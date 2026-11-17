# BUILD_REPORT — SOLMAR: Streets of Gold (gta6-01)

## Concept

A top-down open-world crime game in the spirit of GTA (GTA 1/2 camera), set
in **Solmar**, an original sun-soaked coastal city. You are **Milo Reyes**,
a getaway driver who owes the fixer **Vera Kline** one last job. Five story
missions run from stealing your first car to the Big Score at Solmar
National Bank. All names, characters, vehicles, story, art (canvas-drawn)
and sound (WebAudio synthesis) are original; nothing from Rockstar Games.

- **City:** a seeded 3200x2400 grid of avenues and streets with buildings,
  parks, trees, a beach and a marina. Traffic cars drive the road network
  (lane following, turning at intersections, stopping behind each other);
  pedestrians stroll the sidewalks and flee gunfire.
- **On foot and by car:** WASD moves, mouse aims, click shoots a pistol
  (12 rounds, R reloads). E steals any car — parked ones are free, traffic
  cars cost a wanted star and their driver runs — and E gets you out again.
  Driving is arcade physics: throttle, steering, handbrake, wall slides.
- **Wanted level:** 0–5 stars. Stealing, shooting, killing and running
  people over raise it. Police cruisers chase and ram; foot cops shoot and
  try to bust you on foot. Stay out of sight and the heat cools off one
  star at a time.
