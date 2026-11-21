[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Wedspierre/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Wedspierre/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VELAMAR — Open World Crime Game

A complete, original open-world crime game in the browser, built for the
make.fun gta6-01 bounty. No Rockstar assets, names, characters or map: the
city of Velamar Bay, its people and its story are all original.

## Play

Serve `game/` with any static server and open `game/index.html`:

```sh
node serve.ts
# open http://localhost:8080
```

WASD move/drive, mouse drag orbits the camera, Shift sprint, Space jump,
E enter car / interact, F carjack, Q weapon wheel, 1–4 weapons, click to
shoot, R radio station, T Velamar Dispatch jobs, G store a car in the
garage, Esc pause, F5 quick save.

## What is in the game

- A 1200×1200 procedural city: nine districts, beach, harbor with cranes,
  the Docks, Civic Plaza, a helipad and a garage
- Traffic on the road grid and pedestrians on the sidewalks who flee danger
- Cars to steal and drive (7 models), with arcade handling
- Wanted level (5 stars), police pursuit cars, roadblocks and a police
  helicopter with a spotlight
- Combat with fists, pistol, SMG and shotgun; enemies who chase and shoot
- **Velamar Dispatch**: an explicit dispatch system — paid taxi, courier,
  getaway, vigilante and tow jobs from a job board (T), plus police radio
- 14 story missions with a full arc: Welcome Back, Wheels, First Fare,
  The Drop, Mara, Street Kings, Harbor Lights, Heat Wave, Protect the
  Fixer, The Setup, Air One, Roadblock Run, The Vault, King of Velamar
- HUD with minimap, wanted stars, health/armor, cash, respect, speedometer,
  weapon wheel and three procedural radio stations (WebAudio, no files)
- Save/load in the browser (localStorage), start screen and pause menu
- 4 screenshots, all real renders of the game itself (`?shot=` modes)

## Layout

- `game/index.html` — page, HUD DOM, import map for three.js
- `game/src/state.js` — shared state, mission and weapon data
- `game/src/city.js` — procedural city, collisions
- `game/src/vehicles.js` — cars, traffic AI, helicopter
- `game/src/people.js` — pedestrians and the player character
- `game/src/police.js` — wanted level, pursuit, roadblocks
- `game/src/dispatch.js` — Velamar Dispatch jobs and radio feed
- `game/src/missions.js` — the 14-mission campaign engine
- `game/src/hud.js` — HUD, minimap, weapon wheel, dispatch panel
- `game/src/audio.js` — synthesized sound effects and radio
- `game/src/save.js` — localStorage save/load
- `game/src/shots.js` — screenshot staging modes
- `game/src/main.js` — game loop and glue
- `game/vendor/three/three.module.min.js` — vendored three.js (MIT)
- `main.ts` — entry program, hands game/ + screenshots/ to the grader
- `serve.ts` — tiny static server for local play

## License

MIT — see LICENSE.
