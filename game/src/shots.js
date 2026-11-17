// The screenshot scenes behind ?shot=start|play|drive|mission. Each one
// plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short
// game really looks like and the same seed always gives a similar frame.
// The chase and vault frames are composed after real play forward —
// the cruisers are placed in trail and the health is held — and the
// report says so; the rules, traffic, police and mission logic in them
// are real, only the framing is staged.
import { PLACES, STEP, TUNE } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI;
  return d;
}

function blankControls() {
  return {
    axis: { x: 0, y: 0 },
    run: false,
    brake: false,
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
    reload: false,
    aimX: 0,
    aimY: 0,
    shoot: false,
    click: false,
  };
}

function nearestParkedTo(world, x, y) {
  let best = null;
  let bestD = 1e9;
  for (const car of world.state.cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function nearestParked(world) {
  const p = world.state.player;
  return nearestParkedTo(world, p.x, p.y);
}

// Walk the player toward a point, one step at a time.
function walkToward(world, x, y, frames, audio) {
  for (let i = 0; i < frames; i++) {
    const p = world.state.player;
    const c = blankControls();
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) return true;
    c.axis = { x: dx / d, y: dy / d };
    c.run = true;
    c.aimX = p.x + dx;
    c.aimY = p.y + dy;
    world.step(STEP, c, audio);
  }
  return false;
}

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'start') {
    world.reset(true);
    for (let i = 0; i < 300; i++) world.step(STEP, null, null);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'play') {
    world.startGame(false);
    // Walk to the parked car nearest the city centre, so the frame is
    // streets and buildings, not the map edge.
    const car = nearestParkedTo(world, 1800, 600);
    if (car) walkToward(world, car.x, car.y, 900, null);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'drive') {
    world.startGame(false);
    // Steal the parked car nearest the central avenue, then drive it.
    let car = nearestParkedTo(world, 1800, 600);
    if (car) {
      walkToward(world, car.x, car.y, 900, null);
      const p = world.state.player;
      if (Math.hypot(car.x - p.x, car.y - p.y) < 60) {
        const c = blankControls();
        c.interact = true;
        world.step(STEP, c, null);
      }
    }
    if (!world.state.player.inCar) {
      // Fallback if the walk missed: stage the player beside the car.
      car = nearestParked(world);
      const p = world.state.player;
      if (car) {
        p.x = car.x + 40;
        p.y = car.y;
        const c = blankControls();
        c.interact = true;
        world.step(STEP, c, null);
      }
    }
    const p = world.state.player;
    // Heat: four stars, so the cruisers come.
    state.wanted = 4;
    // Stage the stolen car onto the central avenue (x = 1800), facing
    // south, so the run is a straight chase with buildings on both
    // sides — not a slow turn out of a side street.
    if (p.inCar) {
      p.x = 1800;
      p.y = 500;
      p.car.x = 1800;
      p.car.y = 500;
      p.car.angle = Math.PI / 2;
      p.car.speed = 0;
    }
    // Clear the corridor ahead so the run does not wedge into crossing traffic.
    const roadX = 1800;
    // Clear the corridor ahead so the run does not wedge into crossing traffic.
    state.cars = state.cars.filter((c) => {
      if (c.kind !== 'traffic') return true;
      return !(Math.abs(c.x - roadX) < 90 && c.y > p.y - 100 && c.y < p.y + 1100);
    });
    // Drive south along the avenue for 2.8 seconds.
    for (let i = 0; i < 170; i++) {
      const c = blankControls();
      const pl = world.state.player;
      if (!pl.inCar) break;
      const targetAngle = Math.atan2(pl.y + 300 - pl.y, roadX - pl.x);
      const diff = angleDiff(pl.car.angle, targetAngle);
      c.up = true;
      c.left = diff > 0.08;
      c.right = diff < -0.08;
      c.aimX = pl.x;
      c.aimY = pl.y;
      world.step(STEP, c, null);
    }
    // Compose the frame: the cruisers in trail, speed and health held.
    const pl = world.state.player;
    if (pl.inCar) {
      pl.car.speed = 380;
      pl.hp = 75;
      state.wanted = 4;
      const back = pl.car.angle + Math.PI;
      const px = Math.cos(back);
      const py = Math.sin(back);
      const sx = Math.cos(back + Math.PI / 2);
      const sy = Math.sin(back + Math.PI / 2);
      while (state.cruisers.length < 3) {
        state.cruisers.push({
          x: pl.x, y: pl.y, angle: pl.car.angle, speed: 380, ramCd: 0, leaving: false,
        });
      }
      state.cruisers.slice(0, 4).forEach((cr, i) => {
        const d = 95 + i * 60;
        const side = i === 1 ? -26 : i === 2 ? 26 : i === 3 ? -52 : 0;
        cr.x = pl.x + px * d + sx * side;
        cr.y = pl.y + py * d + sy * side;
        cr.angle = pl.car.angle;
        cr.speed = 380;
        cr.leaving = false;
      });
      // Any cruiser past the first four would sit elsewhere in the
      // frame: fold them into the trail too.
      state.cruisers.slice(4).forEach((cr, i) => {
        const d = 335 + i * 60;
        cr.x = pl.x + px * d;
        cr.y = pl.y + py * d;
        cr.angle = pl.car.angle;
        cr.speed = 380;
        cr.leaving = false;
      });
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    world.startGame(false);
    const p = world.state.player;
    // Stage the player at the bank door, then let the real rules run:
    // walking into the vault radius starts the hold and spawns guards.
    p.x = PLACES.bank.x - 40;
    p.y = PLACES.bank.y + 90;
    world.startMission(4);
    state.wanted = 4;
    for (let i = 0; i < 30; i++) {
      const c = blankControls();
      c.aimX = p.x;
      c.aimY = p.y;
      world.step(STEP, c, null);
    }
    // Stand in the vault circle while the guards close in.
    for (let i = 0; i < 120; i++) {
      const c = blankControls();
      c.aimX = p.x + 100;
      c.aimY = p.y;
      world.step(STEP, c, null);
      world.state.player.hp = 70;
    }
    // Hold the frame mid-robbery: vault just past halfway.
    state.mission.vault = TUNE.vaultTime * 0.55;
    state.player.hp = 70;
    return { screen: SCREEN_PLAY };
  }

  // Unknown scene: the title.
  world.reset(true);
  return { screen: SCREEN_TITLE };
}
