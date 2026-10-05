# Art and sound guide

Sprites can be replaced **one file at a time**: the game picks up whatever is in
`assets/` and falls back to a drawn placeholder for any file that is missing or fails
to load. No code changes are needed. The painterly steampunk artwork and its prompts
are documented in [art/README.md](art/README.md). Open [the art catalog](art/index.html)
through the local server to review all 315 base sprites and play the 36 walk and
attack strips included for the seven colony units and eleven infected types.

- `assets/SPRITES.md` lists every sprite: its key, file, size and what it is.
- `assets/manifest.json` tells the game how to cut and place each image.

## Quick start

1. Find the sprite in `assets/SPRITES.md`, for example `building/tent → assets/building/tent.png, 256x256`.
2. Draw your art and save it over that PNG, keeping the same path.
3. Reload the game. Hard-refresh, or bump `CACHE` in `sw.js` if the old image sticks.

If the new image has a different size or is an animation strip, update its entry in
`assets/manifest.json` (see below).

## Rules

**Scale.** 64 px = 1 map tile. The view is top-down; a 3/4 perspective works if you
follow the building rule below. The size is only a reference: you can draw at 2x (128 px
per tile) for sharper art. The game scales each sprite to its in-game size, so the
resolution is up to you.

**Buildings** (`building/*`, `nest/*`)
- The image is stretched to the footprint's width (for example 2 tiles for a 2x2 Tent).
- If the image is **taller** than the footprint ratio, it keeps its aspect ratio and the
  extra height rises **above** the footprint, with the bottom edge on the footprint's
  bottom edge. Use this for roofs, towers and chimneys drawn in perspective. Example: a
  Tent drawn at 128x192 covers 2x2 tiles plus 1 tile of roof above.
- Gates have a second sprite for the rotated version: `building/woodgate_v`,
  `building/stonegate_v`.
- Construction, damage and selection are drawn by the game on top of your art. You do not
  need separate "under construction" or "damaged" sprites.

**Units and infected** (`unit/*`, `infected/*`)
- The game measures the opaque pixels of the still sprite and scales the character so the
  body, feet to head, is 2.6 times its collision radius. A Ranger is about 0.8 cell tall, a
  Titan about 1.6 and a Giant about 2.6. Padding around the body does not change the size
  on screen.
- The feet stand on the ground point and the body rises above it, so characters overlap
  correctly in crowds. Units and infected are drawn in depth order with buildings.
- Draw them **facing right**; the game mirrors them when they face left.
- Recommended frame: 256x256 px, body about 75% of the frame height, feet centred at about
  90% of the height, transparent background, a soft contact shadow is drawn by the game.
- Every animation strip of a character must use the same frame size and put the feet at the
  same place as the still sprite. The game uses the still sprite's framing for all of them.
- Optional animation states. Add a manifest entry (and a file) for:
  - `unit/<id>_walk` or `infected/<id>_walk`, used while moving;
  - `unit/<id>_attack` or `infected/<id>_attack`, used for 0.35 s after each attack.

  Without them, the base sprite is used for every state.

**Terrain** (`terrain/<map>/<type>_<0-3>`)
- 64x64 tiles that must tile seamlessly with each other.
- There are 4 variants per type per map, picked at random per cell.
- Maps: FA Deep Forest, BR Dark Moorland, TM Peaceful Lowlands, AL Frozen Highlands, DS
  Desolated Wasteland, VO Caustic Lands.
- Types: grass, forest, mountain, stone, iron, gold, water, oil, mud.
- The **Flat mode** setting and the **F4** view ignore terrain art and draw flat colours.

**Terrain props** (`prop/<map>/<name>_<n>`)
- Optional tall art that stands on terrain cells and replaces the procedural volume the
  game draws for them. Names: `tree` (forest), `rock` (mountain), `stone`, `iron` and
  `gold` (deposits). Number them from 0; any count works, and each cell picks one.
- Each prop stands on the bottom edge of its cell, keeps its aspect ratio and is drawn
  `cells` map cells wide (manifest field, default 1.3). A tree drawn at 256x448 with
  `"cells": 1.4` rises about 2.5 cells. Half of the cells mirror it.
- Light comes from the top left, as in the rest of the art. Transparent background.
- Only manifest entries are needed; there are no placeholders for props:

  ```json
  "prop/FA/tree_0": { "file": "prop/FA/tree_0.png", "w": 256, "h": 448, "cells": 1.4 }
  ```

- Without props, forests get textured tree crowns, mountains get faceted peaks that grow
  towards the middle of a range, and deposits get boulders, all cut from the terrain tiles.

