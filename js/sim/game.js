import { Rng } from '../core/rng.js';
import { SpatialGrid } from '../core/spatial.js';
import { FlowField, AStar } from '../core/pathing.js';
import { dist, rectDist, clamp } from '../core/util.js';
import { World } from './world.js';
import { Mods, Events } from './mods.js';
import { Vision } from './vision.js';
import { NoiseGrid } from './noise.js';
import { Economy, STOCKS } from './economy.js';
import { recomputePower, worksUnpowered } from './power.js';
import { placementBlocker, footprint } from './placement.js';
import { InfectedSystem } from './infected.js';
import { UnitSystem, SOLDIER_XP_FACTOR } from './units.js';
import { Structures } from './structures.js';
import { Combat } from './combat.js';
import { Waves } from './waves.js';
import { Nests } from './nests.js';
import { populate } from './populate.js';
import { computeScore } from './score.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { INFECTED } from '../data/infected.js';
import { TECHS, UNLOCKED_BY } from '../data/research.js';
import { MAYORS, MAYOR_LEVELS } from '../data/mayors.js';
import { THEMES, POPULATIONS, DURATIONS, MAP_SIZE, HOUR, DAY, TICK, scoreFactor } from '../data/maps.js';
import { T } from './worldgen.js';

export const STEP = 1 / 20;            // simulation step (s)
export const SAVE_VERSION = 2;

export class Game {
  constructor() {
    this.ev = new Events();
    this.state = 'none';
  }

  // ------------------------------------------------------------------ setup
  // settings: { mode, theme, pop, days, seed, name, mayors, fastForward }
  setup(settings) {
    const s = { mode: 'survival', theme: 'FA', pop: 'medium', days: 100, mayors: true, ...settings };
    if (s.seed == null) s.seed = (Math.random() * 2 ** 31) | 0;
    this.settings = s;
    this.theme = THEMES[s.theme];
    this.popFactor = POPULATIONS[s.pop].factor;
    this.durFactor = s.days / 100;
    this.scoreFactor = s.fixedScore || scoreFactor(s.theme, s.pop, s.days);
    this.rng = new Rng(s.seed ^ 0x5bd1e995);
    const gen = { ...this.theme.gen, villages: 0, blocks: [T.MOUNTAIN, T.STONE, T.IRON, T.GOLD, T.WATER, T.FOREST] };
    this.world = World.generate(s.seed, s.size || MAP_SIZE, gen);
    this.initState();
    this.mods.apply(this.theme.mods || []);
    // Command Center at the start position.
    const st = this.world.start;
    this.cc = this.addBuilding('cc', st.x - 2, st.y - 2, { built: true });
    this.res = { gold: 100, wood: 20, stone: 0, iron: 0, oil: 0 };
    const spots = [[-5, -1], [-5, 1], [-6, 0], [-5, 3], [-6, 2]];
    ['ranger', 'ranger', 'ranger', 'ranger', 'soldier'].forEach((t, i) => this.addUnit(t, st.x + spots[i][0] - 0.5, st.y + spots[i][1] + 0.5));
    populate(this);
    this.waves.schedule();
    this.afterLoad();
    this.state = 'playing';
    this.ev.emit('start');
  }

  initState() {
    const W = this.world;
    this.time = 0; this.tickT = 0; this.paused = false; this.speed = 1;
    this.res = { gold: 0, wood: 0, stone: 0, iron: 0, oil: 0 };
    this.buildings = []; this.units = []; this.infected = []; this.nests = []; this.pickups = []; this.barrels = []; this.ravens = [];
    this.projectiles = []; this.fxq = []; this.corpses = [];
    this.byId = new Map(); this.nextId = 1;
    this.techs = new Set(); this.mods = new Mods();
    this.mayors = []; this.mayorOffer = null; this.mayorLevel = 0;
    this.bonus = { units: {}, buildings: {} };
    this.alerts = []; this.lastAlert = null;
    this.stats = { kills: 0, killsByType: {}, unitsLost: 0, colonistsInfected: 0, colonistsDead: 0, maxColonists: 0, buildingsLost: 0, built: 0, negGoldTicks: 0, negFoodTicks: 0, giantsKilled: 0, paused: false, trained: 0, usedTowers: false, usedWalls: false, unitTypes: {} };
    this.result = null;
    this.eco = new Economy(this);
    this.vision = new Vision(W.w, W.h);
    this.noiseGrid = new NoiseGrid(W.w, W.h);
    this.zgrid = new SpatialGrid(4, W.w, W.h);
    this.colonyField = new FlowField(W.w, W.h);
    this.colonyCost = new Uint16Array(W.w * W.h);
    this.astar = new AStar(W.w, W.h);
    this.infSys = new InfectedSystem(this);
    this.unitSys = new UnitSystem(this);
    this.structs = new Structures(this);
    this.combat = new Combat(this);
    this.waves = new Waves(this);
    this.nestSys = new Nests(this);
    this.powerDirty = true; this.fieldDirty = true; this.visionT = 0; this.fieldT = 0;
    this.revealed = false;
  }

  afterLoad() {
    recomputePower(this);
    this.eco.recalc();
    this.rebuildColonyCost();
    this.colonyField.compute(this.ccSources(), this.colonyCost, this.world.solid);
    this.zgrid.rebuild(this.infected);
    this.updateVision();
    this.infSys.updatePresence();
  }

  // -------------------------------------------------------------- lookups
  def(type) { return BUILDINGS[type] || UNITS[type]; }
  get day() { return Math.floor(this.time / DAY) + 1; }
  get hour() { return Math.floor((this.time % DAY) / HOUR); }
  get totalDays() { return this.settings.days; }

  stat(def, key) {
    if (def.kind === 'infected' || INFECTED[def.id] === def) {
      let v = def[key];
      if (key === 'vision') v = this.mods.global('vision', v);
      if (key === 'awareness') v = this.mods.global('awareness', v);
      return v;
    }
    return def[key];
  }
  unitStat(u, key) {
    const def = u.def;
    if (key === 'range' || key === 'cd' || key === 'dmg') {
      const a = this.unitAttack(u);
      let v = a[key];
      if (key === 'range' && u.garrisoned) v += this.byId.get(u.garrisoned).def.garrison.range;
      return this.mods.stat('unit', u.type, key, v);
    }
    let v = def[key];
    if (key === 'vision') { v = this.mods.global('vision', v); if (u.garrisoned) v += this.byId.get(u.garrisoned).def.garrison.range; }
    if (key === 'speed' && u.carrying) v *= 0.8;
    return this.mods.stat('unit', u.type, key, v);
  }
  unitAttack(u) { return u.vet && u.def.vet ? u.def.vet : u.def.attack; }
  buildingStat(b, key) { return this.mods.stat('building', b.type, key, b.def[key] || 0); }
  needOf(def, group = 'building') {
    const out = {};
    for (const k in def.need || {}) out[k] = this.mods.stat(group, def.id, 'need.' + k, def.need[k]);
    return out;
  }

