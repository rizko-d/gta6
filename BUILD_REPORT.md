# SOLMAR: Streets of Gold — Build Report (recording 2)

Rebuilt from scratch in this session under sealed recording
`01a1ea91-2f5d-71c4-89ec-016a653b686d`, from the prose spec in
`../BUILD_REPORT.md`. Every game source file was written fresh with
write/edit calls in this session; nothing was read, copied, or restored
from `entry-prev/` or `entry-rec1/`. Kit files (`LICENSE`,
`vendor/makefun-game.ts`, `.makefun/owner.json`) are untouched.

## The game

Top-down open-world crime game (GTA 1/2 camera) in a seeded 3200×2400
coastal city. You are Milo Reyes, getaway driver; fixer Vera Kline owns
one last job.

- **City:** seeded avenues/streets, buildings, 2 parks, beach (south),
  marina/pier (east), landmarks: Rico's Auto garage, the bank, the docks,
  the hospital. Deterministic per `?seed=N` (default 11).
- **On foot:** WASD/arrows, Shift run, mouse aim, click to shoot the
  12-round pistol (R reload), E steal a car, Space handbrake in a car,
  P/Esc pause, M mute, C continue a save.
- **Driving:** lane-following traffic with intersection turns, braking
  and respawn; a courier loop; pedestrians who flee gunfire and can be
  run over (raises heat).
- **Heat:** wanted 0–5 stars. One police cruiser per star chases and
  rams (top speed 450); foot cops shoot and bust. Wanted decays after
  8 s clean; Rico's hideout clears it.
