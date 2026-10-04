import { dist } from '../core/util.js';

// Weapons. spec: { type, dmg, range, cd, aoe?, aoeMin?, aoeFull?, cone?, noise, push?, friendly?, burn?, sound? }
//   instant : bullet, sniper, mg            (mg/bullet may splash with aoe)
//   melee   : claw, melee, smash            (cone / arc area when cone is set)
//   flying  : arrow, bolt, rocket, acid     (projectiles; acid = venom spit)
//   flame   : cone of fire, friendly fire
// Damage taken = damage x (1 - armour). Venom ignores armour and uses the
// target's venom factor; fire uses the target's fire factor.
const SPEED = { arrow: 12, bolt: 16, rocket: 12, acid: 4 };
const VENOM_FACTOR = { soldier: 0.5, pyro: 0.35, mutant: 0.5 };

export class Combat {
  constructor(game) { this.g = game; }

  fire(src, target, a, mul = 1) {
    const g = this.g;
    src.firedAt = g.time;   // drives the optional attack animation
    const sx = src.kind === 'b' ? src.cx : src.x, sy = src.kind === 'b' ? src.cy : src.y;
    const tx = target.kind === 'b' || target.kind === 'n' ? Math.max(target.x, Math.min(sx, target.x + target.w)) : target.x;
    const ty = target.kind === 'b' || target.kind === 'n' ? Math.max(target.y, Math.min(sy, target.y + target.h)) : target.y;
    const dmg = a.dmg * mul;
    if (a.noise) g.noise(sx, sy, a.noise);
    if (a.sound) g.ev.emit('sound', a.sound, sx, sy);
    if (src.kind === 'u' || src.kind === 'z') src.face = tx >= sx ? 1 : -1;
    switch (a.type) {
      case 'bullet': case 'sniper': case 'mg':
        g.fx('tracer', sx, sy, tx, ty);
        if (a.aoe) this.splash(tx, ty, a, dmg, src); else this.hit(target, dmg, src, a);
        break;
      case 'claw': case 'melee': case 'smash':
        if (a.cone || a.aoe) this.arc(src, sx, sy, tx, ty, a, dmg);
        else this.hit(target, dmg, src, a);
        if (a.type === 'smash') g.fx('smash', sx, sy, tx, ty);
        break;
      case 'flame': this.flame(src, sx, sy, tx, ty, a, dmg); break;
      default: {
        if (target.kind === 'z') target.incoming = (target.incoming || 0) + dmg;
        g.projectiles.push({ type: a.type, x: sx, y: sy, sx, sy, target, tx, ty, dmg, src, a, speed: SPEED[a.type] || 14, homing: a.type === 'arrow' || a.type === 'bolt' });
      }
    }
  }

  updateProjectiles(dt) {
    const g = this.g, keep = [];
    for (const p of g.projectiles) {
      const t = p.target;
      if (p.homing && t && !t.dead && t.hp > 0) { p.tx = t.x; p.ty = t.y; }
      const d = dist(p.x, p.y, p.tx, p.ty), step = p.speed * dt;
      if (d > step) { p.x += (p.tx - p.x) / d * step; p.y += (p.ty - p.y) / d * step; keep.push(p); continue; }
      if (t && t.kind === 'z') t.incoming = Math.max(0, (t.incoming || 0) - p.dmg);
      if (p.a.aoe) { this.splash(p.tx, p.ty, p.a, p.dmg, p.src); g.fx(p.type === 'acid' ? 'acid' : 'blast', p.tx, p.ty, p.a.aoe); }
      else if (t && !t.dead && t.hp > 0 && (!p.homing || dist(p.tx, p.ty, t.x, t.y) < 1.5)) this.hit(t, p.dmg, p.src, p.a);
      if (p.type === 'rocket') g.ev.emit('sound', 'explosion', p.tx, p.ty);
    }
    g.projectiles = keep;
  }

