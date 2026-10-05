# Billions artwork

Open the [art catalog](index.html) through the game's local server at
`http://localhost:8080/art/`. All 315 base sprites and 36 character animation strips
are installed. The catalog refreshes every 15 seconds, and its live
replacement count comes from `generated.json`. Terrain thumbnails repeat at
64 pixels so tile seams can be inspected.

## Art direction

Original detailed painterly steampunk colony-survival art: weathered timber,
warm stone and brass, teal roofs, blue colony accents, muted natural terrain,
and distinct infected silhouettes. Lighting comes from the upper left.
Buildings use a high three-quarter view; characters face right.

## Files and prompts

- The game-ready PNGs replace their matching files in `assets/`.
- `assets/manifest.json` records actual delivered frame sizes. Buildings, units,
  icons, pickups, portraits and effects use twice the reference resolution.
  Terrain remains 64 × 64 pixels to match the game's terrain cache.
- `generated.json` records the exact prompt, built-in `image_gen` provider,
  source path, destination, dimensions and SHA-256 hash for each installed PNG.
- `tools/art-prompts.mjs` defines the prompt set for all 315 sprite keys.
- `tools/animation-prompts.mjs` defines 36 additional walk and attack strips,
  using the original character images as visual references.
- Full-resolution originals remain in Codex's generated-image storage; the
  renderer depends only on the PNGs saved in this repository.

Generation uses the built-in image tool. The prompt module prepares requests;
it does not call a paid API or generate images itself. The installer resizes
the generated images with macOS `sips` and uses a small Swift/CoreGraphics
exporter for centered character padding. Character bodies stay near the middle
40% of the frame, with room for right-facing weapons. It updates the manifest
and ledger, and keeps `assets/SPRITES.md` in sync with the delivered sizes:

```sh
node tools/install-art.mjs building/tent /absolute/path/to/generated.png
python3 tools/verify-art.py
```

The verifier needs Pillow and decodes all manifest files, checking dimensions,
alpha and delivered-file hashes. `npm run assets` continues to preserve these
images. Walk strips contain four frames at 8 fps; attack strips contain four
frames at 12 fps. Their manifest dimensions describe one frame, and the PNG
contains the frames in a horizontal row. The animation exporter uses a shared
scale and fixed anchors across all frames. It separates poses at transparent
gaps, or isolates complete silhouettes when a diagonal weapon crosses a nominal
cell boundary. It rejects touching or ambiguous silhouettes. Installed strips
play in the catalog and are picked up automatically by the game. The game retains
its synthesized sounds.
