import { dist, rectDist } from '../core/util.js';
import { smoothPath } from '../core/pathing.js';
import { MOVE_SCALE } from '../data/maps.js';

// Player units. Commands (u.cmd.t):
//   idle     stand at post; shoot targets in sight, close in briefly, return
//   move     walk to a point and ignore enemies (even when attacked)
//   amove    attack-move: walk, engaging anything met on the way
//   hold     never move; fire at anything in range
//   patrol   attack-move back and forth between two points
//   chase    seek and destroy: hunt the nearest visible infected
//   attack   attack a specific target (infected, nest or barrel)
//   garrison walk to a tower and enter it
//   pickup   walk to a barrel and carry it
export const SOLDIER_XP_FACTOR = 1.34;

export class UnitSystem {
  constructor(game) { this.g = game; }

  command(units, cmd) {
    const g = this.g;
    const n = units.length, cols = Math.ceil(Math.sqrt(n));
    units.forEach((u, k) => {
      if (u.garrisoned && cmd.t !== 'hold' && cmd.t !== 'stop') g.ungarrison(u);
      if (cmd.t === 'hold' && u.def.noHold) return;
      const c = { ...cmd };
      if (c.x != null && n > 1 && c.t !== 'attack' && c.t !== 'garrison' && c.t !== 'pickup') {
        c.x += ((k % cols) - (cols - 1) / 2) * 0.9; c.y += (Math.floor(k / cols) - (cols - 1) / 2) * 0.9;
      }
      if (c.t === 'patrol') { c.ax = u.x; c.ay = u.y; c.leg = 0; }
      u.cmd = c; u.path = null; u.target = c.t === 'attack' ? c.target : null; u.stuck = 0;
      if (c.t === 'stop') { u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; }
      if (c.t === 'hold') u.post = { x: u.x, y: u.y };
    });
  }

