import { Rng } from '../core/rng.js';
import { smooth, clamp } from '../core/util.js';

// Terrain codes. Behaviour per code lives in data/terrain.js.
export const T = { GRASS: 0, FOREST: 1, MOUNTAIN: 2, STONE: 3, IRON: 4, GOLD: 5, WATER: 6, OIL: 7, MUD: 8 };

// ------------------------------------------------------------------ noise
// Value noise on a coarse lattice, sampled anywhere (so it can be warped).
function lattice(rng, w, h, scale) {
  const gw = Math.ceil(w / scale) + 4, gh = Math.ceil(h / scale) + 4;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  return (x, y) => {
    const fx = clamp(x / scale + 1, 0, gw - 2.001), fy = clamp(y / scale + 1, 0, gh - 2.001);
    const x0 = fx | 0, y0 = fy | 0, tx = smooth(fx - x0), ty = smooth(fy - y0);
    const a = g[x0 + y0 * gw], b = g[x0 + 1 + y0 * gw], c = g[x0 + (y0 + 1) * gw], d = g[x0 + 1 + (y0 + 1) * gw];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
function fbm(rng, w, h, scales, weights) {
  const fns = scales.map((s) => lattice(rng, w, h, s));
  const total = weights.reduce((a, b) => a + b, 0);
  return (x, y) => { let v = 0; for (let k = 0; k < fns.length; k++) v += fns[k](x, y) * weights[k]; return v / total; };
}
// Sharp crests along the middle values of a noise field: long mountain chains.
function ridged(rng, w, h, scale) {
  const f = fbm(rng, w, h, [scale, scale / 2.3], [0.7, 0.3]);
  return (x, y) => { const r = 1 - Math.abs(2 * f(x, y) - 1); return r * r; };
}
// Displaces the sampling point so blobs get organic, stretched shapes.
function warped(rng, w, h, fn, scale, amount) {
  const wx = lattice(rng, w, h, scale), wy = lattice(rng, w, h, scale);
  return (x, y) => fn(x + (wx(x, y) - 0.5) * amount, y + (wy(x, y) - 0.5) * amount);
}
function sample(w, h, fn) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x + y * w] = fn(x, y);
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

// ---------------------------------------------------------------- layouts
// Each game picks one large-scale layout, weighted per map (biome.layouts),
// so two games on the same map can look very different:
//   basin   the colony sits in a valley ringed by mountains with a few passes
//   ridges  long mountain chains cross the map and split it into regions
//   river   one or two rivers cross the map, with fords to wade across
//   lakes   large lakes and scattered hills
//   plains  open land with big forests and few mountains
export const LAYOUTS = ['basin', 'ridges', 'river', 'lakes', 'plains'];
const LAYOUT_NAMES = { basin: 'Mountain basin', ridges: 'Ridges', river: 'River valley', lakes: 'Lakes', plains: 'Open plains' };
export const layoutName = (id) => LAYOUT_NAMES[id] || id;

// Generates a map for a biome. Fractions in `biome` are of the whole map:
//   water, mountain, forest, mud      target terrain shares
//   stone, iron, gold                 how rich the map is in each deposit
//   goldMin                           closest distance of gold to the colony
//   oil                               number of oil pools
//   layouts                           { layout: weight } (default: all equal)
//   blocks                            terrain codes units cannot cross
// Returns { w, h, tiles, variant, start:{x,y}, reach, layout }.
export function generateMap(seed, size, biome) {
  const rng = new Rng(seed);
  const w = size, h = size, n = w * h;
  const tiles = new Uint8Array(n), variant = new Uint8Array(n);
  const cx = w >> 1, cy = h >> 1;
  const clear = biome.startClear || 10;
  const layout = rng.weighted(biome.layouts || { basin: 1, ridges: 1, river: 1, lakes: 1, plains: 1 });
  const jit = () => rng.range(0.8, 1.25);     // feature sizes vary from game to game
  const dist = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dist[x + y * w] = Math.hypot(x - cx, y - cy);
  const free = new Uint8Array(n).fill(1);
  const inClearing = (i) => dist[i] <= clear + 2;
  const shares = { water: biome.water || 0, mountain: biome.mountain || 0, forest: biome.forest || 0, mud: biome.mud || 0 };
  if (layout === 'plains') shares.mountain *= 0.5;
  if (layout === 'lakes') { shares.water = Math.max(shares.water * 1.6, 0.1); }
  if (layout === 'ridges' || layout === 'basin') shares.mountain *= 1.15;

  // Elevation decides mountains: broad hills plus sharp ridges.
  const hills = warped(rng, w, h, fbm(rng, w, h, [38 * jit(), 15, 6], [0.6, 0.3, 0.1]), 30, 26);
  const ridge = warped(rng, w, h, ridged(rng, w, h, 30 * jit()), 24, 18);
  const ridgeW = layout === 'ridges' ? 0.75 : layout === 'plains' ? 0.15 : 0.4;
  // Basin: a ring of high ground around the colony with a few gaps.
  const ringR = rng.range(32, 46), ringW = rng.range(6, 9);
  const passCount = rng.int(2, 4), passBase = rng.angle();
  const passes = Array.from({ length: passCount }, (_, k) => passBase + k * Math.PI * 2 / passCount + rng.range(-0.5, 0.5));
  const elev = sample(w, h, (x, y) => {
    let e = hills(x, y) * (1 - ridgeW) + ridge(x, y) * ridgeW;
    if (layout === 'basin') {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      let gap = 1;
      for (const p of passes) gap = Math.min(gap, 1 - Math.exp(-((angleDiff(a, p) / 0.16) ** 2)));
      e += 0.55 * Math.exp(-(((d - ringR) / ringW) ** 2)) * gap;
    }
    return e;
  });
  // Low ground and its own noise decide lakes.
  const lakeN = warped(rng, w, h, fbm(rng, w, h, [30 * jit(), 12], [0.75, 0.25]), 26, 20);
  const wet = sample(w, h, (x, y) => lakeN(x, y) * 0.65 + (1 - elev[x + y * w]) * 0.35);
  const forestN = warped(rng, w, h, fbm(rng, w, h, [24 * jit(), 10, 4], [0.6, 0.3, 0.1]), 22, 22);
  const mudN = fbm(rng, w, h, [14, 5], [0.7, 0.3]);
  for (let i = 0; i < n; i++) variant[i] = (rng.next() * 4) | 0;
  for (let i = 0; i < n; i++) if (inClearing(i)) free[i] = 0;
  // Open land around the colony, as in the original maps: forests, rock and
  // water fade out towards the middle, leaving room to build and an uneven edge.
  const openR = rng.range(17, 22), forestF = sample(w, h, forestN);
  for (let i = 0; i < n; i++) {
    const f = clamp((openR - dist[i]) / 7 + 0.5, 0, 1);
    if (f <= 0) continue;
    elev[i] -= 0.6 * f; wet[i] -= 0.6 * f; forestF[i] -= 0.5 * f;
  }

  // Rivers first, so lakes only fill what is left of the water share.
  let waterLeft = shares.water * n;
  if (layout === 'river') {
    const count = rng.chance(0.35) ? 2 : 1;
    for (let k = 0; k < count; k++) waterLeft -= carveRiver(tiles, free, w, h, rng, cx, cy, clear);
  }
  const wT = quantile(wet, free, Math.max(0, waterLeft) / n / 0.9);
  for (let i = 0; i < n; i++) if (free[i] && wet[i] >= wT) { tiles[i] = T.WATER; free[i] = 0; }
  const mT = quantile(elev, free, shares.mountain / 0.85);
  for (let i = 0; i < n; i++) if (free[i] && elev[i] >= mT) { tiles[i] = T.MOUNTAIN; free[i] = 0; }
  // Forests gather at the foot of mountains, as in the original maps.
  const nearM = proximity(tiles, w, h, T.MOUNTAIN, 5);
  const forest = sample(w, h, (x, y) => forestF[x + y * w] + nearM[x + y * w] * 0.12);
  const fT = quantile(forest, free, shares.forest / 0.75);
  for (let i = 0; i < n; i++) if (free[i] && forest[i] >= fT) { tiles[i] = T.FOREST; free[i] = 0; }
  const mudF = sample(w, h, mudN);
  const uT = quantile(mudF, free, shares.mud / 0.6);
  for (let i = 0; i < n; i++) if (free[i] && mudF[i] >= uT) tiles[i] = T.MUD;

  // The colony's clearing, with woods close by so wood is available early.
  for (let i = 0; i < n; i++) if (dist[i] <= clear) tiles[i] = T.GRASS;
  for (let k = 0; k < 3; k++) {
    const a = rng.angle(), d = rng.range(clear + 2, clear + 6);
    blob(tiles, w, h, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 3.4, T.FOREST, (t) => t === T.GRASS || t === T.MUD);
  }

  // Trails from the clearing to the map edge keep every region connected:
  // through the passes of a basin, elsewhere in random directions. They cut
  // narrow gaps through forests and mountains, the natural choke points.
  const trailCount = rng.int(3, 5), trailBase = rng.angle();
  const trailAngles = layout === 'basin' ? passes : Array.from({ length: trailCount }, (_, k) => trailBase + k * Math.PI * 2 / trailCount + rng.range(-0.4, 0.4));
  for (const a of trailAngles) carveTrail(tiles, w, h, rng, cx, cy, a, clear);

  // Resource fields: rocks scattered over open ground, so every deposit can
  // be reached by a quarry. Stone close to the colony, iron further out and
  // gold far away; stone and iron prefer the foot of mountains.
  const fields = [];
  const nearM2 = proximity(tiles, w, h, T.MOUNTAIN, 4);
  const field = (type, count, minD, maxD, cells, density, mountainBias) => {
    for (let k = 0, guard = 0; k < count && guard < count * 300; guard++) {
      const a = rng.angle(), d = rng.range(minD, maxD);
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) continue;
      const i = x + y * w;
      if (tiles[i] !== T.GRASS && tiles[i] !== T.MUD) continue;
      if (fields.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + 7)) continue;
      if (mountainBias && nearM2[i] < 0.2 && !rng.chance(0.3)) continue;
      const r = Math.sqrt(cells / (Math.PI * density)) * 1.15;
      fields.push({ x, y, r, type });
      scatter(tiles, w, h, rng, x, y, r, density, type, (j) => dist[j] > clear + 1);
      k++;
    }
  };
  const rich = (v, base) => Math.max(1, Math.round((v || base) / base));
  field(T.STONE, 2, clear + 3, clear + 14, 30, 0.5, true);                       // two fields right outside the clearing
  field(T.STONE, 2 + rich(biome.stone, 7), clear + 14, 80, 34, 0.45, true);
  field(T.IRON, 1, 24, 36, 22, 0.45, true);                                     // the first iron within reach of a few teslas
  field(T.IRON, 1 + rich(biome.iron, 5), 34, 82, 24, 0.45, true);
  field(T.GOLD, Math.max(2, Math.round((biome.gold || 4) * 0.8)), biome.goldMin || 36, 84, 9, 0.5, false);

  // Oil pools: 2x2+ pools on open ground.
  for (let k = 0, guard = 0; k < (biome.oil || 6) && guard < 600; guard++) {
    const x = rng.int(6, w - 8), y = rng.int(6, h - 8);
    if (dist[x + y * w] < 22) continue;
    let ok = true;
    for (let dy = -1; dy <= 2 && ok; dy++) for (let dx = -1; dx <= 2 && ok; dx++) { const t = tiles[x + dx + (y + dy) * w]; if (t !== T.GRASS && t !== T.MUD) ok = false; }
    if (!ok) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) tiles[x + dx + (y + dy) * w] = T.OIL;
    if (rng.next() < 0.5) tiles[x + 2 + y * w] = T.OIL;
    k++;
  }
  // Keep the heart of the clearing open.
  for (let i = 0; i < n; i++) if (dist[i] <= 6) tiles[i] = T.GRASS;

  // Map border is walkable so swarms can enter from any side.
  for (let i = 0; i < w; i++) { edge(tiles, i, 0, w); edge(tiles, i, h - 1, w); edge(tiles, 0, i, w); edge(tiles, w - 1, i, w); }

  // Pockets of open ground walled in by forest or rock: large ones get a trail
  // to the rest of the map, small ones become whatever walls them in.
  const blocks = biome.blocks || [T.MOUNTAIN, T.STONE, T.IRON, T.GOLD, T.WATER, T.FOREST];
  let reach = flood(tiles, w, h, cx + cy * w, blocks);
  if (connectPockets(tiles, w, h, reach, blocks, 30)) reach = flood(tiles, w, h, cx + cy * w, blocks);
  fillPockets(tiles, w, h, reach, blocks);
  return { w, h, tiles, variant, start: { x: cx, y: cy }, reach, layout };
}

