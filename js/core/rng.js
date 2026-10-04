// Seedable PRNG (mulberry32) with serialisable state. Simulation code must
// only use this, never Math.random, so games are reproducible from a seed.
export class Rng {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    let a = (this.state = (this.state + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor((b - a + 1) * this.next()); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  angle() { return this.next() * Math.PI * 2; }
  weighted(obj) {
    let total = 0; for (const k in obj) total += obj[k];
    let r = this.next() * total;
    for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
    return Object.keys(obj)[0];
  }
}
export function mulberry32(seed) { const r = new Rng(seed); return () => r.next(); }
