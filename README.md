# SOLMAR — Streets of Gold

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizko-d/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizko-d/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down open-world crime game in the spirit of GTA (GTA 1/2 camera),
built for [make.fun gta6-01](https://make.fun/bounty/gta6-01). You are
**Milo Reyes**, a getaway driver who owes the fixer **Vera Kline** one
last job, in **Solmar** — an original sun-soaked coastal city. All names,
characters, vehicles, story, art (canvas-drawn) and sound (WebAudio
synthesis) are original; nothing from Rockstar Games.

## What is in the game

- **A city** — a seeded 3200×2400 grid of avenues and streets with
  buildings, two parks, a beach and a marina. Traffic drives the road
  network (lane following, turning at intersections, braking behind
  each other); pedestrians stroll the sidewalks and flee gunfire.
- **On foot and by car** — WASD moves, mouse aims, click shoots a pistol
  (12 rounds, R reloads). E steals any car — parked ones are free,
  traffic cars cost a wanted star and their driver runs — and E gets you
  out again. Arcade driving: throttle, steering, handbrake, wall slides.
- **Wanted level 0–5** — stealing, shooting, killing and running people
  over raise it. Police cruisers chase and ram; foot cops shoot and try
  to bust you on foot. Stay out of sight and the heat cools off one star
  at a time. Rico's Auto is a hideout where cruisers lose your trail.
- **Five story missions** — Wheels Up (steal a car for Rico's Auto), The
  Pickup (fetch a package from the docks), Tail Job (follow a courier
  for 20 s without being spotted), Heat Wave (escape a three-star
  dragnet to the garage), The Big Score (hold the bank vault against
  guards, grab the cash, run). Rewards $300–$2,400; a failed job can be
  retried with Enter; finishing all five makes you a Solmar legend and
  opens free roam.
- **HUD and save** — cash, health bar, ammo/speed, wanted stars, mission
  objective banner, progress bars and a live minimap (roads, player
  arrow, mission marker, police dots, courier). Title, pause (P/Esc,
  also on tab-hide), mute (M), busted screen (keeps 80% of cash),
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

## How to run

```sh
node serve.ts            # http://localhost:8080
MAKEFUN_OUTPUT_DIR=out node main.ts   # grader-style build
```

See `BUILD_REPORT.md` for what was verified and the known weaknesses.
