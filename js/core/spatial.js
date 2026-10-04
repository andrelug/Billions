import { clamp } from './util.js';

// Uniform-grid spatial hash rebuilt every tick. Cells store entity refs in a
// flat array with per-cell start offsets (counting sort), so a rebuild of
// thousands of entities allocates nothing.
export class SpatialGrid {
  constructor(cellSize, worldW, worldH) {
    this.cs = cellSize;
    this.cw = Math.ceil(worldW / cellSize); this.ch = Math.ceil(worldH / cellSize);
    this.count = new Int32Array(this.cw * this.ch + 1);
    this.start = new Int32Array(this.cw * this.ch + 1);
    this.items = [];
    this.cellOf = new Int32Array(0);
  }
  cellIndex(x, y) {
    return clamp(Math.floor(x / this.cs), 0, this.cw - 1) + clamp(Math.floor(y / this.cs), 0, this.ch - 1) * this.cw;
  }
  rebuild(list) {
    const n = list.length, cnt = this.count, st = this.start;
    cnt.fill(0);
    if (this.cellOf.length < n) this.cellOf = new Int32Array(Math.max(n, this.cellOf.length * 2));
    for (let i = 0; i < n; i++) { const c = this.cellIndex(list[i].x, list[i].y); this.cellOf[i] = c; cnt[c]++; }
    let acc = 0;
    for (let c = 0; c < cnt.length; c++) { st[c] = acc; acc += cnt[c]; cnt[c] = st[c]; }
    const items = this.items; items.length = n;
    for (let i = 0; i < n; i++) items[cnt[this.cellOf[i]]++] = list[i];
    // cnt now holds end offsets
  }
  // Calls fn(entity, d2) for entities within r of (x,y). Return true from fn to stop early.
  query(x, y, r, fn) {
    const cs = this.cs, cw = this.cw;
    const x0 = clamp(Math.floor((x - r) / cs), 0, cw - 1), x1 = clamp(Math.floor((x + r) / cs), 0, cw - 1);
    const y0 = clamp(Math.floor((y - r) / cs), 0, this.ch - 1), y1 = clamp(Math.floor((y + r) / cs), 0, this.ch - 1);
    const r2 = r * r, items = this.items, st = this.start, end = this.count;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cx + cy * cw;
        for (let i = st[c], e = end[c]; i < e; i++) {
          const it = items[i], dx = it.x - x, dy = it.y - y, d2 = dx * dx + dy * dy;
          if (d2 <= r2 && fn(it, d2)) return;
        }
      }
    }
  }
  nearest(x, y, r, filter) {
    let best = null, bd = r * r;
    this.query(x, y, r, (e, d2) => { if (d2 <= bd && (!filter || filter(e))) { bd = d2; best = e; } });
    return best;
  }
  countIn(x, y, r, filter) {
    let n = 0;
    this.query(x, y, r, (e) => { if (!filter || filter(e)) n++; });
    return n;
  }
}