const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// Unreached open regions of at least `minSize` cells: a two-cell trail is cut
// from each to the nearest reached cell. Returns how many were connected.
function connectPockets(tiles, w, h, reach, blocks, minSize) {
  const n = w * h, comp = new Int32Array(n).fill(-1), sizes = [];
  for (let i = 0; i < n; i++) {
    if (reach[i] || comp[i] !== -1 || blocks.includes(tiles[i])) continue;
    const id = sizes.length, q = [i]; comp[i] = id;
    for (let head = 0; head < q.length; head++) {
      const c = q[head], x = c % w, y = (c - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = nx + ny * w;
        if (comp[ni] !== -1 || reach[ni] || blocks.includes(tiles[ni])) continue;
        comp[ni] = id; q.push(ni);
      }
    }
    sizes.push(q.length);
  }
  let joined = 0;
  for (let id = 0; id < sizes.length; id++) {
    if (sizes[id] < minSize) continue;
    // Breadth-first search out of the pocket to the closest reached cell.
    const from = new Int32Array(n).fill(-2), q = [];
    for (let i = 0; i < n; i++) if (comp[i] === id) { from[i] = -1; q.push(i); }
    let hit = -1;
    for (let head = 0; head < q.length && hit < 0; head++) {
      const c = q[head], x = c % w, y = (c - x) / w;
      // A per-cell neighbour order turns straight shortest paths into winding ones.
      const r = (Math.imul(c, 2654435761) >>> 29) & 3;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = STEPS[(k + r) & 3];
        const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        const ni = nx + ny * w; if (from[ni] !== -2) continue;
        from[ni] = c;
        if (reach[ni]) { hit = ni; break; }
        q.push(ni);
      }
    }
    if (hit < 0) continue;
    // Cut a gently curving trail between the pocket and the reached cell.
    let s0 = hit; while (from[s0] !== -1) s0 = from[s0];
    const ax = s0 % w, ay = (s0 - ax) / w, bx = hit % w, by = (hit - bx) / w;
    const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    const amp = Math.min(4, len * 0.18) * (((Math.imul(s0, 2654435761) >>> 31) & 1) ? 1 : -1);
    for (let t = 0; t <= 1.0001; t += 0.5 / Math.max(1, len)) {
      const bend = Math.sin(Math.PI * t) * amp, px = ax + (bx - ax) * t + nx * bend, py = ay + (by - ay) * t + ny * bend;
      for (let yy = Math.floor(py) - 1; yy <= Math.floor(py) + 1; yy++) for (let xx = Math.floor(px) - 1; xx <= Math.floor(px) + 1; xx++) {
        if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1 || Math.hypot(xx - px, yy - py) > 1.05) continue;
        const j = xx + yy * w, tt = tiles[j];
        if (tt === T.WATER) tiles[j] = T.MUD;
        else if (blocks.includes(tt)) tiles[j] = T.GRASS;
      }
    }
    joined++;
  }
  return joined;
}

