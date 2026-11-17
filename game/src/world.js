// The rules of Solmar: the player on foot and behind the wheel, traffic and
// pedestrians living their own lives, cars to steal, a wanted level with
// police who hunt the player, five story missions, combat, pickups and the
// bust that ends a run. The world advances in fixed 1/60 s steps; the
// renderer only paints what is here.

import {
  WORLD,
  STEP,
  PLAYER,
  GUN,
  CAR,
  TRAFFIC,
  PEDS,
  WANTED,
  POLICE,
  PLACES,
  MISSIONS,
  START_MONEY,
  ROADS_V,
  ROADS_H,
  ROAD_W,
} from './config.js';
import {
  generateCity,
  isOnRoad,
  nearestRoad,
  nearestRoadPoint,
  randomRoadPoint,
  randomSidewalkPoint,
  resolveBuildingCollision,
} from './city.js';

export const EVENT_BUSTED = 1;
export const EVENT_MISSION_DONE = 2;
export const EVENT_MISSION_FAIL = 4;
export const EVENT_HIT = 8;
export const EVENT_PICKUP = 16;
export const EVENT_CRIME = 32;

const CAR_COLORS = ['#c94f4f', '#4f7ec9', '#e8e8e8', '#3a3a3a', '#7fb069', '#d97b2f', '#8a6fb8', '#c9a227'];
const TAXI_COLOR = '#f2c94c';
const POLICE_COLOR = '#2f4d6d';
const COURIER_COLOR = '#e8e8e8';
const PED_COLORS = ['#e07a5f', '#7fb3d5', '#9db98a', '#c9b458', '#b98ac9', '#e8a34c'];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(rng, seed, sfx) {
  const city = generateCity(seed);
  let carId = 1;

  const state = {
    time: 0,
    money: START_MONEY,
    health: PLAYER.health,
    wanted: 0,
    wantedCool: 0,
    player: null,
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    mission: { index: 0, state: 'none', phase: '', t: 0, courierId: 0, tailTime: 0, tailGrace: 0, vaultT: 0, hasPackage: false, target: null },
    banner: { title: '', sub: '', t: 0 },
    objective: '',
    stats: { kills: 0, stolen: 0, shots: 0, hits: 0, missions: 0, playTime: 0 },
    busted: false,
    storyDone: false,
    muted: false,
  };
  state.city = city;

  function showBanner(title, sub, seconds) {
    state.banner = { title, sub, t: seconds ?? 4 };
  }

  function addWanted(n) {
    if (n <= 0) return;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.wantedCool = 0;
  }

  function spawnCar(kind, x, y, angle, color, type) {
    const car = {
      id: carId++,
      kind,
      type: type || 'sedan',
      x,
      y,
      angle,
      speed: 0,
      color: color || CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      axis: 'v',
      road: ROADS_V[0],
      dir: 1,
      cruise: TRAFFIC.cruiseMin + rng() * (TRAFFIC.cruiseMax - TRAFFIC.cruiseMin),
      targetSpeed: 0,
      driver: kind === 'traffic',
      stolen: false,
      despawnT: 0,
      waypoint: 0,
      ramT: 0,
      bumpT: 0,
    };
    state.cars.push(car);
    return car;
  }

  function spawnTrafficCar() {
    const p = randomRoadPoint(rng);
    const road = nearestRoad(p.x, p.y);
    const car = spawnCar('traffic', p.x, p.y, 0, rng() < 0.12 ? TAXI_COLOR : undefined, rng() < 0.15 ? 'taxi' : 'sedan');
    car.axis = road.axis;
    car.road = road.centre;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.angle = road.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
    car.speed = car.cruise * (0.7 + rng() * 0.3);
    return car;
  }

  function spawnParkedCar() {
    const p = randomRoadPoint(rng);
    const road = nearestRoad(p.x, p.y);
    const car = spawnCar('parked', p.x, p.y, 0);
    car.axis = road.axis;
    car.road = road.centre;
    car.dir = rng() < 0.5 ? 1 : -1;
    if (road.axis === 'v') {
      car.x = road.centre + (car.dir > 0 ? -1 : 1) * (ROAD_W / 2 - 16);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.y = road.centre + (car.dir > 0 ? -1 : 1) * (ROAD_W / 2 - 16);
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    return car;
  }

  function spawnPed(kind, x, y) {
    const p = x === undefined ? randomSidewalkPoint(rng) : { x, y };
    const road = nearestRoad(p.x, p.y);
    const ped = {
      kind: kind || 'ped',
      x: p.x,
      y: p.y,
      angle: rng() * Math.PI * 2,
      speed: PEDS.walkMin + rng() * (PEDS.walkMax - PEDS.walkMin),
      state: 'walk',
      color: kind === 'cop' ? '#2f4d6d' : PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
      axis: road.axis,
      road: road.centre,
      dir: rng() < 0.5 ? 1 : -1,
      t: 0,
      shootT: 1 + rng(),
      bustT: 0,
      health: kind === 'cop' ? 60 : 30,
      fleeX: 0,
      fleeY: 0,
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnPickup(kind, x, y, amount) {
    state.pickups.push({ kind, x, y, amount: amount ?? 25, t: 0 });
  }

  function scatterPickups() {
    for (let i = 0; i < 6; i += 1) {
      const p = randomRoadPoint(rng);
      spawnPickup('cash', p.x, p.y, 20 + Math.floor(rng() * 30));
    }
    spawnPickup('health', PLACES.plaza.x + 40, PLACES.plaza.y, 40);
    spawnPickup('health', PLACES.motel.x, PLACES.motel.y + 40, 40);
    spawnPickup('ammo', PLACES.safehouse.x + 60, PLACES.safehouse.y - 40, 24);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const s = (speed ?? 120) * (0.4 + rng() * 0.8);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + rng() * 0.4,
        maxLife: 0.8,
        size: 2 + rng() * 3,
        color,
      });
    }
  }

  function playerCar() {
    if (!state.player.carId) return null;
    return state.cars.find((c) => c.id === state.player.carId) ?? null;
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function killPed(ped, byPlayer) {
    if (ped.state === 'dead') return;
    ped.state = 'dead';
    ped.t = 0;
    burst(ped.x, ped.y, '#c0392b', 10, 140);
    if (byPlayer) {
      state.stats.kills += 1;
      addWanted(1);
      if (rng() < 0.3) spawnPickup('cash', ped.x, ped.y, 20);
    }
  }

  function damagePlayer(amount) {
    if (state.health <= 0) return EVENT_BUSTED;
    state.health -= amount;
    if (state.health <= 0) {
      state.health = 0;
      state.busted = true;
      return EVENT_BUSTED;
    }
    return EVENT_HIT;
  }

  // ---- Missions ------------------------------------------------------------

  function missionDef() {
    return MISSIONS[state.mission.index] ?? null;
  }

  function startMission(index) {
    const def = MISSIONS[index];
    if (!def) {
      state.mission = { index, state: 'none', phase: '', t: 0, courierId: 0, tailTime: 0, tailGrace: 0, vaultT: 0, hasPackage: false, target: null };
      state.objective = 'Free roam — Solmar is yours. Press M for the next job when Vera calls.';
      return;
    }
    state.mission = {
      index,
      state: 'active',
      phase: def.kind === 'fetch' ? 'go' : def.kind === 'tail' ? 'tail' : def.kind === 'robbery' ? 'go' : 'go',
      t: 0,
      courierId: 0,
      tailTime: 0,
      tailGrace: 0,
      vaultT: 0,
      hasPackage: false,
      target: PLACES[def.target],
    };
    state.objective = def.brief;
    showBanner(`MISSION ${index + 1} — ${def.title}`, def.brief, 5);
    if (def.kind === 'tail') {
      const courier = spawnCar('courier', PLACES.bank.x, PLACES.bank.y, 0, COURIER_COLOR, 'sedan');
      courier.cruise = 195;
      courier.waypoint = 0;
      state.mission.courierId = courier.id;
    }
    if (def.kind === 'escape') {
      state.wanted = 3;
      state.wantedCool = 0;
    }
    if (def.kind === 'robbery') {
      // Bank guards arrive when the player reaches the vault.
      state.mission.guardsSpawned = false;
    }
  }

  function completeMission() {
    const def = missionDef();
    if (!def) return EVENT_MISSION_DONE;
    state.money += def.reward;
    state.stats.missions += 1;
    state.mission.state = 'done';
    state.mission.t = 0;
    state.objective = def.done;
    showBanner('MISSION COMPLETE', `${def.title} — +$${def.reward}`, 4.5);
    if (sfx) sfx.jingle();
    burst(state.player.x, state.player.y, '#ffd94a', 24, 200);
    if (state.mission.index >= MISSIONS.length - 1) {
      state.storyDone = true;
      showBanner('SOLMAR LEGEND', 'Your debt is clear. The whole city is yours now.', 6);
      state.objective = 'Story complete — free roam. You are a Solmar legend.';
    }
    return EVENT_MISSION_DONE;
  }

  function failMission(reason) {
    const def = missionDef();
    state.mission.state = 'failed';
    state.mission.t = 0;
    state.objective = `Job failed: ${reason}. Press Enter to retry.`;
    showBanner('JOB FAILED', `${reason} — press Enter to retry`, 4.5);
    if (sfx) sfx.fail();
    return EVENT_MISSION_FAIL;
  }

  function updateMission(dt) {
    const m = state.mission;
    const def = missionDef();
    const p = state.player;
    if (m.state === 'done') {
      m.t += dt;
      if (m.t > 4 && !state.storyDone) startMission(m.index + 1);
      return 0;
    }
    if (m.state !== 'active' || !def) return 0;
    m.t += dt;
    const car = playerCar();
    const target = m.target;
    if (def.kind === 'drive-to') {
      if (car && dist(p.x, p.y, target.x, target.y) < 110) return completeMission();
      if (m.t > 180) return failMission('Vera got tired of waiting');
    } else if (def.kind === 'fetch') {
      if (m.phase === 'go') {
        if (dist(p.x, p.y, target.x, target.y) < 80) {
          m.phase = 'grab';
          m.t = 0;
          state.objective = 'Grabbing the package… stay put.';
        }
      } else if (m.phase === 'grab') {
        if (dist(p.x, p.y, target.x, target.y) > 130) {
          m.phase = 'go';
          state.objective = def.brief;
        } else if (m.t > 1) {
          m.hasPackage = true;
          m.phase = 'return';
          m.target = PLACES[def.returnTo];
          state.objective = "Package secured. Bring it back to Vera's Garage.";
          showBanner('PACKAGE SECURED', "Now get it back to Vera's Garage.", 3.5);
        }
      } else if (m.phase === 'return') {
        if (dist(p.x, p.y, m.target.x, m.target.y) < 110) return completeMission();
      }
      if (m.t > 240) return failMission('The package moved on without you');
    } else if (def.kind === 'tail') {
      const courier = state.cars.find((c) => c.id === m.courierId);
      if (!courier) return failMission('The courier vanished');
      if (m.phase === 'tail') {
        const d = dist(p.x, p.y, courier.x, courier.y);
        if (d < 620) {
          m.tailTime += dt;
          m.tailGrace = 0;
        } else {
          m.tailGrace += dt;
          if (m.tailGrace > 5) return failMission('You lost the courier');
        }
        state.objective = `Follow the courier — stay close, not too close. (${Math.ceil(20 - m.tailTime)}s)`;
        if (m.tailTime >= 20) {
          m.phase = 'follow-up';
          m.target = PLACES.bank;
          showBanner('HE STOPPED', 'The courier stopped at the bank. Get there to confirm.', 3.5);
        }
      } else if (m.phase === 'follow-up') {
        if (dist(p.x, p.y, m.target.x, m.target.y) < 130) return completeMission();
      }
      if (m.t > 180) return failMission('The trail went cold');
    } else if (def.kind === 'escape') {
      if (dist(p.x, p.y, target.x, target.y) < 110) {
        state.wanted = 0;
        return completeMission();
      }
      if (m.t > 90) return failMission('The dragnet closed in');
      state.objective = `Lose the heat — reach Vera's Garage. Wanted: ${'★'.repeat(state.wanted)}`;
    } else if (def.kind === 'robbery') {
      if (m.phase === 'go') {
        if (dist(p.x, p.y, target.x, target.y) < 95) {
          m.phase = 'vault';
          m.t = 0;
          m.vaultT = 0;
          if (!m.guardsSpawned) {
            m.guardsSpawned = true;
            for (let i = 0; i < 3; i += 1) {
              const guard = spawnPed('cop', target.x + (rng() - 0.5) * 160, target.y + (rng() - 0.5) * 160);
              guard.state = 'chase';
            }
            showBanner('THE VAULT', 'Hold the vault while the guards come — stay in the circle!', 4);
          }
          state.objective = 'Hold the vault — stay in the yellow circle.';
        }
      } else if (m.phase === 'vault') {
        if (dist(p.x, p.y, target.x, target.y) < 110) {
          m.vaultT += dt;
          state.objective = `Cracking the vault… ${Math.ceil(2.5 - m.vaultT)}s — stay in the circle!`;
          if (m.vaultT >= 2.5) {
            m.phase = 'run';
            m.target = PLACES[def.returnTo];
            spawnPickup('cash', target.x, target.y, 400);
            addWanted(2);
            state.objective = 'Cash grabbed! Get back to the garage — the whole PD is coming.';
            showBanner('CASH GRABBED', "Run for Vera's Garage. Don't stop for anyone.", 4);
          }
        } else {
          m.vaultT = Math.max(0, m.vaultT - dt * 2);
          state.objective = 'Hold the vault — stay in the yellow circle.';
        }
      } else if (m.phase === 'run') {
        if (dist(p.x, p.y, m.target.x, m.target.y) < 110) return completeMission();
      }
      if (m.t > 150) return failMission('The bank locked down');
    }
    return 0;
  }

  // ---- Player --------------------------------------------------------------

  function stepOnFoot(dt, ctrl) {
    const p = state.player;
    const speed = ctrl.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = ctrl.move.x;
    const my = ctrl.move.y;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    if (mx !== 0 || my !== 0) p.angle = Math.atan2(my, mx);
    resolveBuildingCollision(city, p, PLAYER.radius);
    p.x = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, p.x));
    p.y = Math.max(PLAYER.radius, Math.min(WORLD.height - PLAYER.radius, p.y));
    // Aim follows the mouse.
    p.aimAngle = angleTo(p.x, p.y, ctrl.aim.x, ctrl.aim.y);
    // Shooting.
    p.fireT -= dt;
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.ammo = GUN.magSize;
        p.reloadT = 0;
      }
    } else if (ctrl.firing && p.fireT <= 0 && p.ammo > 0) {
      p.fireT = GUN.fireInterval;
      p.ammo -= 1;
      state.stats.shots += 1;
      const spread = (rng() - 0.5) * GUN.spread * 2;
      const a = p.aimAngle + spread;
      state.bullets.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * GUN.bulletSpeed,
        vy: Math.sin(a) * GUN.bulletSpeed,
        life: GUN.range / GUN.bulletSpeed,
        from: 'player',
        damage: GUN.damage,
      });
      burst(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#ffd94a', 3, 90);
      p.shotFlash = 0.06;
      if (sfx) sfx.shoot();
      addWanted(0); // firing alone is not a crime until someone sees it
      if (state.wanted === 0 && rng() < 0.25) addWanted(1);
      if (p.ammo === 0) p.reloadT = GUN.reloadSeconds;
    }
    if (ctrl.actions && ctrl.actions & 8 && p.reloadT <= 0 && p.ammo < GUN.magSize) {
      p.reloadT = GUN.reloadSeconds;
    }
    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      if (dist(p.x, p.y, pk.x, pk.y) < 34) {
        if (pk.kind === 'cash') state.money += pk.amount;
        else if (pk.kind === 'health') state.health = Math.min(PLAYER.health, state.health + pk.amount);
        else if (pk.kind === 'ammo') p.ammo = GUN.magSize;
        burst(pk.x, pk.y, '#7ee081', 8, 120);
        if (sfx) sfx.pickup();
        state.pickups.splice(i, 1);
      }
    }
  }

  function stepDriving(dt, ctrl) {
    const p = state.player;
    const car = playerCar();
    if (!car) {
      p.carId = 0;
      return;
    }
    const prevSpeed = car.speed;
    const steer = ctrl.steer;
    const throttle = ctrl.throttle;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 10 ? CAR.brake : CAR.accel * 0.6) * dt;
    else car.speed -= car.speed * CAR.drag * dt * 2;
    if (ctrl.handbrake) {
      car.speed -= car.speed * 3.2 * dt;
      car.angle += steer * CAR.turnRate * 1.5 * dt * Math.sign(car.speed || 1);
    } else {
      const turnAuthority = Math.min(1, Math.abs(car.speed) / 120);
      car.angle += steer * CAR.turnRate * turnAuthority * dt * Math.sign(car.speed || 1);
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;
    p.wallT = Math.max(0, p.wallT - dt);
    const hitWall = resolveBuildingCollision(city, car, 17);
    if (hitWall && Math.abs(prevSpeed) > 400 && p.wallT <= 0) {
      // A hard hit costs a little health, but only about once a second —
      // being wedged against a wall must not melt the player.
      p.wallT = 1.0;
      car.speed *= 0.3;
      burst(car.x, car.y, '#ffb347', 10, 160);
      if (sfx) sfx.crash();
      return damagePlayer(4);
    }
    if (hitWall) car.speed *= 0.55;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Run over pedestrians (a crime, and it is).
    for (const ped of state.peds) {
      if (ped.state === 'dead' || ped.kind === 'cop') continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
        killPed(ped, true);
        car.speed *= 0.85;
      }
    }
    // Pickups while driving.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      if (dist(car.x, car.y, pk.x, pk.y) < 40 && pk.kind === 'cash') {
        state.money += pk.amount;
        burst(pk.x, pk.y, '#7ee081', 8, 120);
        if (sfx) sfx.pickup();
        state.pickups.splice(i, 1);
      }
    }
    return 0;
  }

  function enterNearestCar() {
    const p = state.player;
    if (p.carId) return;
    const car = nearestCar(p.x, p.y, 78);
    if (!car) return;
    if (car.kind === 'traffic' && car.driver) {
      car.driver = false;
      const driver = spawnPed('ped', car.x + 30, car.y + 20);
      driver.state = 'flee';
      driver.fleeX = car.x;
      driver.fleeY = car.y;
      driver.t = 3;
    }
    car.kind = 'player';
    car.speed = 0;
    p.carId = car.id;
    if (!car.stolen) {
      car.stolen = true;
      state.stats.stolen += 1;
      addWanted(1);
      showBanner('CAR JACKED', 'That one is yours now. The owner disagrees.', 2.5);
    }
  }

  function exitCar() {
    const p = state.player;
    const car = playerCar();
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    const side = { x: car.x - Math.sin(car.angle) * 30, y: car.y + Math.cos(car.angle) * 30 };
    resolveBuildingCollision(city, side, PLAYER.radius);
    p.x = side.x;
    p.y = side.y;
    p.carId = 0;
  }

  // ---- Traffic, pedestrians, police ----------------------------------------

  function carAhead(car) {
    let best = null;
    let bestD = 90;
    for (const other of state.cars) {
      if (other === car || other.kind === 'parked') continue;
      if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
      const along = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      const side = car.axis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < bestD && side < 40) {
        bestD = along;
        best = other;
      }
    }
    return best;
  }

  function stepTrafficCar(car, dt) {
    const leader = carAhead(car);
    let target = car.cruise;
    if (leader) target = leader.speed < 20 ? 0 : Math.min(car.cruise, leader.speed * 0.85);
    car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
    if (car.axis === 'v') car.y += car.dir * car.speed * dt;
    else car.x += car.dir * car.speed * dt;
    // At an intersection, decide once whether to turn onto the crossing road.
    const crossing = car.axis === 'v' ? ROADS_H : ROADS_V;
    for (const road of crossing) {
      const pos = car.axis === 'v' ? car.y : car.x;
      if (Math.abs(pos - road) > 40) {
        if (car.turnAt === road) car.turnAt = null;
        continue;
      }
      if (Math.abs(pos - road) < 26 && car.turnAt !== road) {
        // Decide once per crossing, not once per frame inside it.
        car.turnAt = road;
        if (rng() < TRAFFIC.turnChance) {
          if (car.axis === 'v') {
            car.axis = 'h';
            car.road = road;
            car.y = road + car.dir * 28;
            car.dir = rng() < 0.5 ? 1 : -1;
            car.angle = car.dir > 0 ? 0 : Math.PI;
          } else {
            car.axis = 'v';
            car.road = road;
            car.x = road + car.dir * 28;
            car.dir = rng() < 0.5 ? 1 : -1;
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        break;
      }
    }
    // Keep on the road centre line (lane offset) and inside the world.
    if (car.axis === 'v') car.x = car.road + car.dir * 28;
    else car.y = car.road + car.dir * 28;
    if (car.y < -80 || car.y > WORLD.height + 80 || car.x < -80 || car.x > WORLD.width + 80) {
      const p = randomRoadPoint(rng);
      const road = nearestRoad(p.x, p.y);
      car.x = p.x;
      car.y = p.y;
      car.axis = road.axis;
      car.road = road.centre;
      car.dir = rng() < 0.5 ? 1 : -1;
      car.angle = road.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
    }
  }

  const COURIER_LOOP = [
    { x: 1000, y: 300 },
    { x: 2200, y: 300 },
    { x: 2200, y: 1300 },
    { x: 1000, y: 1300 },
    { x: 1000, y: 800 },
  ];

  function stepCourier(car, dt) {
    const m = state.mission;
    if (m.state === 'active' && m.phase === 'follow-up') {
      // Drive to the bank and park.
      const target = PLACES.bank;
      const d = dist(car.x, car.y, target.x, target.y);
      if (d < 40) {
        car.speed = 0;
        return;
      }
      const want = angleTo(car.x, car.y, target.x, target.y);
      car.angle += angleDiff(car.angle, want) * Math.min(1, dt * 3);
      car.speed = 180;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      return;
    }
    const wp = COURIER_LOOP[car.waypoint % COURIER_LOOP.length];
    const d = dist(car.x, car.y, wp.x, wp.y);
    if (d < 30) {
      car.waypoint += 1;
      return;
    }
    const want = angleTo(car.x, car.y, wp.x, wp.y);
    car.angle += angleDiff(car.angle, want) * Math.min(1, dt * 3.2);
    car.speed = car.cruise;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  function stepPoliceCar(car, dt) {
    const p = state.player;
    car.ramT = Math.max(0, car.ramT - dt);
    const d = dist(car.x, car.y, p.x, p.y);
    if (state.wanted === 0) {
      // The heat is off: drive away and leave.
      car.despawnT += dt;
      const want = angleTo(car.x, car.y, WORLD.width / 2, WORLD.height / 2);
      car.angle += angleDiff(car.angle, want + Math.PI) * Math.min(1, dt * 2);
      car.speed = Math.min(car.speed + 300 * dt, 260);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      return;
    }
    const want = angleTo(car.x, car.y, p.x, p.y);
    const diff = angleDiff(car.angle, want);
    car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
    const target = Math.abs(diff) > 1.1 ? 220 : CAR.policeMaxSpeed;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.8);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hitWall = resolveBuildingCollision(city, car, 17);
    if (hitWall) car.speed *= 0.5;
    // Ram the player — but a cruiser only lands a damaging ram about once
    // a second, so three stars do not melt the player in one pile-up.
    const pcar = playerCar();
    if (pcar && dist(car.x, car.y, pcar.x, pcar.y) < 42 && Math.abs(car.speed) > 120 && car.ramT <= 0) {
      car.ramT = POLICE.ramCooldown;
      pcar.speed *= 0.85;
      car.speed *= 0.4;
      burst(car.x, car.y, '#ffb347', 8, 150);
      return damagePlayer(POLICE.ramDamage);
    }
    if (!pcar && d < 46 && Math.abs(car.speed) > 120 && car.ramT <= 0) {
      car.ramT = POLICE.ramCooldown;
      burst(p.x, p.y, '#ffb347', 8, 150);
      return damagePlayer(POLICE.ramDamage);
    }
    // Close enough on foot: a cop gets out and chases on foot.
    if (!pcar && d < 130 && state.peds.filter((q) => q.kind === 'cop' && q.state !== 'dead').length < WANTED.footCopsForStars(state.wanted)) {
      const cop = spawnPed('cop', car.x + 20, car.y + 20);
      cop.state = 'chase';
      car.speed = 0;
      car.kind = 'parked';
      car.despawnT = 0;
    }
    return 0;
  }

  function ensurePolice(dt) {
    const p = state.player;
    const wantedCars = state.cars.filter((c) => c.kind === 'police').length;
    const wantCars = state.wanted > 0 ? WANTED.carsForStars(state.wanted) : 0;
    if (wantedCars < wantCars) {
      const angle = rng() * Math.PI * 2;
      const spawn = {
        x: p.x + Math.cos(angle) * 750,
        y: p.y + Math.sin(angle) * 750,
      };
      const road = nearestRoadPoint(spawn.x, spawn.y);
      const car = spawnCar('police', road.x, road.y, angleTo(road.x, road.y, p.x, p.y), POLICE_COLOR, 'police');
      car.speed = 200;
    }
    // Foot cops join the hunt when the player is on foot.
    const footCops = state.peds.filter((q) => q.kind === 'cop' && q.state !== 'dead').length;
    if (state.wanted > 0 && !playerCar() && footCops < WANTED.footCopsForStars(state.wanted)) {
      const angle = rng() * Math.PI * 2;
      const cop = spawnPed('cop', p.x + Math.cos(angle) * 320, p.y + Math.sin(angle) * 320);
      cop.state = 'chase';
    }
    // Despawn police that have nothing to do.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.kind === 'police' && state.wanted === 0 && car.despawnT > 6) state.cars.splice(i, 1);
      else if (car.kind === 'parked' && car.despawnT > 0) car.despawnT += dt;
    }
  }

  function stepPed(ped, dt) {
    if (ped.state === 'dead') {
      ped.t += dt;
      return 0;
    }
    ped.t += dt;
    const p = state.player;
    if (ped.state === 'flee') {
      const a = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      ped.x += Math.cos(a) * PEDS.fleeSpeed * dt;
      ped.y += Math.sin(a) * PEDS.fleeSpeed * dt;
      ped.angle = a;
      resolveBuildingCollision(city, ped, 10);
      if (ped.t > 4) {
        ped.state = 'walk';
        ped.t = 0;
      }
      return 0;
    }
    if (ped.kind === 'cop' && (ped.state === 'chase' || state.wanted > 0)) {
      const d = dist(ped.x, ped.y, p.x, p.y);
      const want = angleTo(ped.x, ped.y, p.x, p.y);
      ped.angle = want;
      if (d > 34) {
        const speed = playerCar() ? 250 : 235;
        ped.x += Math.cos(want) * speed * dt;
        ped.y += Math.sin(want) * speed * dt;
        resolveBuildingCollision(city, ped, 10);
      } else if (state.wanted > 0 && !playerCar()) {
        // Pressed against the player: the bust.
        ped.bustT += dt;
        if (ped.bustT > PLAYER.bustTime) {
          state.busted = true;
          return EVENT_BUSTED;
        }
      }
      // Shoot at the player from range.
      ped.shootT -= dt;
      if (d < POLICE.shootRange && d > 60 && ped.shootT <= 0) {
        ped.shootT = POLICE.shootInterval * (0.8 + rng() * 0.5);
        const spread = (rng() - 0.5) * 0.3;
        const a = want + spread;
        state.bullets.push({
          x: ped.x + Math.cos(a) * 18,
          y: ped.y + Math.sin(a) * 18,
          vx: Math.cos(a) * POLICE.bulletSpeed,
          vy: Math.sin(a) * POLICE.bulletSpeed,
          life: POLICE.shootRange / POLICE.bulletSpeed,
          from: 'cop',
          damage: POLICE.bulletDamage,
        });
      }
      return 0;
    }
    // Ordinary pedestrian: stroll the sidewalk, turn at intersections.
    const crossing = ped.axis === 'v' ? ROADS_H : ROADS_V;
    const pos = ped.axis === 'v' ? ped.y : ped.x;
    for (const road of crossing) {
      if (Math.abs(pos - road) < 20 && rng() < 0.02) {
        if (ped.axis === 'v') {
          ped.axis = 'h';
          ped.road = road;
          ped.y = road + ped.dir * (ROAD_W / 2 + 8);
        } else {
          ped.axis = 'v';
          ped.road = road;
          ped.x = road + ped.dir * (ROAD_W / 2 + 8);
        }
        ped.dir = rng() < 0.5 ? 1 : -1;
        break;
      }
    }
    if (ped.axis === 'v') {
      ped.y += ped.dir * ped.speed * dt;
      ped.x = ped.road + ped.dir * (ROAD_W / 2 + 8);
      ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ped.x += ped.dir * ped.speed * dt;
      ped.y = ped.road + ped.dir * (ROAD_W / 2 + 8);
      ped.angle = ped.dir > 0 ? 0 : Math.PI;
    }
    if (ped.y < 20 || ped.y > WORLD.height - 20 || ped.x < 20 || ped.x > WORLD.width - 20) {
      ped.dir *= -1;
    }
    return 0;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        // Buildings stop bullets.
        for (const bd of city.buildings) {
          if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
            burst(b.x, b.y, '#c9c9c9', 3, 80);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'player') {
        for (const ped of state.peds) {
          if (ped.state === 'dead') continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.health -= b.damage;
            state.stats.hits += 1;
            burst(b.x, b.y, '#c0392b', 5, 110);
            if (ped.health <= 0) killPed(ped, true);
            else if (ped.kind === 'ped') {
              ped.state = 'flee';
              ped.fleeX = state.player.x;
              ped.fleeY = state.player.y;
              ped.t = 0;
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'cop') {
        const p = state.player;
        const pcar = playerCar();
        if (!pcar && dist(b.x, b.y, p.x, p.y) < 15) {
          events |= damagePlayer(b.damage);
          dead = true;
        } else if (pcar && dist(b.x, b.y, pcar.x, pcar.y) < 24) {
          events |= damagePlayer(Math.ceil(b.damage / 2));
          burst(b.x, b.y, '#ffb347', 4, 100);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2.2 * dt;
      pt.vy *= 1 - 2.2 * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  function stepCars(dt) {
    let events = 0;
    for (const car of state.cars) {
      if (car.kind === 'traffic') stepTrafficCar(car, dt);
      else if (car.kind === 'courier') stepCourier(car, dt);
      else if (car.kind === 'police') events |= stepPoliceCar(car, dt) || 0;
    }
    // Car-to-car bumps: push apart, trade a little speed — but only once
    // per contact, so a long overlap does not drain the speed away frame
    // after frame.
    for (const car of state.cars) car.bumpT = Math.max(0, car.bumpT - dt);
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i];
        const b = state.cars[j];
        if (a.kind === 'parked' && b.kind === 'parked') continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          if (a.bumpT <= 0 && b.bumpT <= 0) {
            const avg = (a.speed + b.speed) / 2;
            if (a.kind === 'player' && Math.abs(a.speed - b.speed) > 280) events |= damagePlayer(4);
            a.speed = avg * 0.8;
            b.speed = avg * 0.8;
            a.bumpT = 0.3;
            b.bumpT = 0.3;
          }
        }
      }
    }
    return events;
  }

  function stepWanted(dt) {
    if (state.wanted <= 0) return;
    const p = state.player;
    let copNear = false;
    for (const car of state.cars) {
      if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < WANTED.copSight) {
        copNear = true;
        break;
      }
    }
    if (!copNear) {
      for (const ped of state.peds) {
        if (ped.kind === 'cop' && ped.state !== 'dead' && dist(ped.x, ped.y, p.x, p.y) < WANTED.copSight) {
          copNear = true;
          break;
        }
      }
    }
    if (copNear) {
      state.wantedCool = 0;
      return;
    }
    state.wantedCool += dt;
    if (state.wantedCool >= WANTED.coolSeconds) {
      state.wanted -= 1;
      state.wantedCool = 0;
      showBanner('HEAT COOLING', `Wanted level down to ${'★'.repeat(state.wanted) || 'clear'}.`, 2.5);
    }
  }

  // ---- Public API ----------------------------------------------------------

  function reset(save) {
    state.time = 0;
    state.money = save?.money ?? START_MONEY;
    state.health = PLAYER.health;
    state.wanted = 0;
    state.wantedCool = 0;
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.busted = false;
    state.storyDone = false;
    state.banner = { title: '', sub: '', t: 0 };
    state.stats = { kills: 0, stolen: 0, shots: 0, hits: 0, missions: 0, playTime: 0 };
    carId = 1;
    const start = PLACES.safehouse;
    state.player = {
      x: start.x + 40,
      y: start.y + 90,
      angle: -Math.PI / 2,
      aimAngle: 0,
      carId: 0,
      ammo: GUN.magSize,
      reloadT: 0,
      fireT: 0,
      shotFlash: 0,
      wallT: 0,
    };
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < TRAFFIC.parkedCount; i += 1) spawnParkedCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed('ped');
    scatterPickups();
    state.mission = { index: save?.missionIndex ?? 0, state: 'none', phase: '', t: 0, courierId: 0, tailTime: 0, tailGrace: 0, vaultT: 0, hasPackage: false, target: null };
    startMission(state.mission.index);
  }

  /**
   * Advance the world one fixed step. `ctrl` is the live input (null in
   * attract mode): {move, steer, throttle, running, handbrake, aim, firing,
   * actions}. Returns an EVENT_* bitmask.
   */
  function step(dt, ctrl, attract) {
    if (!state.player) return 0;
    state.time += dt;
    if (state.banner.t > 0) state.banner.t -= dt;
    if (state.player.shotFlash > 0) state.player.shotFlash -= dt;
    let events = 0;
    if (!attract && ctrl) {
      state.stats.playTime += dt;
      const actions = ctrl.actions || 0;
      if (actions & 4) {
        // ACTION_ENTER
        if (state.player.carId) exitCar();
        else enterNearestCar();
      }
      if (state.player.carId) events |= stepDriving(dt, ctrl) || 0;
      else events |= stepOnFoot(dt, ctrl) || 0;
      events |= updateMission(dt);
      if (state.mission.state === 'failed' && (actions & 1)) {
        // ACTION_CONFIRM retries the failed job.
        startMission(state.mission.index);
      }
    } else {
      // Attract mode: the city lives, nobody plays.
      if (state.mission.state === 'none') startMission(0);
    }
    events |= stepCars(dt);
    for (const ped of state.peds) events |= stepPed(ped, dt) || 0;
    events |= stepBullets(dt);
    stepParticles(dt);
    stepWanted(dt);
    ensurePolice(dt);
    // Dead pedestrians fade out after a while.
    for (let i = state.peds.length - 1; i >= 0; i -= 1) {
      if (state.peds[i].state === 'dead' && state.peds[i].t > 14) state.peds.splice(i, 1);
    }
    // Keep the streets populated.
    if (state.peds.filter((p) => p.kind === 'ped' && p.state !== 'dead').length < PEDS.count) spawnPed('ped');
    if (state.cars.filter((c) => c.kind === 'traffic').length < TRAFFIC.count) spawnTrafficCar();
    if (state.busted) events |= EVENT_BUSTED;
    return events;
  }

  return {
    state,
    city,
    reset,
    step,
    startMission,
    addWanted,
    showBanner,
    playerCar,
    nearestCar,
    /** The save payload main.ts stores in localStorage. */
    saveData() {
      // A finished job counts as done: continuing starts the next one, not
      // a replay of the job just completed.
      const next = state.mission.state === 'done' ? state.mission.index + 1 : state.mission.index;
      return {
        money: state.money,
        missionIndex: Math.min(next, MISSIONS.length - 1),
        missions: state.stats.missions,
      };
    },
  };
}
