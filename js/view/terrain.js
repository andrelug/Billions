import { PX } from './placeholder.js';
import { T } from '../sim/worldgen.js';

// Terrain is drawn from baked chunk canvases (CHUNK x CHUNK tiles). Chunks are
// baked lazily at a resolution matched to the current zoom and kept in a small
// LRU cache, so even 256x256 maps stay within phone memory.
const CHUNK = 16;
const VOL_UP = 2;      // procedural volume rises at most this many cells above its own cell
const PROP_UP = 3;     // prop art may rise this many cells
const BAKES_PER_FRAME = 3;   // chunks rebaked per frame when an older copy can stand in

// Which kind of volume a cell carries, if any, and the prop art that can
// replace it (prop/<map>/<name>_<n>).
function volumeKind(W, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return null;
  const t = W.tiles[tx + ty * W.w];
  return t === T.FOREST ? 'tree' : t === T.MOUNTAIN ? 'rock' : t === T.STONE || t === T.IRON || t === T.GOLD ? 'ore' : null;
}
export const PROP_NAMES = { [T.FOREST]: 'tree', [T.MOUNTAIN]: 'rock', [T.STONE]: 'stone', [T.IRON]: 'iron', [T.GOLD]: 'gold' };
function isKind(W, tx, ty, k) { return volumeKind(W, tx, ty) === k; }
// Stable pseudo-random value in [0, 1) per cell and channel.
function hash(x, y, k) { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); }
function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); }

// A rounded tree crown lit from the top left. Some cells add a second,
// smaller crown so the forest edge is irregular.
function drawCanopy(g, pat, tx, ty, px, py, res) {
  const crowns = [[0.5 + (hash(tx, ty, 1) - 0.5) * 0.3, 0.36 + (hash(tx, ty, 2) - 0.5) * 0.2, 0.5 + hash(tx, ty, 3) * 0.22]];
  if (hash(tx, ty, 4) > 0.4) crowns.push([0.5 + (hash(tx, ty, 5) - 0.5) * 0.8, 0.22 + (hash(tx, ty, 6) - 0.5) * 0.3, 0.3 + hash(tx, ty, 7) * 0.14]);
  crowns.sort((a, b) => a[1] - b[1]);
  for (const [fx, fy, fr] of crowns) {
    const x = px + fx * res, y = py + fy * res, r = fr * res;
    g.fillStyle = pat; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    const sh = g.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.02);
    sh.addColorStop(0, 'rgba(255,248,200,0.26)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,12,0,0.5)');
    g.fillStyle = sh; g.fill();
  }
}

// A rock peak: a jagged, textured pyramid standing on its cell, its left
// face lit and its right face in shade. Peaks grow taller the deeper they sit
// inside a mountain range, so ranges rise towards their middle and their
// edges stay low next to the ground you build on.
function drawRock(g, pat, W, tx, ty, px, py, res) {
  let depth = 0;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) if (isKind(W, tx + dx, ty + dy, 'rock')) depth++;
  const h = (0.45 + depth * 0.085 + hash(tx, ty, 2) * 0.4) * res;           // 0.45..1.5 cells
  const base = py + res * (0.96 + (hash(tx, ty, 3) - 0.5) * 0.08);
  const cx = px + res * (0.5 + (hash(tx, ty, 1) - 0.5) * 0.36), half = res * (0.74 + hash(tx, ty, 4) * 0.22);
  const ax = cx + (hash(tx, ty, 5) - 0.5) * res * 0.5, ay = base - h;
  const lx = cx - half * (0.5 + hash(tx, ty, 6) * 0.25), ly = base - h * (0.55 + hash(tx, ty, 7) * 0.25);
  const rx = cx + half * (0.5 + hash(tx, ty, 11) * 0.25), ry = base - h * (0.5 + hash(tx, ty, 12) * 0.25);
  const mx = cx + (hash(tx, ty, 13) - 0.5) * res * 0.2;
  const outline = () => { g.beginPath(); g.moveTo(cx - half, base); g.lineTo(lx, ly); g.lineTo(ax, ay); g.lineTo(rx, ry); g.lineTo(cx + half, base); g.closePath(); };
  outline(); g.fillStyle = pat; g.fill();
  // Lit left face and shaded right face, split by a ridge from the apex.
  g.beginPath(); g.moveTo(cx - half, base); g.lineTo(lx, ly); g.lineTo(ax, ay); g.lineTo(mx, base); g.closePath();
  g.fillStyle = 'rgba(255,246,222,0.14)'; g.fill();
  g.beginPath(); g.moveTo(mx, base); g.lineTo(ax, ay); g.lineTo(rx, ry); g.lineTo(cx + half, base); g.closePath();
  g.fillStyle = 'rgba(12,10,8,0.46)'; g.fill();
  // Darken the foot of the rock where it meets the ground.
  const lg = g.createLinearGradient(0, base - h * 0.35, 0, base);
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(8,6,4,0.4)');
  outline(); g.fillStyle = lg; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = Math.max(1, res / 40); g.stroke();
}