// Remaining unreached open cells take the most common blocking terrain
// around them (forest in a forest, rock among mountains).
function fillPockets(tiles, w, h, reach, blocks) {
  const n = w * h;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    if (reach[i] || blocks.includes(tiles[i])) continue;
    const x = i % w, y = (i - x) / w, votes = {};
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const t = tiles[nx + ny * w];
      if (t === T.FOREST || t === T.MOUNTAIN) votes[t] = (votes[t] || 0) + 1;
    }
    tiles[i] = (votes[T.FOREST] || 0) > (votes[T.MOUNTAIN] || 0) ? T.FOREST : T.MOUNTAIN;
  }
}

// A river from one edge to the opposite one that bends around the colony.
// Fords of shallow mud cross it every 20 to 30 cells. Returns the cells of water.
function carveRiver(tiles, free, w, h, rng, cx, cy, clear) {
  const horizontal = rng.chance(0.5), along = () => rng.range(0.2, 0.8);
  let x, y, tx, ty;
  if (horizontal) { x = 0; y = h * along(); tx = w - 1; ty = h * along(); } else { x = w * along(); y = 0; tx = w * along(); ty = h - 1; }
  if (rng.chance(0.5)) { [x, y, tx, ty] = [tx, ty, x, y]; }
  let wander = 0, step = 0, nextFord = rng.int(12, 24), water = 0;
  const width = rng.range(1.4, 2.4);
  for (let guard = 0; guard < w * 4; guard++) {
    let a = Math.atan2(ty - y, tx - x);
    wander = wander * 0.94 + (rng.next() - 0.5) * 0.45;
    a += clamp(wander, -1.1, 1.1);
    const dc = Math.hypot(x - cx, y - cy);
    if (dc < clear + 18) { const away = Math.atan2(y - cy, x - cx); a = a * 0.4 + away * 0.6; }
    x += Math.cos(a); y += Math.sin(a); step++;
    const r = width * (0.85 + 0.3 * Math.sin(step / 9));
    const ford = step >= nextFord && step < nextFord + 3;
    if (step >= nextFord + 3) nextFord = step + rng.int(20, 30);
    const R = Math.ceil(r + 1);
    for (let yy = Math.floor(y) - R; yy <= Math.floor(y) + R; yy++) for (let xx = Math.floor(x) - R; xx <= Math.floor(x) + R; xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || Math.hypot(xx - x, yy - y) > r + (ford ? 0.6 : 0)) continue;
      const i = xx + yy * w;
      if (Math.hypot(xx - cx, yy - cy) <= clear + 3) continue;
      if (ford) { if (tiles[i] === T.WATER) water--; tiles[i] = T.MUD; free[i] = 0; continue; }
      if (tiles[i] === T.MUD && !free[i]) continue;   // keep fords already laid
      if (tiles[i] !== T.WATER) water++;
      tiles[i] = T.WATER; free[i] = 0;
    }
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1 || Math.hypot(tx - x, ty - y) < 1.5) break;
  }
  return water;
}

