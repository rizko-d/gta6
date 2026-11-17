// The city of Solmar: a seeded 3200x2400 grid of avenues and streets.
// Roads are free to drive and walk; the blocks between them hold
// buildings, two parks, a beach along the south edge and a marina on
// the east edge. The bank block and the garage block hold no generated
// buildings, so the vault and the hideout are always reachable.
import { ROADS_H, ROADS_V, ROAD_HALF, WORLD, PALETTE } from './config.js';
import { RNG, hash2 } from './random.js';

export function isRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function inWater(x, y) {
  return x > 3080;
}

export function buildCity(seed) {
  const rng = new RNG(seed);
  const buildings = [];
  const trees = [];
  const parks = [];

  // Park blocks, picked by seed from the interior blocks.
  const blockXs = [];
  for (let i = 0; i < ROADS_V.length - 1; i++) {
    blockXs.push([ROADS_V[i] + ROAD_HALF + 8, ROADS_V[i + 1] - ROAD_HALF - 8]);
  }
  const blockYs = [];
  for (let i = 0; i < ROADS_H.length - 1; i++) {
    blockYs.push([ROADS_H[i] + ROAD_HALF + 8, ROADS_H[i + 1] - ROAD_HALF - 8]);
  }
  const parkPick = new Set();
  while (parkPick.size < 2) parkPick.add(rng.int(0, blockXs.length * blockYs.length - 1));
  const parkBlocks = [...parkPick].map((n) => {
    const bx = n % blockXs.length;
    const by = Math.floor(n / blockXs.length);
    return { x0: blockXs[bx][0], y0: blockYs[by][0], x1: blockXs[bx][1], y1: blockYs[by][1] };
  });

  // The bank block (1400-1800 x, 1000-1400 y) and the garage block
  // (600-1000 x, 400-600 y) stay clear of generated buildings.
  const clearBlocks = [
    { x0: 1400, y0: 1000, x1: 1800, y1: 1400 },
    { x0: 600, y0: 400, x1: 1000, y1: 600 },
  ];

  for (let by = 0; by < blockYs.length; by++) {
    for (let bx = 0; bx < blockXs.length; bx++) {
      const [x0, x1] = blockXs[bx];
      const [y0, y1] = blockYs[by];
      const isPark = parkBlocks.some((p) => p.x0 === x0 && p.y0 === y0);
      const isClear = clearBlocks.some((c) => x0 >= c.x0 && x1 <= c.x1 && y0 >= c.y0 && y1 <= c.y1);
      if (isPark) {
        parks.push({ x0, y0, x1, y1 });
        const count = rng.int(5, 9);
        for (let i = 0; i < count; i++) {
          trees.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            r: rng.range(9, 15),
          });
        }
        continue;
      }
      if (isClear) continue;
      // One to three buildings per block, seeded by block coordinates
      // so the layout is stable for the seed.
      const n = 1 + Math.floor(hash2(bx, by, 7) * 3);
      for (let i = 0; i < n; i++) {
        const w = rng.range(90, 190);
        const h = rng.range(80, 170);
        const x = rng.range(x0 + 10, Math.max(x0 + 11, x1 - w - 10));
        const y = rng.range(y0 + 10, Math.max(y0 + 11, y1 - h - 10));
        buildings.push({
          x,
          y,
          w,
          h,
          color: PALETTE.building[Math.floor(hash2(bx, by, i + 1) * PALETTE.building.length)],
          roof: PALETTE.roof[Math.floor(hash2(bx, by, i + 11) * PALETTE.roof.length)],
        });
      }
      // A couple of sidewalk trees per block.
      for (let i = 0; i < 2; i++) {
        trees.push({
          x: rng.range(x0, x1),
          y: rng.range(y0, y1),
          r: rng.range(7, 11),
        });
      }
    }
  }

  // The beach: the strip below the last street is sand, walkable.
  // The marina: the strip east of the last avenue is water, with a
  // wooden pier reaching out to the docks.
  return {
    buildings,
    trees,
    parks,
    beach: { x0: 0, y0: 2280, x1: WORLD.w, y1: WORLD.h },
    water: { x0: 3080, y0: 0, x1: WORLD.w, y1: WORLD.h },
    pier: { x0: 2960, y0: 1700, x1: 3080, y1: 1800 },
  };
}

// Push a circle out of every building it overlaps and out of the water.
// Returns true if a hard impact happened (speed above the threshold).
export function collideCircle(city, p, r, impactSpeed = 0) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        // Dead centre: push up out of the roof.
        p.y = b.y - r;
      }
    }
  }
  // The water is solid: keep the circle on the shore side.
  if (p.x + r > city.water.x0) {
    p.x = city.water.x0 - r;
    hit = true;
  }
  // The world edge is solid too.
  p.x = Math.max(r, Math.min(WORLD.w - r, p.x));
  p.y = Math.max(r, Math.min(WORLD.h - r, p.y));
  return hit && impactSpeed > 200;
}

export function pointBlocked(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return inWater(x, y);
}
