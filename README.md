# Billions — Colony Survival

A mobile-first browser game in the spirit of *They Are Billions*: build a colony,
fortify it, and survive 30 days of escalating zombie hordes. No dependencies,
no build step: plain HTML, CSS and JavaScript on a Canvas.

Works on phones (touch), tablets and desktop browsers. Installable to a phone
home screen as a PWA and playable offline.

## Play it

Any static web host works. The easiest is GitHub Pages:

1. Push this repository to GitHub.
2. Repository **Settings → Pages → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) deploys on every push
   to `master` / `main`. Your game is then at `https://<user>.github.io/<repo>/`.

Alternatively, **Settings → Pages → Source: Deploy from a branch** (branch
`master`, folder `/ (root)`) also works, with no workflow needed.

To run locally:

```sh
npx http-server -p 8080 .
# open http://localhost:8080
```

On your phone, open the URL in Safari or Chrome and use **Share → Add to Home
Screen** to install it full-screen. Progress autosaves every day and when the
app goes to the background.

## How to play

- **Goal:** keep the Command Center alive through day 30. Hordes attack on days
  5, 10, 15, 20, 25 and a final one from all sides on day 30. Scouts announce the
  direction a day ahead; hordes arrive at night.
- **Build:** tap a building in the bottom bar, tap the map to position it, then
  tap **✓ Build** (or tap the ghost again). Walls place instantly per tap; the
  **Line** toggle draws a wall between two taps.
- **Economy:** Tents add workers and gold but eat food. Farms grow food on open
  grass, Sawmills need forest, Quarries need rock. The placement preview shows
  the yield of a spot before you commit.
- **Defense:** Walls block zombies (your units can pass through). Ballistas shoot
  over walls. Barracks train Rangers (fast, long range) and Soldiers (tough).
  Tap a unit, then tap the ground to move it; **Army** selects everyone. Units
  rally automatically to buildings under attack nearby.
- **Danger:** gunfire attracts nearby zombies, and an overrun tent turns its
  colonists into zombies inside your walls.
- **Camera:** drag to pan, pinch or scroll to zoom, tap the minimap to jump.
- **Keyboard (desktop):** `1`–`7` pick a building, `A` select the army, `H`
  center on the base, `Space` pause, `Esc` cancel, `+`/`-` zoom.

Three difficulties (Easy / Normal / Hard) scale horde sizes.

## Project layout

```
index.html            page shell and HUD markup
css/style.css         mobile-first styling (safe areas, landscape, desktop)
js/config.js          tuning: buildings, units, zombies, horde schedule, difficulty
js/util.js            PRNG, min-heap, spatial hash
js/world.js           map generation and flow-field (Dijkstra) pathfinding
js/game.js            simulation: economy, combat, zombie AI, hordes, save/load
js/render.js          Canvas renderer, vector building icons, minimap
js/input.js           touch / mouse / keyboard input
js/ui.js              HUD, placement flow, panels, toasts, screens, persistence
js/main.js            boot and game loop
manifest.webmanifest  PWA manifest; sw.js caches the app for offline play
icons/                app icons
```

## Design notes

- Hordes navigate with a flow field computed from the Command Center. Walls and
  buildings are expensive but passable in the field, so hordes chew through the
  cheapest route and find gaps you leave open.
- Zombies are alerted by damage: shooting one pulls its neighbours onto the
  shooter, and towers that fire at wanderers will draw them in.
- Everything is tunable in `js/config.js`.
