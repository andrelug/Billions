import { drawPlaceholder, PX } from './placeholder.js';

// Loads sprites listed in assets/manifest.json. Any entry whose file is missing
// or fails to decode falls back to a procedurally drawn placeholder, so the
// artist can replace PNG files one at a time without breaking the game.
//
// Manifest entry: { file, w, h, frames?, fps?, ax?, ay?, cells? }
// Units and infected may add "<key>_walk" and "<key>_attack" entries.
//  - w, h: size of ONE frame in pixels (64 px = 1 map tile)
//  - frames: horizontal strip of frames (default 1); fps: animation speed
//  - ax, ay: anchor as a fraction of the frame (default 0.5, 0.5 for units,
//            0, 0 for buildings and terrain)
//  - cells: width in map cells of a terrain prop (default 1.3)
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
    this.manifest = manifest;
    const keys = [...this.specs.keys()];
    let done = 0;
    await Promise.all(keys.map(async (key) => {
      const spec = this.specs.get(key);
      const m = manifest[key] || {};
      const entry = {
        w: m.w || spec.w, h: m.h || spec.h, frames: m.frames || 1, fps: m.fps || 8,
        ax: m.ax != null ? m.ax : spec.ax, ay: m.ay != null ? m.ay : spec.ay, cells: m.cells, img: null,
      };
      if (m.file) entry.img = await loadImage(this.base + m.file).catch(() => null);
      if (!entry.img) { entry.img = this.placeholder(spec); entry.frames = 1; entry.w = spec.w; entry.h = spec.h; }
      this.entries.set(key, entry);
      done++; if (onProgress) onProgress(done / keys.length);
    }));
    // Optional extra sprites that only exist in the manifest, such as
    // animation states ("unit/ranger_walk", "infected/young_attack") and
    // terrain props ("prop/FA/tree_0"). They have no placeholder: when
    // missing, the base sprite or the procedural terrain volume is used.
    await Promise.all(Object.keys(manifest).filter((k) => !this.specs.has(k) && !k.startsWith('ui/') && manifest[k].file).map(async (key) => {
      const m = manifest[key], base = this.entries.get(key.replace(/_(walk|attack)$/, ''));
      const img = await loadImage(this.base + m.file).catch(() => null);
      if (!img) return;
      this.entries.set(key, {
        img, w: m.w || img.width / (m.frames || 1), h: m.h || img.height, frames: m.frames || 1, fps: m.fps || 8,
        ax: m.ax != null ? m.ax : base ? base.ax : 0.5, ay: m.ay != null ? m.ay : base ? base.ay : 0.5, cells: m.cells,
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
  keys(prefix) { return [...this.entries.keys()].filter((k) => k.startsWith(prefix)).sort(); }

  // Where the character sits inside a unit or infected frame, as fractions of
  // the frame: top and bottom of the opaque pixels, and the centre of the
  // feet (the bottom fifth of the body). Measured once from the first frame,
  // so art with any amount of padding is drawn at the same body height.
  figure(key) {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.fig) return e.fig;
    e.fig = { top: 0.25, bottom: 0.75, cx: 0.5 };
    try {
      const c = document.createElement('canvas');
      c.width = e.w; c.height = e.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(e.img, 0, 0, e.w, e.h, 0, 0, e.w, e.h);
      const d = g.getImageData(0, 0, e.w, e.h).data;
      let top = -1, bottom = -1;
      for (let y = 0; y < e.h && top < 0; y++) for (let x = 0; x < e.w; x++) if (d[(x + y * e.w) * 4 + 3] > 40) { top = y; break; }
      for (let y = e.h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < e.w; x++) if (d[(x + y * e.w) * 4 + 3] > 40) { bottom = y + 1; break; }
      if (top >= 0 && bottom > top) {
        let sx = 0, n = 0;
        const y0 = Math.floor(bottom - (bottom - top) * 0.2);
        for (let y = y0; y < bottom; y++) for (let x = 0; x < e.w; x++) if (d[(x + y * e.w) * 4 + 3] > 40) { sx += x; n++; }
        e.fig = { top: top / e.h, bottom: bottom / e.h, cx: n ? (sx / n + 0.5) / e.w : 0.5 };
      }
    } catch (err) { /* tainted or unreadable image: keep the default framing */ }
    return e.fig;
  }

  // The part of a frame that holds opaque pixels in any frame of the strip,
  // in frame pixels. Drawing only this rectangle skips the transparent
  // padding, which is most of the area of a character sprite.
  crop(key) {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.crop) return e.crop;
    e.crop = { x: 0, y: 0, w: e.w, h: e.h };
    try {
      const W = e.w * e.frames, c = document.createElement('canvas');
      c.width = W; c.height = e.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(e.img, 0, 0, W, e.h, 0, 0, W, e.h);
      const d = g.getImageData(0, 0, W, e.h).data;
      let x0 = e.w, y0 = e.h, x1 = -1, y1 = -1;
      for (let y = 0; y < e.h; y++) for (let x = 0; x < W; x++) {
        if (d[(x + y * W) * 4 + 3] <= 8) continue;
        const fx = x % e.w;
        if (fx < x0) x0 = fx; if (fx > x1) x1 = fx; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 >= x0) {
        x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(e.w - 1, x1 + 1); y1 = Math.min(e.h - 1, y1 + 1);
        e.crop = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      }
    } catch (err) { /* keep the whole frame */ }
    return e.crop;
  }
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
