// Every tuning number, place and colour in one place. The world is a
// fixed 3200x2400 city; the renderer scales the view to the window, so
// no rule below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = { w: 3200, h: 2400 };

// Avenues run north-south, streets east-west. Road centres, in world px.
export const ROADS_V = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_H = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_HALF = 46;

export const SAVE_KEY = 'solmar-save-v1';

// Landmark points. The bank and garage blocks hold no generated
// buildings, so these points are always reachable on foot.
export const PLACES = {
  start: { x: 560, y: 330 },
  rico: { x: 820, y: 560 }, // Rico's Auto — garage and hideout
  bank: { x: 1450, y: 1230 }, // Solmar National Bank front door (vault)
  docks: { x: 2960, y: 1750 }, // marina pier
  hospital: { x: 1050, y: 1950 }, // respawn after a bust
  escape: { x: 2620, y: 240 }, // getaway point for the Big Score
  courierLoop: { x: 1800, y: 900 }, // where the courier's loop starts
};

export const MISSIONS = [
  { id: 'wheels', name: 'Wheels Up', reward: 300, brief: 'Steal a car for Rico' },
  { id: 'pickup', name: 'The Pickup', reward: 500, brief: 'Fetch the package from the docks' },
  { id: 'tail', name: 'Tail Job', reward: 800, brief: 'Follow the courier — stay out of sight' },
  { id: 'heat', name: 'Heat Wave', reward: 1000, brief: 'Lose the three-star dragnet' },
  { id: 'score', name: 'The Big Score', reward: 2400, brief: 'Rob Solmar National Bank' },
];

export const TUNE = {
  footWalk: 175,
  footRun: 265,
  footAccel: 1500,
  carAccel: 520,
  carBrake: 900,
  carReverseMax: 150,
  carTop: 470,
  carTurn: 2.9,
  carRadius: 17,
  cruiserTop: 450,
  cruiserRamDamage: 5,
  cruiserRamCooldown: 1.8,
  copSpeed: 150,
  copShotDamage: 4,
  copShotRange: 320,
  copShotCooldown: 1.3,
  guardShotDamage: 3,
  guardShotRange: 320,
  guardShotCooldown: 1.4,
  pistolAmmo: 12,
  pistolCooldown: 0.18,
  pistolRange: 430,
  pistolDamage: 34,
  trafficSpeed: 150,
  pedSpeed: 42,
  wantedDecaySeconds: 8,
  tailTime: 20,
  tailMin: 100,
  tailMax: 380,
  vaultTime: 10,
  vaultRadius: 130,
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sidewalk: '#b9b3a4',
  road: '#3c3f46',
  roadLine: '#e8d44d',
  building: ['#c98f5f', '#b57a6e', '#8f9bb0', '#a89a7a', '#7d8ba0', '#c2a06b'],
  roof: ['#8a5a3b', '#6e4a52', '#5d6b80', '#7a6a4a'],
  park: '#5d9b4a',
  tree: '#2f6b2a',
  sand: '#e0c98f',
  water: '#2e6f9e',
  waterDeep: '#25608c',
  player: '#f2c94c',
  playerCar: '#e8b13c',
  traffic: ['#c94f43', '#4f7ec9', '#5aa37a', '#c9c9c9', '#7a5aa3', '#d08a3c'],
  cruiser: '#20242c',
  cruiserTrim: '#e8e8e8',
  ped: ['#e8e0d0', '#d08a8a', '#8ab0d0', '#d0c08a', '#a08ad0'],
  guard: '#2c3a2c',
  cop: '#1f2a44',
  text: '#f2f0e8',
  muted: '#b9b3a4',
  panel: 'rgba(12, 14, 20, 0.82)',
  banner: '#ffd34d',
  danger: '#ff5a4d',
  money: '#7ddc7d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
