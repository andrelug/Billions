import { Rng } from '../core/rng.js';
import { smooth, lerp } from '../core/util.js';

// Terrain codes. Behaviour per code lives in data/terrain.js.
export const T = { GRASS: 0, FOREST: 1, MOUNTAIN: 2, STONE: 3, IRON: 4, GOLD: 5, WATER: 6, OIL: 7, MUD: 8 };

function valueNoise(rng, w, h, scale) {
  const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / scale, y0 = Math.floor(fy), ty = smooth(fy - y0);
    for (let x = 0; x < w; x++) {
      const fx = x / scale, x0 = Math.floor(fx), tx = smooth(fx - x0);
      const a = g[x0 + y0 * gw], b = g[x0 + 1 + y0 * gw], c = g[x0 + (y0 + 1) * gw], d = g[x0 + 1 + (y0 + 1) * gw];
      out[x + y * w] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }
  }
  return out;
}

function fbm(rng, w, h, scales, weights) {
  const out = new Float32Array(w * h);
  let total = 0;
  scales.forEach((s, k) => {
    const n = valueNoise(rng, w, h, s), wt = weights[k]; total += wt;
    for (let i = 0; i < out.length; i++) out[i] += n[i] * wt;
  });
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Value of `field` such that `frac` of the cells in `mask` lie above it.
function quantile(field, mask, frac) {
  const vals = [];
  for (let i = 0; i < field.length; i++) if (!mask || mask[i]) vals.push(field[i]);
  if (!vals.length || frac <= 0) return Infinity;
  vals.sort((x, y) => y - x);
  return vals[Math.min(vals.length - 1, Math.floor(vals.length * frac))];
}

// Generates a map for a biome. Fractions in `biome` are of the whole map:
//   water, mountain, forest, mud      target terrain shares
//   stone, iron, gold                 number of deposit formations
//   oil                               number of oil pools
//   scales: { water, mountain, forest } noise feature sizes in cells
// Returns { w, h, tiles, variant, start:{x,y} }.
export function generateMap(seed, size, biome) {
  const rng = new Rng(seed);
  const w = size, h = size, n = w * h;
  const tiles = new Uint8Array(n), variant = new Uint8Array(n);
  const sc = biome.scales || {};
  const water = fbm(rng, w, h, [sc.water || 22, 9, 4], [0.65, 0.25, 0.1]);
  const mount = fbm(rng, w, h, [sc.mountain || 16, 6, 3], [0.6, 0.28, 0.12]);
  const forest = fbm(rng, w, h, [sc.forest || 12, 5, 2], [0.55, 0.3, 0.15]);
  const mud = fbm(rng, w, h, [10, 4], [0.6, 0.4]);
  const cx = w >> 1, cy = h >> 1;
  const clear = biome.startClear || 10;
  const free = new Uint8Array(n).fill(1);
  const wT = quantile(water, null, biome.water);
  for (let i = 0; i < n; i++) if (water[i] >= wT) { tiles[i] = T.WATER; free[i] = 0; }
  const mT = quantile(mount, free, biome.mountain / Math.max(0.01, 1 - biome.water));
  for (let i = 0; i < n; i++) if (free[i] && mount[i] >= mT) { tiles[i] = T.MOUNTAIN; free[i] = 0; }
  const fT = quantile(forest, free, biome.forest / Math.max(0.01, 1 - biome.water - biome.mountain));
  for (let i = 0; i < n; i++) if (free[i] && forest[i] >= fT) { tiles[i] = T.FOREST; free[i] = 0; }
  const uT = quantile(mud, free, (biome.mud || 0) / Math.max(0.01, 1 - biome.water - biome.mountain - biome.forest));
  for (let i = 0; i < n; i++) if (free[i] && mud[i] >= uT) tiles[i] = T.MUD;
  for (let i = 0; i < n; i++) variant[i] = (rng.next() * 4) | 0;

  // Starting clearing.
  for (let y = cy - clear; y <= cy + clear; y++) for (let x = cx - clear; x <= cx + clear; x++) {
    if (Math.hypot(x - cx, y - cy) <= clear) tiles[x + y * w] = T.GRASS;
  }
  // Forest near the start so wood is available, and resource formations at
  // their minimum distances from the colony (stone 5+, iron 18+, gold 36+).
  const ring = (minR, maxR, type, count, rad) => {
    for (let k = 0; k < count; k++) {
      const a = rng.angle(), d = rng.range(minR, maxR);
      blob(tiles, w, h, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), rad, type, (t) => t !== T.WATER || type === T.WATER);
    }
  };
  ring(clear + 2, clear + 6, T.FOREST, 3, 3.4);
  ring(clear + 2, clear + 8, T.STONE, 2, 1.7);
  ring(clear + 12, clear + 22, T.MOUNTAIN, 2, 2.5);
  const formations = (minD, type, count, rad) => {
    for (let k = 0, guard = 0; k < count && guard < count * 50; guard++) {
      const x = rng.int(6, w - 7), y = rng.int(6, h - 7);
      const d = Math.hypot(x - cx, y - cy);
      if (d < minD) continue;
      blob(tiles, w, h, x, y, rng.range(rad * 0.7, rad * 1.3), type, (t) => t === T.GRASS || t === T.MUD || t === T.MOUNTAIN || t === T.FOREST);
      k++;
    }
  };
  formations(clear + 4, T.STONE, biome.stone || 14, 1.8);
  formations(18, T.IRON, biome.iron || 9, 1.6);
  formations(biome.goldMin || 36, T.GOLD, biome.gold || 4, 1.3);
  // Oil pools: 2x2+ pools on open ground.
  for (let k = 0, guard = 0; k < (biome.oil || 6) && guard < 400; guard++) {
    const x = rng.int(6, w - 8), y = rng.int(6, h - 8);
    if (Math.hypot(x - cx, y - cy) < 22) continue;
    let ok = true;
    for (let dy = -1; dy <= 2 && ok; dy++) for (let dx = -1; dx <= 2 && ok; dx++) { const t = tiles[x + dx + (y + dy) * w]; if (t !== T.GRASS && t !== T.MUD) ok = false; }
    if (!ok) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) tiles[x + dx + (y + dy) * w] = T.OIL;
    if (rng.next() < 0.5) tiles[x + 2 + y * w] = T.OIL;
    k++;
  }
  // Keep the clearing itself open.
  for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) if (Math.hypot(x - cx, y - cy) <= 6) tiles[x + y * w] = T.GRASS;

  // Map border is walkable so swarms can enter from any side.
  for (let i = 0; i < w; i++) { edge(tiles, i, 0, w); edge(tiles, i, h - 1, w); edge(tiles, 0, i, w); edge(tiles, w - 1, i, w); }

  // Fill pockets that cannot be reached from the start.
  const reach = flood(tiles, w, h, cx + cy * w, biome.blocks);
  for (let i = 0; i < n; i++) if (!reach[i] && !biome.blocks.includes(tiles[i])) tiles[i] = T.MOUNTAIN;
  return { w, h, tiles, variant, start: { x: cx, y: cy }, reach };
}

function blob(tiles, w, h, bx, by, r, type, ok) {
  const R = Math.ceil(r);
  for (let y = by - R; y <= by + R; y++) for (let x = bx - R; x <= bx + R; x++) {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    if (Math.hypot(x - bx, y - by) > r) continue;
    if (ok(tiles[x + y * w])) tiles[x + y * w] = type;
  }
}

function edge(tiles, x, y, w) { const i = x + y * w; if (tiles[i] === T.WATER || tiles[i] === T.MOUNTAIN) tiles[i] = T.GRASS; }

function flood(tiles, w, h, start, blocks) {
  const reach = new Uint8Array(w * h), q = [start];
  reach[start] = 1;
  while (q.length) {
    const c = q.pop(), x = c % w, y = (c - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = nx + ny * w;
      if (reach[ni] || blocks.includes(tiles[ni])) continue;
      reach[ni] = 1; q.push(ni);
    }
  }
  return reach;
}
