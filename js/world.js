'use strict';
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Terrain, occupancy and flow-field pathfinding.
class World {
  constructor(seed, tiles) {
    this.seed = seed;
    this.w = CFG.MAP_W; this.h = CFG.MAP_H;
    const n = this.w * this.h;
    this.tiles = new Uint8Array(n);
    this.variant = new Uint8Array(n);
    this.occ = new Int32Array(n).fill(-1);   // building id per tile, -1 = free
    this.reach = new Uint8Array(n);          // 1 if walkable from the center ignoring buildings
    if (tiles) {
      this.tiles.set(tiles);
      const rng = U.mulberry32(seed ^ 0x9e3779b9);
      for (let i = 0; i < n; i++) this.variant[i] = Math.floor(rng() * 4);
      this.computeReach();
    } else {
      this.generate();
    }
  }

  idx(x, y) { return x + y * this.w; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[x + y * this.w] : T.WATER; }
  terrainBlocked(x, y) { const t = this.tileAt(x, y); return t === T.WATER || t === T.ROCK; }
  occAt(x, y) { return this.inBounds(x, y) ? this.occ[x + y * this.w] : -1; }
  cornerBlocked(x, y) { return this.terrainBlocked(x, y) || this.occAt(x, y) !== -1; }

  static noise(rng, w, h, scale) {
    const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = y / scale, y0 = Math.floor(fy), ty = U.smooth(fy - y0);
      for (let x = 0; x < w; x++) {
        const fx = x / scale, x0 = Math.floor(fx), tx = U.smooth(fx - x0);
        const a = g[x0 + y0 * gw], b = g[x0 + 1 + y0 * gw];
        const c = g[x0 + (y0 + 1) * gw], d = g[x0 + 1 + (y0 + 1) * gw];
        out[x + y * w] = U.lerp(U.lerp(a, b, tx), U.lerp(c, d, tx), ty);
      }
    }
    return out;
  }

  generate() {
    const rng = U.mulberry32(this.seed);
    const w = this.w, h = this.h;
    const nf = World.noise(rng, w, h, 7), nf2 = World.noise(rng, w, h, 3);
    const nr = World.noise(rng, w, h, 5), nr2 = World.noise(rng, w, h, 2);
    const nw = World.noise(rng, w, h, 11);
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = x + y * w;
      const d = U.dist(x + 0.5, y + 0.5, cx, cy);
      let t = T.GRASS;
      const f = nf[i] * 0.65 + nf2[i] * 0.35;
      const r = nr[i] * 0.75 + nr2[i] * 0.25;
      if (nw[i] > 0.73) t = T.WATER;
      else if (r > 0.70) t = T.ROCK;
      else if (f > 0.55) t = T.FOREST;
      if (d < 6.5) t = T.GRASS;                       // starting clearing
      else if (d < 10 && (t === T.WATER)) t = T.GRASS;
      this.tiles[i] = t;
      this.variant[i] = Math.floor(rng() * 4);
    }
    // Keep the outer ring walkable so hordes can always enter from any side.
    for (let x = 0; x < w; x++) { this.tiles[x] = this.tiles[x] === T.FOREST ? T.FOREST : T.GRASS; this.tiles[x + (h - 1) * w] = this.tiles[x + (h - 1) * w] === T.FOREST ? T.FOREST : T.GRASS; }
    for (let y = 0; y < h; y++) { this.tiles[y * w] = this.tiles[y * w] === T.FOREST ? T.FOREST : T.GRASS; this.tiles[w - 1 + y * w] = this.tiles[w - 1 + y * w] === T.FOREST ? T.FOREST : T.GRASS; }
    // Guarantee some forest and rock within reach of the starting clearing.
    this.ensureNear(rng, T.FOREST, 14, 9);
    this.ensureNear(rng, T.ROCK, 8, 10);
    this.computeReach();
    // Any pocket unreachable from the center gets carved open so nothing is stranded.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = x + y * w;
      if (!this.reach[i] && !this.terrainBlocked(x, y)) this.tiles[i] = T.ROCK;
    }
    this.computeReach();
  }

  // If fewer than `min` tiles of `type` exist within `radius` of the center,
  // paint a small blob of it at the edge of the clearing.
  ensureNear(rng, type, min, radius) {
    const w = this.w, h = this.h, cx = w >> 1, cy = h >> 1;
    let count = 0;
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) if (this.tileAt(x, y) === type) count++;
    if (count >= min) return;
    const a = rng() * Math.PI * 2, bx = Math.round(cx + Math.cos(a) * 8.5), by = Math.round(cy + Math.sin(a) * 8.5);
    for (let y = by - 2; y <= by + 2; y++) for (let x = bx - 2; x <= bx + 2; x++) {
      if (!this.inBounds(x, y) || U.dist(x, y, bx, by) > 2.3 || U.dist(x + 0.5, y + 0.5, cx, cy) < 6.5) continue;
      if (this.tiles[x + y * w] === T.GRASS || this.tiles[x + y * w] === T.FOREST) this.tiles[x + y * w] = type;
    }
  }

  computeReach() {
    const w = this.w, h = this.h;
    this.reach.fill(0);
    const q = [this.idx(w >> 1, h >> 1)];
    this.reach[q[0]] = 1;
    while (q.length) {
      const c = q.pop();
      const x = c % w, y = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DIRS8[k][0], ny = y + DIRS8[k][1];
        if (!this.inBounds(nx, ny)) continue;
        const ni = nx + ny * w;
        if (this.reach[ni] || this.terrainBlocked(nx, ny)) continue;
        this.reach[ni] = 1; q.push(ni);
      }
    }
  }

  // Dijkstra from a set of source tiles. costFn(x,y) returns the cost of
  // entering a tile (Infinity = impassable). Returns a Float64Array of distances
  // (64-bit on purpose: 32-bit rounding makes equal-cost neighbours re-queue forever).
  dijkstra(sources, costFn) {
    const w = this.w, n = w * this.h;
    const dist = new Float64Array(n).fill(Infinity);
    const heap = new MinHeap();
    for (const s of sources) { dist[s] = 0; heap.push(s, 0); }
    while (heap.size) {
      const { node: c, pri: d } = heap.pop();
      if (d > dist[c]) continue;
      const cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS8[k][0], dy = DIRS8[k][1];
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const cost = costFn(nx, ny);
        if (cost === Infinity) continue;
        if (dx && dy && (this.cornerBlocked(cx + dx, cy) || this.cornerBlocked(cx, cy + dy))) continue;
        const nd = d + cost * (dx && dy ? 1.4142 : 1);
        const ni = nx + ny * w;
        if (nd < dist[ni]) { dist[ni] = nd; heap.push(ni, nd); }
      }
    }
    return dist;
  }

  // Best neighbouring tile to step to (lower field value), or null if none.
  fieldStep(field, x, y, passFn) {
    const w = this.w;
    let best = null, bd = this.inBounds(x, y) ? field[x + y * w] : Infinity;
    for (let k = 0; k < 8; k++) {
      const dx = DIRS8[k][0], dy = DIRS8[k][1];
      const nx = x + dx, ny = y + dy;
      if (!this.inBounds(nx, ny) || !passFn(nx, ny)) continue;
      if (dx && dy && (this.cornerBlocked(x + dx, y) || this.cornerBlocked(x, y + dy))) continue;
      const d = field[nx + ny * w];
      if (d < bd) { bd = d; best = { x: nx, y: ny }; }
    }
    return best;
  }
}
