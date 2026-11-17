// SOLMAR — tuning, palette, places and the mission chain. Every number the
// rules use lives here, so the world, the renderer and the screenshots all
// agree on what the city is. The city is Solmar, a sun-soaked coastal town
// of the player's own: no borrowed names, maps or characters anywhere.

/** The city is a fixed 3200x2400 world; the camera shows a 1280x720 window of it. */
export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Asphalt width of every road; sidewalks run along both edges. */
export const ROAD_W = 120;
export const ROADS_V = [400, 1000, 1600, 2200, 2800];
export const ROADS_H = [300, 800, 1300, 1800, 2200];

/** Where the save and the best run are kept between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
export const BEST_KEY = 'solmar.best.v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 215,
  runSpeed: 305,
  health: 100,
  /** Seconds a foot cop needs pressed against the player to bust them. */
  bustTime: 1.1,
};

export const GUN = {
  damage: 34,
  bulletSpeed: 760,
  range: 520,
  magSize: 12,
  reloadSeconds: 1.1,
  fireInterval: 0.16,
  spread: 0.05,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 620,
  brake: 900,
  maxSpeed: 460,
  maxReverse: 190,
  turnRate: 3.2,
  drag: 0.55,
  /** Police cruisers are only just faster than anything the player can steal. */
  policeMaxSpeed: 480,
};

export const TRAFFIC = {
  count: 14,
  parkedCount: 7,
  cruiseMin: 130,
  cruiseMax: 205,
  /** Chance a traffic car turns at an intersection, per crossing. */
  turnChance: 0.38,
};

export const PEDS = { count: 26, walkMin: 42, walkMax: 78, fleeSpeed: 250 };

export const WANTED = {
  max: 5,
  /** Seconds of no crime and no cop in sight before one star cools off. */
  coolSeconds: 13,
  copSight: 460,
  /** Cop cars on the hunt: 1 per star, plus one more from 3 stars up. */
  carsForStars: (stars) => Math.min(1 + stars + (stars >= 3 ? 1 : 0), 5),
  footCopsForStars: (stars) => Math.min(stars, 3),
};

export const POLICE = {
  shootRange: 320,
  shootInterval: 1.25,
  bulletDamage: 7,
  bulletSpeed: 520,
  ramDamage: 5,
  /** Seconds between one cruiser's damaging rams. */
  ramCooldown: 1.8,
};

/** Named places, all on road centres or at intersections, so markers are always reachable. */
export const PLACES = {
  safehouse: { x: 1600, y: 1300, name: "Vera's Garage" },
  bank: { x: 1000, y: 800, name: 'Solmar National Bank' },
  docks: { x: 400, y: 2200, name: 'Marina Docks' },
  autoshop: { x: 2200, y: 300, name: "Rico's Auto" },
  motel: { x: 2800, y: 1800, name: 'Palm Court Motel' },
  plaza: { x: 1000, y: 1800, name: 'Coral Plaza' },
};

/**
 * The story: Milo Reyes, a getaway driver who owes fixer Vera Kline one last
 * job. Five missions, in order; each one names its target place and its
 * reward. `kind` tells the world how the mission is won.
 */
export const MISSIONS = [
  {
    id: 'wheels',
    title: 'WHEELS UP',
    kind: 'drive-to',
    target: 'autoshop',
    reward: 300,
    brief: "Vera: 'You need wheels, Milo. Steal any car and bring it to Rico's Auto on Coral Ave.'",
    done: 'Rico grins. "She picks the good ones." The car is yours now.',
  },
  {
    id: 'pickup',
    title: 'THE PICKUP',
    kind: 'fetch',
    target: 'docks',
    returnTo: 'safehouse',
    reward: 500,
    brief: "Vera: 'A package is waiting at the Marina Docks. Grab it and bring it back to the garage. No peeking.'",
    done: 'The package is in. Vera nods once. That is her version of a hug.',
  },
  {
    id: 'tail',
    title: 'TAIL JOB',
    kind: 'tail',
    target: 'bank',
    reward: 800,
    brief: "Vera: 'A courier is running cash for the Marlowe crew. Follow him — close, but not too close — and see where he stops.'",
    done: 'The courier stops at the bank. Vera now knows where the money sleeps.',
  },
  {
    id: 'heat',
    title: 'HEAT WAVE',
    kind: 'escape',
    target: 'safehouse',
    reward: 1000,
    brief: "Vera: 'Somebody talked. The whole Solmar PD is on you. Lose them and get back to the garage — three stars and counting.'",
    done: 'You slip the dragnet. Vera is already planning the next one.',
  },
  {
    id: 'score',
    title: 'THE BIG SCORE',
    kind: 'robbery',
    target: 'bank',
    returnTo: 'safehouse',
    reward: 2500,
    brief: "Vera: 'Tonight we take the bank. Hold the vault, grab the cash, and run. This is the one that clears your debt, Milo.'",
    done: 'The vault is empty and so is your debt. Solmar is yours now, Milo Reyes.',
  },
];

export const START_MONEY = 150;

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6f9e55',
  park: '#69a854',
  sand: '#e8cf9a',
  water: '#3f9ec4',
  waterDeep: '#2f83ad',
  asphalt: '#3d3a38',
  asphaltLight: '#454140',
  lane: '#e8d44f',
  sidewalk: '#b9b2a4',
  curb: '#8f887a',
  building: ['#e8a34c', '#d97b6c', '#7fb3d5', '#c9b458', '#9db98a', '#b98ac9', '#e07a5f', '#6fa8a0'],
  roof: ['#a8622d', '#8f4a3f', '#4f7d9e', '#8f7d33', '#5f7d4f', '#7d5a8f', '#9e4a35', '#3f6d66'],
  window: '#2e3d4d',
  windowLit: '#ffd97a',
  tree: '#3f7d3a',
  treeDark: '#2f6130',
  player: '#f2c94c',
  playerJacket: '#2f6fb2',
  ped: ['#e07a5f', '#7fb3d5', '#9db98a', '#c9b458', '#b98ac9', '#e8a34c'],
  policeCar: '#2f4d6d',
  policeLightR: '#ff3b30',
  policeLightB: '#2f7bff',
  taxi: '#f2c94c',
  text: '#f4f1e8',
  muted: '#b8b2a4',
  panel: 'rgba(16, 18, 24, 0.86)',
  panelEdge: '#f2c94c',
  star: '#ffd94a',
  starEmpty: '#5a5548',
  health: '#58c96b',
  healthLow: '#e5534b',
  marker: '#ffd94a',
  markerPulse: 'rgba(255, 217, 74, 0.35)',
  objective: '#ffd94a',
  danger: '#ff5a4a',
  cash: '#7ee081',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
