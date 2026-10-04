// Grid pathfinding on typed arrays.
//  - flowField: multi-source Dijkstra with integer costs using a bucket queue
//    (Dial's algorithm). Cost map values: 0 = impassable, otherwise the cost of
//    entering the tile (10 = normal). Diagonals cost x1.4 and cannot cut corners
//    past impassable or "solid" tiles.
//  - astar: point-to-point path for player units.
export const IMPASSABLE = 0;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class FlowField {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.INF = 0xFFFFFFFF;
    this.dist = new Uint32Array(w * h).fill(this.INF);   // last completed field
    this.work = new Uint32Array(w * h);                  // field being built
    this.job = null;
    this.version = 0;
  }

  // Starts a new computation. Call run() until it returns true, or compute() for all at once.
  // sources: tile indices. cost: Uint16Array (0 = impassable, else cost of entering).
  // solid: Uint8Array, 1 where diagonal moves may not cut the corner.
  begin(sources, cost, solid) {
    const n = this.w * this.h;
    this.work.fill(this.INF);
    let maxStep = 0;
    for (let i = 0; i < n; i++) if (cost[i] > maxStep) maxStep = cost[i];
    const span = Math.ceil(maxStep * 1.5) + 2;
    const buckets = new Array(span);
    for (let i = 0; i < span; i++) buckets[i] = [];
    let pending = 0;
    for (const s of sources) { if (this.work[s] !== 0) { this.work[s] = 0; buckets[0].push(s); pending++; } }
    this.job = { cost, solid, buckets, span, pending, d: 0 };
  }

  // Processes up to `budget` nodes. Returns true when the field is complete and swapped in.
  run(budget = Infinity) {
    const job = this.job;
    if (!job) return true;
    const w = this.w, h = this.h, dist = this.work, { cost, solid, buckets, span } = job;
    let { pending, d } = job, done = 0;
    while (pending > 0 && done < budget) {
      const b = buckets[d % span];
      while (b.length && done < budget) {
        const c = b.pop(); pending--; done++;
        if (dist[c] !== d) continue;
        const cx = c % w, cy = (c - cx) / w;
        for (let k = 0; k < 8; k++) {
          const nx = cx + DX[k], ny = cy + DY[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = nx + ny * w, cst = cost[ni];
          if (cst === IMPASSABLE) continue;
          let step = cst;
          if (k >= 4) {
            if (solid[cx + DX[k] + cy * w] || solid[cx + (cy + DY[k]) * w]) continue;
            step = (cst * 14 + 5) / 10 | 0;
          }
          const nd = d + step;
          if (nd < dist[ni]) { dist[ni] = nd; buckets[nd % span].push(ni); pending++; }
        }
      }
      if (!b.length) d++;
    }
    job.pending = pending; job.d = d;
    if (pending > 0) return false;
    const tmp = this.dist; this.dist = this.work; this.work = tmp;
    this.job = null; this.version++;
    return true;
  }

  compute(sources, cost, solid) { this.begin(sources, cost, solid); this.run(); return this; }
  get busy() { return !!this.job; }

  // Lowest neighbour of (x,y). Returns tile index or -1. pass(i) filters candidates.
  step(x, y, solid, pass) {
    const w = this.w, h = this.h, dist = this.dist;
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    let best = -1, bd = dist[x + y * w];
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = nx + ny * w;
      if (k >= 4 && (solid[x + DX[k] + y * w] || solid[x + (y + DY[k]) * w])) continue;
      if (pass && !pass(ni)) continue;
      if (dist[ni] < bd) { bd = dist[ni]; best = ni; }
    }
    return best;
  }
}

// Binary heap of (index, priority) on typed arrays.
class IdxHeap {
  constructor(cap) { this.i = new Int32Array(cap); this.p = new Float64Array(cap); this.n = 0; }
  push(idx, pri) {
    if (this.n >= this.i.length) { const ni = new Int32Array(this.i.length * 2); ni.set(this.i); this.i = ni; const np = new Float64Array(this.p.length * 2); np.set(this.p); this.p = np; }
    let k = this.n++; const I = this.i, P = this.p;
    while (k > 0) { const j = (k - 1) >> 1; if (P[j] <= pri) break; I[k] = I[j]; P[k] = P[j]; k = j; }
    I[k] = idx; P[k] = pri;
  }
  pop() {
    const I = this.i, P = this.p, top = I[0];
    const li = I[--this.n], lp = P[this.n];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1; if (l >= this.n) break;
      const r = l + 1, m = r < this.n && P[r] < P[l] ? r : l;
      if (P[m] >= lp) break;
      I[k] = I[m]; P[k] = P[m]; k = m;
    }
    I[k] = li; P[k] = lp;
    return top;
  }
}

export class AStar {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.g = new Float64Array(w * h);
    this.from = new Int32Array(w * h);
    this.stamp = new Uint32Array(w * h);
    this.closed = new Uint32Array(w * h);
    this.cur = 0;
    this.heap = new IdxHeap(1024);
  }
  // pass(i) -> boolean. Returns array of tile indices from start (exclusive) to goal,
  // or the path to the closest reachable tile when the goal is blocked.
  find(sx, sy, tx, ty, pass, solid, maxNodes = 40000) {
    const w = this.w, h = this.h;
    if (++this.cur >= 0xFFFFFFFF) { this.stamp.fill(0); this.closed.fill(0); this.cur = 1; }
    const cur = this.cur, g = this.g, from = this.from, stamp = this.stamp, closed = this.closed, heap = this.heap;
    heap.n = 0;
    const s = sx + sy * w, t = tx + ty * w;
    const hfn = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    stamp[s] = cur; g[s] = 0; from[s] = -1; heap.push(s, hfn(sx, sy));
    let best = s, bestH = hfn(sx, sy), nodes = 0;
    while (heap.n && nodes++ < maxNodes) {
      const c = heap.pop();
      if (closed[c] === cur) continue;
      closed[c] = cur;
      if (c === t) { best = c; break; }
      const cx = c % w, cy = (c - cx) / w;
      const hc = hfn(cx, cy);
      if (hc < bestH) { bestH = hc; best = c; }
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = nx + ny * w;
        if (closed[ni] === cur || !pass(ni)) continue;
        if (k >= 4 && (solid[cx + DX[k] + cy * w] || solid[cx + (cy + DY[k]) * w])) continue;
        const ng = g[c] + (k >= 4 ? 1.4142 : 1);
        if (stamp[ni] !== cur || ng < g[ni]) { stamp[ni] = cur; g[ni] = ng; from[ni] = c; heap.push(ni, ng + hfn(nx, ny)); }
      }
    }
    const path = [];
    for (let c = best; c !== s && c !== -1; c = from[c]) path.push(c);
    path.reverse();
    return path;
  }
}

// Removes intermediate waypoints that have clear line of sight (tile walk).
export function smoothPath(path, w, sx, sy, clear) {
  if (path.length < 3) return path;
  const out = [];
  let ax = sx, ay = sy, i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    for (; j > i; j--) { const p = path[j], px = p % w, py = (p - px) / w; if (clear(ax, ay, px, py)) break; }
    out.push(path[j]);
    const p = path[j]; ax = p % w; ay = (p - ax) / w; i = j + 1;
  }
  return out;
}
