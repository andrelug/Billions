'use strict';
const U = {
  // Small, fast seedable PRNG.
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
  lerp(a, b, t) { return a + (b - a) * t; },
  smooth(t) { return t * t * (3 - 2 * t); },
  fmt(n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString(); },
  costStr(cost) {
    const parts = [];
    if (cost.gold) parts.push(cost.gold + '💰');
    if (cost.wood) parts.push(cost.wood + '🪵');
    if (cost.stone) parts.push(cost.stone + '🪨');
    return parts.join(' ') || 'free';
  },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
};

// Binary min-heap keyed by priority; used by Dijkstra flow fields.
class MinHeap {
  constructor() { this.n = []; this.p = []; }
  get size() { return this.n.length; }
  push(node, pri) {
    const n = this.n, p = this.p;
    n.push(node); p.push(pri);
    let i = n.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= p[i]) break;
      [n[i], n[j]] = [n[j], n[i]]; [p[i], p[j]] = [p[j], p[i]];
      i = j;
    }
  }
  pop() {
    const n = this.n, p = this.p;
    const top = { node: n[0], pri: p[0] };
    const ln = n.pop(), lp = p.pop();
    if (n.length) {
      n[0] = ln; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n.length && p[l] < p[m]) m = l;
        if (r < n.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [n[i], n[m]] = [n[m], n[i]]; [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}

// Uniform grid for fast "who is near (x,y)" queries over zombies.
class SpatialHash {
  constructor(cell, w, h) {
    this.cell = cell;
    this.cw = Math.ceil(w / cell); this.ch = Math.ceil(h / cell);
    this.cells = Array.from({ length: this.cw * this.ch }, () => []);
  }
  clear() { for (const c of this.cells) c.length = 0; }
  insert(e) {
    const cx = U.clamp(Math.floor(e.x / this.cell), 0, this.cw - 1);
    const cy = U.clamp(Math.floor(e.y / this.cell), 0, this.ch - 1);
    this.cells[cx + cy * this.cw].push(e);
  }
  each(x, y, r, fn) {
    const x0 = U.clamp(Math.floor((x - r) / this.cell), 0, this.cw - 1);
    const x1 = U.clamp(Math.floor((x + r) / this.cell), 0, this.cw - 1);
    const y0 = U.clamp(Math.floor((y - r) / this.cell), 0, this.ch - 1);
    const y1 = U.clamp(Math.floor((y + r) / this.cell), 0, this.ch - 1);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const cell = this.cells[cx + cy * this.cw];
      for (let i = 0; i < cell.length; i++) {
        const e = cell[i];
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= r2) fn(e, dx * dx + dy * dy);
      }
    }
  }
  nearest(x, y, r) {
    let best = null, bd = r * r;
    this.each(x, y, r, (e, d2) => { if (d2 <= bd && e.hp > 0) { bd = d2; best = e; } });
    return best;
  }
}
