// The city of Solmar: a grid of avenues and streets, the blocks between
// them filled with buildings, parks and trees, and a sandy beach along the
// south edge. Generation is seeded, so one seed always builds the same city.
// This module also answers the questions the rules keep asking: is this
// point on a road, does it hit a building, where is the nearest road.

import { WORLD, ROADS_V, ROADS_H, ROAD_W, PALETTE } from './config.js';
import { createRandom } from './random.js';

/** Half the road width, plus the sidewalk that runs along each edge. */
const HALF = ROAD_W / 2;
const SIDEWALK = 16;

/** The blocks are the gaps between roads, plus the strips at the edges. */
function blockRanges(roads, size) {
  const ranges = [];
  let start = 0;
  for (const road of roads) {
    ranges.push([start, road - HALF - SIDEWALK]);
    start = road + HALF + SIDEWALK;
  }
  ranges.push([start, size]);
  return ranges;
}

export function generateCity(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const xs = blockRanges(ROADS_V, WORLD.width);
  const ys = blockRanges(ROADS_H, WORLD.height);
  let colorIndex = 0;
  for (let by = 0; by < ys.length; by += 1) {
    for (let bx = 0; bx < xs.length; bx += 1) {
      const [x0, x1] = xs[bx];
      const [y0, y1] = ys[by];
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      // The last row is the beach: sand and palms, never buildings.
      if (by === ys.length - 1) {
        const count = 4 + Math.floor(rng() * 4);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 30 + rng() * (w - 60), y: y0 + 24 + rng() * (h - 48), r: 13, palm: true });
        }
        continue;
      }
      if (rng() < 0.22) {
        parks.push({ x: x0, y: y0, w, h });
        const count = 3 + Math.floor(rng() * 5);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 26 + rng() * (w - 52), y: y0 + 26 + rng() * (h - 52), r: 11 + rng() * 5, palm: false });
        }
        continue;
      }
      // One or two buildings per block, with a margin so streets stay open.
      const split = w > 300 && rng() < 0.55;
      const slots = split ? 2 : 1;
      for (let s = 0; s < slots; s += 1) {
        const sx0 = x0 + (split ? (s * w) / 2 : 0) + 14;
        const sx1 = x0 + (split ? ((s + 1) * w) / 2 : w) - 14;
        const bw = sx1 - sx0;
        const bh = h - 28;
        if (bw < 60 || bh < 60) continue;
        const shrinkX = rng() * 0.2;
        const shrinkY = rng() * 0.2;
        const color = PALETTE.building[colorIndex % PALETTE.building.length];
        const roof = PALETTE.roof[colorIndex % PALETTE.roof.length];
        colorIndex += 1;
        buildings.push({
          x: sx0 + (bw * shrinkX) / 2,
          y: y0 + 14 + (bh * shrinkY) / 2,
          w: bw * (1 - shrinkX),
          h: bh * (1 - shrinkY),
          color,
          roof,
        });
      }
    }
  }
  return { buildings, parks, trees, seed };
}

/** True when the point is on asphalt (not on a sidewalk or a block). */
export function isOnRoad(x, y) {
  for (const road of ROADS_V) if (Math.abs(x - road) <= HALF) return true;
  for (const road of ROADS_H) if (Math.abs(y - road) <= HALF) return true;
  return false;
}

/** True when the point is on a sidewalk strip beside a road. */
export function isOnSidewalk(x, y) {
  for (const road of ROADS_V) {
    const d = Math.abs(x - road);
    if (d > HALF && d <= HALF + SIDEWALK) return true;
  }
  for (const road of ROADS_H) {
    const d = Math.abs(y - road);
    if (d > HALF && d <= HALF + SIDEWALK) return true;
  }
  return false;
}

/** The nearest point on any road centre line to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const road of ROADS_V) {
    const d = Math.abs(x - road);
    if (d < bestDist) {
      bestDist = d;
      best = { x: road, y };
    }
  }
  for (const road of ROADS_H) {
    const d = Math.abs(y - road);
    if (d < bestDist) {
      bestDist = d;
      best = { x, y: road };
    }
  }
  return best;
}

/** The road (axis, centre, direction sign) a point is closest to, for traffic. */
export function nearestRoad(x, y) {
  let best = { axis: 'v', centre: ROADS_V[0], dist: Infinity };
  for (const road of ROADS_V) {
    const d = Math.abs(x - road);
    if (d < best.dist) best = { axis: 'v', centre: road, dist: d };
  }
  for (const road of ROADS_H) {
    const d = Math.abs(y - road);
    if (d < best.dist) best = { axis: 'h', centre: road, dist: d };
  }
  return best;
}

/** True when a circle of radius r at (x, y) touches any building or the world edge. */
export function hitsBuilding(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Push a circle out of buildings and the world edge; returns true when it was pushed. */
export function resolveBuildingCollision(city, body, r) {
  let pushed = false;
  if (body.x < r) {
    body.x = r;
    pushed = true;
  }
  if (body.y < r) {
    body.y = r;
    pushed = true;
  }
  if (body.x > WORLD.width - r) {
    body.x = WORLD.width - r;
    pushed = true;
  }
  if (body.y > WORLD.height - r) {
    body.y = WORLD.height - r;
    pushed = true;
  }
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
      pushed = true;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the shortest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
      pushed = true;
    }
  }
  return pushed;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const road = ROADS_V[Math.floor(rng() * ROADS_V.length)];
    return { x: road + (rng() - 0.5) * (ROAD_W - 40), y: 80 + rng() * (WORLD.height - 160) };
  }
  const road = ROADS_H[Math.floor(rng() * ROADS_H.length)];
  return { x: 80 + rng() * (WORLD.width - 160), y: road + (rng() - 0.5) * (ROAD_W - 40) };
}

/** A random point on a sidewalk beside a road. */
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const road = nearestRoad(p.x, p.y);
  if (road.axis === 'v') p.x = road.centre + (rng() < 0.5 ? -1 : 1) * (HALF + SIDEWALK / 2);
  else p.y = road.centre + (rng() < 0.5 ? -1 : 1) * (HALF + SIDEWALK / 2);
  return p;
}