// Two boulders per ore deposit cell.
function oreBoulder(tx, ty, i, px, py, res) {
  return { x: px + res * (i ? 0.66 : 0.34) + (hash(tx, ty, 20 + i) - 0.5) * res * 0.16, y: py + res * (i ? 0.62 : 0.4) + (hash(tx, ty, 22 + i) - 0.5) * res * 0.14, r: res * (0.26 + hash(tx, ty, 24 + i) * 0.1) };
}
function drawBoulder(g, pat, b, res) {
  g.beginPath(); g.ellipse(b.x, b.y, b.r * 1.08, b.r * 0.9, 0, 0, 7);
  g.fillStyle = pat; g.fill();
  const sh = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r * 1.1);
  sh.addColorStop(0, 'rgba(255,250,230,0.32)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,8,6,0.5)');
  g.fillStyle = sh; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(1, res / 48); g.stroke();
}

export class TerrainLayer {
  constructor(world, assets, tileKey) {
    this.world = world; this.assets = assets; this.tileKey = tileKey;
    this.cache = new Map();    // `${res}:${cx},${cy}` -> canvas
    this.maxBytes = 72 * 1024 * 1024;
    this.bytes = 0;
    this.version = 0;          // bump to invalidate all chunks (terrain changed)
    this.dirtyChunks = new Set();
  }