  // ------------------------------------------------------------- entities
  addBuilding(type, x, y, opts = {}) {
    const def = BUILDINGS[type];
    const [w, h] = footprint(def, opts.rot);
    const maxHp = this.mods.stat('building', type, 'hp', def.hp);
    const maxBarrier = this.mods.stat('building', type, 'barrier', def.barrier);
    const built = !!opts.built;
    const b = {
      id: this.nextId++, kind: 'b', type, def, x, y, w, h, cx: x + w / 2, cy: y + h / 2, rot: opts.rot ? 1 : 0,
      hp: built ? maxHp : Math.max(1, maxHp * 0.2), maxHp, barrier: built ? maxBarrier : maxBarrier * 0.2, maxBarrier,
      state: built ? 'ok' : 'build', progress: built ? 1 : 0, buildTime: this.buildTime(def), paid: opts.paid || {},
      off: false, powered: true, queue: [], trainT: 0, rq: [], resT: 0, garrison: [], cd: 0, target: null, prio: 'nearest',
      trapCd: 0, mineT: -1, mineDelay: 0, gateOpen: 0, output: null, tiles: 0, lastHit: -99, neutral: !!opts.neutral, free: !!opts.free,
    };
    if (opts.state) b.state = opts.state;
    this.buildings.push(b); this.byId.set(b.id, b);
    this.world.occupy(b, true);
    this.onStructureChange(b);
    return b;
  }
  buildTime(def) { return Math.max(1, this.mods.stat('building', def.id, 'build', def.build || 30)); }

  addUnit(type, x, y, opts = {}) {
    const def = UNITS[type];
    const u = {
      id: this.nextId++, kind: 'u', type, def, x, y, r: def.r, hp: def.hp, maxHp: def.hp, xp: 0, vet: !!opts.vet,
      cmd: { t: 'idle' }, post: { x, y }, path: null, cd: 0, cdx: 0, target: null, prio: def.priority === 'special' ? 'strongest' : 'nearest',
      face: 1, garrisoned: 0, carrying: null, lastHit: -99, burnT: 0, scan: Math.random() * 0.2, moving: false, flash: 0,
    };
    if (this.buildings.some((b) => b.type === 'academy' && b.state === 'ok') && def.vet) u.vet = true;
    this.units.push(u); this.byId.set(u.id, u);
    this.eco.dirty = true;
    this.stats.unitTypes[type] = true;
    return u;
  }

  addInfected(type, x, y, opts = {}) {
    const def = INFECTED[type];
    let hp = def.hp;
    if (def.hpRange) hp = Math.round(def.hpRange[0] + (def.hpRange[1] - def.hpRange[0]) * clamp(this.popFactor / 1.5, 0, 1) * this.rng.next());
    const z = {
      id: this.nextId++, kind: 'z', type, def, x, y, r: def.r, hp, maxHp: hp,
      st: opts.cc ? 3 : 0, target: null, gx: x, gy: y, hx: x, hy: y, cd: this.rng.next() * def.attack.cd, face: 1, lastHit: -99,
      burnT: 0, slow: 1, slowT: 0, scanT: this.rng.next() * 1.5, noiseT: this.rng.next() * 4, wanderT: this.rng.next() * 6, vx: 0, vy: 0,
      stuck: 0, flash: 0, wave: !!opts.cc, linger: 0, incoming: 0, nest: opts.nest || 0,
    };
    this.infected.push(z);
    return z;
  }

  remove(e) { this.byId.delete(e.id); }

  // ------------------------------------------------------------ main loop
  update(realDt) {
    if (this.state !== 'playing' || this.paused) return;
    this.acc = (this.acc || 0) + Math.min(0.25, realDt) * this.speed;
    let steps = 0;
    while (this.acc >= STEP && steps < 12) { this.step(STEP); this.acc -= STEP; steps++; if (this.state !== 'playing') break; }
    if (steps >= 12) this.acc = 0;
  }

  step(dt) {
    this.time += dt;
    this.tickT += dt;
    if (this.tickT >= TICK) { this.tickT -= TICK; this.eco.payTick(); }
    this.waves.update(dt);
    this.zgrid.rebuild(this.infected);
    if (this.powerDirty) recomputePower(this);
    if (this.eco.dirty) this.eco.recalc();
    this.structs.update(dt);
    this.unitSys.update(dt);
    this.infSys.update(dt);
    this.nestSys.update(dt);
    this.combat.updateProjectiles(dt);
    this.noiseGrid.update(dt);
    this.updatePickups();
    this.visionT -= dt;
    if (this.visionT <= 0) { this.visionT = 0.25; this.updateVision(); }
    this.updateColonyField(dt);
    this.cleanup();
    this.checkMayor();
    this.checkEnd();
  }

  // Colony flow field: sources are the Command Center cells. Walls and
  // buildings are passable at a cost proportional to their HP, so swarms
  // look for the weakest point instead of the shortest path.
  rebuildColonyCost() {
    const W = this.world, cost = this.colonyCost;
    for (let i = 0; i < cost.length; i++) cost[i] = W.walk[i] ? 10 : 0;
    for (const b of this.buildings) {
      if (b.def.trap || b.def.mine) continue;
      const c = b.def.wall || b.def.gate ? Math.min(600, 10 + Math.round(b.hp / 8)) : b.def.garrison ? Math.min(600, 30 + Math.round(b.hp / 10)) : 20;
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (W.walk[x + y * W.w]) cost[x + y * W.w] = c;
    }
  }
  ccSources() {
    const W = this.world, out = [];
    if (!this.cc) return out;
    for (let y = this.cc.y; y < this.cc.y + this.cc.h; y++) for (let x = this.cc.x; x < this.cc.x + this.cc.w; x++) out.push(x + y * W.w);
    return out;
  }
  updateColonyField(dt) {
    this.fieldT -= dt;
    if (this.colonyField.busy) { this.colonyField.run(6000); return; }
    if (this.fieldDirty && this.fieldT <= 0) {
      this.fieldDirty = false; this.fieldT = 1.5;
      this.rebuildColonyCost();
      this.colonyField.begin(this.ccSources(), this.colonyCost, this.world.solid);
      this.colonyField.run(6000);
    }
  }

