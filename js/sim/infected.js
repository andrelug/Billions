import { rectDist } from '../core/util.js';
import { SpatialGrid } from '../core/spatial.js';
import { NOISE_CHECK } from './noise.js';

// Infected AI. States (z.st):
//   0 idle   - dormant map population; roams a little around its spot
//   1 alert  - running to a noise (or last seen) location to investigate
//   2 chase  - has a target unit or building and attacks it
//   3 march  - swarm / raider: follows the colony field to the Command Center
// Idle infected away from the colony are updated in round-robin slices.
const SLICES = 8;
const ACTIVE_CELL = 8;
const NB = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const SCAN = { decrepit: 1.5, aged: 1.5, young: 1.5, giant: 1.5, harpy: 0.66, behemoth: 0.1 };

export class InfectedSystem {
  constructor(game) {
    this.g = game; this.slice = 0; this.presence = null; this.presenceT = 0;
    this.waspT = 0; this.wasps = [];
    this.sep = null; this.sepFlip = 0; this.active = [];
  }

  updatePresence() {
    const g = this.g, W = g.world;
    const cw = Math.ceil(W.w / ACTIVE_CELL), ch = Math.ceil(W.h / ACTIVE_CELL);
    if (!this.presence || this.presence.length !== cw * ch) this.presence = new Uint8Array(cw * ch);
    const p = this.presence; p.fill(0);
    const mark = (x, y, R) => {
      const cx = (x / ACTIVE_CELL) | 0, cy = (y / ACTIVE_CELL) | 0;
      for (let yy = Math.max(0, cy - R); yy <= Math.min(ch - 1, cy + R); yy++) for (let xx = Math.max(0, cx - R); xx <= Math.min(cw - 1, cx + R); xx++) p[xx + yy * cw] = 1;
    };
    for (const b of g.buildings) if (!b.neutral) mark(b.cx, b.cy, 2);
    for (const u of g.units) mark(u.x, u.y, 2);
    this.cw = cw;
    this.wasps = g.buildings.filter((b) => b.def.blocksJump && b.state === 'ok' && b.powered);
  }
  near(z) { return this.presence[((z.x / ACTIVE_CELL) | 0) + ((z.y / ACTIVE_CELL) | 0) * this.cw] === 1; }

  // Per-type stats with map modifiers applied, refreshed every 2 s.
  typeStats() {
    const g = this.g, out = {};
    for (const z of g.infected) {
      if (out[z.type]) continue;
      const d = z.def;
      out[z.type] = { vision: g.stat(d, 'vision'), aw: g.stat(d, 'awareness'), run: d.speed * g.mods.global('infectedSpeed', 1), walk: d.walk };
    }
    return out;
  }

  update(dt) {
    const g = this.g;
    this.tsT = (this.tsT || 0) - dt;
    if (this.tsT <= 0 || !this.ts) { this.tsT = 2; this.ts = this.typeStats(); }
    this.presenceT -= dt;
    if (this.presenceT <= 0 || !this.presence) { this.presenceT = 1; this.updatePresence(); }
    this.slice = (this.slice + 1) % SLICES;
    // Active infected run at 10 Hz in two alternating halves; dormant ones in
    // eight slices. Small games keep the full 20 Hz.
    const half = g.infected.length > 1500 ? 2 : 1, parity = this.slice & 1;
    const list = g.infected;
    for (let i = 0; i < list.length; i++) {
      const z = list[i];
      if (z.dead) continue;
      if (z.st === 0 && !this.near(z)) {
        if (z.id % SLICES !== this.slice) continue;
        this.think(z, dt * SLICES);
      } else if (half === 1) this.think(z, dt);
      else if ((z.id & 1) === parity) this.think(z, dt * 2);
    }
    // Separation at 10 Hz on a fine grid (crowds can be thousands deep).
    this.sepFlip ^= 1;
    if (this.sepFlip) this.separate(dt * 2);
  }

