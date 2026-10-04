# Art and sound guide

All art in this repository is temporary. Every sprite is a generated placeholder, so you
can replace them **one file at a time**: the game picks up whatever is in `assets/` and
falls back to a drawn placeholder for any file that is missing or fails to load. No code
changes are needed.

- `assets/SPRITES.md` lists every sprite: its key, file, size and what it is.
- `assets/manifest.json` tells the game how to cut and place each image.

## Quick start

1. Find the sprite in `assets/SPRITES.md`, for example `building/tent → assets/building/tent.png, 128x128`.
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
- Centred on the entity's position, with the anchor at the middle of the image.
- Draw them **facing right**; the game mirrors them when they face left.
- The image box is about 2.6 times the unit's collision radius. Keep the body inside the
  middle ~40% of the box so that crowds read well.
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

Sounds are synthesized placeholders. To use real files, create
`assets/audio/manifest.json` that maps sound keys to files in `assets/audio/`:

```json
{ "rifle": "rifle.ogg", "horde": "horde.mp3" }
```

Any key you leave out keeps its synthesized sound. Use short, normalised clips; OGG or
MP3 work everywhere except old Safari, where you should use MP3 or M4A.

| Key | Played when |
|---|---|
| `bow`, `rifle`, `sniper`, `flame`, `rocket` | Ranger, Soldier, Sniper, Pyro, and Rocketeer rockets fire |
| `mg`, `ballista`, `zap` | Titan, Executor and Wasp fire; Great Ballista fires; Shocking Tower pulses |
| `hit` | Rocketeer and Mutant melee hits |
| `explosion` | Rockets, mines and barrels explode; buildings and nests are destroyed |
| `gate` | A gate opens |
| `die` | A colony unit dies |
| `build`, `complete` | Construction starts / finishes |
| `research` | A technology finishes |
| `click`, `error` | UI feedback |
| `alert` | The colony is under attack |
| `horde` | A swarm is announced or arrives |
| `victory`, `defeat` | Wonder completed or game won / game lost |
| `groan` | Reserved for infected ambience |

There is no music yet. A `music` key would need a small loader change, because the
manifest above is for one-shot sounds.
