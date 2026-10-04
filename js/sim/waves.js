import { HOUR, DAY } from '../data/maps.js';

// Scripted level events, following the reference survival event table
// (base values for a 100-day game; times scale with the game length and
// counts with the infected population):
//   swarmEasy   first 312 h, every 240 h, 4 times, one random side, warned 8 h ahead
//   swarmHard   first 1200 h, every 168 h, 5 times, one random side, warned 8 h ahead
//   final       2208 h, all four sides, warned 24 h ahead; everything left attacks
//   roamWeak    from 48 h every 48 h, 7 times, small walker groups, silent
//   roamMedium  from 600 h every 144 h, 10 times, small runner groups, silent
//   won         2400 h
const RUNNERS = ['fresh', 'fresh', 'colonist', 'colonist'];
export const EVENTS = [
  { id: 'roamWeak', first: 48, every: 48, reps: 7, sides: 'all', mix: [['decrepit', 1, 2], ['aged', 1, 2], ['young', 1, 2]], growth: 0.1, cap: 20 },
  { id: 'swarmEasy', first: 312, every: 240, reps: 4, offset: 24, warn: 8, sides: 'one', mix: RUNNERS.map((t) => [t, 4, 6]), growth: 3, cap: 200, swarm: true, spread: 8 },
  { id: 'roamMedium', first: 600, every: 144, reps: 10, offset: 24, sides: 'all', mix: [['executive', 1, 2], ...RUNNERS.map((t) => [t, 1, 2])], growth: 0.5, cap: 20 },
  { id: 'swarmHard', first: 1200, every: 168, reps: 5, offset: 24, warn: 8, sides: 'one', mix: [['executive', 25, 40], ...RUNNERS.map((t) => [t, 25, 40]), ['chubby', 3, 5]], growth: 3.5, cap: 200, swarm: true, spread: 20 },
  { id: 'final', first: 2208, every: 0, reps: 1, warn: 24, sides: 'all', mix: [['executive', 550, 550], ...RUNNERS.map((t) => [t, 550, 550]), ['chubby', 50, 50], ['harpy', 50, 50], ['venom', 50, 50]], growth: 0, cap: 1, swarm: true, final: true, spread: 30 },
];
export const SIDES = ['North', 'East', 'South', 'West'];

export class Waves {
  constructor(game) { this.g = game; this.list = []; this.queue = []; this.finalSpawned = false; this.groups = []; }

  // Builds the concrete schedule for this game.
  schedule() {
    const g = this.g, f = g.durFactor;
    this.list = [];
    let swarmNo = 0;
    for (const e of EVENTS) {
      for (let n = 0; n < e.reps; n++) {
        const base = Math.ceil((e.first + e.every * n) * f);
        const at = base + (e.offset ? Math.floor(g.rng.next() * e.offset) : 0);
        const side = e.sides === 'one' ? g.rng.int(0, 3) : -1;
        this.list.push({ id: e.id, n, at, warnAt: e.warn ? at - e.warn : null, side, warned: false, done: false, swarm: !!e.swarm, final: !!e.final });
      }
    }
    this.list.sort((a, b) => a.at - b.at);
    for (const ev of this.list) if (ev.swarm) ev.no = ++swarmNo;
  }

  get hours() { return this.g.time / HOUR; }
  nextSwarm() { return this.list.find((e) => e.swarm && !e.done) || null; }
  pendingSpawns() { return this.queue.length; }

  update(dt) {
    const g = this.g, h = this.hours;
    for (const ev of this.list) {
      if (ev.done) continue;
      if (ev.warnAt != null && !ev.warned && h >= ev.warnAt) {
        ev.warned = true;
        if (ev.final) g.notify('Infected are coming from every direction! THEY ARE BILLIONS!', 'danger', null, 'horde');
        else g.notify(`A swarm of infected is heading to the colony. From the ${SIDES[ev.side]}!`, 'warn', null, 'horde');
        g.ev.emit('swarmWarning', ev);
      }
      if (h >= ev.at) { ev.done = true; this.fire(ev); }
    }
    // 50 Days Challenge: neighbouring colonies send reinforcements every 5 days.
    if (g.settings.mode === 'fifty' && g.day > 1 && g.day % 5 === 0 && this.giftDay !== g.day) {
      this.giftDay = g.day;
      const gift = g.day < 20 ? ['ranger', 'ranger', 'soldier'] : g.day < 35 ? ['soldier', 'soldier', 'sniper'] : ['sniper', 'sniper', 'soldier', 'soldier'];
      for (const t of gift) g.spawnTrained(g.cc, t, false);
      g.notify(`Reinforcements arrived: ${gift.length} units`, 'good', g.cc, 'complete');
    }
    // Spawn queued infected a few per step.
    for (let i = 0; i < 80 && this.queue.length; i++) {
      const s = this.queue.pop();
      const z = g.addInfected(s.type, s.x, s.y, { cc: true });
      z.group = s.group;
    }
    // Track swarm groups for the minimap skull.
    this.groupT = (this.groupT || 0) - dt;
    if (this.groupT <= 0) { this.groupT = 1; this.trackGroups(); }
  }