  think(z, dt) {
    const g = this.g, def = z.def;
    const ts = this.ts[z.type] || (this.ts[z.type] = { vision: g.stat(def, 'vision'), aw: g.stat(def, 'awareness'), run: def.speed, walk: def.walk });
    z.cd -= dt; z.scanT -= dt; z.noiseT -= dt;
    if (z.flash > 0) z.flash -= dt;
    if (z.slowT > 0) { z.slowT -= dt; if (z.slowT <= 0) z.slow = 1; }
    if (z.burnT > 0) { g.combat.burn(z, dt); if (z.dead) return; }
    if (z.hp < z.maxHp && g.time - z.lastHit > 2) z.hp = Math.min(z.maxHp, z.hp + def.regen * dt);
    let t = z.target;
    if (t && (t.dead || t.hp <= 0 || t.garrisoned || t.state === 'infected' || t.neutral)) { z.target = t = null; if (z.st === 2) this.lose(z); }

    // Sight: look for prey.
    if (z.scanT <= 0) {
      z.scanT = (SCAN[z.type] || 1) * (0.8 + g.rng.next() * 0.4);
      const prey = g.findHumanTarget(z.x, z.y, ts.vision, true);
      if (prey && (!t || (prey.kind === 'u' && t.kind !== 'u') || (t.def && (t.def.wall || t.def.gate) && !(prey.def.wall || prey.def.gate)))) {
        z.target = t = prey; if (z.st !== 3 || prey) z.st = 2;
      }
    }
    // Hearing: every 4 s, idle and alert infected may hear noise.
    if (z.noiseT <= 0) {
      z.noiseT = NOISE_CHECK * (0.9 + g.rng.next() * 0.2);
      if ((z.st === 0 || z.st === 1) && def.awareness > 0) {
        const h = g.noiseGrid.hear(z.x, z.y, ts.vision, ts.aw, this.rnd || (this.rnd = () => g.rng.next()));
        if (h) { z.st = 1; z.gx = h.x + (g.rng.next() - 0.5) * 2; z.gy = h.y + (g.rng.next() - 0.5) * 2; z.linger = 3 + g.rng.next() * 3; z.stuck = 0; }
      }
    }

    const speed = (z.st === 0 ? ts.walk : ts.run) * z.slow * g.terrainSpeed(z.x, z.y);
    switch (z.st) {
      case 0: this.roam(z, speed, dt); break;
      case 1: {
        const dx = z.gx - z.x, dy = z.gy - z.y;
        if (dx * dx + dy * dy < 1.5) { z.linger -= dt; if (z.linger <= 0) { z.st = 0; z.hx = z.x; z.hy = z.y; z.wanderT = 0; } }
        else this.steer(z, z.gx, z.gy, speed * dt, dt);
        break;
      }
      case 2: this.chase(z, speed, dt); break;
      case 3: this.march(z, speed * dt, dt); break;
    }
  }

  lose(z) {
    if (z.wave) { z.st = 3; return; }
    z.st = 1; z.gx = z.x; z.gy = z.y; z.linger = 2;
  }