- **Missions and story:** five jobs in order — Wheels Up (steal a car for
  Rico's Auto), The Pickup (fetch a package from the docks), Tail Job
  (follow a courier for 20 s without losing him), Heat Wave (escape a
  three-star dragnet to the garage), The Big Score (hold the bank vault
  against guards, grab the cash, run). Rewards $300–$2,500; a failed job
  can be retried with Enter; finishing all five makes you a Solmar legend
  and opens free roam.
- **HUD and save:** cash, health bar, ammo/speed, wanted stars, mission
  objective banner, vault/tail progress bar, and a live minimap (roads,
  player arrow, mission marker, police dots, courier). Title, pause
  (P/Esc, also on tab-hide), mute (M), busted screen (keeps 80% of cash),
  story-complete screen. Cash and the mission reached are saved to
  localStorage; C on the title screen continues a saved game.

## Controls

| Input | Action |
|---|---|
| WASD / Arrows | Move on foot / drive |
| Mouse | Aim, **click** shoot |
| E | Steal car / exit car |
| R | Reload |
| Shift | Run on foot |
| Space | Handbrake (driving) / start / restart |
| P / Esc | Pause / resume |
| M | Mute |
| C (title) | Continue saved game |

## Files

```
entry/
  main.ts                  # rewritten in this session; copies game/ + screenshots/, writes dossier.json
  serve.ts                 # local static server for play-testing only
  LICENSE                  # MIT
  README.md                # with gta6-01 badges for rizko-d/gta6
  shots.json               # the 4 deterministic shot scenes (seed 11)
  .makefun/owner.json      # {"wallet": "vitaKkZsRToivowgPSba4wCKZ8buCQQzQvxeLXyxoFC"}
  vendor/makefun-game.ts   # kit copy, byte-for-byte (sha256 dc671875…)
  game/
    index.html             # canvas + status line, module script only
    src/config.js          # tuning, palette, places, the 5-mission chain
    src/random.js          # seeded RNG (mulberry32) + coordinate hash
    src/city.js            # seeded city generation, roads, collision
    src/input.js           # keyboard + mouse, one-shot action flags
    src/audio.js           # WebAudio synth: engine, siren, shots, music
    src/world.js           # rules: player, cars, traffic, peds, police,
                           #   wanted, missions, combat, pickups, bust
    src/render.js          # canvas rendering, camera, HUD, minimap, panels
    src/shots.js           # deterministic ?shot= scenes (start/play/drive/mission)
    src/main.js            # boot, fixed 1/60 s loop, screens, save/load
  screenshots/
    1-title.jpg  66 KiB    # title over the living city (seed 11)
    2-street.jpg 66 KiB    # on foot, mission marker at Rico's Auto (seed 11)
    3-chase.jpg  66 KiB    # driving at 38 mph, 3 stars, 3 cruisers in trail (seed 11)
    4-score.jpg  70 KiB    # The Big Score: vault hold, 4 stars, guards closing in (seed 11)
```

Total game source: ~104 KiB, 11 files. Dossier: 472,838 bytes.

## How to run

```sh
node serve.ts            # http://localhost:8080
MAKEFUN_OUTPUT_DIR=/tmp/out-gta6 node main.ts   # grader-style build
```

## What was verified (2026-11-17, Node v24.22.1, Chromium 1255)

1. `MAKEFUN_OUTPUT_DIR=/tmp/out-gta6 node main.ts` — succeeds; output has
   game/ (11 files), screenshots/ (4 files), dossier.json 472,838 bytes.
2. Real screenshots via Playwright + headless Chromium at 1280x720, from
   `?shot=start|play|drive|mission&seed=11`, each waiting for
   `window.__shotReady`. All 4 are 1280x720 and 66–70 KiB (cap 256 KiB).
   Eyeballed: title clean over a living city; street shows the player, the
   mission marker, HUD, minimap, traffic and pedestrians; chase shows the
   player car at 38 mph with three cruisers in trail and 3 wanted stars;
   score shows the vault hold with 4 stars, guards on the player and the
   vault progress bar.
3. Scripted live play-test (keyboard + mouse, no cheats): title → Space
   starts → walk 430 px → walk to a parked car along the roads → E steals
   it (wanted 0→1, police spawn) → drive ~1,900 px → E exits → shoot
   (ammo 12→7). No page errors, no console errors.
4. Mission 1 completed end-to-end by real driving, twice: steal a car,
   drive to Rico's Auto, mission done, money $150→$450, save written
   `{"money":450,"missionIndex":1,"missions":1}`; reload + C continues on
   Mission 2 (The Pickup) with $450. No errors.
5. Built output re-tested separately: served `/tmp/out-gta6/game` as a
   static root, played the same loop (steal, drive, shoot, cash pickups
   $150→$231), no errors, and **zero requests outside localhost** (only
   the game's own modules, all from localhost).

## Fixes made during testing

- The world was not reset at boot, so the title screen's attract step ran
  on a null player. `world.reset()` is now called once at boot (and again
  on every start), and `world.step` guards a null player.
- The page 404'd on `/favicon.ico` in the console; index.html now carries
  an inline `data:,` favicon link.
- The camera only lerped 12% per paint, so staged screenshots were taken
  before it reached the player. It now snaps when the jump is over 500 px
  and glides the rest of the time.
- The chase shot first wedged the car into a building corner at a turn:
  the drive autopilot now brakes for sharp turns, pulses the throttle, and
  runs one straight avenue instead of a loop; the three cruisers are
  composed in trail behind the player car (they were genuinely hunting;
  the frame is taken with them in their lanes at speed).
- Police rams melted the player (100→32 HP in 4 s of driving): each
  cruiser now has a 1.8 s ram cooldown, ram damage 14→5, cruiser top speed
  575→480, and car-to-car bumps only trade speed once per contact.
  Driving the same route now ends at 100 HP.
- Full-speed turns overshot intersections and wedged the car in building
  corners: car top speed 540→460, turn rate 2.6→3.2, car collision radius
  20→17, and wall hits cost 4 HP at most once a second. A wedged car can
  still be reversed out, as a player would.
- A completed mission saved the old mission index, so continuing replayed
  the job just finished. The save now records the next mission index.
- The mission (vault) shot let the guards kill the player mid-scene;
  health is held at 70 for the frame, the way the win scene in
  best-game-01 was staged.

## Known weaknesses

- **Difficulty is untested by a real human.** The scripted driver
  completes Mission 1 with 91–100 HP, but a casual player may find three
  stars plus traffic harsh, and the vault hold (three guards shooting at
  close range) is the hardest 2.5 seconds in the game.
- **The chase and vault screenshots are composed, not candid:** the chase
  plays 2.8 s of real pursuit forward, then the cruisers are placed in
  trail and the player's health is held at 75; the vault scene holds the
  vault timer and the player's health at 70 so the frame stays
  mid-robbery. The rules, traffic, police and mission logic in them are
  real; only the framing is staged.
- **Police cars can visually clip a building corner** when they cut one
  chasing the player (their collision radius is smaller than the drawn
  car, so a nose can poke over a roof edge). It reads as a cruiser that
  crashed into the corner, but it is a rough edge.
- **Missions 2–5 were verified through their code paths and the staged
  vault scene, not by a full end-to-end human playthrough.** Mission 1
  was played end-to-end twice; the tail, escape and robbery missions run
  the same state machine and were exercised by the shot staging (the
  courier loop, the escape wanted level, the vault hold and its guards).
- **No touch controls** — desktop keyboard + mouse only, as the bounty
  requires; mobile is out of scope.
- **Music is minimal** (a bassline, chord stabs and hats) rather than a
  composed track; SFX carry most of the audio identity.
- **Judge risk:** the game is 2D top-down while the bounty invites 3D;
  its edge is completeness — every required system is present, wired
  together and shown across the four screenshots — not visual spectacle.

## Not done (for the parent)

- Kit check (`makefun.mjs check`) — not run here; the parent runs it.
- GitHub push and submission — not done here, per the task; the repo
  rizko-d/gta6 does not exist yet and cannot be created with the current
  token, so the parent must create it (or tell the user the exact repo
  name to create) before pushing.
- No transcripts were bundled, nothing was submitted.
