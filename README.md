# solmar — Streets of Gold

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizko-d/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizko-d/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down open-world crime game in the spirit of GTA, built for the
make.fun gta6-01 bounty. You are **Milo Reyes**, a getaway driver in the
sun-soaked coastal city of **Solmar**, running five story jobs for the fixer
**Vera Kline** — from stealing your first car to the Big Score at Solmar
National Bank. Everything is original: the city, the characters, the
vehicles, the story, the art (drawn on canvas) and the sound (synthesised
with WebAudio). Nothing from Rockstar Games.

## How to play

- **WASD / Arrows** — move on foot, drive when in a car
- **Mouse** — aim, **click** — shoot (pistol, 12 rounds, **R** reloads)
- **E** — steal a car / get out of a car
- **Shift** — run on foot, **Space** — handbrake while driving
- **P / Esc** — pause, **M** — mute, **Space** — start / restart

Steal any car — parked ones are free, traffic cars cost you a wanted star
and their driver runs. Shoot, run people over, or rob the bank and the
Solmar PD comes for you: one star per crime, up to five, with cruisers that
ram you and foot cops that shoot and try to bust you. Stay out of sight and
the heat cools off, one star at a time.

Five missions, in order: **Wheels Up** (steal a car), **The Pickup** (fetch
a package from the docks), **Tail Job** (follow a courier without losing
him), **Heat Wave** (escape a three-star dragnet), and **The Big Score**
(hold the bank vault, grab the cash, run). Finish all five and you are a
Solmar legend. Cash, the mission reached, and your best run are saved in
your browser — press **C** on the title screen to continue.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or hand it in the way the grader does:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

No build step, no network, no libraries: plain static files under `game/`,
sound synthesised with WebAudio, art drawn on canvas. Best run is kept in
your browser's localStorage.

---

<sub>Entered on [make.fun](https://make.fun/?ref=rizko-f&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