  // Area damage around a point. Player weapons hit infected (and nests);
  // infected weapons hit units and buildings.
  splash(x, y, a, dmg, src) {
    const g = this.g, r = a.aoe;
    const fall = (d) => a.aoeFull ? 1 : 1 - (1 - (a.aoeMin ?? 0.5)) * Math.min(1, d / r);
    if (!src || src.kind !== 'z') {
      g.zgrid.query(x, y, r + 0.3, (z, d2) => { this.hit(z, dmg * fall(Math.sqrt(d2)), src, a); return false; });
      for (const n of g.nests) if (n.hp > 0 && dist(x, y, n.x + n.w / 2, n.y + n.h / 2) < r + n.w / 2) this.hit(n, dmg, src, a);
      for (const b of g.barrels) if (!b.carriedBy && dist(x, y, b.x, b.y) < r + 0.3) this.explodeBarrel(b, b.x, b.y);
    } else {
      for (const u of g.units) if (!u.garrisoned && dist(x, y, u.x, u.y) < r + u.r) this.hit(u, dmg * fall(dist(x, y, u.x, u.y)), src, a);
      const b = g.adjacentBuilding({ x, y });
      if (b) this.hit(b, dmg, src, a);
    }
  }

  // Melee arc (Giant swipe, Mutant claw, Rocketeer punch).
  arc(src, sx, sy, tx, ty, a, dmg) {
    const g = this.g, ang = Math.atan2(ty - sy, tx - sx), half = (a.cone || 360) * Math.PI / 360, r = a.aoe || a.range + 0.5;
    const inArc = (x, y) => { let da = Math.abs(Math.atan2(y - sy, x - sx) - ang); if (da > Math.PI) da = Math.PI * 2 - da; return da <= half; };
    if (src.kind === 'z') {
      for (const u of g.units) if (!u.garrisoned && dist(sx, sy, u.x, u.y) <= r + u.r && inArc(u.x, u.y)) this.hit(u, dmg, src, a);
      // Buildings in reach.
      const seen = new Set(), W = g.world, R = Math.ceil(r);
      for (let y = Math.floor(sy) - R; y <= Math.floor(sy) + R; y++) for (let x = Math.floor(sx) - R; x <= Math.floor(sx) + R; x++) {
        const o = W.occAt(x, y); if (o === -1 || seen.has(o)) continue;
        if (dist(sx, sy, x + 0.5, y + 0.5) > r + 0.5 || !inArc(x + 0.5, y + 0.5)) continue;
        seen.add(o); const b = g.byId.get(o); if (b && !b.neutral) this.hit(b, dmg, src, a);
        if (!a.friendly) break;      // ordinary claws hit one building
      }
      if (a.friendly) g.zgrid.query(sx, sy, r, (z) => { if (z !== src && inArc(z.x, z.y)) this.hit(z, dmg * 0.5, null, a); return false; });
    } else {
      g.zgrid.query(sx, sy, r + 0.3, (z) => { if (inArc(z.x, z.y)) this.hit(z, dmg, src, a); return false; });
    }
  }

  flame(src, sx, sy, tx, ty, a, dmg) {
    const g = this.g, ang = Math.atan2(ty - sy, tx - sx), half = (a.cone || 20) * Math.PI / 180, r = a.range + 0.3;
    const inCone = (x, y) => { let da = Math.abs(Math.atan2(y - sy, x - sx) - ang); if (da > Math.PI) da = Math.PI * 2 - da; return da <= half; };
    g.zgrid.query(sx, sy, r, (z) => { if (inCone(z.x, z.y)) { this.hit(z, dmg, src, a); z.burnT = 2; } return false; });
    if (a.friendly) {
      for (const u of g.units) if (u !== src && !u.garrisoned && dist(sx, sy, u.x, u.y) <= r && inCone(u.x, u.y)) this.hit(u, dmg, src, a);
      const W = g.world, seen = new Set();
      for (let k = 1; k <= Math.ceil(a.range); k++) {
        const x = Math.floor(sx + Math.cos(ang) * k), y = Math.floor(sy + Math.sin(ang) * k), o = W.occAt(x, y);
        if (o !== -1 && !seen.has(o)) { seen.add(o); const b = g.byId.get(o); if (b && !b.neutral) this.hit(b, dmg * 0.5, src, a); }
      }
    }
    g.fx('flame', sx, sy, sx + Math.cos(ang) * a.range, sy + Math.sin(ang) * a.range);
  }

  pulse(b, a) {
    const g = this.g;
    g.zgrid.query(b.cx, b.cy, a.range, (z) => { this.hit(z, a.dmg, b, a); return false; });
    g.noise(b.cx, b.cy, a.noise);
    g.fx('pulse', b.cx, b.cy, a.range);
    g.ev.emit('sound', 'zap', b.cx, b.cy);
  }