  // A tile's volume and shadow spill into the cells around it, which may sit
  // in a neighbouring chunk, so those chunks are rebaked too.
  invalidateTile(tx, ty) {
    for (let dy = -VOL_UP - 1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy; if (x < 0 || y < 0) continue;
      this.dirtyChunks.add(((x / CHUNK) | 0) + ',' + ((y / CHUNK) | 0));
    }
  }

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
    c.width = tw * res; c.height = th * res; c.res = res;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
      if (this.flat) { g.fillStyle = this.flat[W.tiles[tx + ty * W.w]]; g.fillRect(x * res, y * res, res + 0.5, res + 0.5); continue; }
      const a = this.assets.get(this.tileKey(tx, ty));
      if (a) g.drawImage(a.img, 0, 0, a.w, a.h, x * res, y * res, res + 0.5, res + 0.5);
    }
    if (!this.flat) this.bakeVolume(g, cx * CHUNK, cy * CHUNK, tw, th, res);
    this.cache.set(key, c);
    this.bytes += c.width * c.height * 4;
    while (this.bytes > this.maxBytes && this.cache.size > 4) {
      const [k, old] = this.cache.entries().next().value;
      this.cache.delete(k); this.bytes -= old.width * old.height * 4;
    }
    return c;
  }

  // Forests, mountains and ore deposits get volume: each such cell draws a
  // tree crown or a rock mass that rises a little above its cell and casts a
  // shadow down and to the right, so they read as natural walls around the
  // open ground, as in They Are Billions. The shapes are textured with the
  // cell's own tile art. Prop art replaces them when the manifest lists it:
  // prop/<map>/tree_<n> (forest), rock_<n> (mountain), stone_<n>, iron_<n>
  // and gold_<n> (deposits).
  // Cells of neighbouring chunks are drawn too, clipped to this chunk, so
  // shapes cross chunk seams without breaks. Rows go from back to front.
  bakeVolume(g, x0, y0, tw, th, res) {
    const W = this.world, pats = new Map();
    const pattern = (tx, ty) => {
      const key = this.tileKey(tx, ty);
      if (pats.has(key)) return pats.get(key);
      const a = this.assets.get(key);
      let p = null;
      if (a) { p = g.createPattern(a.img, 'repeat'); if (p && p.setTransform) p.setTransform(new DOMMatrix([res / a.w, 0, 0, res / a.h, 0, 0])); }
      pats.set(key, p);
      return p;
    };
    const props = this.props || {};
    const ya = y0 - 1, yb = y0 + th + VOL_UP + (props.any ? PROP_UP : 0), xa = x0 - 2, xb = x0 + tw + 2;
    // Shadows first, so every volume stands on top of every shadow.
    g.fillStyle = 'rgba(8,10,6,0.30)';
    for (let ty = ya; ty < yb; ty++) for (let tx = xa; tx < xb; tx++) {
      const k = volumeKind(W, tx, ty); if (!k) continue;
      const px = (tx - x0) * res, py = (ty - y0) * res;
      if (k === 'ore') {
        for (let i = 0; i < 2; i++) { const b = oreBoulder(tx, ty, i, px, py, res); ellipse(g, b.x + b.r * 0.35, b.y + b.r * 0.45, b.r * 1.05, b.r * 0.7); }
      } else {
        const r = res * (k === 'tree' ? 0.66 : 0.7);
        ellipse(g, px + res * 0.72, py + res * 0.78, r, r * 0.72);
      }
    }
    for (let ty = ya; ty < yb; ty++) for (let tx = xa; tx < xb; tx++) {
      const k = volumeKind(W, tx, ty); if (!k) continue;
      const px = (tx - x0) * res, py = (ty - y0) * res;
      const set = props[PROP_NAMES[W.tiles[tx + ty * W.w]]];
      if (set && set.length) { this.drawProp(g, set[(hash(tx, ty, 9) * set.length) | 0], tx, ty, px, py, res); continue; }
      const pat = pattern(tx, ty);
      if (!pat) continue;
      if (k === 'tree') drawCanopy(g, pat, tx, ty, px, py, res);
      else if (k === 'rock') drawRock(g, pat, W, tx, ty, px, py, res);
      else for (let i = 0; i < 2; i++) drawBoulder(g, pat, oreBoulder(tx, ty, i, px, py, res), res);
    }
  }

  // Prop art stands on the bottom edge of its cell, jittered and scaled a
  // little per cell. Its width is `cells` map cells (manifest field, default
  // 1.3) and it keeps its aspect ratio, so a tall tree rises over the cells
  // behind it. Half the cells mirror it.
  drawProp(g, key, tx, ty, px, py, res) {
    const a = this.assets.get(key); if (!a) return;
    const k = 0.88 + hash(tx, ty, 3) * 0.24, w = (a.cells || 1.3) * res * k, h = w * a.h / a.w;
    const bx = px + res * (0.5 + (hash(tx, ty, 4) - 0.5) * 0.2), by = py + res * (0.92 + (hash(tx, ty, 5) - 0.5) * 0.1);
    if (hash(tx, ty, 6) < 0.5) { g.save(); g.translate(bx, 0); g.scale(-1, 1); g.drawImage(a.img, 0, 0, a.w, a.h, -w / 2, by - h, w, h); g.restore(); }
    else g.drawImage(a.img, 0, 0, a.w, a.h, bx - w / 2, by - h, w, h);
  }

  draw(ctx, cam) {
    const res = this.resFor(cam.scale);
    const b = cam.bounds(0), W = this.world;
    const cx0 = Math.max(0, Math.floor(b.fx0 / CHUNK)), cy0 = Math.max(0, Math.floor(b.fy0 / CHUNK));
    const cx1 = Math.min(Math.ceil(W.w / CHUNK) - 1, Math.floor(b.fx1 / CHUNK)), cy1 = Math.min(Math.ceil(W.h / CHUNK) - 1, Math.floor(b.fy1 / CHUNK));
    ctx.imageSmoothingEnabled = cam.scale * 2 < res * 1.5;
    // Baking a chunk with its forests and rocks takes a few milliseconds, so
    // after a zoom step only a few are rebaked per frame; the others show
    // their copy at another resolution until their turn comes.
    let baked = 0;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      let c = this.ready(cx, cy, res);
      if (!c) { c = baked < BAKES_PER_FRAME ? null : this.stand(cx, cy); if (!c) { c = this.chunk(cx, cy, res); baked++; } }
      const [sx, sy] = cam.toScreen(cx * CHUNK, cy * CHUNK);
      const sw = c.width / c.res * cam.scale, sh = c.height / c.res * cam.scale;
      ctx.drawImage(c, Math.floor(sx), Math.floor(sy), Math.ceil(sw) + 1, Math.ceil(sh) + 1);
    }
  }

  // The cached chunk at this resolution, if it is current.
  ready(cx, cy, res) {
    const ck = cx + ',' + cy;
    if (this.dirtyChunks.has(ck)) return null;
    const key = res + ':' + ck, c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); }
    return c || null;
  }
  // Any current copy of the chunk, at the resolution closest to sharp.
  stand(cx, cy) {
    const ck = cx + ',' + cy;
    if (this.dirtyChunks.has(ck)) return null;
    for (const r of [PX, 40, 24, 12]) { const c = this.cache.get(r + ':' + ck); if (c) return c; }
    return null;
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