  fire(ev) {
    const g = this.g;
    const def = EVENTS.find((e) => e.id === ev.id);
    const mult = Math.min(1 + def.growth * ev.n, def.cap);
    const sides = def.sides === 'all' ? [0, 1, 2, 3] : [ev.side];
    let total = 0;
    const group = ev.swarm ? ev.no : 0;
    for (const side of sides) {
      const center = (g.rng.next() - 0.5) * 60;
      for (const [type, lo, hi] of def.mix) {
        let t = type;
        if (g.settings.theme === 'FA' && !def.final && t === 'executive') t = 'fresh';
        const n = Math.ceil(g.rng.range(lo, hi) * g.popFactor * mult);
        for (let i = 0; i < n; i++) {
          const p = this.spawnPoint(side, def.swarm ? center + (g.rng.next() - 0.5) * 2 * (def.spread + 10) : (g.rng.next() - 0.5) * 100, def.swarm ? def.spread : 4);
          if (p) { this.queue.push({ type: t, x: p.x, y: p.y, group }); total++; }
        }
      }
    }
    // Shuffle so mixed types arrive together.
    for (let i = this.queue.length - 1; i > 0; i--) { const j = Math.floor(g.rng.next() * (i + 1)); [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; }
    if (ev.final) {
      this.finalSpawned = true;
      g.revealed = true; g.vision.revealAll = true;
      for (const z of g.infected) { z.st = 3; z.wave = true; z.target = null; }
      g.nestSys.finalWave();
    }
    if (ev.swarm) {
      g.ev.emit('swarm', ev, total);
      if (!ev.final) g.notify(`The swarm has arrived from the ${SIDES[ev.side]}: ${total} infected`, 'danger', null, 'horde');
    }
  }

  // A walkable cell near the generator strip of `side`, 85 cells from the centre.
  spawnPoint(side, along, spread) {
    const g = this.g, W = g.world, c = W.w / 2, R = 85;
    for (let k = 0; k < 12; k++) {
      const a = Math.max(-51, Math.min(51, along)) + (g.rng.next() - 0.5) * 4;
      const depth = (g.rng.next() - 0.5) * 2 * Math.min(spread, 6);
      let x, y;
      if (side === 0) { x = c + a; y = c - R + depth; }
      else if (side === 1) { x = c + R + depth; y = c + a; }
      else if (side === 2) { x = c + a; y = c + R + depth; }
      else { x = c - R + depth; y = c + a; }
      const tx = Math.floor(x), ty = Math.floor(y);
      if (W.inside(tx, ty) && W.walk[tx + ty * W.w] && W.occ[tx + ty * W.w] === -1 && g.colonyField.dist[tx + ty * W.w] !== 0xFFFFFFFF) return { x: x - tx + tx, y };
    }
    return null;
  }

  trackGroups() {
    const g = this.g, acc = new Map();
    for (const z of g.infected) {
      if (!z.group) continue;
      let a = acc.get(z.group); if (!a) acc.set(z.group, a = { x: 0, y: 0, n: 0 });
      a.x += z.x; a.y += z.y; a.n++;
    }
    this.groups = [...acc.entries()].filter(([, a]) => a.n >= 5).map(([id, a]) => ({ id, x: a.x / a.n, y: a.y / a.n, n: a.n }));
  }

  serialize() { return { list: this.list, queue: this.queue, finalSpawned: this.finalSpawned, giftDay: this.giftDay }; }
  load(s) { if (!s) return; this.list = s.list; this.queue = s.queue || []; this.finalSpawned = s.finalSpawned; this.giftDay = s.giftDay; }
}
