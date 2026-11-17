// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, busted and the story-complete screen. Progress — cash and
// the mission reached — is saved to localStorage whenever a job ends and
// when the player is busted, and a saved game can be continued from the
// title screen.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|drive|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), seed, audio);
const renderer = createRenderer(canvas);

// Handy for scripted play-tests: the live world, readable from the console.
window.__solmar = world;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save.money !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best run then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const save = readSave();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: readBest(),
      hasSave: !!save,
      saveMoney: save?.money ?? 0,
      saveMission: save?.missionIndex ?? 0,
      muted: false,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  // Reset once at boot so the title screen already has a living city behind
  // it; startGame resets again with the chosen save.
  world.reset();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let muted = false;
  let winShown = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(saved) {
    world.reset(saved ?? undefined);
    winShown = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    const mission = MISSIONS[world.state.mission.index];
    announce(saved ? `Continuing. Mission ${world.state.mission.index + 1}: ${mission?.title ?? ''}.` : 'Playing. Mission 1: Wheels Up.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    const kept = Math.floor(world.state.money * 0.8);
    world.state.money = kept;
    writeSave();
    if (kept > best) {
      best = kept;
      saveBest(best);
    }
    audio.engine(0);
    audio.siren(false);
    announce(`Busted. You kept $${kept}. Best $${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(null);
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        if (screen === SCREEN_WIN) {
          screen = SCREEN_PLAY;
          announce('Back on the streets. Free roam.');
        } else {
          startGame({ money: world.state.money, missionIndex: world.state.mission.index });
        }
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        audio.engine(0);
        audio.siren(false);
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x, mouse.y);
    const ctrl = {
      move: input.move(),
      steer: input.steer(),
      throttle: input.throttle(),
      running: input.running(),
      handbrake: input.handbrake(),
      aim,
      firing: mouse.down,
      actions,
    };
    const events = world.step(STEP, ctrl, false);
    const p = world.state.player;
    const car = world.playerCar();
    audio.engine(car ? Math.abs(car.speed) / 460 : 0);
    audio.siren(world.state.wanted > 0);
    if (events & EVENT_BUSTED) endGame();
    else if (events & EVENT_MISSION_DONE) {
      writeSave();
      save = readSave();
      if (world.state.money > best) {
        best = world.state.money;
        saveBest(best);
      }
      announce(`Mission complete. $${world.state.money}.`);
      if (world.state.storyDone && !winShown) {
        winShown = true;
        screen = SCREEN_WIN;
        audio.engine(0);
        audio.siren(false);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses are delivered to the first step only: a second step
      // in the same frame must not re-enter or re-exit the same car.
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      hasSave: !!save,
      saveMoney: save?.money ?? 0,
      saveMission: save?.missionIndex ?? 0,
      muted,
    });
  }

  // Leaving the tab pauses a running game rather than letting the PD close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.engine(0);
      audio.siren(false);
      announce('Paused.');
    }
  });

  // KeyC continues a saved game from the title screen; Space (or a click)
  // starts a new one. It is bound here, not through the action flags, so a
  // click still means "new game".
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && save) {
      audio.unlock();
      startGame(save);
    }
  });

  announce('Solmar. Press Space for a new game, or C to continue.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
