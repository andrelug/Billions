import { generateMap, T } from './worldgen.js';
import { TERRAIN } from '../data/terrain.js';

// Terrain, occupancy and the cost maps used by pathfinding.
export class World {
  constructor(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.tiles = new Uint8Array(n);
    this.variant = new Uint8Array(n);
    this.occ = new Int32Array(n).fill(-1);      // building id or -1
    this.trap = new Int32Array(n).fill(-1);     // trap building id (traps do not block)
    this.power = new Uint16Array(n);            // number of energy-grid sources covering the tile
    this.walk = new Uint8Array(n);              // terrain walkable
    this.solid = new Uint8Array(n);             // blocks diagonal corner cutting (terrain or building)
    this.version = 0;                           // bumps when occupancy changes
  }

  static generate(seed, size, biome) {
    const g = generateMap(seed, size, biome);
    const w = new World(g.w, g.h);
    w.tiles.set(g.tiles); w.variant.set(g.variant);
    w.start = g.start; w.villages = g.villages;
    w.refreshTerrain();
    return w;
  }

  static fromSave(s) {
    const w = new World(s.w, s.h);
    w.tiles.set(s.tiles); w.variant.set(s.variant);
    w.start = s.start; w.villages = s.villages || [];
    w.refreshTerrain();
    return w;
  }

  refreshTerrain() {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = TERRAIN[this.tiles[i]];
      this.walk[i] = t.walk ? 1 : 0;
      this.solid[i] = t.walk ? 0 : 1;
    }
    for (let i = 0; i < this.occ.length; i++) if (this.occ[i] !== -1) this.solid[i] = 1;
  }

  idx(x, y) { return x + y * this.w; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.inside(x, y) ? this.tiles[x + y * this.w] : T.MOUNTAIN; }
  terrain(x, y) { return TERRAIN[this.tile(x, y)]; }
  occAt(x, y) { return this.inside(x, y) ? this.occ[x + y * this.w] : -1; }
  walkable(x, y) { return this.inside(x, y) && this.walk[x + y * this.w] === 1; }

  setTile(x, y, t) {
    const i = x + y * this.w;
    this.tiles[i] = t;
    const tt = TERRAIN[t];
    this.walk[i] = tt.walk ? 1 : 0;
    this.solid[i] = (!tt.walk || this.occ[i] !== -1) ? 1 : 0;
    this.version++;
  }

  occupy(b, on) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const i = x + y * this.w;
      if (b.def.trap) { this.trap[i] = on ? b.id : -1; continue; }
      this.occ[i] = on ? b.id : -1;
      this.solid[i] = on || !this.walk[i] ? 1 : 0;
    }
    this.version++;
  }

  // Count tiles of the given terrain resource in a ring around a footprint,
  // skipping tiles that are occupied or claimed by `claimed` (Uint8 mask).
  countAround(x, y, w, h, radius, pred) {
    let n = 0;
    for (let ty = y - radius; ty < y + h + radius; ty++) for (let tx = x - radius; tx < x + w + radius; tx++) {
      if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
      if (!this.inside(tx, ty)) continue;
      if (pred(tx, ty, tx + ty * this.w)) n++;
    }
    return n;
  }

  serialize() {
    return { w: this.w, h: this.h, tiles: Array.from(this.tiles), variant: Array.from(this.variant), start: this.start, villages: this.villages };
  }
}