  roam(z, speed, dt) {
    const g = this.g;
    z.wanderT -= dt;
    if (z.wanderT <= 0) {
      z.wanderT = 3 + g.rng.next() * 7;
      const roam = z.def.giant ? 3 : z.type === 'harpy' ? 2 : 1;
      if (g.rng.next() < 0.5) { z.vx = 0; z.vy = 0; }
      else {
        const tx = z.hx + (g.rng.next() - 0.5) * 2 * roam, ty = z.hy + (g.rng.next() - 0.5) * 2 * roam;
        const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy) || 1;
        z.vx = dx / d; z.vy = dy / d;
      }
    }
    if (z.vx || z.vy) {
      this.move(z, z.vx, z.vy, speed * dt, dt, false);
      if (Math.hypot(z.x - z.hx, z.y - z.hy) > 3) { z.vx = z.hx - z.x; z.vy = z.hy - z.y; }
    }
  }

  chase(z, speed, dt) {
    const g = this.g, t = z.target, a = z.def.attack;
    if (!t) { this.lose(z); return; }
    const isB = t.kind === 'b';
    const d = isB ? rectDist(z.x, z.y, t.x, t.y, t.w, t.h) : Math.hypot(t.x - z.x, t.y - z.y) - (t.r || 0.3);
    if (!isB && d > (this.ts[z.type] ? this.ts[z.type].vision : z.def.vision) * 2.5) { z.target = null; z.gx = t.x; z.gy = t.y; z.st = z.wave ? 3 : 1; z.linger = 3; return; }
    // Venom prefers living targets over walls.
    if (z.type === 'venom' && isB && (t.def.wall || t.def.gate)) {
      const alt = g.findHumanTarget(z.x, z.y, a.range + 2, false);
      if (alt) { z.target = alt; return; }
    }
    if (d <= a.range + z.r * 0.5) {
      if (z.cd <= 0) { z.cd = a.cd; g.combat.fire(z, t, a, 1); }
      return;
    }
    if (isB && d > 10) { this.march(z, speed * dt, dt); return; }
    const tx = isB ? Math.max(t.x + 0.1, Math.min(z.x, t.x + t.w - 0.1)) : t.x;
    const ty = isB ? Math.max(t.y + 0.1, Math.min(z.y, t.y + t.h - 0.1)) : t.y;
    this.steer(z, tx, ty, speed * dt, dt);
  }

  // Direct steering with wall sliding; when stuck, follow the colony field.
  steer(z, tx, ty, step, dt) {
    if (z.stuck > 1.2) { this.march(z, step, dt); if (z.stuck > 4) z.stuck = 0; return; }
    const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy) || 1;
    this.move(z, dx / d, dy / d, Math.min(step, d), dt, true);
  }

  march(z, step, dt) {
    const g = this.g, W = g.world, f = g.colonyField;
    const tx = z.x | 0, ty = z.y | 0;
    const jump = z.def.jump;
    const n = f.step(tx, ty, W.solid, jump ? null : null);
    if (n < 0) {
      const b = g.adjacentBuilding(z);
      if (b && !b.def.trap) { z.target = b; z.st = 2; }
      return;
    }
    const occ = W.occ[n];
    if (occ !== -1) {
      const b = g.byId.get(occ);
      if (b && !b.neutral && !(jump && (b.def.wall || b.def.gate) && this.canJump(n))) { z.target = b; z.st = 2; return; }
    }
    const nx = n % W.w, ny = (n - nx) / W.w;
    this.move(z, nx + 0.5 - z.x, ny + 0.5 - z.y, step, dt, true);
  }

  canJump(i) {
    const W = this.g.world, x = i % W.w, y = (i - x) / W.w;
    for (const w of this.wasps) if (Math.abs(w.cx - x) < 6 && Math.abs(w.cy - y) < 6) return false;
    return true;
  }

  // Axis-separated movement against terrain and buildings. Bumping into a
  // player building while marching or chasing makes it the target.
  // Is (x, y) open for z? Sets this.hit when a player building blocks it.
  open(z, x, y) {
    const g = this.g, W = g.world, tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return false;
    const i = tx + ty * W.w;
    if (!W.walk[i]) return false;
    const o = W.occ[i];
    if (o === -1) return true;
    const b = g.byId.get(o);
    if (!b || b.neutral) return false;
    if (z.def.jump && (b.def.wall || b.def.gate) && this.canJump(i)) return true;
    if (!b.def.trap) this.hit = b;
    return false;
  }

  // Axis-separated movement against terrain and buildings. Bumping into a
  // player building while marching or chasing makes it the target.
  move(z, dx, dy, step, dt, bump) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = z.x + dx / len * step, ny = z.y + dy / len * step;
    if (dx) z.face = dx > 0 ? 1 : -1;
    let moved = false;
    this.hit = null;
    if (this.open(z, nx, z.y)) { z.x = nx; moved = true; }
    if (this.open(z, z.x, ny)) { z.y = ny; moved = true; }
    if (moved) z.stuck = 0; else z.stuck += dt;
    const hit = this.hit;
    if (bump && hit && z.st !== 0 && z.target !== hit) {
      if (z.st === 3 || z.st === 1 || (z.st === 2 && z.target && z.target.kind === 'b')) { z.target = hit; z.st = 2; }
    }
  }

  separate(dt) {
    const g = this.g, W = g.world, w = W.w;
    if (!this.sep || this.sep.cw !== w) { this.sep = new SpatialGrid(1, w, W.h); this.dens = new Uint16Array(w * W.h); }
    const act = this.active; act.length = 0;
    for (const z of g.infected) if (!z.dead && (z.st !== 0 || this.near(z))) act.push(z);
    const dens = this.dens; dens.fill(0);
    for (const z of act) dens[(z.x | 0) + (z.y | 0) * w]++;
    const sparse = [];
    const k = Math.min(1, dt * 4) * 0.5;
    for (const z of act) {
      const tx = z.x | 0, ty = z.y | 0, c = dens[tx + ty * w];
      if (c <= 1) continue;
      if (c <= 3) { sparse.push(z); continue; }
      // Dense: drift toward a less crowded open neighbour. Ties are broken
      // differently per infected so a stacked group fans out.
      let best = -1, bc = c - 1;
      const rot = z.id & 7;
      for (let k8 = 0; k8 < 8; k8++) {
        const o = NB[(k8 + rot) & 7], nx = tx + o[0], ny = ty + o[1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= W.h) continue;
        const i = nx + ny * w;
        if (!W.walk[i] || W.occ[i] !== -1) continue;
        if (dens[i] < bc) { bc = dens[i]; best = i; }
      }
      if (best < 0) continue;
      const bx = best % w + 0.5, by = (best / w | 0) + 0.5, dx = bx - z.x, dy = by - z.y, d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, 0.12 * dt * 4);
      const nx = z.x + dx / d * step, ny = z.y + dy / d * step;
      if (this.open(z, nx, z.y)) z.x = nx;
      if (this.open(z, z.x, ny)) z.y = ny;
    }
    if (!sparse.length) return;
    const grid = this.sep; grid.rebuild(sparse);
    const items = grid.items, st = grid.start, en = grid.count, cw = grid.cw, ch = grid.ch;
    for (const z of sparse) {
      const rr = z.r * 1.8, rr2 = rr * rr;
      let px = 0, py = 0, n = 0;
      const cx0 = Math.max(0, (z.x - rr) | 0), cx1 = Math.min(cw - 1, (z.x + rr) | 0);
      const cy0 = Math.max(0, (z.y - rr) | 0), cy1 = Math.min(ch - 1, (z.y + rr) | 0);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cx + cy * cw;
        for (let i = st[c], e = en[c]; i < e; i++) {
          const q = items[i]; if (q === z) continue;
          let dx = z.x - q.x, dy = z.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 >= rr2) continue;
          if (d2 < 1e-6) { const a = (z.id * 2.399) % 6.283; dx = Math.cos(a) * 0.01; dy = Math.sin(a) * 0.01; d2 = 1e-4; }
          const d = Math.sqrt(d2), f = (rr - d) / d;
          px += dx * f; py += dy * f; n++;
        }
      }
      if (!n) continue;
      const nx = z.x + px * k, ny = z.y + py * k;
      const i1 = (nx | 0) + (z.y | 0) * w, i2 = (z.x | 0) + (ny | 0) * w;
      if (nx > 0 && nx < w && W.walk[i1] && W.occ[i1] === -1) z.x = nx;
      if (ny > 0 && ny < W.h && W.walk[i2] && W.occ[i2] === -1) z.y = ny;
    }
  }
}