  update(dt) {
    const g = this.g;
    for (const u of g.units) {
      if (u.dead || u.garrisoned) continue;
      const def = u.def, c = u.cmd;
      u.cd -= dt; u.cdx -= dt; u.scan -= dt; u.moving = false;
      if (u.flash > 0) u.flash -= dt;
      if (u.burnT > 0) { g.combat.burn(u, dt); if (u.dead) continue; }
      if (u.hp < u.maxHp && g.time - u.lastHit > 2) u.hp = Math.min(u.maxHp, u.hp + def.regen * dt);
      if (u.target && (u.target.dead || u.target.hp <= 0)) { u.target = null; if (c.t === 'attack') { u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; } }
      if (u.carrying) { u.carrying.x = u.x; u.carrying.y = u.y; }
      const range = g.unitStat(u, 'range'), vision = g.unitStat(u, 'vision');
      const speed = g.unitStat(u, 'speed') * MOVE_SCALE * g.terrainSpeed(u.x, u.y);

      // Target acquisition (20-frame reaction; the Mutant reacts faster).
      const reacting = c.t !== 'move' && c.t !== 'garrison' && c.t !== 'pickup' && c.t !== 'attack';
      if (u.scan <= 0 && reacting) {
        u.scan = def.id === 'mutant' ? 0.07 : 0.33;
        const r = c.t === 'hold' ? range : c.t === 'chase' ? vision * 1.5 : vision;
        u.target = g.findInfectedTarget(u.x, u.y, r, u.prio, u.target);
      }
      // Counter-attack while moving (Pyro, Mutant).
      if (!reacting && (def.id === 'pyro' || def.id === 'mutant') && c.t === 'move' && g.time - u.lastHit < 1 && u.scan <= 0) {
        u.scan = 0.3; const t = g.findInfectedTarget(u.x, u.y, range, 'nearest');
        if (t && u.cd <= 0) { u.cd = g.unitStat(u, 'cd'); g.unitFire(u, t); }
      }

      if (u.target && (reacting || c.t === 'attack')) {
        const t = u.target;
        const d = t.kind === 'n' ? rectDist(u.x, u.y, t.x, t.y, t.w, t.h) : dist(u.x, u.y, t.x, t.y) - (t.r || 0.3);
        // Rocketeer: rockets from range (min 3), punches up close.
        if (def.extra) {
          const ex = def.extra;
          if (d <= ex.range && d >= ex.minRange && u.cdx <= 0) { u.cdx = ex.cd; u.face = t.x >= u.x ? 1 : -1; g.unitFire(u, t, true); continue; }
          if (d <= def.attack.range + 0.3 && c.t !== 'hold') { if (u.cd <= 0) { u.cd = def.attack.cd; g.unitFire(u, t); } continue; }
          if (d < ex.minRange && c.t !== 'hold') { this.walkTo(u, u.x + (u.x - t.x), u.y + (u.y - t.y), speed * dt, dt); continue; }
        } else if (d <= range) {
          u.face = t.x >= u.x ? 1 : -1;
          if (u.cd <= 0) { u.cd = g.unitStat(u, 'cd'); g.unitFire(u, t); }
          continue;
        }
        if (c.t === 'hold') { /* stay */ }
        else if (c.t === 'idle' && dist(u.x, u.y, u.post.x, u.post.y) > vision) { u.target = null; }
        else { this.walkTo(u, t.x, t.y, speed * dt, dt, true); continue; }
      }

      switch (c.t) {
        case 'move': case 'amove':
          if (this.walkTo(u, c.x, c.y, speed * dt, dt)) { u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; }
          break;
        case 'patrol': {
          const tx = c.leg ? c.ax : c.x, ty = c.leg ? c.ay : c.y;
          if (this.walkTo(u, tx, ty, speed * dt, dt)) { c.leg = 1 - c.leg; u.path = null; }
          break;
        }
        case 'chase': {
          // Wander toward the nearest visible infected; idle when none.
          const t = g.findInfectedTarget(u.x, u.y, 40, 'nearest');
          if (t) this.walkTo(u, t.x, t.y, speed * dt, dt, true); else { u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; }
          break;
        }
        case 'attack': {
          const t = c.target;
          if (!t || t.dead || t.hp <= 0) { u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; break; }
          u.target = t;
          const tx = t.kind === 'n' ? t.x + t.w / 2 : t.x, ty = t.kind === 'n' ? t.y + t.h / 2 : t.y;
          this.walkTo(u, tx, ty, speed * dt, dt, true);
          break;
        }
        case 'garrison': {
          const b = g.byId.get(c.b);
          if (!b || b.dead) { u.cmd = { t: 'idle' }; break; }
          if (rectDist(u.x, u.y, b.x, b.y, b.w, b.h) < 1) { if (!g.garrison(u, b)) { u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; } }
          else this.walkTo(u, b.cx, b.cy + 1, speed * dt, dt);
          break;
        }
        case 'pickup': {
          const x = c.barrel;
          if (!x || x.exploded || x.carriedBy) { u.cmd = { t: 'idle' }; break; }
          if (dist(u.x, u.y, x.x, x.y) < 0.8) { x.carriedBy = u.id; u.carrying = x; u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y }; }
          else this.walkTo(u, x.x, x.y, speed * dt, dt);
          break;
        }
        case 'idle': case 'hold':
          if (c.t === 'idle' && dist(u.x, u.y, u.post.x, u.post.y) > 0.6) this.walkTo(u, u.post.x, u.post.y, speed * dt, dt);
          break;
      }
    }
    this.separate(dt);
  }

  dropBarrel(u) {
    const x = u.carrying; if (!x) return;
    x.carriedBy = 0; x.x = u.x; x.y = u.y; u.carrying = null;
  }

  // Follows an A* path to (tx, ty). Returns true on arrival.
  walkTo(u, tx, ty, step, dt, chasing) {
    const g = this.g, W = g.world;
    if (dist(u.x, u.y, tx, ty) < 0.25) return true;
    const gtx = Math.max(0, Math.min(W.w - 1, Math.floor(tx))), gty = Math.max(0, Math.min(W.h - 1, Math.floor(ty)));
    const pass = (i) => g.unitPassIdx(i);
    u.repath = (u.repath || 0) - dt;
    if (!u.path || u.pathGoal !== gtx + gty * W.w || u.pathVer !== W.version || (chasing && u.repath <= 0)) {
      u.repath = 0.8;
      const sx = Math.floor(u.x), sy = Math.floor(u.y);
      const raw = g.astar.find(sx, sy, gtx, gty, pass, W.solid, 25000);
      u.path = smoothPath(raw, W.w, sx, sy, (ax, ay, bx, by) => g.clearLine(ax, ay, bx, by));
      u.pathI = 0; u.pathGoal = gtx + gty * W.w; u.pathVer = W.version;
      if (!u.path.length && !(sx === gtx && sy === gty)) return !chasing;
    }
    let wx = tx, wy = ty;
    if (u.pathI < u.path.length) {
      const p = u.path[u.pathI], px = p % W.w, py = (p - px) / W.w;
      const last = u.pathI === u.path.length - 1 && px === gtx && py === gty;
      wx = last ? tx : px + 0.5; wy = last ? ty : py + 0.5;
      if (!last && dist(u.x, u.y, wx, wy) < 0.35) { u.pathI++; return false; }
    } else if (u.path.length && !(Math.floor(u.x) === gtx && Math.floor(u.y) === gty)) return true;
    const dx = wx - u.x, dy = wy - u.y, l = Math.hypot(dx, dy) || 1, s = Math.min(step, l);
    const nx = u.x + dx / l * s, ny = u.y + dy / l * s;
    let moved = false;
    if (g.unitPass(nx, u.y)) { u.x = nx; moved = true; }
    if (g.unitPass(u.x, ny)) { u.y = ny; moved = true; }
    if (dx) u.face = dx > 0 ? 1 : -1;
    u.moving = moved;
    if (moved) this.gateCheck(u);
    else { u.stuck = (u.stuck || 0) + dt; if (u.stuck > 1) { u.path = null; u.stuck = 0; } }
    return dist(u.x, u.y, tx, ty) < 0.25;
  }

  // Walking through a closed gate opens it: 100 noise.
  gateCheck(u) {
    const g = this.g, W = g.world, o = W.occAt(Math.floor(u.x), Math.floor(u.y));
    if (o === -1) return;
    const b = g.byId.get(o);
    if (b && b.def.gate) { if (b.gateOpen <= 0) { g.noise(b.cx, b.cy, 100); g.ev.emit('sound', 'gate', b.cx, b.cy); } b.gateOpen = 1.5; }
  }

  separate(dt) {
    const g = this.g, us = g.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i]; if (a.garrisoned) continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j]; if (b.garrisoned) continue;
        const rr = (a.r + b.r) * 0.85, dx = b.x - a.x, dy = b.y - a.y;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.5 * Math.min(1, dt * 6), px = dx / d * push, py = dy / d * push;
        if (g.unitPass(a.x - px, a.y - py)) { a.x -= px; a.y -= py; }
        if (g.unitPass(b.x + px, b.y + py)) { b.x += px; b.y += py; }
      }
    }
  }
}