// A winding three-cell trail from the clearing to the edge of the map.
function carveTrail(tiles, w, h, rng, cx, cy, angle, clear) {
  let x = cx + Math.cos(angle) * clear, y = cy + Math.sin(angle) * clear, a = angle, wander = 0;
  for (let guard = 0; guard < w * 2; guard++) {
    wander = wander * 0.9 + (rng.next() - 0.5) * 0.35;
    a = angle + clamp(wander, -0.7, 0.7);
    x += Math.cos(a); y += Math.sin(a);
    if (x < 1 || y < 1 || x > w - 2 || y > h - 2) break;
    for (let yy = Math.floor(y) - 1; yy <= Math.floor(y) + 1; yy++) for (let xx = Math.floor(x) - 1; xx <= Math.floor(x) + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || Math.hypot(xx + 0.5 - x, yy + 0.5 - y) > 1.3) continue;
      const i = xx + yy * w, t = tiles[i];
      if (t === T.WATER) tiles[i] = T.MUD;
      else if (t === T.MOUNTAIN || t === T.FOREST || t === T.STONE || t === T.IRON || t === T.GOLD) tiles[i] = T.GRASS;
    }
  }
}

// Smallest absolute difference between two angles, in radians.
function angleDiff(a, b) { const d = (((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI; return Math.abs(d); }

// 1 on cells of `type`, falling to 0 at `range` cells away.
function proximity(tiles, w, h, type, range) {
  const n = w * h, d = new Float32Array(n).fill(range + 1), q = [];
  for (let i = 0; i < n; i++) if (tiles[i] === type) { d[i] = 0; q.push(i); }
  for (let head = 0; head < q.length; head++) {
    const c = q[head], x = c % w, y = (c - x) / w;
    if (d[c] >= range) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = nx + ny * w; if (d[ni] <= d[c] + 1) continue;
      d[ni] = d[c] + 1; q.push(ni);
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(0, 1 - d[i] / range);
  return out;
}

// Rocks of `type` scattered over open ground around (x, y), denser in the middle.
function scatter(tiles, w, h, rng, x, y, r, density, type, ok) {
  const R = Math.ceil(r);
  for (let yy = y - R; yy <= y + R; yy++) for (let xx = x - R; xx <= x + R; xx++) {
    if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) continue;
    const d = Math.hypot(xx - x, yy - y) / r; if (d > 1) continue;
    const i = xx + yy * w;
    if ((tiles[i] !== T.GRASS && tiles[i] !== T.MUD) || !ok(i)) continue;
    if (rng.next() < density * (1.35 - d * 0.9)) tiles[i] = type;
  }
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
