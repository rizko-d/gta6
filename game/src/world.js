// The game's rules and state, with no drawing and no browser in it:
// the player on foot and by car, traffic, pedestrians, police, the
// wanted level, combat, pickups and the five-mission story. step()
// advances one fixed step from a plain controls snapshot, so the loop
// and the screenshot scenes drive the same code.
import { MISSIONS, PLACES, ROADS_H, ROADS_V, ROAD_HALF, TUNE, WORLD } from './config.js';
import { buildCity, collideCircle, isRoad, pointBlocked } from './city.js';
import { RNG } from './random.js';

export const EVENT_BUST = 1;
export const EVENT_MISSION = 2;
export const EVENT_FAIL = 4;
export const EVENT_PICKUP = 8;

const TAU = Math.PI * 2;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * clamp(t, -1, 1);
}

export function createWorld(seed = 11) {
  const rng = new RNG(seed);
  const city = buildCity(seed);

  const state = {
    city,
    time: 0,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    cruisers: [],
    guards: [],
    bullets: [],
    particles: [],
    pickups: [],
    courier: null,
    wanted: 0,
    heatTimer: 0,
    mission: { index: 0, stage: 'steal', timer: 0, spotted: 0, vault: 0, safe: 0, hasPackage: false },
    storyDone: false,
    banner: { text: '', sub: '', t: 0 },
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    attract: true,
  };

  function setBanner(text, sub = '', seconds = 3) {
    state.banner = { text, sub, t: seconds };
  }

  function spawnParkedCar() {
    const vertical = rng.chance(0.5);
    const road = rng.pick(vertical ? ROADS_V : ROADS_H);
    const along = rng.range(300, WORLD.w - 300);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * 72 : along;
    const y = vertical ? along : road + side * 72;
    if (pointBlocked(city, x, y)) return;
    state.cars.push({
      kind: 'parked',
      x,
      y,
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI,
      speed: 0,
      hp: 100,
      color: rng.pick(['#c94f43', '#4f7ec9', '#5aa37a', '#c9c9c9', '#7a5aa3', '#d08a3c']),
      bumpCd: 0,
    });
  }

  function spawnTrafficCar(near) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(vertical ? ROADS_V : ROADS_H);
    const dir = rng.chance(0.5) ? 1 : -1;
    let x;
    let y;
    if (near) {
      const a = rng.range(-1, 1);
      x = vertical ? road + dir * 22 : state.player.x + a * 500;
      y = vertical ? state.player.y + a * 500 : road + dir * 22;
      x = clamp(x, 120, WORLD.w - 120);
      y = clamp(y, 120, WORLD.h - 120);
    } else {
      const along = rng.range(150, (vertical ? WORLD.h : WORLD.w) - 150);
      x = vertical ? road + dir * 22 : along;
      y = vertical ? along : road + dir * 22;
    }
    state.cars.push({
      kind: 'traffic',
      x,
      y,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      speed: rng.range(110, 170),
      hp: 100,
      color: rng.pick(['#c94f43', '#4f7ec9', '#5aa37a', '#c9c9c9', '#7a5aa3', '#d08a3c']),
      axis: vertical ? 'v' : 'h',
      dir,
      bumpCd: 0,
    });
  }

  function spawnPed(near) {
    let x;
    let y;
    for (let tries = 0; tries < 12; tries++) {
      x = near ? state.player.x + rng.range(-500, 500) : rng.range(100, WORLD.w - 100);
      y = near ? state.player.y + rng.range(-500, 500) : rng.range(100, WORLD.h - 100);
      if (!isRoad(x, y) && !pointBlocked(city, x, y)) break;
    }
    state.peds.push({
      x: clamp(x, 60, WORLD.w - 60),
      y: clamp(y, 60, WORLD.h - 60),
      vx: 0,
      vy: 0,
      tx: x,
      ty: y,
      hp: 1,
      dead: false,
      deadT: 0,
      fleeT: 0,
      color: rng.pick(['#e8e0d0', '#d08a8a', '#8ab0d0', '#d0c08a', '#a08ad0']),
    });
  }

  function spawnPickup(near) {
    let x = rng.range(200, WORLD.w - 200);
    let y = rng.range(200, WORLD.h - 200);
    if (near) {
      x = clamp(state.player.x + rng.range(-450, 450), 100, WORLD.w - 100);
      y = clamp(state.player.y + rng.range(-450, 450), 100, WORLD.h - 100);
    }
    if (isRoad(x, y) || pointBlocked(city, x, y)) return;
    state.pickups.push({ x, y, amount: rng.int(3, 8) * 10 });
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      const s = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rng.range(0.25, 0.6),
        max: 0.6,
        color,
        size: rng.range(2, 4.5),
      });
    }
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
  }

  function nearestCar(x, y, kinds, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of state.cars) {
      if (kinds && !kinds.includes(c.kind)) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function startMission(index) {
    const m = state.mission;
    m.index = index;
    m.timer = 0;
    m.spotted = 0;
    m.vault = 0;
    m.safe = 0;
    m.hasPackage = false;
    state.guards = [];
    if (index >= MISSIONS.length) {
      m.stage = 'done';
      return;
    }
    const def = MISSIONS[index];
    if (index === 0) m.stage = 'steal';
    else if (index === 1) m.stage = 'goto';
    else if (index === 2) m.stage = 'find';
    else if (index === 3) {
      m.stage = 'escape';
      state.wanted = 3;
    } else if (index === 4) m.stage = 'bank';
    setBanner(`Mission ${index + 1}: ${def.name}`, def.brief, 4);
    if (index === 2) spawnCourier();
  }

  function spawnCourier() {
    const loop = [
      { x: 1400, y: 600 },
      { x: 2200, y: 600 },
      { x: 2200, y: 1400 },
      { x: 1400, y: 1400 },
    ];
    state.courier = {
      car: {
        kind: 'courier',
        x: 1400,
        y: 900,
        angle: Math.PI / 2,
        speed: 135,
        hp: 200,
        color: '#e8e8e8',
        bumpCd: 0,
      },
      loop,
      wp: 0,
    };
    state.cars.push(state.courier.car);
  }

  function completeMission() {
    const def = MISSIONS[state.mission.index];
    state.player.money += def.reward;
    setBanner(`${def.name} complete`, `+$${def.reward}`, 4);
    state.mission.index += 1;
    if (state.mission.index >= MISSIONS.length) {
      state.storyDone = true;
      state.mission.stage = 'done';
      saveProgress();
      return EVENT_MISSION;
    }
    saveProgress();
    startMission(state.mission.index);
    return EVENT_MISSION;
  }

  function failMission(reason) {
    setBanner('Job failed', `${reason} — press Enter to retry`, 4);
    // The stage parks on 'failed' until the player presses Enter;
    // the mission machine does nothing in that stage.
    state.mission.stage = 'failed';
    return EVENT_FAIL;
  }

  function saveProgress() {
    try {
      window.localStorage.setItem('solmar-save-v1', JSON.stringify({
        money: state.player.money,
        missionIndex: state.mission.index,
        missions: state.mission.index,
      }));
    } catch {
      // Storage off: the save lasts this visit only.
    }
  }

  function reset(attract = false) {
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.cruisers = [];
    state.guards = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.courier = null;
    state.wanted = 0;
    state.heatTimer = 0;
    state.storyDone = false;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.attract = attract;
    state.player = {
      x: PLACES.start.x,
      y: PLACES.start.y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      money: 150,
      ammo: TUNE.pistolAmmo,
      inCar: false,
      car: null,
      reloadT: 0,
      shootCd: 0,
      hurtCd: 0,
      wallCd: 0,
    };
    state.mission = { index: 0, stage: 'steal', timer: 0, spotted: 0, vault: 0, safe: 0, hasPackage: false };
    for (let i = 0; i < 6; i++) spawnParkedCar();
    for (let i = 0; i < 14; i++) spawnTrafficCar(false);
    for (let i = 0; i < 18; i++) spawnPed(false);
    for (let i = 0; i < 8; i++) spawnPickup(false);
    if (!attract) startMission(0);
  }

  function startGame(continueSave) {
    reset(false);
    if (continueSave) {
      try {
        const save = JSON.parse(window.localStorage.getItem('solmar-save-v1') ?? 'null');
        if (save && typeof save.money === 'number') {
          state.player.money = save.money;
          startMission(Math.min(save.missionIndex | 0, MISSIONS.length - 1));
        }
      } catch {
        // A corrupt save starts fresh.
      }
    }
  }

  function bust() {
    const p = state.player;
    p.money = Math.floor(p.money * 0.8);
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y;
    p.vx = 0;
    p.vy = 0;
    p.hp = 100;
    p.inCar = false;
    p.car = null;
    p.ammo = TUNE.pistolAmmo;
    state.wanted = 0;
    state.cops = [];
    state.cruisers = [];
    state.guards = [];
    state.bullets = [];
    startMission(state.mission.index);
    saveProgress();
  }

  function objective() {
    const m = state.mission;
    if (state.storyDone) return { text: 'Free roam — Solmar is yours', x: null, y: null, progress: null };
    switch (m.index) {
      case 0:
        if (m.stage === 'steal') {
          const car = nearestCar(state.player.x, state.player.y, ['parked', 'traffic'], 4000);
          return { text: 'Steal a car', x: car ? car.x : null, y: car ? car.y : null, progress: null };
        }
        return { text: "Drive to Rico's Auto", x: PLACES.rico.x, y: PLACES.rico.y, progress: null };
      case 1:
        if (m.stage === 'goto') return { text: 'Pick up the package at the docks', x: PLACES.docks.x, y: PLACES.docks.y, progress: null };
        return { text: 'Take the package to Rico', x: PLACES.rico.x, y: PLACES.rico.y, progress: null };
      case 2:
        if (m.stage === 'find') {
          return {
            text: 'Find the courier',
            x: state.courier ? state.courier.car.x : PLACES.courierLoop.x,
            y: state.courier ? state.courier.car.y : PLACES.courierLoop.y,
            progress: null,
          };
        }
        if (m.stage === 'failed') return { text: 'Spotted! Press Enter to retry', x: null, y: null, progress: null };
        return {
          text: 'Tail the courier — keep your distance',
          x: state.courier ? state.courier.car.x : null,
          y: state.courier ? state.courier.car.y : null,
          progress: clamp(m.timer / TUNE.tailTime, 0, 1),
        };
      case 3:
        return { text: 'Lose the heat — get to the garage', x: PLACES.rico.x, y: PLACES.rico.y, progress: clamp(m.safe / 5, 0, 1) };
      case 4:
        if (m.stage === 'bank') return { text: 'Get to Solmar National Bank', x: PLACES.bank.x, y: PLACES.bank.y, progress: null };
        if (m.stage === 'vault') {
          return { text: 'Hold the vault — stay in the circle', x: PLACES.bank.x, y: PLACES.bank.y, progress: clamp(m.vault / TUNE.vaultTime, 0, 1) };
        }
        return { text: 'Run! Get to the east side', x: PLACES.escape.x, y: PLACES.escape.y, progress: null };
      default:
        return { text: '', x: null, y: null, progress: null };
    }
  }

  function fireBullet(from, x, y, angle, damage, speed) {
    state.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.55,
      from,
      damage,
    });
  }

  function stepPlayer(dt, c, audio) {
    const p = state.player;
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.wallCd = Math.max(0, p.wallCd - dt);
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.ammo = TUNE.pistolAmmo;
        if (audio) audio.reload();
      }
    }

    if (p.inCar && p.car) {
      const car = p.car;
      const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      const throttle = c.up ? 1 : 0;
      const braking = c.down ? 1 : 0;
      if (throttle) car.speed += TUNE.carAccel * dt;
      if (braking) car.speed -= (car.speed > 0 ? TUNE.carBrake : 520) * dt;
      car.speed -= car.speed * 0.45 * dt;
      if (c.brake) {
        car.speed -= car.speed * 2.2 * dt;
      }
      car.speed = clamp(car.speed, -TUNE.carReverseMax, TUNE.carTop);
      const turnAuthority = clamp(Math.abs(car.speed) / 180, 0, 1) * (c.brake ? 1.6 : 1);
      car.angle += steer * TUNE.carTurn * turnAuthority * dt * (car.speed >= 0 ? 1 : -1);
      const ox = car.x;
      const oy = car.y;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const hitWall = collideCircle(city, car, TUNE.carRadius, Math.abs(car.speed));
      if (hitWall) {
        if (Math.abs(car.speed) > 200 && p.wallCd <= 0) {
          p.hp -= 5;
          p.wallCd = 1;
          burst(car.x, car.y, '#ffb84d', 8, 160);
        }
        car.speed *= 0.5;
      }
      // The player rides the car.
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (c.interact) {
        // Bail out at any speed — a fast bail hurts and flings the
        // player forward. E must always work: a tap while rolling
        // that does nothing reads as a broken key.
        const fast = Math.abs(car.speed) > 200;
        const side = car.angle + Math.PI / 2;
        p.x = car.x + Math.cos(side) * 34;
        p.y = car.y + Math.sin(side) * 34;
        collideCircle(city, p, 14);
        p.inCar = false;
        p.car = null;
        car.kind = 'parked';
        car.speed = 0;
        if (fast) {
          p.hp -= 5;
          p.vx = Math.cos(car.angle) * 160;
          p.vy = Math.sin(car.angle) * 160;
          burst(p.x, p.y, '#ffb84d', 6, 120);
        }
      }
      if (audio) audio.setEngine(Math.abs(car.speed) / TUNE.carTop);
      return;
    }

    if (audio) audio.setEngine(0);
    // On foot.
    const ax = c.axis.x;
    const ay = c.axis.y;
    const len = Math.hypot(ax, ay) || 1;
    const maxSpeed = c.run ? TUNE.footRun : TUNE.footWalk;
    p.vx += (ax / len) * TUNE.footAccel * dt * (ax || ay ? 1 : 0);
    p.vy += (ay / len) * TUNE.footAccel * dt * (ax || ay ? 1 : 0);
    const drag = Math.max(0, 1 - 8 * dt);
    if (!ax && !ay) {
      p.vx *= drag;
      p.vy *= drag;
    }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxSpeed) {
      p.vx = (p.vx / sp) * maxSpeed;
      p.vy = (p.vy / sp) * maxSpeed;
    }
    p.x += p.vx * dt;
    collideCircle(city, p, 14);
    p.y += p.vy * dt;
    collideCircle(city, p, 14);
    p.angle = angleTo(p.x, p.y, c.aimX, c.aimY);

    if (c.interact) {
      const car = nearestCar(p.x, p.y, ['parked', 'traffic'], 55);
      if (car) {
        if (car.kind === 'traffic') {
          addWanted(1);
          // The driver bails and runs.
          state.peds.push({
            x: car.x + 30, y: car.y + 30, vx: 0, vy: 0, tx: car.x + 200, ty: car.y + 200,
            hp: 1, dead: false, deadT: 0, fleeT: 2, color: '#d08a8a',
          });
          setBanner('Carjacked!', 'The law is coming', 2);
        }
        car.kind = 'player';
        car.speed = 0;
        p.inCar = true;
        p.car = car;
        p.vx = 0;
        p.vy = 0;
      }
    }

    if (c.reload && p.ammo < TUNE.pistolAmmo && p.reloadT <= 0) {
      p.reloadT = 0.9;
    }
    if ((c.click || c.shoot) && p.shootCd <= 0 && p.reloadT <= 0) {
      if (p.ammo > 0) {
        p.ammo -= 1;
        p.shootCd = TUNE.pistolCooldown;
        state.shotsFired += 1;
        const a = angleTo(p.x, p.y, c.aimX, c.aimY);
        fireBullet('player', p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a, TUNE.pistolDamage, 900);
        burst(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#ffd34d', 3, 120);
        // Gunfire in the open draws the law, even before it hits anyone.
        if (state.wanted === 0) addWanted(1);
        if (audio) audio.shot();
      } else if (audio) {
        audio.blip(220, 0.05, 'square', 0.06);
      }
    }
  }

  function stepTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.kind !== 'traffic' && car.kind !== 'courier') continue;
      if (car.kind === 'courier') continue; // the courier has its own driver
      // Brake for a car ahead in the same lane.
      let ahead = null;
      let aheadD = 90;
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const along = car.axis === 'v' ? dy * car.dir : dx * car.dir;
        const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
        if (along > 0 && along < aheadD && side < 30) {
          ahead = other;
          aheadD = along;
        }
      }
      let target = car.speed;
      if (ahead && aheadD < 75) target = Math.min(target, 40);
      else if (ahead) target = Math.min(target, 120);
      else target = rng.range(120, 170);
      car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
      // Maybe turn at an intersection.
      const cross = car.axis === 'v' ? ROADS_H : ROADS_V;
      for (const rc of cross) {
        const pos = car.axis === 'v' ? car.y : car.x;
        if (Math.abs(pos - rc) < 34 && rng.chance(0.004)) {
          car.axis = car.axis === 'v' ? 'h' : 'v';
          car.dir = rng.chance(0.5) ? 1 : -1;
          if (car.axis === 'v') {
            car.y = rc;
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            car.x = rc;
            car.angle = car.dir > 0 ? 0 : Math.PI;
          }
          break;
        }
      }
      const nx = car.x + (car.axis === 'v' ? 0 : car.dir * car.speed * dt);
      const ny = car.y + (car.axis === 'v' ? car.dir * car.speed * dt : 0);
      car.x = nx;
      car.y = ny;
      // A traffic car that hits the player on foot hurts.
      if (!p.inCar && p.hurtCd <= 0 && dist(car.x, car.y, p.x, p.y) < 28 && Math.abs(car.speed) > 60) {
        p.hp -= 8;
        p.hurtCd = 1;
        p.vx += (p.x - car.x) * 4;
        p.vy += (p.y - car.y) * 4;
        burst(p.x, p.y, '#ff5a4d', 8, 140);
      }
    }
    // Despawn traffic that drifted far from the player; respawn near them.
    // Collected after the loop so the array is never mutated mid-iteration.
    let far = 0;
    for (const car of state.cars) {
      if (car.kind === 'traffic' && dist(car.x, car.y, p.x, p.y) > 1400) far += 1;
    }
    if (far > 0) {
      state.cars = state.cars.filter((c) => !((c.kind === 'traffic') && dist(c.x, c.y, p.x, p.y) > 1400));
      for (let i = 0; i < far; i++) spawnTrafficCar(true);
    }
      // Car-to-car bumps: push apart and trade speed once per contact.
    for (let i = 0; i < state.cars.length; i++) {
      const a = state.cars[i];
      a.bumpCd = Math.max(0, a.bumpCd - dt);
      for (let j = i + 1; j < state.cars.length; j++) {
        const b = state.cars[j];
        if (a.kind === 'parked' && b.kind === 'parked') continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 38 && d > 0.01 && a.bumpCd <= 0) {
          const push = (38 - d) / 2;
          const ux = (b.x - a.x) / d;
          const uy = (b.y - a.y) / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg * 0.7;
          b.speed = avg * 0.7;
          a.bumpCd = 0.25;
          b.bumpCd = 0.25;
        }
      }
    }
  }

  function stepCourier(dt) {
    const cour = state.courier;
    if (!cour) return;
    const car = cour.car;
    const target = cour.loop[cour.wp];
    const d = dist(car.x, car.y, target.x, target.y);
    if (d < 60) {
      cour.wp = (cour.wp + 1) % cour.loop.length;
      return;
    }
    const want = angleTo(car.x, car.y, target.x, target.y);
    car.angle = angleLerp(car.angle, want, 2.4 * dt);
    car.speed = 135;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  function stepPeds(dt) {
    const p = state.player;
    for (let i = state.peds.length - 1; i >= 0; i--) {
      const ped = state.peds[i];
      if (ped.dead) {
        ped.deadT += dt;
        if (ped.deadT > 1.5) state.peds.splice(i, 1);
        continue;
      }
      ped.fleeT = Math.max(0, ped.fleeT - dt);
      let speed = TUNE.pedSpeed;
      if (ped.fleeT > 0) {
        speed = 130;
        ped.tx = ped.x + (ped.x - p.x);
        ped.ty = ped.y + (ped.y - p.y);
      } else if (dist(ped.x, ped.y, ped.tx, ped.ty) < 20) {
        ped.tx = clamp(ped.x + (Math.random() - 0.5) * 420, 80, WORLD.w - 80);
        ped.ty = clamp(ped.y + (Math.random() - 0.5) * 420, 80, WORLD.h - 80);
      }
      const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.vx = Math.cos(a) * speed;
      ped.vy = Math.sin(a) * speed;
      ped.x += ped.vx * dt;
      ped.y += ped.vy * dt;
      collideCircle(city, ped, 12);
      // Run over by the player's car.
      if (p.inCar && p.car && dist(ped.x, ped.y, p.car.x, p.car.y) < 30 && Math.abs(p.car.speed) > 80) {
        ped.dead = true;
        ped.deadT = 0;
        addWanted(1);
        burst(ped.x, ped.y, '#a03a30', 10, 150);
      }
    }
    if (state.peds.length < 16) spawnPed(true);
  }

  function stepPolice(dt, audio) {
    const p = state.player;
    const inHideout = dist(p.x, p.y, PLACES.rico.x, PLACES.rico.y) < 160;
    // Cruisers: one per wanted star, up to five.
    const wantCruisers = state.wanted > 0 ? Math.min(state.wanted, 5) : 0;
    while (state.cruisers.length < wantCruisers) {
      const a = rng.range(0, TAU);
      const r = rng.range(550, 750);
      let x = clamp(p.x + Math.cos(a) * r, 120, WORLD.w - 120);
      let y = clamp(p.y + Math.sin(a) * r, 120, WORLD.h - 120);
      // Put the spawn on a road so the cruiser can reach the player.
      const road = rng.pick(ROADS_V);
      x = road;
      state.cruisers.push({
        x, y, angle: angleTo(x, y, p.x, p.y), speed: 0, ramCd: 0, leaving: false,
      });
    }
    for (let i = state.cruisers.length - 1; i >= 0; i--) {
      const c = state.cruisers[i];
      c.ramCd = Math.max(0, c.ramCd - dt);
      if (state.wanted === 0 || inHideout) c.leaving = true;
      if (c.leaving) {
        const a = angleTo(p.x, p.y, c.x, c.y);
        c.angle = angleLerp(c.angle, a, 2 * dt);
        c.speed = Math.min(c.speed + 300 * dt, 380);
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        if (dist(c.x, c.y, p.x, p.y) > 950) state.cruisers.splice(i, 1);
        continue;
      }
      const want = angleTo(c.x, c.y, p.x, p.y);
      c.angle = angleLerp(c.angle, want, 2.2 * dt);
      c.speed = Math.min(c.speed + 420 * dt, TUNE.cruiserTop);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      collideCircle(city, c, 17);
      const d = dist(c.x, c.y, p.x, p.y);
      if (d < 38 && c.ramCd <= 0) {
        c.ramCd = TUNE.cruiserRamCooldown;
        p.hp -= TUNE.cruiserRamDamage;
        burst(p.x, p.y, '#ffb84d', 8, 160);
        if (p.inCar && p.car) p.car.speed *= 0.6;
      }
    }
    // Foot cops: only when the player is on foot and wanted.
    const wantCops = !p.inCar && state.wanted >= 2 ? Math.min(2 + Math.floor(state.wanted / 2), 5) : 0;
    while (state.cops.length < wantCops) {
      const a = rng.range(0, TAU);
      state.cops.push({
        x: clamp(p.x + Math.cos(a) * 420, 80, WORLD.w - 80),
        y: clamp(p.y + Math.sin(a) * 420, 80, WORLD.h - 80),
        hp: 100,
        shootCd: rng.range(0.5, 1.5),
        bustT: 0,
      });
    }
    for (let i = state.cops.length - 1; i >= 0; i--) {
      const cop = state.cops[i];
      if (state.wanted < 2 || p.inCar) {
        state.cops.splice(i, 1);
        continue;
      }
      cop.shootCd -= dt;
      const d = dist(cop.x, cop.y, p.x, p.y);
      const a = angleTo(cop.x, cop.y, p.x, p.y);
      if (d > 60) {
        cop.x += Math.cos(a) * TUNE.copSpeed * dt;
        cop.y += Math.sin(a) * TUNE.copSpeed * dt;
        collideCircle(city, cop, 13);
      }
      if (d < TUNE.copShotRange && cop.shootCd <= 0) {
        cop.shootCd = TUNE.copShotCooldown;
        fireBullet('cop', cop.x, cop.y, a, TUNE.copShotDamage, 520);
        if (audio) audio.blip(300, 0.06, 'square', 0.05);
      }
      if (d < 26) {
        cop.bustT += dt;
        if (cop.bustT > 1.5) {
          return EVENT_BUST;
        }
      } else {
        cop.bustT = 0;
      }
    }
    if (audio) audio.setSiren(state.wanted > 0, state.time);
    return 0;
  }

  function stepGuards(dt, audio) {
    const p = state.player;
    for (const g of state.guards) {
      g.shootCd -= dt;
      const d = dist(g.x, g.y, p.x, p.y);
      if (d < 450 && d > 90) {
        const a = angleTo(g.x, g.y, p.x, p.y);
        g.x += Math.cos(a) * 130 * dt;
        g.y += Math.sin(a) * 130 * dt;
        collideCircle(city, g, 13);
      }
      if (d < TUNE.guardShotRange && g.shootCd <= 0) {
        g.shootCd = TUNE.guardShotCooldown;
        fireBullet('guard', g.x, g.y, angleTo(g.x, g.y, p.x, p.y), TUNE.guardShotDamage, 520);
        if (audio) audio.blip(260, 0.06, 'square', 0.05);
      }
    }
  }

  function stepBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && pointBlocked(city, b.x, b.y)) {
        burst(b.x, b.y, '#ffd34d', 3, 90);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        for (const ped of state.peds) {
          if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.dead = true;
            ped.deadT = 0;
            state.kills += 1;
            state.shotsHit += 1;
            addWanted(1);
            burst(ped.x, ped.y, '#a03a30', 10, 150);
            // Everyone nearby runs.
            for (const other of state.peds) {
              if (dist(other.x, other.y, ped.x, ped.y) < 300) other.fleeT = 2;
            }
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of state.cops) {
            if (dist(b.x, b.y, cop.x, cop.y) < 14) {
              cop.hp -= b.damage;
              state.shotsHit += 1;
              burst(cop.x, cop.y, '#ff5a4d', 6, 120);
              if (cop.hp <= 0) {
                state.cops.splice(state.cops.indexOf(cop), 1);
                state.kills += 1;
                addWanted(1);
              }
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const g of state.guards) {
            if (dist(b.x, b.y, g.x, g.y) < 14) {
              g.hp -= b.damage;
              state.shotsHit += 1;
              burst(g.x, g.y, '#ff5a4d', 6, 120);
              if (g.hp <= 0) {
                state.guards.splice(state.guards.indexOf(g), 1);
                state.kills += 1;
              }
              dead = true;
              break;
            }
          }
        }
        if (!dead && state.courier && dist(b.x, b.y, state.courier.car.x, state.courier.car.y) < 24) {
          state.courier.car.hp -= b.damage;
          state.shotsHit += 1;
          burst(b.x, b.y, '#ffd34d', 6, 120);
          if (state.courier.car.hp <= 0) {
            return 'courier-dead';
          }
          dead = true;
        }
      }
      if (!dead && (b.from === 'cop' || b.from === 'guard')) {
        if (dist(b.x, b.y, p.x, p.y) < 14 && p.hurtCd <= 0) {
          p.hp -= b.damage;
          p.hurtCd = 0.6;
          burst(p.x, p.y, '#ff5a4d', 6, 120);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return null;
  }

  function stepPickups(dt, audio) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      const d = dist(pk.x, pk.y, p.x, p.y);
      if (d < 50) {
        const a = angleTo(pk.x, pk.y, p.x, p.y);
        pk.x += Math.cos(a) * 220 * dt;
        pk.y += Math.sin(a) * 220 * dt;
      }
      if (d < 26) {
        p.money += pk.amount;
        if (audio) audio.pickup();
        burst(pk.x, pk.y, '#7ddc7d', 6, 100);
        state.pickups.splice(i, 1);
      }
    }
    if (state.pickups.length < 8) spawnPickup(true);
  }

  function stepMission(dt) {
    const m = state.mission;
    const p = state.player;
    if (state.storyDone || state.attract) return 0;
    let events = 0;
    switch (m.index) {
      case 0: {
        if (m.stage === 'steal' && p.inCar) m.stage = 'drive';
        else if (m.stage === 'drive' && p.inCar && dist(p.x, p.y, PLACES.rico.x, PLACES.rico.y) < 100) {
          events |= completeMission();
        }
        break;
      }
      case 1: {
        if (m.stage === 'goto' && dist(p.x, p.y, PLACES.docks.x, PLACES.docks.y) < 70) {
          m.hasPackage = true;
          m.stage = 'return';
          setBanner('Package secured', "Take it to Rico's Auto", 3);
        } else if (m.stage === 'return' && dist(p.x, p.y, PLACES.rico.x, PLACES.rico.y) < 100) {
          events |= completeMission();
        }
        break;
      }
      case 2: {
        const cour = state.courier;
        if (!cour) break;
        const d = dist(p.x, p.y, cour.car.x, cour.car.y);
        if (m.stage === 'find' && d < 400) {
          m.stage = 'tail';
          setBanner('Tail Job', 'Follow for 20 seconds — stay back', 3);
        } else if (m.stage === 'tail') {
          if (d >= TUNE.tailMin && d <= TUNE.tailMax) {
            m.timer += dt;
            m.spotted = 0;
          } else if (d < TUNE.tailMin) {
            m.spotted += dt;
            if (m.spotted > 1.2) {
              m.stage = 'failed';
              events |= failMission('You were spotted');
            }
          }
          if (m.timer >= TUNE.tailTime) events |= completeMission();
        }
        break;
      }
      case 3: {
        const inGarage = dist(p.x, p.y, PLACES.rico.x, PLACES.rico.y) < 140;
        const nearestCruiser = state.cruisers.reduce((best, c) => Math.min(best, dist(c.x, c.y, p.x, p.y)), 1e9);
        if (inGarage && nearestCruiser > 300) {
          m.safe += dt;
          if (m.safe >= 5) {
            state.wanted = 0;
            events |= completeMission();
          }
        } else {
          m.safe = 0;
        }
        break;
      }
      case 4: {
        if (m.stage === 'bank' && dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < 130) {
          m.stage = 'vault';
          m.vault = 0;
          state.guards = [
            { x: PLACES.bank.x - 60, y: PLACES.bank.y - 70, hp: 100, shootCd: 1 },
            { x: PLACES.bank.x + 70, y: PLACES.bank.y - 60, hp: 100, shootCd: 1.4 },
            { x: PLACES.bank.x, y: PLACES.bank.y + 80, hp: 100, shootCd: 0.7 },
          ];
          setBanner('The Big Score', 'Hold the vault for 10 seconds', 3);
        } else if (m.stage === 'vault') {
          if (dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < TUNE.vaultRadius) {
            m.vault += dt;
            if (m.vault >= TUNE.vaultTime) {
              m.stage = 'escape';
              state.guards = [];
              setBanner('Cash grabbed!', 'Run for the east side', 3);
            }
          }
        } else if (m.stage === 'escape' && dist(p.x, p.y, PLACES.escape.x, PLACES.escape.y) < 100) {
          events |= completeMission();
        }
        break;
      }
      default:
        break;
    }
    return events;
  }

  function step(dt, controls, audio) {
    state.time += dt;
    if (state.banner.t > 0) state.banner.t -= dt;
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    if (!controls) {
      // Attract mode behind the title screen: the city lives, no story.
      stepTraffic(dt);
      stepPeds(dt);
      stepPickups(dt, null);
      return 0;
    }
    let events = 0;
    stepPlayer(dt, controls, audio);
    stepTraffic(dt);
    stepCourier(dt);
    stepPeds(dt);
    const policeEvents = stepPolice(dt, audio);
    if (policeEvents) events |= policeEvents;
    stepGuards(dt, audio);
    const bulletResult = stepBullets(dt);
    if (bulletResult === 'courier-dead') {
      events |= failMission('You killed the courier');
    }
    stepPickups(dt, audio);
    // Heat decays when no police can see the player.
    const nearestPolice = Math.min(
      state.cruisers.reduce((best, c) => Math.min(best, dist(c.x, c.y, state.player.x, state.player.y)), 1e9),
      state.cops.reduce((best, c) => Math.min(best, dist(c.x, c.y, state.player.x, state.player.y)), 1e9),
    );
    const inHideout = dist(state.player.x, state.player.y, PLACES.rico.x, PLACES.rico.y) < 160;
    if (nearestPolice > 450 || inHideout) {
      state.heatTimer += dt * (inHideout ? 3 : 1);
      if (state.heatTimer >= TUNE.wantedDecaySeconds && state.wanted > 0) {
        state.wanted -= 1;
        state.heatTimer = 0;
      }
    } else {
      state.heatTimer = 0;
    }
    events |= stepMission(dt);
    if (audio) audio.music(dt);
    if (state.player.hp <= 0) events |= EVENT_BUST;
    return events;
  }

  reset(true);

  return {
    state,
    reset,
    startGame,
    startMission,
    completeMission,
    failMission,
    bust,
    objective,
    saveProgress,
    step,
    setBanner,
  };
}
