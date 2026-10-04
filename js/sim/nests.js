import { DAY, HOUR } from '../data/maps.js';

// Villages of Doom. Each building ("nest") produces infected when disturbed:
//   n = ceil(rand(0.5, 1.5) x sizeFactor x themeInfectedFactor x disturbance)
// disturbance: 3 when attacked, 1 every 12 h if few infected are around,
// 1 every 5 days after day 20 (a raid sent at the Command Center), 0.8 during
// the final wave. A nest stops once it has produced its maximum. Destroyed
// nests drop loot.
export const NEST = {
  small:  { name: 'Dwelling of Doom', hp: 400, size: 2, factor: 1, max: 40, vision: 5, loot: 2, mix: { decrepit: 1, aged: 1, young: 1 }, lootTypes: ['wood', 'stone'] },
  medium: { name: 'Tavern of Doom', hp: 1500, size: 3, factor: 2, max: 150, vision: 6, loot: 4, mix: { fresh: 1, colonist: 1 }, lootTypes: ['wood', 'stone', 'gold', 'iron', 'energy', 'food'] },
  large:  { name: 'City Hall of Doom', hp: 4000, size: 4, factor: 5, max: 500, vision: 8, loot: 6, mix: { fresh: 0.39, colonist: 0.39, executive: 0.19, chubby: 0.03 }, lootTypes: ['gold', 'iron', 'oil', 'food', 'energy'] },
};
const LOOT = { wood: 10, stone: 10, iron: 10, oil: 10, gold: 500, food: 20, energy: 20, workers: 20 };

export class Nests {
  constructor(game) { this.g = game; }

  add(size, x, y, village) {
    const g = this.g, d = NEST[size];
    const n = { id: g.nextId++, kind: 'n', size, def: d, x, y, w: d.size, h: d.size, hp: d.hp, maxHp: d.hp, made: 0,
      max: Math.ceil(d.max * g.popFactor * g.theme.nestFactor), village, aggro: false, lastGen: -99, lastRaid: 0, lastCheck: 0, flash: 0, r: d.size / 2 };
    g.nests.push(n); g.byId.set(n.id, n);
    const W = g.world;
    for (let ty = y; ty < y + n.h; ty++) for (let tx = x; tx < x + n.w; tx++) { W.walk[tx + ty * W.w] = 0; W.solid[tx + ty * W.w] = 1; }
    return n;
  }

  load(list) {
    const g = this.g;
    for (const o of list) {
      if (o.hp <= 0) continue;
      const n = this.add(o.size, o.x, o.y, o.village);
      g.byId.delete(n.id);
      Object.assign(n, o, { def: NEST[o.size], kind: 'n' });
      g.byId.set(n.id, n);
    }
  }

  produce(n, disturbance, toCC) {
    const g = this.g;
    if (n.hp <= 0 || n.made >= n.max || g.time - n.lastGen < 1) return 0;
    n.lastGen = g.time;
    const count = Math.min(n.max - n.made, Math.ceil(g.rng.range(0.5, 1.5) * n.def.factor * g.theme.density * disturbance * 3));
    for (let i = 0; i < count; i++) {
      const p = g.freeCellNear(n.x + n.w / 2, n.y + n.h + 0.5, 4) || { x: n.x + n.w / 2, y: n.y + n.h + 0.5 };
      const z = g.addInfected(g.rng.weighted(n.def.mix), p.x, p.y, { cc: toCC, nest: n.id });
      if (!toCC) { z.st = 1; z.gx = p.x + (g.rng.next() - 0.5) * 6; z.gy = p.y + (g.rng.next() - 0.5) * 6; z.linger = 3; }
    }
    n.made += count;
    return count;
  }

  hurt(n, dmg, src) {
    const g = this.g;
    n.hp -= dmg; n.flash = 0.12; n.aggro = true;
    if (src && src.kind !== 'z') {
      const made = this.produce(n, 3, false);
      if (made) for (const z of g.infected) if (z.nest === n.id && z.st !== 3 && (z.st === 0 || z.st === 1)) { z.target = src.kind === 'u' && src.garrisoned ? g.byId.get(src.garrisoned) : src; z.st = 2; }
    }
    if (n.hp <= 0) this.destroy(n);
  }

  destroy(n) {
    const g = this.g, W = g.world;
    n.hp = 0;
    for (let ty = n.y; ty < n.y + n.h; ty++) for (let tx = n.x; tx < n.x + n.w; tx++) { W.walk[tx + ty * W.w] = 1; W.solid[tx + ty * W.w] = 0; }
    W.version++;
    g.nests = g.nests.filter((x) => x !== n);
    g.remove(n);
    for (let i = 0; i < n.def.loot; i++) {
      const type = g.rng.pick(n.def.lootTypes);
      const p = g.freeCellNear(n.x + n.w / 2, n.y + n.h / 2, 3) || { x: n.x, y: n.y };
      g.pickups.push({ id: g.nextId++, type, amount: LOOT[type], x: p.x + (g.rng.next() - 0.5), y: p.y + (g.rng.next() - 0.5) });
    }
    g.fx('burst', n.x + n.w / 2, n.y + n.h / 2, n.w);
    g.ev.emit('sound', 'explosion', n.x + n.w / 2, n.y + n.h / 2);
    g.notify(`${n.def.name} destroyed`, 'good', { x: n.x + n.w / 2, y: n.y + n.h / 2 });
    g.fieldDirty = true;
  }

  update(dt) {
    const g = this.g;
    if (!g.nests.length) return;
    this.t = (this.t || 0) - dt;
    if (this.t > 0) return;
    this.t = 1;
    const hours = g.time / HOUR, day = g.day;
    for (const n of g.nests) {
      if (n.flash > 0) n.flash = 0;
      // Noise rouses nests (awareness 5).
      const h = g.noiseGrid.hear(n.x + n.w / 2, n.y + n.h / 2, n.def.vision, 5, () => g.rng.next());
      if (h) { n.aggro = true; this.produce(n, 0.5, false); }
      // Refill surroundings every 12 h if few infected are around.
      if (hours - n.lastCheck >= 12) {
        n.lastCheck = hours;
        let around = 0;
        g.zgrid.query(n.x + n.w / 2, n.y + n.h / 2, 10, () => { around++; return around > 8; });
        if (around <= 8) this.produce(n, 1, false);
      }
      // Raids at the Command Center every 5 days from day 20.
      if (day >= 20 && day - n.lastRaid >= 5) { n.lastRaid = day; this.produce(n, 1, true); }
    }
  }

  finalWave() { for (const n of this.g.nests) this.produce(n, 0.8, true); }
}
