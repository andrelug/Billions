# Billions artwork

Open the [art catalog](index.html) through the game's local server at
`http://localhost:8080/art/`. The original package has 315 base sprites and 36 character
animation strips. The October replacements are partially installed; see
[update status](UPDATE-STATUS.md) for the remaining work. The catalog refreshes every 15 seconds, and its live
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
- `tools/art-prompts.mjs` defines the prompt set for the original sprites, biome props and UI skin.
- `tools/animation-prompts.mjs` defines 36 additional walk and attack strips,
  using the original character images as visual references.
- Full-resolution originals remain in Codex's generated-image storage; the
  renderer depends only on the PNGs saved in this repository.

Generation uses the built-in image tool. The prompt module prepares requests;
it does not call a paid API or generate images itself. The installer resizes
the generated images with macOS `sips` and uses a small Swift/CoreGraphics
exporter for centered character padding. New character exports use 256-pixel frames, a body near 75% of the frame height,
and a fixed foot anchor at (50%, 90%). Oversized weapon poses must be regenerated
if fitting them shrinks the body below the brief's target. It updates the manifest
and ledger, and keeps `assets/SPRITES.md` in sync with the delivered sizes:

```sh
node tools/install-art.mjs building/tent /absolute/path/to/generated.png
python3 tools/verify-art.py
```

The verifier needs Pillow and decodes all manifest files, checking dimensions,
alpha, bottom anchors and delivered-file hashes. `npm run assets` continues to preserve these
images. The October update uses six walk frames at 10 fps and four attack frames at
12 fps. When a new idle is installed without its new strips, incompatible old
strips are deferred in `deferred-legacy-strips.json`; the renderer uses the new
idle until its strips arrive. Unchanged characters retain their old strips.
Their manifest dimensions describe one frame, and the PNG
contains the frames in a horizontal row. The animation exporter uses a shared
scale and fixed anchors across all frames. It separates poses at transparent
gaps, or isolates complete silhouettes when a diagonal weapon crosses a nominal
cell boundary. It rejects touching or ambiguous silhouettes. Installed strips
play in the catalog and are picked up automatically by the game. The game retains
its synthesized sounds.

## October 2026 volume and scale update

The delivery brief covers 320 images and strips, plus the Cinzel font and UI colours.
`tools/asset-update-spec.mjs` defines tall building sizes, 126 biome props and 41 UI
assets. `tools/art-prompts.mjs` and `tools/animation-prompts.mjs` contain the prompts.
`art/update-jobs.json` is a snapshot of the requested deliveries. Generate one asset
per built-in image-tool call; animation strips use their new still character as a
visual reference. Screenshots of They Are Billions guide scale and composition;
the delivered art is original.

Installed October art has `update: "tab-scale-2026-10"` in `generated.json`. Previous
art stays available while remaining replacements are generated. Check actual
progress with `node tools/art-update-status.mjs`; `--require-complete` fails until
every requested image is delivered. Do not equate the original catalog's generated
count with completion of this update.

UI corners use the brief's image-pixel slices, with compact screen-pixel borders to
preserve the mobile layout. Cinzel is bundled in `assets/ui/cinzel.woff2` under the
SIL Open Font License; its copyright and licence are in `assets/ui/OFL.txt`.

`tools/anchor-object.swift` moves the already resized visible building/prop base
to the bottom of its canvas without repainting pixels. Rejected character poses
are preserved in `rework.json` and `rework/` for targeted edits after generation resumes.
