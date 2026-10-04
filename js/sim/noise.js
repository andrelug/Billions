// Noise ("activity"). Each attack or event adds activity to its tile and a
// quarter of it to the 8 neighbours. Every second all activity halves.
// Every 4 s each idle infected may hear activity within 4 x its watch range:
//   p = clamp(A * awareness * 20 / (1000 * (d / watch)^2), 0, 1)
// A heard infected runs to the noisy tile and investigates.
//
// Activity lives on a coarse grid (2x2 tiles per cell) with a list of "hot"
// cells, so detection only scans cells that actually hold noise.
const CELL = 2;
export const NOISE_CHECK = 4;

export class NoiseGrid {
  constructor(w, h) {
    this.cw = Math.ceil(w / CELL); this.ch = Math.ceil(h / CELL);
    this.a = new Float32Array(this.cw * this.ch);
    this.hot = new Set();
    this.decayT = 0;
  }

  add(x, y, amount) {
    if (amount <= 0) return;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= this.cw || ny >= this.ch) continue;
      const i = nx + ny * this.cw;
      this.a[i] += dx || dy ? amount * 0.25 : amount;
      this.hot.add(i);
    }
  }

  update(dt) {
    // Continuous halving per second.
    const f = Math.pow(0.5, dt);
    for (const i of this.hot) {
      this.a[i] *= f;
      if (this.a[i] < 0.05) { this.a[i] = 0; this.hot.delete(i); }
    }
  }

  // Strongest audible source for an infected at (x,y) with watch range `watch`
  // and awareness `aw`. Returns {x, y} of a cell centre, or null.
  hear(x, y, watch, aw, rnd) {
    if (aw <= 0 || !this.hot.size) return null;
    const R = watch * 4, R2 = R * R;
    let best = null, bp = 0;
    for (const i of this.hot) {
      const A = this.a[i];
      if (A <= 0) continue;
      const cx = (i % this.cw) * CELL + CELL / 2, cy = Math.floor(i / this.cw) * CELL + CELL / 2;
      const dx = cx - x, dy = cy - y, d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const rel = Math.max(0.25, d2 / (watch * watch));
      const p = (A * aw * 20) / (1000 * rel);
      if (p > bp) { bp = p; best = { x: cx, y: cy }; }
    }
    if (!best) return null;
    return rnd() < Math.min(1, bp) ? best : null;
  }

  level(x, y) { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return this.a[cx + cy * this.cw] || 0; }
  serialize() { const o = {}; for (const i of this.hot) o[i] = +this.a[i].toFixed(2); return o; }
  load(o) { for (const k in o || {}) { this.a[+k] = o[k]; this.hot.add(+k); } }
}