  updateVision() {
    const src = [];
    for (const b of this.buildings) {
      if (b.neutral || b.state === 'infected') continue;
      let r = this.buildingStat(b, 'vision');
      if (!r) r = b.def.wall || b.def.gate || b.def.trap || b.def.mine ? 0 : 2;
      if (r) src.push({ x: b.cx, y: b.cy, r: this.mods.global('vision', r) });
    }
    for (const u of this.units) src.push({ x: u.x, y: u.y, r: this.unitStat(u, 'vision') });
    this.vision.recompute(src);
    if ((this.buildings.some((b) => b.type === 'telescope' && b.state === 'ok')) || this.revealed) this.vision.revealAll = true;
  }

  onStructureChange(b) {
    this.fieldDirty = true; this.eco.dirty = true;
    if (b && (b.def.grid || b.type === 'cc')) this.powerDirty = true;
    else if (b) this.powerDirty = true;
  }

  // ----------------------------------------------------------- notifications
  notify(text, kind = 'info', where = null, sound = null) {
    this.ev.emit('msg', text, kind, where);
    if (sound) this.ev.emit('sound', sound);
  }
  alert(where, text) {
    // Throttled "under attack" alert.
    if (this.time - (this.lastAlertT || -99) < 6) return;
    this.lastAlertT = this.time;
    this.lastAlert = { x: where.cx ?? where.x, y: where.cy ?? where.y, t: this.time };
    this.ev.emit('alert', this.lastAlert, text);
  }

  // ----------------------------------------------------------- lock rules
  techDone(id) { return this.techs.has(id); }
  hasBuilding(type, built = true) { return this.buildings.some((b) => b.type === type && !b.neutral && (!built || b.state === 'ok' || b.state === 'upgrade')); }
  countBuildings(type) { return this.buildings.filter((b) => b.type === type && !b.neutral).length; }

  // Why `type` (building or unit) can't be built right now, or null.
  lockReason(type) {
    const def = this.def(type);
    if (!def) return 'Unknown';
    const tech = UNLOCKED_BY[type];
    if (tech && !this.techs.has(tech)) return `Research ${TECHS[tech].name} first`;
    if (def.needs && !this.hasBuilding(def.needs)) return `Needs a ${BUILDINGS[def.needs].name}`;
    if (def.tech && UNITS[type] && TECHS[def.tech] && !this.techs.has(def.tech)) return `Research ${TECHS[def.tech].name} first`;
    if (BUILDINGS[type]) {
      if (def.max && this.countBuildings(type) >= def.max) return def.max === 1 ? 'Only one allowed' : `At most ${def.max}`;
      if (def.colonistsPer && this.eco.colonists < def.colonistsPer * (this.countBuildings(type) + 1)) return `Needs ${def.colonistsPer * (this.countBuildings(type) + 1)} colonists`;
      if (this.cc && this.cc.state === 'repair' && !def.onCC) return 'Cannot build while the Command Center is repaired';
      if (this.buildings.some((b) => b.type === 'telescope' && b.state === 'build')) return 'Cannot build while the Great Telescope is being built';
      if (def.fixed) return 'Cannot be built';
    }
    return null;
  }

  // Full check for placing a building. Returns null or a reason.
  buildBlocker(type, x, y, rot) {
    const def = BUILDINGS[type];
    const free = (this.bonus.buildings[type] || 0) > 0;
    const p = placementBlocker(this, type, x, y, rot);
    if (p) return p;
    return this.eco.blocker(this.needOf(def), free ? {} : def.cost);
  }
  costBlocker(type) {
    const def = BUILDINGS[type];
    const free = (this.bonus.buildings[type] || 0) > 0;
    return this.lockReason(type) || this.eco.blocker(this.needOf(def), free ? {} : def.cost);
  }

