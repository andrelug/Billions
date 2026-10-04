import { PX } from './placeholder.js';

// Terrain is drawn from baked chunk canvases (CHUNK x CHUNK tiles). Chunks are
// baked lazily at a resolution matched to the current zoom and kept in a small
// LRU cache, so even 256x256 maps stay within phone memory.
const CHUNK = 16;

export class TerrainLayer {
  constructor(world, assets, tileKey) {
    this.world = world; this.assets = assets; this.tileKey = tileKey;
    this.cache = new Map();    // `${res}:${cx},${cy}` -> canvas
    this.maxBytes = 72 * 1024 * 1024;
    this.bytes = 0;
    this.version = 0;          // bump to invalidate all chunks (terrain changed)
    this.dirtyChunks = new Set();
  }

  invalidateTile(tx, ty) { this.dirtyChunks.add(((tx / CHUNK) | 0) + ',' + ((ty / CHUNK) | 0)); }

  resFor(scale) {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2), want = scale * dpr;
    return want <= 12 ? 12 : want <= 24 ? 24 : want <= 40 ? 40 : PX;
  }

  chunk(cx, cy, res) {
    const key = res + ':' + cx + ',' + cy;
    const ck = cx + ',' + cy;
    if (this.dirtyChunks.has(ck)) {
      for (const r of [12, 24, 40, PX]) { const k = r + ':' + ck; const c = this.cache.get(k); if (c) { this.bytes -= c.width * c.height * 4; this.cache.delete(k); } }
      this.dirtyChunks.delete(ck);
    }
    let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }
    c = document.createElement('canvas');
    const W = this.world;
    const tw = Math.min(CHUNK, W.w - cx * CHUNK), th = Math.min(CHUNK, W.h - cy * CHUNK);
    c.width = tw * res; c.height = th * res;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
      if (this.flat) { g.fillStyle = this.flat[W.tiles[tx + ty * W.w]]; g.fillRect(x * res, y * res, res + 0.5, res + 0.5); continue; }
      const a = this.assets.get(this.tileKey(tx, ty));
      if (a) g.drawImage(a.img, 0, 0, a.w, a.h, x * res, y * res, res + 0.5, res + 0.5);
    }
    this.cache.set(key, c);
    this.bytes += c.width * c.height * 4;
    while (this.bytes > this.maxBytes && this.cache.size > 4) {
      const [k, old] = this.cache.entries().next().value;
      this.cache.delete(k); this.bytes -= old.width * old.height * 4;
    }
    return c;
  }

  draw(ctx, cam) {
    const res = this.resFor(cam.scale);
    const b = cam.bounds(0), W = this.world;
    const cx0 = Math.max(0, Math.floor(b.fx0 / CHUNK)), cy0 = Math.max(0, Math.floor(b.fy0 / CHUNK));
    const cx1 = Math.min(Math.ceil(W.w / CHUNK) - 1, Math.floor(b.fx1 / CHUNK)), cy1 = Math.min(Math.ceil(W.h / CHUNK) - 1, Math.floor(b.fy1 / CHUNK));
    ctx.imageSmoothingEnabled = cam.scale * 2 < res * 1.5;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = this.chunk(cx, cy, res);
      const [sx, sy] = cam.toScreen(cx * CHUNK, cy * CHUNK);
      const sw = c.width / res * cam.scale, sh = c.height / res * cam.scale;
      ctx.drawImage(c, Math.floor(sx), Math.floor(sy), Math.ceil(sw) + 1, Math.ceil(sh) + 1);
    }
  }
}

// Fog of war: a 1-pixel-per-tile canvas, smoothed when scaled up so edges are soft.
export class FogLayer {
  constructor(vision) {
    this.v = vision;
    this.c = document.createElement('canvas');
    this.c.width = vision.w; this.c.height = vision.h;
    this.g = this.c.getContext('2d');
    this.img = this.g.createImageData(vision.w, vision.h);
  }
  refresh() {
    const v = this.v, d = this.img.data, n = v.w * v.h;
    for (let i = 0, j = 3; i < n; i++, j += 4) {
      d[j] = v.revealAll || v.visible[i] ? 0 : v.explored[i] ? 120 : 255;
    }
    this.g.putImageData(this.img, 0, 0);
    v.dirty = false;
  }
  draw(ctx, cam) {
    if (this.v.dirty) this.refresh();
    const [sx, sy] = cam.toScreen(0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.c, sx, sy, this.v.w * cam.scale, this.v.h * cam.scale);
  }
}
