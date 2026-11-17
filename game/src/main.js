// Boot and the one loop: actions are taken once per frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. Screens: title,
// play, paused, busted and story complete.
//
// ?seed=N fixes the city. ?shot=start|play|drive|mission (with
// &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { createWorld, EVENT_BUST, EVENT_MISSION } from './world.js';
import {
  ACT_CONTINUE,
  ACT_INTERACT,
  ACT_MUTE,
  ACT_PAUSE,
  ACT_RELOAD,
  ACT_RETRY,
  ACT_START,
  createInput,
} from './input.js';
import { AudioEngine } from './audio.js';
import {
  SCREEN_BUSTED,
  SCREEN_COMPLETE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 11;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = new AudioEngine();

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // The camera lerps toward the player, so snap it onto the player
  // before the first paint — otherwise the staged frame shows a
  // random stretch of city instead of the action.
  renderer.camera.x = world.state.player.x;
  renderer.camera.y = world.state.player.y;
  // Test-only handle so a screenshot run can read the staged state.
  window.__solmar = { world, camera: renderer.camera, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, world.objective(), readSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let frameActions = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(continueSave) {
    audio.ensure();
    world.startGame(continueSave);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(continueSave ? 'Continuing your save.' : 'Playing. Steal a car for Rico.');
  }

  function handleActions() {
    frameActions = input.takeActions();
    if (frameActions & ACT_MUTE) {
      audio.ensure();
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (frameActions & ACT_CONTINUE && readSave()) startGame(true);
      else if (frameActions & ACT_START) startGame(false);
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_COMPLETE) {
      if (frameActions & (ACT_START | ACT_RETRY)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (frameActions & (ACT_PAUSE | ACT_START)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (frameActions & ACT_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (frameActions & ACT_RETRY && world.state.mission.stage === 'failed') {
        world.startMission(world.state.mission.index);
        announce('Retrying the job.');
      }
    }
  }

  function buildControls() {
    const aim = renderer.toWorld(input.mouse.x, input.mouse.y);
    return {
      axis: input.axis(),
      run: input.run(),
      brake: input.brake(),
      up: input.up(),
      down: input.held('KeyS') || input.held('ArrowDown'),
      left: input.held('KeyA') || input.held('ArrowLeft'),
      right: input.held('KeyD') || input.held('ArrowRight'),
      interact: Boolean(frameActions & ACT_INTERACT),
      reload: Boolean(frameActions & ACT_RELOAD),
      aimX: aim.x,
      aimY: aim.y,
      shoot: input.mouse.down,
      click: input.takeClick(),
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, null);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, buildControls(), audio);
    if (events & EVENT_BUST) {
      world.bust();
      screen = SCREEN_BUSTED;
      audio.bust();
      announce('Busted. You kept 80% of your cash.');
    } else if (events & EVENT_MISSION) {
      audio.jingle();
      if (world.state.storyDone) {
        screen = SCREEN_COMPLETE;
        announce('Story complete. Solmar is yours.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, world.objective(), readSave());
  }

  // Leaving the tab pauses a running game rather than letting the
  // heat rise unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A test-only handle so scripted playtests can read the world; it
  // changes nothing about play.
  window.__solmar = {
    world,
    get screen() {
      return screen;
    },
    start: (continueSave) => startGame(continueSave),
  };

  announce('SOLMAR, Streets of Gold. Press Space to start, C to continue a save.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
