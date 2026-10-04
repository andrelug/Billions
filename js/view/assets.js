import { drawPlaceholder, PX } from './placeholder.js';

// Loads sprites listed in assets/manifest.json. Any entry whose file is missing
// or fails to decode falls back to a procedurally drawn placeholder, so the
// artist can replace PNG files one at a time without breaking the game.
//
// Manifest entry: { file, w, h, frames?, fps?, ax?, ay? }
// Units and infected may add "<key>_walk" and "<key>_attack" entries.
//  - w, h: size of ONE frame in pixels (64 px = 1 map tile)
//  - frames: horizontal strip of frames (default 1); fps: animation speed
//  - ax, ay: anchor as a fraction of the frame (default 0.5, 0.5 for units,
//            0, 0 for buildings and terrain)
export class Assets {
  constructor(specs) {
    this.specs = new Map(specs.map((s) => [s.key, s]));   // placeholder specs from game data
    this.entries = new Map();                               // key -> {img, w, h, frames, fps, ax, ay}
    this.base = 'assets/';
  }

  async load(onProgress) {
    let manifest = {};
    try {
      const res = await fetch(this.base + 'manifest.json', { cache: 'no-cache' });
      if (res.ok) manifest = await res.json();
    } catch (e) { /* offline or missing: placeholders only */ }
    const keys = [...this.specs.keys()];
    let done = 0;
    await Promise.all(keys.map(async (key) => {
      const spec = this.specs.get(key);
      const m = manifest[key] || {};
      const entry = {
        w: m.w || spec.w, h: m.h || spec.h, frames: m.frames || 1, fps: m.fps || 8,
        ax: m.ax != null ? m.ax : spec.ax, ay: m.ay != null ? m.ay : spec.ay, img: null,
      };
      if (m.file) entry.img = await loadImage(this.base + m.file).catch(() => null);
      if (!entry.img) { entry.img = this.placeholder(spec); entry.frames = 1; entry.w = spec.w; entry.h = spec.h; }
      this.entries.set(key, entry);
      done++; if (onProgress) onProgress(done / keys.length);
    }));
    // Optional extra sprites that only exist in the manifest, such as
    // animation states ("unit/ranger_walk", "infected/young_attack"). They have
    // no placeholder: when missing, the base sprite is used.
    await Promise.all(Object.keys(manifest).filter((k) => !this.specs.has(k) && manifest[k].file).map(async (key) => {
      const m = manifest[key], base = this.entries.get(key.replace(/_(walk|attack)$/, ''));
      const img = await loadImage(this.base + m.file).catch(() => null);
      if (!img) return;
      this.entries.set(key, {
        img, w: m.w || img.width / (m.frames || 1), h: m.h || img.height, frames: m.frames || 1, fps: m.fps || 8,
        ax: m.ax != null ? m.ax : base ? base.ax : 0.5, ay: m.ay != null ? m.ay : base ? base.ay : 0.5,
      });
    }));
  }

  placeholder(spec) {
    const c = document.createElement('canvas');
    c.width = spec.w; c.height = spec.h;
    drawPlaceholder(c.getContext('2d'), spec);
    return c;
  }

  get(key) { return this.entries.get(key) || null; }
  has(key) { return this.entries.has(key); }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export { PX };