  build(type, x, y, rot = 0) {
    const def = BUILDINGS[type];
    if (def.onCC) return this.buildOnCC(type);
    const why = this.buildBlocker(type, x, y, rot);
    if (why) return why;
    const free = (this.bonus.buildings[type] || 0) > 0;
    if (free) this.bonus.buildings[type]--; else this.eco.pay(def.cost);
    // Gates and towers dropped on walls refund part of those walls.
    const [w, h] = footprint(def, rot);
    if (def.onWalls) {
      for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
        const o = this.world.occAt(tx, ty);
        if (o !== -1) { const wb = this.byId.get(o); if (wb && wb.def.wall) { this.eco.give(halfCost(wb.def.cost)); this.removeBuilding(wb); } }
      }
    }
    const b = this.addBuilding(type, x, y, { rot, paid: free ? {} : { ...def.cost }, free });
    if (def.wall || def.gate) this.stats.usedWalls = true;
    if (def.garrison) this.stats.usedTowers = true;
    if (def.attack && !def.inert) this.stats.usedAttackTowers = true;
    if (type === 'ballista' || type === 'executor') this.stats.usedBallista = true;
    this.ev.emit('sound', 'build', b.cx, b.cy);
    this.ev.emit('built', b);
    return null;
  }

  buildOnCC(type) {
    const def = BUILDINGS[type];
    const why = this.lockReason(type) || this.eco.blocker({}, def.cost);
    if (why) return why;
    if (this.buildings.some((b) => b.type === type)) return 'Already built';
    this.eco.pay(def.cost);
    const b = this.addBuilding(type, this.cc.x, this.cc.y, { paid: { ...def.cost } });
    this.world.occupy(b, false);       // lives on top of the CC
    for (let y = this.cc.y; y < this.cc.y + this.cc.h; y++) for (let x = this.cc.x; x < this.cc.x + this.cc.w; x++) this.world.occ[x + y * this.world.w] = this.cc.id;
    b.onCC = true;
    return null;
  }

  upgradeBlocker(b) {
    const to = b.def.upgradeTo;
    if (!to || b.state !== 'ok' || b.neutral) return 'Cannot upgrade';
    const lock = this.lockReason(to);
    if (lock && !(UNLOCKED_BY[to] && this.techs.has(UNLOCKED_BY[to]))) return lock;
    const def = BUILDINGS[to];
    const extra = {};
    const nNew = this.needOf(def), nOld = this.needOf(b.def);
    for (const k in nNew) { const d = nNew[k] - (nOld[k] || 0); if (d > 0) extra[k] = d; }
    return this.eco.blocker(extra, upgradeCost(b.def, def));
  }
  upgrade(b) {
    const why = this.upgradeBlocker(b);
    if (why) return why;
    const def = BUILDINGS[b.def.upgradeTo];
    const cost = upgradeCost(b.def, def);
    this.eco.pay(cost);
    for (const k in cost) b.paid[k] = (b.paid[k] || 0) + cost[k];
    b.upFrom = b.type;
    b.type = def.id; b.def = def;
    b.state = 'upgrade'; b.progress = 0;
    b.buildTime = Math.max(1, this.mods.stat('building', def.id, 'build', def.upgradeTime || (def.build || 30) * 0.45));
    b.maxHp = this.mods.stat('building', def.id, 'hp', def.hp);
    b.maxBarrier = this.mods.stat('building', def.id, 'barrier', def.barrier);
    this.onStructureChange(b);
    this.ev.emit('sound', 'build', b.cx, b.cy);
    return null;
  }

  repairCost(b) {
    const g = b.def.cost.gold || 0;
    if (b.state === 'infected') return { gold: Math.ceil(g * 0.3) };
    const miss = 1 - (b.hp + b.barrier) / (b.maxHp + b.maxBarrier);
    const c = {};
    for (const k in b.def.cost) { const v = Math.ceil(b.def.cost[k] * 0.3 * miss); if (v > 0) c[k] = v; }
    return c;
  }
  repairBlocker(b) {
    if (b.state !== 'ok' && b.state !== 'infected') return 'Cannot repair now';
    if (b.hp >= b.maxHp && b.barrier >= b.maxBarrier && b.state !== 'infected') return 'Not damaged';
    if (!b.powered) return 'Must be inside the energy grid';
    if (this.zgrid.nearest(b.cx, b.cy, 4 + Math.max(b.w, b.h) / 2, (z) => z.hp > 0)) return 'Infected too close';
    return this.eco.blocker({}, this.repairCost(b));
  }
  repair(b) {
    const why = this.repairBlocker(b);
    if (why) return why;
    this.eco.pay(this.repairCost(b));
    b.wasInfected = b.state === 'infected';
    if (b.neutral) b.neutral = false;
    b.state = 'repair'; b.progress = 0;
    const miss = b.wasInfected ? 1 : 1 - (b.hp + b.barrier) / (b.maxHp + b.maxBarrier);
    b.buildTime = Math.max(3, this.buildTime(b.def) * 0.5 * miss);
    b.repairFrom = { hp: b.hp, barrier: b.barrier };
    this.onStructureChange(b);
    return null;
  }

  demolishBlocker(b) {
    if (b.def.noDemolish || b.type === 'cc' || b.onCC) return 'Cannot be demolished';
    if (b.neutral) return 'Not yours';
    if (this.zgrid.nearest(b.cx, b.cy, 4 + Math.max(b.w, b.h) / 2, (z) => z.hp > 0)) return 'Infected too close';
    return null;
  }
  demolish(b) {
    const why = this.demolishBlocker(b);
    if (why) return why;
    const f = b.state === 'build' ? 1 : this.mods.global('refund', 0.5);
    this.eco.give(scaleCost(b.paid, f), false);
    for (const uid of b.garrison) this.ungarrison(this.byId.get(uid), b);
    this.removeBuilding(b);
    this.ev.emit('sound', 'click');
    return null;
  }

  toggle(b) {
    if (!b.def.toggle || b.state !== 'ok') return 'Cannot switch off';
    b.off = !b.off;
    this.eco.dirty = true;
    return null;
  }

  removeBuilding(b) {
    if (b.dead) return;
    b.dead = true;
    if (!b.onCC) this.world.occupy(b, false);
    if (b.onCC) for (let y = this.cc.y; y < this.cc.y + this.cc.h; y++) for (let x = this.cc.x; x < this.cc.x + this.cc.w; x++) this.world.occ[x + y * this.world.w] = this.cc.id;
    this.buildings.splice(this.buildings.indexOf(b), 1);
    this.remove(b);
    // Losing a workshop loses its research.
    if (b.def.research && !b.neutral) for (const id in TECHS) if (TECHS[id].at === b.type && this.techs.has(id) && !this.grantedTechs?.has(id)) this.techs.delete(id);
    this.onStructureChange(b);
    this.ev.emit('removed', b);
  }

  destroyBuilding(b, src) {
    if (b.dead) return;
    const pos = { x: b.cx, y: b.cy };
    for (const uid of b.garrison) this.ungarrison(this.byId.get(uid), b);
    if (!b.neutral) { this.stats.buildingsLost++; if (!b.def.wall) this.notify(`${b.def.name} destroyed`, 'danger', pos); }
    this.fx('burst', b.cx, b.cy, Math.max(b.w, b.h));
    this.ev.emit('sound', 'collapse', b.cx, b.cy);
    if (b.type === 'cc') { this.endGame(false, 'The Command Center was destroyed'); }
    this.removeBuilding(b);
  }

  // Infected damage drains the barrier; once it is gone the next hit infects
  // (for infectable buildings) or damages hit points (walls, towers, traps).
  buildingHurt(b, src) {
    b.lastHit = this.time;
    if (!b.neutral && b.type !== 'cc' && !b.def.wall) this.alert(b, `${b.def.name} under attack`);
    else if (b.type === 'cc') this.alert(b, 'Command Center under attack');
  }

  infectBuilding(b) {
    if (b.state === 'infected' || b.dead) return;
    const def = b.def;
    const n = (def.house ? (def.supply.workers || 0) : (def.need.workers || def.supply.colonists || 0)) + (def.extraInfected || 0);
    const prevState = b.state;
    b.state = 'infected'; b.barrier = 0; b.queue = []; b.rq = [];
    this.ev.emit('sound', 'infect', b.cx, b.cy);
    for (const uid of b.garrison) this.ungarrison(this.byId.get(uid), b);
    if (!(def.house && prevState === 'build')) {
      for (let i = 0; i < n; i++) {
        const t = def.house ? 'colonist' : this.rng.pick(['colonist', 'colonist', 'fresh', 'fresh', 'executive']);
        const p = this.freeCellNear(b.cx, b.cy, Math.max(b.w, b.h) + 2) || { x: b.cx, y: b.cy };
        const z = this.addInfected(t, p.x + (this.rng.next() - 0.5) * 0.6, p.y + (this.rng.next() - 0.5) * 0.6);
        z.st = 1; z.gx = b.cx; z.gy = b.cy; z.linger = 2;
      }
      this.stats.colonistsInfected += n;
      this.noise(b.cx, b.cy, 50 * Math.max(1, n));
    }
    this.onStructureChange(b);
    this.notify(`${def.name} has been infected!`, 'danger', { x: b.cx, y: b.cy }, 'alert');
    this.fx('infect', b.cx, b.cy, Math.max(b.w, b.h));
    if (def.endGame) this.endGame(false, 'The Command Center was infected');
  }

  // -------------------------------------------------------------- training
  pendingUnits() {
    const out = [];
    for (const b of this.buildings) for (const t of b.queue) out.push(UNITS[t.type]);
    return out;
  }
  trainBlocker(b, type, mercenary) {
    const def = UNITS[type];
    if (!mercenary) {
      if (b.state !== 'ok' || !b.def.trains || !b.def.trains.includes(type)) return 'Cannot train here';
      const lock = this.lockReason(type);
      if (lock && !(this.bonus.units[type] > 0)) return lock;
      if (b.queue.length >= 5) return 'Queue is full';
      if (!b.powered) return 'No power';
      if (def.at === 'engineeringcenter' && this.eco.income.oil <= 0) return 'Needs positive oil income';
    }
    const free = (this.bonus.units[type] || 0) > 0;
    return this.eco.blocker(def.need, free || mercenary ? {} : def.cost);
  }
  train(b, type) {
    const why = this.trainBlocker(b, type);
    if (why) return why;
    const def = UNITS[type];
    const free = (this.bonus.units[type] || 0) > 0;
    if (free) this.bonus.units[type]--; else this.eco.pay(def.cost);
    b.queue.push({ type, paid: free ? {} : { ...def.cost }, t: 0, time: Math.max(1, this.mods.stat('unit', type, 'train', def.train)) });
    this.eco.dirty = true;
    this.stats.trained++;
    return null;
  }
  cancelTrain(b, i) {
    const q = b.queue[i];
    if (!q) return;
    b.queue.splice(i, 1);
    this.eco.give(q.paid, false);
    this.eco.dirty = true;
  }
  spawnTrained(b, type, vet) {
    const p = this.freeCellNear(b.cx, b.cy + b.h / 2 + 0.5, 6) || { x: b.cx, y: b.y + b.h + 0.5 };
    const u = this.addUnit(type, p.x, p.y, { vet });
    this.ev.emit('sound', 'trained', p.x, p.y);
    if (b.rally) { this.unitSys.command([u], { t: 'move', x: b.rally.x, y: b.rally.y }); }
    this.fx('ring', p.x, p.y, 1);
    this.ev.emit('sound', 'complete', p.x, p.y);
    return u;
  }

  // -------------------------------------------------------------- research
  researchBlocker(b, id) {
    const t = TECHS[id];
    if (!t || b.type !== t.at || b.state !== 'ok') return 'Not here';
    if (this.techs.has(id)) return 'Already researched';
    if (b.rq.some((r) => r.id === id)) return 'Already queued';
    if (b.rq.length >= 4) return 'Research queue is full';
    for (const r of t.requires) if (!this.techs.has(r)) return `Requires ${TECHS[r].name}`;
    if (t.needs && !this.hasBuilding(t.needs)) return `Needs a ${BUILDINGS[t.needs].name}`;
    if (!b.powered) return 'No power';
    return this.eco.blocker({}, t.cost);
  }
  research(b, id) {
    const why = this.researchBlocker(b, id);
    if (why) return why;
    this.eco.pay(TECHS[id].cost);
    b.rq.push({ id, t: 0, time: TECHS[id].time });
    return null;
  }
  cancelResearch(b, i) {
    const r = b.rq[i]; if (!r) return;
    b.rq.splice(i, 1);
    this.eco.give(TECHS[r.id].cost, false);
  }
  completeTech(id, granted) {
    this.techs.add(id);
    if (granted) { this.grantedTechs = this.grantedTechs || new Set(); this.grantedTechs.add(id); }
    this.notify(`Research complete: ${TECHS[id].name}`, 'good', null, 'research');
    this.ev.emit('tech', id);
  }

  // -------------------------------------------------------------- garrison
  garrison(u, b) {
    if (!b.def.garrison || !u.def.garrison || b.state !== 'ok' || b.garrison.length >= b.def.garrison.max) return false;
    b.garrison.push(u.id); u.garrisoned = b.id; u.x = b.cx; u.y = b.cy; u.target = null; u.cmd = { t: 'hold' };
    return true;
  }
  ungarrison(u, b) {
    if (!u) return;
    b = b || this.byId.get(u.garrisoned);
    if (b) b.garrison = b.garrison.filter((id) => id !== u.id);
    u.garrisoned = 0;
    const p = this.freeCellNear(b ? b.cx : u.x, b ? b.cy : u.y, 3) || { x: u.x, y: u.y };
    u.x = p.x; u.y = p.y; u.cmd = { t: 'idle' }; u.post = { x: u.x, y: u.y };
  }

  // -------------------------------------------------------------- mayors
  checkMayor() {
    if (!this.settings.mayors || this.mayorOffer) return;
    const lvl = this.mayorLevel;
    if (lvl >= MAYOR_LEVELS.length) return;
    if (this.eco.colonists >= MAYOR_LEVELS[lvl]) {
      const pool = MAYORS.filter((m) => m.level === lvl + 1);
      const a = this.rng.pick(pool);
      let b = this.rng.pick(pool); let guard = 0;
      while (b === a && guard++ < 20) b = this.rng.pick(pool);
      this.mayorOffer = { level: lvl + 1, options: [a.id, b.id] };
      this.notify(`A new mayor can be elected (level ${lvl + 1})`, 'good', null, 'complete');
      this.ev.emit('mayor', this.mayorOffer);
    }
  }
  chooseMayor(id) {
    const m = MAYORS.find((x) => x.id === id);
    if (!m || !this.mayorOffer) return;
    this.mayorOffer = null; this.mayorLevel++;
    this.mayors.push(id);
    if (m.res) this.eco.give(m.res, false);
    if (m.techs) for (const t of m.techs) if (!this.techs.has(t)) this.completeTech(t, true);
    if (m.mods) { this.mods.apply(m.mods); this.refreshStats(); }
    if (m.units) for (const t in m.units) this.bonus.units[t] = (this.bonus.units[t] || 0) + m.units[t];
    if (m.buildings) for (const t in m.buildings) this.bonus.buildings[t] = (this.bonus.buildings[t] || 0) + m.buildings[t];
    this.eco.dirty = true; this.powerDirty = true;
    this.ev.emit('mayorChosen', m);
  }
  // Bonus units from mayors appear next to the Command Center.
  claimBonusUnit(type) {
    if (!(this.bonus.units[type] > 0)) return 'No bonus unit';
    const why = this.eco.blocker(UNITS[type].need, {});
    if (why) return why;
    this.bonus.units[type]--;
    const u = this.spawnTrained(this.cc, type, false);
    return u ? null : 'No room';
  }
  refreshStats() {
    for (const b of this.buildings) {
      const hpF = b.hp / b.maxHp, brF = b.maxBarrier ? b.barrier / b.maxBarrier : 0;
      b.maxHp = this.mods.stat('building', b.type, 'hp', b.def.hp); b.hp = b.maxHp * hpF;
      b.maxBarrier = this.mods.stat('building', b.type, 'barrier', b.def.barrier); b.barrier = b.maxBarrier * brF;
    }
  }

  // --------------------------------------------------------- mercenaries
  hireMercenary(inn, i) {
    const o = inn.mercs && inn.mercs[i];
    if (!o) return 'Not available';
    if (this.res.gold < o.price) return 'Not enough gold';
    const why = this.eco.blocker(UNITS[o.type].need, {});
    if (why) return why;
    this.res.gold -= o.price;
    inn.mercs.splice(i, 1);
    this.spawnTrained(inn, o.type, o.vet);
    return null;
  }

  // --------------------------------------------------------------- pickups
  updatePickups() {
    // Ravens take off when a unit comes close.
    if (this.ravens.length && (this.ravenT = (this.ravenT || 0) - 1) <= 0) {
      this.ravenT = 10;
      for (const r of this.ravens) if (!r.gone) for (const u of this.units) if ((u.x - r.x) ** 2 + (u.y - r.y) ** 2 < 16) { r.gone = true; this.fx('ring', r.x, r.y, 0.5); break; }
    }
    if (!this.pickups.length) return;
    for (const p of this.pickups) {
      if (p.taken) continue;
      for (const u of this.units) {
        if (u.garrisoned) continue;
        const dx = u.x - p.x, dy = u.y - p.y;
        if (dx * dx + dy * dy < 1.2) { this.collect(p); break; }
      }
    }
    if (this.pickups.some((p) => p.taken)) this.pickups = this.pickups.filter((p) => !p.taken);
  }
  collect(p) {
    p.taken = true;
    if (p.type === 'workers' || p.type === 'food' || p.type === 'energy') { this.eco.bonusCap[p.type] += p.amount; this.eco.dirty = true; }
    else { this.res[p.type] = (this.res[p.type] || 0) + p.amount; }   // pickups may exceed storage
    this.notify(`Collected ${p.amount} ${p.type}`, 'good', null, 'complete');
    this.fx('ring', p.x, p.y, 1);
  }

  // ------------------------------------------------------- unit helpers
  desertUnits() {
    const n = Math.max(1, Math.ceil(this.units.length * 0.1));
    for (let i = 0; i < n && this.units.length; i++) {
      const u = this.units.reduce((a, b) => (UNITS[a.type].upkeep.gold || 0) >= (UNITS[b.type].upkeep.gold || 0) ? a : b);
      this.removeUnit(u);
      this.notify(`A ${u.def.name} deserted: wages unpaid`, 'danger');
    }
  }
  dismiss(u) {
    const near = this.buildings.some((b) => b.type === 'soldierscenter' && b.state === 'ok' && rectDist(u.x, u.y, b.x, b.y, b.w, b.h) < 4);
    if (!near) return 'Must be next to a Soldiers Center';
    this.eco.give(halfCost(u.def.cost), false);
    this.removeUnit(u);
    return null;
  }
  removeUnit(u) {
    if (u.dead) return;
    u.dead = true;
    if (u.garrisoned) { const b = this.byId.get(u.garrisoned); if (b) b.garrison = b.garrison.filter((id) => id !== u.id); }
    if (u.carrying) { u.carrying.carriedBy = 0; u.carrying.x = u.x; u.carrying.y = u.y; u.carrying = null; }
    this.units.splice(this.units.indexOf(u), 1);
    this.remove(u);
    this.eco.dirty = true;
    this.ev.emit('unitRemoved', u);
  }

  // ------------------------------------------------------------ combat hooks
  unitFire(u, target, extra) {
    const a = extra ? u.def.extra : this.unitAttack(u);
    const dmg = this.mods.stat('unit', u.type, 'dmg', a.dmg) / a.dmg;
    this.combat.fire(u, target, a, dmg);
  }
  noise(x, y, amount) { this.noiseGrid.add(x, y, amount); }
  fx(type, x, y, a, b, c) { if (this.fxq.length < 400) this.fxq.push({ type, x, y, a, b, c, t: 0 }); }

  // An infected was hurt by a player unit or structure: it and idle infected
  // within 1 cell go after the attacker.
  infectedHurt(z, src) {
    z.lastHit = this.time;
    if (!src || src.dead) return;
    const target = src.kind === 'u' && src.garrisoned ? this.byId.get(src.garrisoned) : src;
    if (!target || target.def.inert && src.kind === 'b' && z.target && z.target !== src && this.rng.next() < 0.7) return;
    if (z.st !== 2 || (z.target && z.target.kind === 'b' && target.kind === 'u')) { z.target = target; z.st = 2; }
    this.zgrid.query(z.x, z.y, 1.2, (q) => { if (q !== z && (q.st === 0 || q.st === 1)) { q.target = target; q.st = 2; } return false; });
  }
  killInfected(z, src) {
    if (z.dead) return;
    z.dead = true; z.hp = 0;
    this.stats.kills++;
    this.stats.killsByType[z.type] = (this.stats.killsByType[z.type] || 0) + 1;
    if (z.type === 'giant') this.stats.giantsKilled++;
    if (src && src.kind === 'u' && !src.dead && src.def.xp && !src.vet) {
      src.xp += z.def.power * (src.type === 'soldier' ? SOLDIER_XP_FACTOR : 1);
      if (src.xp >= src.def.xp) { src.vet = true; this.notify(`A ${src.def.name} became a veteran`, 'good', src); this.fx('ring', src.x, src.y, 1); }
    }
    if (this.corpses.length < 600) this.corpses.push({ x: z.x, y: z.y, t: this.time, type: z.type, r: z.r });
    this.ev.emit('sound', 'zdie', z.x, z.y);
    this.fx('splat', z.x, z.y, z.r);
  }
  killUnit(u, src) {
    if (u.dead) return;
    this.stats.unitsLost++;
    this.notify(`${u.def.name} killed`, 'danger', { x: u.x, y: u.y });
    if (u.carrying) this.combat.explodeBarrel(u.carrying, u.x, u.y);
    if (this.corpses.length < 600) this.corpses.push({ x: u.x, y: u.y, t: this.time, type: u.type, r: u.r, human: true });
    this.fx('burst', u.x, u.y, 0.6);
    this.ev.emit('sound', 'die', u.x, u.y);
    this.removeUnit(u);
  }
  alertUnderAttack(u, src) { u.lastHit = this.time; this.alert(u, `${u.def.name} under attack`); }

  // Nearest player unit or building an infected at (x,y) can see/target.
  findHumanTarget(x, y, range, includeWalls) {
    let best = null, bd = range * range;
    for (const u of this.units) {
      if (u.garrisoned) continue;
      const dx = u.x - x, dy = u.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = u; }
    }
    const W = this.world, r = Math.ceil(range);
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W.w - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(W.h - 1, Math.floor(y + r));
    let seen = null;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const o = W.occ[tx + ty * W.w];
      if (o === -1 || o === seen) continue;
      const b = this.byId.get(o);
      if (!b || b.neutral || b.state === 'infected' || b.def.inert || b.def.trap || b.def.mine) continue;
      if (!includeWalls && (b.def.wall || b.def.gate)) continue;
      const d = rectDist(x, y, b.x, b.y, b.w, b.h) ** 2;
      if (d < bd) { bd = d; best = b; seen = o; }
    }
    return best;
  }

  // Infected (or nest) for a player shooter. prio: 'nearest' | 'strongest'.
  findInfectedTarget(x, y, r, prio, current) {
    let best = null, score = -Infinity;
    this.zgrid.query(x, y, r, (z, d2) => {
      if (z.hp <= 0 || z.hp - (z.incoming || 0) <= 0 && z !== current) return false;
      if (!this.vision.revealAll && !this.vision.isVisible(z.x, z.y)) return false;
      const s = prio === 'strongest' ? z.def.power * 1000 - d2 : -d2;
      if (s > score) { score = s; best = z; }
      return false;
    });
    if (!best && this.nests.length) {
      for (const n of this.nests) if (n.hp > 0 && n.aggro && rectDist(x, y, n.x, n.y, n.w, n.h) <= r) return n;
    }
    return best;
  }

  adjacentBuilding(z) {
    const W = this.world, x = Math.floor(z.x), y = Math.floor(z.y);
    let best = null, bd = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = W.occAt(x + dx, y + dy);
      if (o === -1) continue;
      const b = this.byId.get(o);
      if (!b || b.neutral) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // Player unit movement: walls block, gates let units through.
  unitPassIdx(i) {
    const W = this.world;
    if (!W.walk[i]) return false;
    const o = W.occ[i];
    if (o === -1) return true;
    const b = this.byId.get(o);
    return !!(b && b.def.gate && b.state !== 'build' && !b.dead);
  }
  unitPass(x, y) {
    const W = this.world, tx = Math.floor(x), ty = Math.floor(y);
    if (!W.inside(tx, ty)) return false;
    return this.unitPassIdx(tx + ty * W.w);
  }
  clearLine(ax, ay, bx, by) {
    const W = this.world;
    let ok = true;
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx - dy, x = ax, y = ay;
    for (let n = 0; n < 512; n++) {
      if (!this.unitPassIdx(x + y * W.w)) { ok = false; break; }
      if (x === bx && y === by) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return ok;
  }
  terrainSpeed(x, y) {
    const W = this.world, tx = Math.floor(x), ty = Math.floor(y);
    if (!W.inside(tx, ty)) return 1;
    const i = tx + ty * W.w;
    let s = W.tiles[i] === T.MUD ? 0.85 : 1;
    if (W.trap[i] !== -1) { const tr = this.byId.get(W.trap[i]); if (tr && tr.def.trap) s *= 0.5; }
    return s;
  }
  freeCellNear(cx, cy, maxR) {
    const W = this.world, bx = Math.floor(cx), by = Math.floor(cy);
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = bx + dx, y = by + dy;
        if (W.inside(x, y) && W.walk[x + y * W.w] && W.occ[x + y * W.w] === -1) return { x: x + 0.5, y: y + 0.5 };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- cleanup
  cleanup() {
    if (this.infected.some((z) => z.dead)) {
      const keep = [];
      for (const z of this.infected) if (!z.dead) keep.push(z);
      this.infected = keep;
    }
    if (this.corpses.length && this.time - this.corpses[0].t > 40) this.corpses = this.corpses.filter((c) => this.time - c.t < 40);
  }

  // ------------------------------------------------------------- end game
  checkEnd() {
    if (this.state !== 'playing') return;
    this.stats.maxColonists = Math.max(this.stats.maxColonists, this.eco.colonists);
    if (this.time >= this.totalDays * DAY) this.endGame(true, `You survived ${this.totalDays} days`);
    else if (this.waves.finalSpawned && this.infected.length === 0 && this.nests.every((n) => n.hp <= 0) && this.waves.pendingSpawns() === 0) this.endGame(true, 'Every infected on the map is dead');
  }
  endGame(won, reason) {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    this.result = { won, reason, day: this.day, ...computeScore(this, won) };
    this.ev.emit('sound', won ? 'victory' : 'defeat');
    this.ev.emit('end', this.result);
  }

  // ---------------------------------------------------------------- saving
  serialize() {
    const ent = (e, keys) => { const o = {}; for (const k of keys) if (e[k] !== undefined) o[k] = e[k]; return o; };
    return {
      v: SAVE_VERSION, settings: this.settings, world: this.world.serialize(), time: this.time, tickT: this.tickT,
      res: this.res, techs: [...this.techs], granted: [...(this.grantedTechs || [])], mods: this.mods.serialize(),
      mayors: this.mayors, mayorOffer: this.mayorOffer, mayorLevel: this.mayorLevel, bonus: this.bonus,
      stats: this.stats, revealed: this.revealed, bonusCap: this.eco.bonusCap, unpaid: this.eco.unpaidTicks,
      nextId: this.nextId, rng: this.rng.state, waves: this.waves.serialize(), noise: this.noiseGrid.serialize(),
      explored: encodeBits(this.vision.explored),
      buildings: this.buildings.map((b) => ent(b, ['id', 'type', 'x', 'y', 'rot', 'hp', 'barrier', 'state', 'progress', 'buildTime', 'paid', 'off', 'queue', 'rq', 'garrison', 'prio', 'mineDelay', 'neutral', 'free', 'onCC', 'upFrom', 'wasInfected', 'repairFrom', 'mercs', 'mercDay', 'rally'])),
      units: this.units.map((u) => ent(u, ['id', 'type', 'x', 'y', 'hp', 'xp', 'vet', 'cmd', 'post', 'prio', 'garrisoned', 'face'])),
      infected: this.infected.map((z) => [z.id, z.type, +z.x.toFixed(2), +z.y.toFixed(2), Math.round(z.hp), z.st, z.wave ? 1 : 0, +z.hx.toFixed(1), +z.hy.toFixed(1), z.nest || 0, z.maxHp]),
      nests: this.nests.map((n) => ent(n, ['id', 'size', 'x', 'y', 'w', 'h', 'hp', 'maxHp', 'made', 'max', 'village', 'aggro', 'lastGen', 'lastRaid', 'lastCheck'])),
      pickups: this.pickups.map((p) => ent(p, ['id', 'type', 'amount', 'x', 'y'])),
      barrels: this.barrels.map((x) => ent(x, ['id', 'x', 'y', 'hp'])),
      ravens: this.ravens.map((r) => ent(r, ['x', 'y', 'gone'])),
    };
  }

  load(s) {
    if (!s || s.v !== SAVE_VERSION) throw new Error('Unsupported save version');
    this.settings = s.settings;
    this.theme = THEMES[s.settings.theme];
    this.popFactor = POPULATIONS[s.settings.pop].factor;
    this.durFactor = s.settings.days / 100;
    this.scoreFactor = s.settings.fixedScore || scoreFactor(s.settings.theme, s.settings.pop, s.settings.days);
    this.world = World.fromSave(s.world);
    this.initState();
    this.rng = new Rng(0); this.rng.state = s.rng;
    this.time = s.time; this.tickT = s.tickT; this.res = s.res;
    this.techs = new Set(s.techs); this.grantedTechs = new Set(s.granted || []);
    this.mods = Mods.from(s.mods);
    this.mayors = s.mayors; this.mayorOffer = s.mayorOffer; this.mayorLevel = s.mayorLevel; this.bonus = s.bonus;
    this.stats = s.stats; this.revealed = s.revealed; this.eco.bonusCap = s.bonusCap; this.eco.unpaidTicks = s.unpaid || 0;
    decodeBits(s.explored, this.vision.explored);
    for (const o of s.buildings) {
      const b = this.addBuilding(o.type, o.x, o.y, { rot: o.rot, built: o.state === 'ok', neutral: o.neutral });
      this.byId.delete(b.id); b.id = o.id; this.byId.set(b.id, b);
      Object.assign(b, o, { def: BUILDINGS[o.type] });
      b.maxHp = this.mods.stat('building', b.type, 'hp', b.def.hp); b.maxBarrier = this.mods.stat('building', b.type, 'barrier', b.def.barrier);
      this.world.occupy(b, false); if (!b.onCC) this.world.occupy(b, true);
      if (b.type === 'cc') this.cc = b;
    }
    for (const b of this.buildings) if (b.onCC) for (let y = this.cc.y; y < this.cc.y + this.cc.h; y++) for (let x = this.cc.x; x < this.cc.x + this.cc.w; x++) this.world.occ[x + y * this.world.w] = this.cc.id;
    for (const o of s.units) {
      const u = this.addUnit(o.type, o.x, o.y);
      this.byId.delete(u.id); Object.assign(u, o); this.byId.set(u.id, u);
    }
    for (const a of s.infected) {
      const z = this.addInfected(a[1], a[2], a[3]);
      z.id = a[0]; z.hp = a[4]; z.st = a[5] === 2 ? 1 : a[5]; z.wave = !!a[6]; z.hx = a[7]; z.hy = a[8]; z.nest = a[9]; z.maxHp = a[10] || z.maxHp;
      if (z.st === 1) { z.gx = this.cc.cx; z.gy = this.cc.cy; z.linger = 3; }
    }
    this.nestSys.load(s.nests || []);
    this.pickups = s.pickups || []; this.barrels = (s.barrels || []).map((x) => ({ ...x, kind: 'x' }));
    this.ravens = s.ravens || [];
    for (const x of this.barrels) this.byId.set(x.id, x);
    this.nextId = s.nextId;
    this.waves.load(s.waves);
    this.noiseGrid.load(s.noise);
    this.afterLoad();
    this.state = 'playing';
  }
}

export function halfCost(cost) { return scaleCost(cost, 0.5); }
export function scaleCost(cost, f) { const o = {}; for (const k in cost || {}) { const v = Math.ceil(cost[k] * f - 1e-9); if (v > 0) o[k] = v; } return o; }
export function upgradeCost(from, to) {
  if (to.upgradeCost) return { ...to.upgradeCost };
  const c = {};
  for (const k in to.cost) { const d = to.cost[k] - (from.cost[k] || 0); if (d > 0) c[k] = d; }
  return c;
}
function encodeBits(arr) { let s = ''; for (let i = 0; i < arr.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v |= (arr[i + k] ? 1 : 0) << k; s += String.fromCharCode(48 + v); } return s; }
function decodeBits(s, arr) { if (!s) return; for (let j = 0; j < s.length; j++) { const v = s.charCodeAt(j) - 48; for (let k = 0; k < 6; k++) if (j * 6 + k < arr.length) arr[j * 6 + k] = (v >> k) & 1; } }