- **Story — 5 missions:** Wheels Up $300 (steal a car, drive to Rico's),
  The Pickup $500, Tail Job $800 (20 s tail, 100–380 px), Heat Wave
  $1,000, The Big Score $2,400 (hold the bank vault 10 s inside the
  circle, then escape). Failed missions retry with Enter. Busted keeps
  80% of cash and respawns at the hospital. localStorage save
  (`solmar-save-v1`).
- **Presentation:** HUD (cash, health, ammo/speed, stars, mission
  banner, progress bars), live minimap, title / pause (tab-hide) /
  busted / story-complete screens, WebAudio synth (engine drone,
  two-tone siren, gunshots, 112 bpm bassline).

## Files (2,704 lines total)

| File | Lines | What it is |
| --- | --- | --- |
| `game/index.html` | 20 | Canvas + status line, loads `src/main.js` |
| `game/src/random.js` | 46 | mulberry32 + hash2 + RNG class |
| `game/src/config.js` | 99 | WORLD 3200×2400, roads, places, missions, tuning |
| `game/src/city.js` | 147 | Seeded buildings/parks/beach/water, collision |
| `game/src/input.js` | 118 | Keyboard/mouse, one-shot actions per frame |
| `game/src/audio.js` | 149 | WebAudio synth: engine, siren, shots, jingles |
| `game/src/world.js` | 1,040 | Player/car physics, traffic, peds, police, bullets, missions, save |
| `game/src/render.js` | 551 | Camera, ground, entities, HUD, minimap, screens |
| `game/src/shots.js` | 226 | `?shot=` staging (title / street / chase / vault) |
| `game/src/main.js` | 209 | Fixed 1/60 s loop, screens, `__shotReady`, `__solmar` |
| `main.ts` | 39 | Copies `game/` + `screenshots/`, writes `dossier.json` |
| `serve.ts` | 60 | Static dev server (port 8080) |
| `shots.json` | — | 4 shots, seed 11 |
| `README.md` | — | Rewritten with gta6-01 badges for `rizko-d/gta6` |
| `screenshots/` | — | 4 real screenshots (below) |

## Verification

All run in-session against `node serve.ts` on port 8080 with headless
Chromium (Playwright headless shell) via a Node/CDP driver.

### Build

- `node --check` passes on all 11 source files + `main.ts` + `serve.ts`.
- `MAKEFUN_OUTPUT_DIR=/tmp/out-gta6-rec2 node main.ts` succeeds.
  Output: `dossier.json` + `game/` (10 source files, 85,864 bytes) +
  `screenshots/` (4 files). Total output 836 KiB.
- **Dossier: 460,660 bytes** (cap 1,572,864). Dossier text: **86,584
  bytes** (cap 163,840). Schema `makefun/dossier/v1`, cover 0.

### Screenshots (1280×720, all ≤256 KiB, all "clean" — no console errors)

| File | Bytes | Scene |
| --- | --- | --- |
| `1-title.jpg` | 57,916 | Title panel over the city |
| `2-street.jpg` | 68,824 | On foot beside a parked car, "Steal a car" |
| `3-chase.jpg` | 72,690 | Driving south on the central avenue, 4 stars, 3 cruisers in trail |
| `4-score.jpg` | 78,641 | "The Big Score": vault circle at the bank, 55% progress, guards + cruisers |

Each was eyeballed. The street shot shows the player, a parked car,
traffic, peds, HUD and minimap. The chase shot shows the yellow player
car centred on the avenue with cruisers behind. The vault shot shows
the gold vault ring, the progress bar half-filled, and the bank.

### Scripted live playtest (CDP, 15 checks — ALL PASS)

Title → Space start → walk to nearest parked car → E steal → drive to
Rico's → **Mission 1 complete, $150 → $490** → E exit → 3 shots →
P pause / resume. No page or console errors; **zero requests outside
localhost**.

- Car stolen (parked car at 981,528), mission 1 stage `drive`, then
  mission 2 starts; money $490 (≥$450).
- Exit: player out of the car. Shooting: ammo 12 → 9. Wanted 0 → 1.
- Pause and resume work.

## Bugs found and fixed in this session

1. **Inverted `clamp` (critical, in `render.js`, `world.js`,
   `shots.js`).** It was `v < a ? a : v > b ? v : b` — any in-range
   value returned the max, and over-range values passed through
   unclamped. Effects before the fix: the camera was pinned to the
   south-east corner (2760,2240) in every frame so the player was
   off-screen; wanted jumped straight to 5 on any gain; cars ran at
   top speed constantly; the HP and progress bars always drew full;
   parked-car/ped spawn positions were wrong. Fixed to
   `v < a ? a : v > b ? b : v` in all three files. Found by reading the
   staged player/camera positions via a debug CDP eval after the first
   screenshots showed the marina corner instead of the player.
2. **E did nothing while the car was rolling.** Exit required
   `|speed| < 120`, so a tap of E at speed was swallowed and read as a
   broken key. Now E always exits; bailing above 200 px/s costs 5 HP
   and flings the player forward.
3. **Gunfire drew no heat.** Firing only raised wanted on a hit, so
   shooting into the air did nothing. Now the first shot in the open
   raises wanted to 1 (further shots only on hits).
4. **Playtest driver steering was inverted** (`/tmp/cdp.mjs`, not game
   code): it pressed A when the heading error was positive. The game
   itself was correct (D = clockwise = right). Swapped the keys in the
   driver; the first passing run had only worked because the stolen car
   happened to face the target already.
5. **Shot staging:** the chase shot drove on the marina-edge avenue
   (x=3000) and the vault shot staged off-camera. The drive shot now
   stages the stolen car onto the central avenue (x=1800) facing south
   before driving, and `runShot` snaps the camera to the player before
   the first paint.

## Known weaknesses

- The drive-shot car is staged onto the central avenue (see bug 5);
  the frame is a real driven chase after staging, but the starting
  position is composed, like the vault shot's bank placement.
- The play shot's player takes a little damage walking (HP 92 in the
  frame) from a traffic bump on the way to the car — honest, but the
  frame shows a less-than-full health bar.
- Traffic cars sometimes queue in a column behind a slow car on the
  same avenue; it reads as a traffic jam rather than a bug, but it can
  look dense in the chase frame's background.
- The bank landmark label is partly covered by the mission marker in
  the vault screenshot.
- Missions 2–5 were verified only through the mission state machine in
  headless logic checks in the first rebuild, not end-to-end in the
  live playtest this session (only Mission 1 was driven end-to-end
  live). The vault hold was verified live through the staged shot
  (vault 5.5/10 s, stage `vault`).
- Audio is synthesized WebAudio only; there is no music beyond the
  bassline loop, and no touch controls.
