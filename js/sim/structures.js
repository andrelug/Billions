import { rectDist, dist } from '../core/util.js';
import { TECHS } from '../data/research.js';
import { UNITS } from '../data/units.js';
import { worksUnpowered } from './power.js';
import { DAY } from '../data/maps.js';

// Per-step behaviour of player structures.
export class Structures {
  constructor(game) { this.g = game; }

  update(dt) {
    const g = this.g;
    for (const b of g.buildings) {
      if (b.dead || b.neutral) continue;
      switch (b.state) {
        case 'build': this.construct(b, dt); break;
        case 'upgrade': this.upgrading(b, dt); break;
        case 'repair': this.repairing(b, dt); break;
        case 'ok': this.active(b, dt); break;
      }
    }
  }

  construct(b, dt) {
    const g = this.g;
    b.progress += dt / b.buildTime;
    const f = Math.min(1, b.progress);
    // HP rises from 20% to full during construction (damage taken stays taken).
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.8 * dt / b.buildTime);
    b.barrier = Math.min(b.maxBarrier, b.barrier + b.maxBarrier * 0.8 * dt / b.buildTime);
    if (f >= 1) {
      b.state = 'ok'; b.progress = 1;
      g.stats.built++;
      g.onStructureChange(b);
      g.ev.emit('sound', 'complete', b.cx, b.cy);
      g.ev.emit('completed', b);
      if (b.def.wonder) g.notify(`${b.def.name} completed!`, 'good', b, 'victory');
      if (b.type === 'academy') for (const u of g.units) if (u.def.vet) u.vet = true;
      if (b.def.mercenaries) this.refreshMercs(b);
    }
  }

  upgrading(b, dt) {
    const g = this.g;
    b.progress += dt / b.buildTime;
    if (b.progress >= 1) {
      const hpF = Math.min(1, b.hp / b.maxHp + 0.0);
      b.state = 'ok'; b.progress = 1;
      b.hp = b.maxHp; b.barrier = b.maxBarrier;
      g.onStructureChange(b);
      g.ev.emit('sound', 'complete', b.cx, b.cy);
      g.ev.emit('completed', b);
      void hpF;
    }
  }

  repairing(b, dt) {
    const g = this.g;
    b.progress += dt / b.buildTime;
    const f = Math.min(1, b.progress), from = b.repairFrom || { hp: b.hp, barrier: b.barrier };
    b.hp = from.hp + (b.maxHp - from.hp) * f;
    b.barrier = from.barrier + (b.maxBarrier - from.barrier) * f;
    if (f >= 1) { b.state = 'ok'; b.wasInfected = false; g.onStructureChange(b); g.ev.emit('sound', 'complete', b.cx, b.cy); }
  }

  active(b, dt) {
    const g = this.g, def = b.def;
    const powered = b.powered || worksUnpowered(def);
    if (b.gateOpen > 0) b.gateOpen -= dt;
    if (def.attack && powered && !(def.needsEnergy && g.eco.free('energy') < 0)) this.turret(b, dt);
    if (def.garrison && b.garrison.length) this.garrisoned(b, dt);
    if (def.trap) this.trap(b, dt);
    if (def.mine) this.mine(b, dt);
    if (!powered || b.off) return;
    if (def.trains && b.queue.length) {
      const q = b.queue[0];
      q.t += dt;
      if (q.t >= q.time) { b.queue.shift(); g.spawnTrained(b, q.type, b.type === 'soldierscenter' && g.hasBuilding('academy')); g.eco.dirty = true; }
    }
    if (def.research && b.rq.length) {
      const r = b.rq[0];
      r.t += dt;
      if (r.t >= r.time) { b.rq.shift(); g.completeTech(r.id); }
    }
    if (def.mercenaries) {
      if (!b.mercs || g.day - (b.mercDay || 0) >= 5) this.refreshMercs(b);
    }
  }

  // Inn: a new set of mercenaries every 5 days; better with more prestige
  // (colonists housed in its zone).
  refreshMercs(b) {
    const g = this.g;
    b.mercDay = g.day;
    let prestige = 0;
    for (const h of g.buildings) if (h.def.house && h.state === 'ok' && g.eco.inZone(h, b)) prestige += h.def.supply.colonists || 0;
    const pool = [
      { type: 'ranger', vet: true, price: 270, min: 0 }, { type: 'soldier', vet: true, price: 540, min: 0 },
      { type: 'sniper', vet: true, price: 675, min: 100 }, { type: 'pyro', price: 900, min: 250 },
      { type: 'rocketeer', price: 1200, min: 400 }, { type: 'titan', price: 3000, min: 700 },
    ];
    const n = Math.min(6, 2 + Math.floor(prestige / 150));
    const avail = pool.filter((p) => prestige >= p.min);
    b.mercs = [];
    for (let i = 0; i < n; i++) b.mercs.push({ ...g.rng.pick(avail) });
    b.prestige = prestige;
    g.notify('New mercenaries are available at the Inn', 'good', b);
  }

  turret(b, dt) {
    const g = this.g, a = b.def.attack;
    b.cd -= dt;
    if (a.type === 'pulse') {
      if (b.cd > 0) return;
      let any = false;
      g.zgrid.query(b.cx, b.cy, a.range, (z) => { if (z.hp > 0) any = true; return any; });
      if (!any) return;
      b.cd = a.cd;
      g.combat.pulse(b, a);
      return;
    }
    b.scan = (b.scan || 0) - dt;
    if (b.target && (b.target.dead || b.target.hp <= 0 || dist(b.cx, b.cy, b.target.x, b.target.y) > a.range + 0.5)) b.target = null;
    if (!b.target || b.scan <= 0) { b.scan = 0.25; b.target = g.findInfectedTarget(b.cx, b.cy, a.range, b.prio, b.target); }
    if (b.target && b.cd <= 0) { b.cd = a.cd; g.combat.fire(b, b.target, a, 1); }
  }

  // Units inside a tower fire with bonus range and cannot be hit.
  garrisoned(b, dt) {
    const g = this.g;
    for (const id of b.garrison) {
      const u = g.byId.get(id);
      if (!u) continue;
      u.cd -= dt; u.scan -= dt;
      const range = g.unitStat(u, 'range');
      if (u.target && (u.target.dead || u.target.hp <= 0 || dist(b.cx, b.cy, u.target.x, u.target.y) > range + 0.5)) u.target = null;
      if (!u.target || u.scan <= 0) { u.scan = 0.25; u.target = g.findInfectedTarget(b.cx, b.cy, range, u.prio, u.target); }
      if (u.target && u.cd <= 0) { u.cd = g.unitStat(u, 'cd'); u.x = b.cx; u.y = b.cy; g.unitFire(u, u.target); }
      if (u.hp < u.maxHp && g.time - u.lastHit > 2) u.hp = Math.min(u.maxHp, u.hp + u.def.regen * dt);
    }
  }

  // Stakes / wire fence: every 0.5 s hurt each infected on the tile; the trap
  // loses 1 HP per infected hit.
  trap(b, dt) {
    const g = this.g;
    b.trapCd -= dt;
    if (b.trapCd > 0) return;
    b.trapCd = 0.5;
    const dmg = b.def.trap.dmg;
    g.zgrid.query(b.cx, b.cy, 0.8, (z) => {
      if (z.hp <= 0 || Math.floor(z.x) !== b.x || Math.floor(z.y) !== b.y) return false;
      g.combat.hit(z, dmg, b, { type: 'trap' });
      b.hp -= 1;
      return false;
    });
    if (b.hp <= 0) g.destroyBuilding(b, null);
  }

  mine(b, dt) {
    const g = this.g;
    if (b.mineT < 0) {
      let trig = false;
      g.zgrid.query(b.cx, b.cy, 0.75, (z) => { if (z.hp > 0) trig = true; return trig; });
      if (trig) b.mineT = b.mineDelay || 0;
      return;
    }
    b.mineT -= dt;
    if (b.mineT <= 0) g.combat.explode(b.cx, b.cy, b.def.mine.radius, b.def.mine.dmg, b, true);
  }
}
