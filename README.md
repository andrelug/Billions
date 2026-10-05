# Billions — Colony Survival

A colony-survival strategy game in the style of *They Are Billions*, built to run in a
browser on phones, tablets and desktops. You build a colony inside an energy grid, gather
resources, research technology, train an army, and survive escalating swarms of infected.
The final swarm comes from every side at once.

Plain HTML, CSS and JavaScript (ES modules) on a Canvas. There are no runtime
dependencies and no build step. It installs as a PWA and plays offline.

The sprite pack includes 315 original painterly steampunk images and 36 walk and
attack animation strips for all 18 characters. Review and play the animations in
[the art catalog](art/index.html), or see [ASSETS.md](ASSETS.md) for replacement rules.
For what matches the original game and what is still missing, see [PARITY.md](PARITY.md).

## Run it locally

ES modules need a web server; opening `index.html` from disk will not work.

```sh
npm run serve          # npx http-server -p 8080 -c-1 .
# or: python3 -m http.server 8080
```

Then open http://localhost:8080. To test on a phone on the same Wi-Fi, open
`http://<your-computer-ip>:8080`.

## Deploy

Any static host works. With GitHub Pages:

1. Repository **Settings → Pages → Source: GitHub Actions**.
2. The workflow in `.github/workflows/pages.yml` deploys every push to `master` or
   `main`. The game is then at `https://<user>.github.io/<repo>/`.

On a phone, open the URL and use **Share → Add to Home Screen** (Safari) or **Install app**
(Chrome) to play full-screen and offline. The service worker (`sw.js`) is network-first,
so a new deploy is picked up on the next load while online.

## Game modes

- **Survival.** Choose a map (6 themes, unlocked in order by winning), the infected
  population (5 levels), the duration (80, 100, 120 or 150 days) and whether to elect
  mayors. These choices set the score factor.
- **Weekly Challenge.** Uses the same seed for the whole ISO week, with one attempt and
  a fixed score factor. Scores are kept on the device.
- **The 50 Days Challenge.** Neighbouring colonies send you reinforcements every 5 days.
- **Campaign.** Not built yet (see PARITY.md).

Survival is ironman, as in the original game. It autosaves every 2 minutes and whenever
the app goes to the background, and you can **Save & Quit** from the menu. Losing a game
deletes its save. Several games can be in progress at the same time.

## Controls

**Touch**
- Drag to pan, pinch to zoom, and tap the minimap to jump.
- Tap a unit or building to select it. With units selected, tap the ground to move and
  long-press to attack-move.
- **Select** turns on box selection. **Army** selects every unit. **Base** jumps to the
  Command Center. **!** jumps to the last alert.
- Group buttons 1–5: hold to assign the current selection, tap to recall, double-tap to
  jump to the group.
- Building: tap a card in the bottom tray, tap the map to position it, then tap **Build**.
  For walls, **Line** draws a wall between two taps.

**Keyboard and mouse.** These follow the original game's defaults.

| Key | Action |
|---|---|
| Left click / drag | Select / box select |
| Right click | Move, attack, garrison or pick up, depending on the target |
| Space | Pause |
| Esc | Cancel or open the menu |
| Enter | Select the Command Center |
| F2 | Select the whole army |
| Q (or A) | Attack-move |
| H / S / P / C | Hold / Stop / Patrol / Chase |
| Ctrl+1–8, then 1–8 | Assign a control group, then recall it |
| R or Tab while placing | Rotate a gate |
| Tab | Hide the HUD |
| E (hold) / G | Show the energy grid while held / toggle it |
| F4 | Flat terrain and grid view |
| Alt (hold) | Health bars |
| Delete | Demolish the selected building |
| Q W R U I O P | Train units while a Soldiers Center or Engineering Center is selected |
| Arrows, wheel, +/− | Pan and zoom |

## Project layout

```
index.html, css/style.css   App shell and the mobile-first HUD
js/main.js                  Entry point
js/core/                    RNG, spatial grid, flow-field and A* pathfinding
js/data/                    Game data: buildings, research, units, infected, maps, mayors,
                            achievements, sprite list
js/sim/                     Simulation at a fixed 20 Hz: world generation, economy, energy,
                            noise, vision, combat, infected AI, swarms, nests, scoring
js/view/                    Canvas renderer, camera, terrain cache, asset loader, audio
js/ui/                      Input, selection and commands, HUD, panels, screens, profile
assets/                     Original sprites and animation strips plus manifest.json
tools/gen-placeholders.mjs  Regenerates the placeholder sprites
tests/                      node --test unit tests for the simulation
```

The simulation does not use the DOM, so it runs in Node (`tests/sim.test.js` plays whole
scenarios headlessly).

## Development

```sh
npm test               # unit and simulation tests (Node 18 or later)
npm run assets         # regenerate missing placeholder sprites (needs Playwright)
```

In the browser console, `window.BILLIONS` is the running app and `BILLIONS.game` is the
simulation.

Performance targets: the final swarm in Node simulates about 14,000 infected in about
5 ms per step. In Chromium it holds 60 fps with about 10,000 infected on screen. On slow
devices the renderer drops to 1x pixel density automatically.
