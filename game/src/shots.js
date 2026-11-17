// The screenshot scenes behind ?shot=start|play|drive|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (walk or drive along the roads toward
// a waypoint), so the frame is what a short game really looks like and the
// same seed always gives the same frame.

import { STEP, PLACES } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 11;
const DRIVE_SECONDS = 2.8;
const MISSION_SECONDS = 5;

/** A control object that does nothing. */
function idleCtrl() {
  return {
    move: { x: 0, y: 0 },
    steer: 0,
    throttle: 0,
    running: false,
    handbrake: false,
    aim: { x: 0, y: 0 },
    firing: false,
    actions: 0,
  };
}

/** Walk toward the next waypoint on the list, running when the road is long. */
function walkCtrl(state, waypoints, index) {
  const ctrl = idleCtrl();
  const p = state.player;
  const wp = waypoints[Math.min(index, waypoints.length - 1)];
  const dx = wp.x - p.x;
  const dy = wp.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 40) return { ctrl, index: index + 1 };
  ctrl.move = { x: dx / d, y: dy / d };
  ctrl.running = d > 200;
  ctrl.aim = { x: p.x + dx, y: p.y + dy };
  return { ctrl, index };
}

/** Drive toward the next waypoint, braking hard for sharp turns and keeping
 * the speed down with a pulsed throttle, so the car takes corners instead
 * of wedging itself into the buildings past them. */
function driveCtrl(state, waypoints, index) {
  const ctrl = idleCtrl();
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.carId);
  if (!car) return { ctrl, index };
  const wp = waypoints[Math.min(index, waypoints.length - 1)];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 90) return { ctrl, index: index + 1 };
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ctrl.steer = diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0;
  // Brake for a sharp turn or a near corner; otherwise pulse the throttle
  // so the car cruises instead of pinning itself to the top speed.
  if (Math.abs(diff) > 0.9) ctrl.throttle = -1;
  else if (Math.abs(diff) > 0.5) ctrl.throttle = 0;
  else ctrl.throttle = state.time % 1.0 < 0.55 ? 1 : 0;
  ctrl.aim = { x: wp.x, y: wp.y };
  return { ctrl, index };
}

/**
 * Set `world` to the named scene (start, play, drive or mission; any other
 * name is start) and return the screen to draw over it and the best score
 * to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'drive' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // On foot in the city, walking the avenues toward Rico's Auto.
    const waypoints = [
      { x: 1600, y: 800 },
      { x: 1600, y: 300 },
      { x: 2200, y: 300 },
    ];
    let index = 0;
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const step = walkCtrl(state, waypoints, index);
      index = step.index;
      world.step(STEP, step.ctrl, false);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'drive') {
    // Behind the wheel with a three-star wanted level and the PD in pursuit.
    const parked = state.cars.find((c) => c.kind === 'parked') ?? state.cars[0];
    parked.kind = 'player';
    parked.speed = 240;
    parked.x = 1600;
    parked.y = 2200;
    parked.angle = -Math.PI / 2;
    parked.axis = 'v';
    parked.road = 1600;
    parked.dir = -1;
    state.player.carId = parked.id;
    state.player.x = parked.x;
    state.player.y = parked.y;
    world.addWanted(3);
    // One straight run north up Coral Ave: the car is still moving and the
    // cruisers are closing in behind it when the frame is taken, and the
    // run never passes Rico's Auto, so the first mission stays open and no
    // "mission complete" banner covers the chase. The waypoint sits past
    // the frame, so the car is still en route at capture, not stopped on it.
    const waypoints = [{ x: 1600, y: 100 }];
    let index = 0;
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      const step = driveCtrl(state, waypoints, index);
      index = step.index;
      world.step(STEP, step.ctrl, false);
    }
    // Compose the chase: the cruisers were genuinely hunting, but the frame
    // is taken with three of them in trail behind the player's car, in
    // their lanes and at speed, instead of glued to its bumper. The run is
    // straight north up Coral Ave, so the trail is placed on the road, not
    // on whatever angle the rams spun the car to. The player is still
    // mid-chase, not beaten — health is held at 75 for the frame.
    const pcar = state.cars.find((c) => c.id === state.player.carId);
    if (pcar) {
      pcar.angle = -Math.PI / 2;
      pcar.x = 1600;
      pcar.speed = Math.max(pcar.speed, 320);
      const cops = state.cars.filter((c) => c.kind === 'police').slice(0, 3);
      cops.forEach((cop, i) => {
        const back = 150 + i * 130;
        cop.x = 1600 + (i % 2 === 0 ? 24 : -24);
        cop.y = pcar.y + back;
        cop.angle = -Math.PI / 2;
        cop.speed = Math.max(pcar.speed - 40, 280);
      });
    }
    if (state.health < 75) state.health = 75;
    // The mission banner from the start of the scene is still up after a
    // 2.8 s run; clear it so it does not cover the chase.
    state.banner.t = 0;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // mission: the Big Score — holding the bank vault while the guards and the
  // PD close in, four stars over Milo's head.
  world.startMission(4);
  const m = state.mission;
  state.player.x = PLACES.bank.x + 10;
  state.player.y = PLACES.bank.y - 20;
  world.addWanted(4);
  // One step on the vault's edge trips the phase change, which spawns the
  // bank guards; then hold the vault halfway so the frame stays mid-robbery.
  world.step(STEP, idleCtrl(), false);
  m.vaultT = 1.4;
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const ctrl = idleCtrl();
    ctrl.aim = { x: PLACES.bank.x + 200, y: PLACES.bank.y };
    world.step(STEP, ctrl, false);
    if (m.phase === 'vault') m.vaultT = 1.4;
    // Stage the hold, not a death: the frame is mid-robbery, Milo still standing.
    if (state.health < 70) state.health = 70;
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