  explode(x, y, r, dmg, src, isMine) {
    const g = this.g;
    g.zgrid.query(x, y, r, (z, d2) => { this.hit(z, dmg * (1 - 0.5 * Math.sqrt(d2) / r), src, { type: 'blast' }); return false; });
    for (const u of g.units.slice()) if (!u.garrisoned && dist(x, y, u.x, u.y) <= r) this.hit(u, dmg * 0.5, null, { type: 'blast' });
    const W = g.world, seen = new Set();
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      const o = W.occAt(tx, ty); if (o === -1 || seen.has(o)) continue; seen.add(o);
      const b = g.byId.get(o); if (b && b !== src && dist(x, y, tx + 0.5, ty + 0.5) <= r) this.hit(b, dmg * 0.5, null, { type: 'blast' });
    }
    for (const n of g.nests) if (n.hp > 0 && dist(x, y, n.x + n.w / 2, n.y + n.h / 2) <= r + n.w / 2) this.hit(n, dmg, src, { type: 'blast' });
    g.noise(x, y, 200);
    g.fx('blast', x, y, r);
    g.ev.emit('sound', 'explosion', x, y);
    if (isMine && src && !src.dead) g.removeBuilding(src);
  }

  explodeBarrel(barrel, x, y) {
    const g = this.g;
    if (barrel.exploded) return;
    barrel.exploded = true; barrel.hp = 0;
    g.barrels = g.barrels.filter((b) => b !== barrel);
    g.remove(barrel);
    this.explode(x, y, 2.5, 1000, null, false);
  }

  // Apply damage to any target.
  hit(t, amount, src, a) {
    const g = this.g;
    if (!t || t.dead || t.hp <= 0) return;
    let dmg = amount;
    const kind = a && a.type;
    if (kind === 'acid') {
      if (t.kind === 'u') dmg *= VENOM_FACTOR[t.type] ?? 1;
      else if (t.kind === 'z') return;
    } else if (kind === 'flame' || kind === 'burn') {
      dmg *= t.kind === 'b' ? t.def.fire : t.def.fire ?? 1;
      dmg *= 1 - this.armor(t);
    } else if (kind !== 'blast' && kind !== 'trap') {
      dmg *= 1 - this.armor(t);
    }
    if (dmg <= 0) return;
    t.flash = 0.12;
    t.lastHit = g.time;
    if (t.kind === 'z') {
      t.hp -= dmg;
      if (a && a.push && t.def.id !== 'giant') this.push(t, src, a.push);
      if (src && src.kind !== 'z') g.infectedHurt(t, src);
      if (t.hp <= 0) g.killInfected(t, src);
    } else if (t.kind === 'u') {
      t.hp -= dmg;
      if (t.hp <= 0) g.killUnit(t, src); else g.alertUnderAttack(t, src);
    } else if (t.kind === 'b') {
      if (t.def.invincible) return;
      if (src && src.kind === 'z') {
        // Infected drain the defensive barrier first, then infect.
        if (t.barrier > 0) { t.barrier = Math.max(0, t.barrier - dmg); }
        else if (t.def.infectable && t.state !== 'infected') { g.infectBuilding(t); }
        else t.hp -= dmg;
        g.buildingHurt(t, src);
        if (t.def.wall || t.def.gate) g.noise(t.cx, t.cy, 4);
      } else t.hp -= dmg;
      if (t.hp <= 0) g.destroyBuilding(t, src);
      else if (t.state === 'ok' || t.state === 'build') g.fieldDirty = true;
    } else if (t.kind === 'n') {
      g.nestSys.hurt(t, dmg, src);
    } else if (t.kind === 'x') {
      this.explodeBarrel(t, t.x, t.y);
    }
  }

  armor(t) {
    if (t.kind === 'b') return t.def.armor || 0;
    return t.def.armor || 0;
  }

  push(z, src, amount) {
    if (!src) return;
    const g = this.g, W = g.world;
    const sx = src.kind === 'b' ? src.cx : src.x, sy = src.kind === 'b' ? src.cy : src.y;
    const d = dist(sx, sy, z.x, z.y) || 1, k = Math.min(1.2, amount / 100) * 0.6;
    const nx = z.x + (z.x - sx) / d * k, ny = z.y + (z.y - sy) / d * k;
    if (W.walkable(nx | 0, ny | 0) && W.occ[(nx | 0) + (ny | 0) * W.w] === -1) { z.x = nx; z.y = ny; }
  }

  // Burning damage over time (5 per second x fire factor).
  burn(e, dt) {
    if (e.burnT > 0) { e.burnT -= dt; this.hit(e, 5 * dt, null, { type: 'burn' }); }
  }
}