**Icons, pickups and effects**
- `icon/*` are HUD resource icons, drawn at 14–28 px; keep them bold and simple.
- `pickup/*` are loot on the map. `barrel` and `raven` are map objects.
- `mayor/m` and `mayor/f` are mayor portraits.
- `fx/*` are effects:
  - `arrow`, `bolt` and `rocket` are projectiles and point right;
  - `blast` and `acidsplash` are explosions;
  - `blood` and `ichor` are corpses;
  - `ring` is used for pulses.

## manifest.json

Each key maps to an entry like this:

```json
"unit/ranger": { "file": "unit/ranger.png", "w": 64, "h": 64, "frames": 1, "fps": 8, "ax": 0.5, "ay": 0.5 }
```

| Field | Meaning |
|---|---|
| `file` | Path under `assets/` |
| `w`, `h` | Size of **one frame** in pixels |
| `frames` | Number of frames laid out **horizontally** in one strip (default 1) |
| `fps` | Animation speed for strips, looping (default 8) |
| `ax`, `ay` | Anchor as a fraction of the frame. Units are 0.5, 0.5 (centre); buildings and terrain are 0, 0 (top-left) |

Example: a 6-frame walk cycle for the Ranger, with each frame 96x96 px, saved as one
576x96 strip:

```json
"unit/ranger_walk": { "file": "unit/ranger_walk.png", "w": 96, "h": 96, "frames": 6, "fps": 12 }
```

## Regenerating placeholders

```sh
npm run assets             # node tools/gen-placeholders.mjs
```

This writes placeholders only for files that do not exist yet, so **your art is never
overwritten**. It keeps your manifest settings for those files and rebuilds
`assets/SPRITES.md`. Use `--force` to reset everything back to placeholders.

Run it after a game update adds new buildings or units, to create their placeholder files.

The tool needs Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).

## Sound

Sounds are synthesized placeholders until real files are added. Put files in
`assets/audio/` and list them in `assets/audio/manifest.json`. One-shot sounds map a key
to a file; `music` and `ambience` map a mood or a map to one file or a list of files:

```json
{
  "rifle": "sfx/rifle.mp3",
  "bite": ["sfx/bite.mp3"],
  "music": { "menu": "music/menu.mp3", "calm": ["music/calm_1.mp3", "music/calm_2.mp3"], "swarm": "music/swarm.mp3" },
  "ambience": { "FA": "ambience/deep_forest.mp3" }
}
```

Any key you leave out keeps its current behaviour. Use short, normalised clips for
one-shots. MP3 works everywhere; OGG does not play on old Safari.

| Key | Played when |
|---|---|
| `bow`, `rifle`, `sniper`, `flame`, `rocket` | Ranger, Soldier, Sniper, Pyro, and Rocketeer rockets fire |
| `mg`, `ballista`, `zap` | Titan, Executor and Wasp fire; Great Ballista fires; Shocking Tower pulses |
| `hit` | Rocketeer and Mutant melee hits |
| `explosion` | Rockets, mines and barrels explode; nests are destroyed |
| `collapse` | A building is destroyed (uses `explosion` until it has a file) |
| `infect` | A building is overrun and turns infected (uses `groan` until it has a file) |
| `bite`, `spit`, `smash` | Infected melee, Venom acid, Giant and Behemoth blows (silent until they have files) |
| `zdie` | An infected dies (silent until it has a file) |
| `trained` | A unit leaves its training building (silent until it has a file) |
| `gate` | A gate opens |
| `die` | A colony unit dies |
| `build`, `complete` | Construction starts / finishes |
| `research` | A technology finishes |
| `click`, `error` | UI feedback |
| `alert` | The colony is under attack |
| `horde` | A swarm is announced or arrives |
| `victory`, `defeat` | Wonder completed or game won / game lost |
| `groan` | Reserved for infected ambience |

**Voice lines** play when you select or command units, as in the original game. The
game tries `voice_<unit>_<what>` first, then `voice_<what>`, where `<what>` is
`select`, `move`, `attack`, `garrison` or `pickup` and `<unit>` is `ranger`, `soldier`,
`sniper`, `pyro`, `rocketeer`, `titan` or `mutant`. They are silent until they have files.

**Music** is streamed and crossfades between moods:

| Mood | Plays |
|---|---|
| `menu` | Title and menus |
| `calm` | Building the colony; a list of tracks plays in random order |
| `tension` | From a swarm warning until it arrives |
| `swarm` | For 150 game seconds after a swarm arrives, then back to `calm` |
| `final` | From the final-wave warning to the end |
| `victory`, `defeat` | Once, on the result screen |

**Ambience** loops quietly under the music during a game: one entry per map id (`FA`,
`BR`, `TM`, `AL`, `DS`, `VO`). The **Music** setting turns music and ambience off
without muting sound effects.
