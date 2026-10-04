'use strict';
// ---------------------------------------------------------------------------
// Core simulation: economy, buildings, units, zombies, hordes, save/load.
// Positions are in tile units (floats). Entities are plain objects with a
// `kind` field: 'b' building, 'u' unit, 'z' zombie.
// ---------------------------------------------------------------------------
class Game {
  constructor() {
    this.listeners = {};
    this.state = 'title';
    this.tips = [];
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...args) { for (const fn of this.listeners[ev] || []) fn(...args); }
  msg(text, kind, where) { this.emit('msg', text, kind || 'info', where); }

  // ------------------------------------------------------------------ setup
  newGame(seed, difficulty) {
    this.seed = seed == null ? (Math.random() * 1e9) | 0 : seed;
    this.difficulty = DIFFICULTY[difficulty] ? difficulty : 'normal';
    this.world = new World(this.seed);
    this.res = { ...CFG.START_RES };
    this.rates = { gold: 0, wood: 0, stone: 0, food: 0 };
    this.workers = { cap: 0, used: 0 };
    this.time = 0; this.day = 1; this.speed = 1; this.paused = false;
    this.buildings = []; this.units = []; this.zombies = []; this.projectiles = []; this.effects = [];
    this.byId = new Map();
    this.nextId = 1; this.kills = 0; this.lostBuildings = 0;
    this.state = 'playing'; this.result = null;
    this.spawnQueue = [];
    this.hordes = HORDES.map((h) => ({
      day: h.day, comp: { ...h.comp }, final: !!h.final,
      sides: h.final ? [0, 1, 2, 3] : [Math.floor(Math.random() * 4)],
      warned: false, announced: false, spawned: false,
    }));
    this.selection = { kind: null, ids: [] };
    this.placing = null;
    this.fieldStamp = 0; this.unitFields = new Map();
    this.baseField = null; this.baseFieldDirty = true; this.fieldTimer = 0;
    this.hash = new SpatialHash(4, this.world.w, this.world.h);
    this.terrainDirty = true;
    const cx = (this.world.w >> 1) - 1, cy = (this.world.h >> 1) - 1;
    this.cc = this.addBuilding('cc', cx, cy);
    this.spawnUnit('ranger', cx - 1.5, cy + 4.5);
    this.spawnUnit('ranger', cx + 4.5, cy + 4.5);
    this.spawnAmbient();
    this.recalcEconomy();
    this.rebuildBaseField();
    this.tips = [
      [1, 'Tap a building below, tap the map to position it, then tap ✓ to build.'],
      [14, 'Tents give workers and gold but eat food. Farms grow food on open grass.'],
      [28, 'Sawmills need forest nearby, quarries need rock. Check the yield before building.'],
      [42, 'The first horde comes on day 5. Ring the colony with walls and ballistas!'],
      [60, 'Tap a ranger, then tap the ground to move it. "Army" selects every unit.'],
    ];
  }

  // ------------------------------------------------------------- buildings
  addBuilding(type, x, y, hp) {
    const def = BUILDINGS[type];
    const b = {
      id: this.nextId++, kind: 'b', type, x, y, w: def.w, h: def.h,
      hp: hp == null ? def.hp : hp, maxHp: def.hp, cx: x + def.w / 2, cy: y + def.h / 2,
      cd: 0, scanT: Math.random() * 0.2, target: null, queue: [], trainT: 0, yield: 0, dead: false,
    };
    const W = this.world;
    for (let ty = y; ty < y + def.h; ty++) for (let tx = x; tx < x + def.w; tx++) {
      const i = W.idx(tx, ty);
      if (W.tiles[i] === T.FOREST) { W.tiles[i] = T.GRASS; this.res.wood += 2; this.terrainDirty = true; }
      W.occ[i] = b.id;
    }
    this.buildings.push(b); this.byId.set(b.id, b);
    this.invalidateFields();
    return b;
  }

  removeBuilding(b, byZombie) {
    if (b.dead) return;
    b.dead = true;
    const W = this.world;
    for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) W.occ[W.idx(tx, ty)] = -1;
    this.buildings.splice(this.buildings.indexOf(b), 1);
    this.byId.delete(b.id);
    if (this.selection.kind === 'building' && this.selection.ids[0] === b.id) this.clearSelection();
    this.invalidateFields();
    this.recalcEconomy();
    if (byZombie) {
      this.lostBuildings++;
      this.effect(b.cx, b.cy, 'burst', '#ff7a3c', 0.8);
      const def = BUILDINGS[b.type];
      if (def.infect) {
        for (let i = 0; i < def.infect; i++) {
          this.spawnZombie('walker', b.cx + (Math.random() - 0.5) * 0.8, b.cy + (Math.random() - 0.5) * 0.8, false);
        }
        this.msg('A tent was overrun — its colonists have turned!', 'danger');
      } else if (b.type !== 'wall') {
        this.msg(`${def.name} destroyed!`, 'danger');
      }
      if (b.type === 'cc') this.endGame(false);
    }
  }

  canPlace(type, x, y) {
    const def = BUILDINGS[type];
    const W = this.world;
    for (let ty = y; ty < y + def.h; ty++) for (let tx = x; tx < x + def.w; tx++) {
      if (!W.inBounds(tx, ty)) return { ok: false, reason: 'Outside the map' };
      const t = W.tileAt(tx, ty);
      if (t === T.WATER) return { ok: false, reason: 'Cannot build on water' };
      if (t === T.ROCK) return { ok: false, reason: 'Cannot build on rock' };
      if (W.occAt(tx, ty) !== -1) return { ok: false, reason: 'Space is occupied' };
    }
    const cx = x + def.w / 2, cy = y + def.h / 2, rr = Math.max(def.w, def.h) / 2 + 0.5;
    let blocked = null;
    this.hash.each(cx, cy, rr, (z) => { if (!blocked && z.hp > 0 && z.x >= x - 0.3 && z.x < x + def.w + 0.3 && z.y >= y - 0.3 && z.y < y + def.h + 0.3) blocked = z; });
    if (blocked) return { ok: false, reason: 'Zombies in the way!' };
    for (const u of this.units) {
      if (u.x >= x && u.x < x + def.w && u.y >= y && u.y < y + def.h) return { ok: false, reason: 'A unit is in the way' };
    }
    return { ok: true };
  }

  affordable(cost) {
    for (const k in cost) if ((this.res[k] || 0) < cost[k]) return false;
    return true;
  }
  pay(cost) { for (const k in cost) this.res[k] -= cost[k]; }

  // Returns the reason a building cannot be bought right now, or null.
  buildBlocker(type) {
    const def = BUILDINGS[type];
    if (!this.affordable(def.cost)) return 'Not enough resources';
    if (def.workers < 0 && this.workers.cap - this.workers.used < -def.workers) return 'Not enough workers — build tents';
    if (def.food < 0 && this.rates.food + def.food < 0) return 'Not enough food — build farms';
    return null;
  }

  tryBuild(type, x, y, quiet) {
    const p = this.canPlace(type, x, y);
    if (!p.ok) { if (!quiet) this.msg(p.reason, 'warn'); return false; }
    const blocker = this.buildBlocker(type);
    if (blocker) { if (!quiet) this.msg(blocker, 'warn'); return false; }
    this.pay(BUILDINGS[type].cost);
    const b = this.addBuilding(type, x, y);
    this.recalcEconomy();
    this.effect(b.cx, b.cy, 'ring', '#ffffff', 0.4);
    this.emit('built', b);
    return true;
  }

  demolish(b) {
    if (b.type === 'cc' || b.dead) return;
    const cost = BUILDINGS[b.type].cost;
    for (const k in cost) this.res[k] += Math.floor(cost[k] * 0.5);
    this.removeBuilding(b, false);
    this.msg('Demolished (50% refunded)');
  }

  // Yield of a resource building from the tiles around it.
  computeYield(b) {
    const def = BUILDINGS[b.type];
    if (!def.yields) return 0;
    const y = def.yields, W = this.world;
    let count = 0;
    for (let ty = b.y - y.radius; ty < b.y + b.h + y.radius; ty++) {
      for (let tx = b.x - y.radius; tx < b.x + b.w + y.radius; tx++) {
        if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) continue;
        if (!W.inBounds(tx, ty)) continue;
        if (W.tileAt(tx, ty) === y.tile && W.occAt(tx, ty) === -1) count++;
      }
    }
    return Math.round(count * y.per * 10) / 10;
  }

  // Yield preview for a building that is not placed yet.
  previewYield(type, x, y) {
    const def = BUILDINGS[type];
    if (!def.yields) return null;
    return this.computeYield({ type, x, y, w: def.w, h: def.h });
  }

  recalcEconomy() {
    const r = { gold: 0, wood: 0, stone: 0, food: 0 };
    let cap = 0, used = 0;
    for (const b of this.buildings) {
      const def = BUILDINGS[b.type];
      if (def.workers > 0) cap += def.workers; else used += -def.workers;
      r.gold += def.gold || 0; r.wood += def.wood || 0; r.stone += def.stone || 0; r.food += def.food || 0;
      if (def.yields) { b.yield = this.computeYield(b); r[def.yields.res] += b.yield; }
    }
    for (const k in r) r[k] = Math.round(r[k] * 10) / 10;
    this.rates = r; this.workers = { cap, used };
  }

  invalidateFields() { this.fieldStamp++; this.unitFields.clear(); this.baseFieldDirty = true; }

  rebuildBaseField() {
    const W = this.world, cc = this.cc;
    const sources = [];
    for (let ty = cc.y; ty < cc.y + cc.h; ty++) for (let tx = cc.x; tx < cc.x + cc.w; tx++) sources.push(W.idx(tx, ty));
    this.baseField = W.dijkstra(sources, (x, y) => {
      if (W.terrainBlocked(x, y)) return Infinity;
      const o = W.occ[x + y * W.w];
      if (o === -1) return 1;
      const b = this.byId.get(o);
      return b && b.type === 'wall' ? 30 : 20;
    });
    this.baseFieldDirty = false;
  }

  getUnitField(tx, ty) {
    const key = tx + ',' + ty;
    const c = this.unitFields.get(key);
    if (c) return c;
    const W = this.world;
    const field = W.dijkstra([W.idx(tx, ty)], (x, y) => this.unitPass(x, y) ? 1 : Infinity);
    if (this.unitFields.size > 24) this.unitFields.delete(this.unitFields.keys().next().value);
    this.unitFields.set(key, field);
    return field;
  }

  unitPass(x, y) {
    const W = this.world;
    if (W.terrainBlocked(x, y)) return false;
    const o = W.occAt(x, y);
    if (o === -1) return true;
    const b = this.byId.get(o);
    return !!(b && b.type === 'wall');
  }
  zombiePass(x, y) { return !this.world.terrainBlocked(x, y); }

  // ----------------------------------------------------------------- units
  spawnUnit(type, x, y, hp) {
    const def = UNITS[type];
    const u = {
      id: this.nextId++, kind: 'u', type, x, y, hp: hp == null ? def.hp : hp, maxHp: def.hp,
      cd: 0, scanT: Math.random() * 0.2, target: null, order: null, post: { x, y }, dead: false, alert: null,
    };
    this.units.push(u); this.byId.set(u.id, u);
    return u;
  }

  freeTileNear(cx, cy, maxR) {
    const W = this.world;
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.floor(cx + dx), ty = Math.floor(cy + dy);
        if (W.inBounds(tx, ty) && !W.terrainBlocked(tx, ty) && W.occAt(tx, ty) === -1) return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return null;
  }

  train(b, type) {
    const def = UNITS[type];
    if (b.queue.length >= 5) { this.msg('Training queue is full', 'warn'); return false; }
    if (!this.affordable(def.cost)) { this.msg('Not enough resources', 'warn'); return false; }
    this.pay(def.cost);
    b.queue.push(type);
    return true;
  }

  orderMove(ids, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (const id of ids) {
      const u = this.byId.get(id);
      if (u && u.kind === 'u') u.order = { x: tx, y: ty, fx: x, fy: y };
    }
    this.effect(x, y, 'move', '#7cff7c', 0.5);
  }

  selectUnits(ids) { this.selection = { kind: 'units', ids: ids.slice() }; this.emit('select'); }
  selectBuilding(b) { this.selection = { kind: 'building', ids: [b.id] }; this.emit('select'); }
  clearSelection() { this.selection = { kind: null, ids: [] }; this.emit('select'); }
  selectedUnits() { return this.selection.kind === 'units' ? this.selection.ids.map((id) => this.byId.get(id)).filter((u) => u && !u.dead) : []; }
  selectedBuilding() { return this.selection.kind === 'building' ? this.byId.get(this.selection.ids[0]) : null; }

  unitAt(x, y, r) {
    let best = null, bd = (r || 0.5) ** 2;
    for (const u of this.units) { const d = (u.x - x) ** 2 + (u.y - y) ** 2; if (d < bd) { bd = d; best = u; } }
    return best;
  }
  buildingAt(tx, ty) { const o = this.world.occAt(tx, ty); return o === -1 ? null : this.byId.get(o); }

  // --------------------------------------------------------------- zombies
  spawnZombie(type, x, y, horde, hp) {
    const def = ZOMBIES[type];
    const z = {
      id: this.nextId++, kind: 'z', type, x, y, hp: hp == null ? def.hp : hp, maxHp: def.hp, r: def.r,
      cd: Math.random() * def.cd, scanT: Math.random() * 0.5, state: horde ? 'horde' : 'idle', horde: !!horde,
      target: null, wanderT: 0, wx: 0, wy: 0, hit: 0, stuckT: 0, dead: false,
    };
    this.zombies.push(z);
    return z;
  }

  spawnAmbient() {
    const W = this.world, cx = W.w / 2, cy = W.h / 2;
    let placed = 0, guard = 0;
    while (placed < CFG.AMBIENT_ZOMBIES && guard++ < 20000) {
      const x = Math.floor(Math.random() * W.w), y = Math.floor(Math.random() * W.h);
      const d = U.dist(x + 0.5, y + 0.5, cx, cy);
      if (d < CFG.AMBIENT_MIN_DIST || !W.reach[W.idx(x, y)] || W.terrainBlocked(x, y)) continue;
      if (Math.random() > d / 34) continue;
      const group = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0; i < group && placed < CFG.AMBIENT_ZOMBIES; i++) {
        const roll = Math.random();
        const type = roll < 0.85 || d < 22 ? (roll < 0.88 ? 'walker' : 'runner') : (roll < 0.97 ? 'runner' : 'brute');
        const p = this.freeTileNear(x + 0.5, y + 0.5, 2) || { x: x + 0.5, y: y + 0.5 };
        this.spawnZombie(type, p.x + (Math.random() - 0.5) * 0.6, p.y + (Math.random() - 0.5) * 0.6, false);
        placed++;
      }
    }
  }

  // Finds a walkable tile near the map edge of the given side.
  edgeSpawnPoint(side, along, depth) {
    const W = this.world;
    let x, y;
    if (side === 0) { x = along; y = depth; }
    else if (side === 1) { x = W.w - 1 - depth; y = along; }
    else if (side === 2) { x = along; y = W.h - 1 - depth; }
    else { x = depth; y = along; }
    x = U.clamp(Math.floor(x), 0, W.w - 1); y = U.clamp(Math.floor(y), 0, W.h - 1);
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = x + dx, ty = y + dy;
        if (W.inBounds(tx, ty) && W.reach[W.idx(tx, ty)] && !W.terrainBlocked(tx, ty) && W.occAt(tx, ty) === -1) return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return null;
  }

  queueGroup(side, comp, horde) {
    const W = this.world;
    const center = 10 + Math.random() * (W.w - 20);
    for (const type in comp) {
      for (let i = 0; i < comp[type]; i++) {
        const along = center + (Math.random() - 0.5) * 26;
        const p = this.edgeSpawnPoint(side, along, Math.random() * 4);
        if (p) this.spawnQueue.push({ type, x: p.x + (Math.random() - 0.5) * 0.8, y: p.y + (Math.random() - 0.5) * 0.8, horde });
      }
    }
  }

  spawnHorde(h) {
    const n = h.sides.length, mult = DIFFICULTY[this.difficulty].horde;
    for (const side of h.sides) {
      const comp = {};
      for (const t in h.comp) comp[t] = Math.ceil(h.comp[t] * mult / n);
      this.queueGroup(side, comp, true);
    }
  }

  get nextHorde() { return this.hordes.find((h) => !h.spawned) || null; }
  get hordeAlive() { let n = 0; for (const z of this.zombies) if (z.horde) n++; return n + this.spawnQueue.length; }
  get dayFrac() { return (this.time % CFG.DAY_LENGTH) / CFG.DAY_LENGTH; }

  sideName(sides) { return sides.map((s) => SIDES[s]).join(' & '); }

  checkHordes() {
    for (const h of this.hordes) {
      const name = h.final ? 'ALL SIDES' : this.sideName(h.sides);
      if (!h.warned && this.day >= h.day - 1) {
        h.warned = true;
        if (this.day === h.day - 1) this.msg(`⚠️ Scouts report a horde gathering to the ${name}. Expected tomorrow night!`, 'warn');
      }
      if (!h.announced && this.day >= h.day) {
        h.announced = true;
        this.msg(h.final ? '☠️ The FINAL horde comes tonight from every direction. Hold the line!' : `The horde arrives tonight from the ${name}!`, 'warn');
      }
      if (!h.spawned && this.day >= h.day && this.dayFrac >= CFG.HORDE_SPAWN_FRAC) {
        h.spawned = true;
        this.spawnHorde(h);
        this.msg(`🧟 HORDE INCOMING from the ${name}!`, 'danger');
        this.emit('horde', h);
      }
    }
  }

  onNewDay() {
    this.emit('autosave');
    const hordeDay = this.hordes.some((h) => h.day === this.day || h.day === this.day + 1);
    if (this.day >= 4 && !hordeDay && Math.random() < 0.35) {
      const side = Math.floor(Math.random() * 4);
      const n = Math.max(2, Math.round((4 + this.day * 0.5) * DIFFICULTY[this.difficulty].raid));
      this.queueGroup(side, { walker: n, runner: Math.floor(n / 3) }, true);
      this.msg(`A pack of zombies wanders in from the ${SIDES[side]}.`, 'warn');
    }
  }

  // Nearest unit (within range) or non-wall building (within bRange) of a zombie.
  findZombieTarget(z, range, bRange) {
    let best = null, bd = range * range;
    for (const u of this.units) {
      if (u.dead) continue;
      const d = (u.x - z.x) ** 2 + (u.y - z.y) ** 2;
      if (d < bd) { bd = d; best = u; }
    }
    const br = bRange == null ? range : bRange;
    if (best === null || br > range) bd = Math.min(bd, br * br);
    for (const b of this.buildings) {
      if (b.type === 'wall') continue;
      const px = U.clamp(z.x, b.x, b.x + b.w), py = U.clamp(z.y, b.y, b.y + b.h);
      const d = (px - z.x) ** 2 + (py - z.y) ** 2;
      if (d < bd && d < br * br) { bd = d; best = b; }
    }
    return best;
  }

  reachInfo(z, t) {
    if (t.kind === 'b') {
      const px = U.clamp(z.x, t.x, t.x + t.w), py = U.clamp(z.y, t.y, t.y + t.h);
      const d = U.dist(z.x, z.y, px, py);
      return { d, dx: d > 1e-4 ? (px - z.x) / d : 0, dy: d > 1e-4 ? (py - z.y) / d : 0, inReach: d <= 0.85 };
    }
    const d = U.dist(z.x, z.y, t.x, t.y);
    return { d, dx: d > 1e-4 ? (t.x - z.x) / d : 0, dy: d > 1e-4 ? (t.y - z.y) / d : 0, inReach: d <= z.r + 0.45 };
  }

  moveZombie(z, dx, dy, step, dt) {
    const W = this.world;
    const len = Math.hypot(dx, dy) || 1;
    const nx = z.x + (dx / len) * step, ny = z.y + (dy / len) * step;
    let bump = null, moved = false;
    let tx = Math.floor(nx), ty = Math.floor(z.y);
    if (W.inBounds(tx, ty) && !W.terrainBlocked(tx, ty)) {
      const o = W.occ[tx + ty * W.w];
      if (o === -1) { z.x = nx; moved = true; } else bump = this.byId.get(o);
    }
    tx = Math.floor(z.x); ty = Math.floor(ny);
    if (W.inBounds(tx, ty) && !W.terrainBlocked(tx, ty)) {
      const o = W.occ[tx + ty * W.w];
      if (o === -1) { z.y = ny; moved = true; } else bump = bump || this.byId.get(o);
    }
    if (bump && bump !== z.target) { z.target = bump; z.state = 'chase'; }
    if (moved) z.stuckT = 0; else z.stuckT += dt;
    if (z.stuckT > 1.2 && !bump) {
      z.stuckT = 0;
      const a = Math.random() * Math.PI * 2;
      z.wx = Math.cos(a); z.wy = Math.sin(a); z.wanderT = 1.5;
      if (z.horde) { z.state = 'horde'; z.target = null; } else { z.state = 'idle'; z.target = null; }
    }
  }

  // Alerts a zombie (and idle neighbours) to whoever hurt it.
  alertZombie(z, src) {
    if (!src || src.dead || src.hp <= 0) return;
    const divert = (q) => {
      if (q.state === 'chase' && q.target && q.target.kind === 'u') return;
      q.target = src; q.state = 'chase';
    };
    divert(z);
    this.hash.each(z.x, z.y, 2.5, (q) => { if (q !== z && q.state !== 'chase') divert(q); });
  }

  damage(t, dmg, src) {
    if (t.dead || t.hp <= 0) return;
    t.hp -= dmg;
    if (t.kind === 'z') { t.hit = 0.15; this.alertZombie(t, src); }
    else if (t.kind === 'u') { if (t.hp <= 0) { t.dead = true; this.effect(t.x, t.y, 'burst', '#5db8ff', 0.6); } }
    else if (t.kind === 'b') {
      if (src && src.kind === 'z') this.onBuildingAttacked(t, src);
      if (t.hp <= 0) this.removeBuilding(t, !!(src && src.kind === 'z'));
    }
  }

  // A zombie hit a building: warn the player (throttled) and rally nearby idle units.
  onBuildingAttacked(b, z) {
    if (this.time - (this.lastAttackAlert || -99) > 8 && b.type !== 'wall') {
      this.lastAttackAlert = this.time;
      this.emit('attack', b);
      this.msg(`⚠️ ${BUILDINGS[b.type].name} under attack!`, 'danger', b);
    }
    for (const u of this.units) {
      if (u.order || u.alert || u.target) continue;
      if (U.dist(u.x, u.y, b.cx, b.cy) <= 12) { u.alert = { z, t: 8 }; u.target = z; }
    }
  }

  // Nearest zombie that is not already doomed by projectiles in flight.
  nearestShootable(x, y, r) {
    let best = null, bd = Infinity, fallback = null, fd = Infinity;
    this.hash.each(x, y, r, (e, d2) => {
      if (e.hp <= 0) return;
      if (d2 < fd) { fd = d2; fallback = e; }
      if (e.hp - (e.incoming || 0) > 0 && d2 < bd) { bd = d2; best = e; }
    });
    return best || fallback;
  }

  fire(src, x, y, target, dmg, color) {
    target.incoming = (target.incoming || 0) + dmg;
    this.projectiles.push({ x, y, target, dmg, src, speed: 16, color });
  }

  effect(x, y, type, color, dur) { this.effects.push({ x, y, type, color, t: 0, dur }); }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.state !== 'playing' || this.paused) return;
    let t = dt * this.speed;
    while (t > 0) { const s = Math.min(t, 1 / 30); this.step(s); t -= s; if (this.state !== 'playing') break; }
  }

  step(dt) {
    this.time += dt;
    const day = Math.floor(this.time / CFG.DAY_LENGTH) + 1;
    if (day !== this.day) { this.day = day; this.onNewDay(); }
    this.checkHordes();
    this.res.gold += this.rates.gold * dt / CFG.DAY_LENGTH;
    this.res.wood += this.rates.wood * dt / CFG.DAY_LENGTH;
    this.res.stone += this.rates.stone * dt / CFG.DAY_LENGTH;

    for (let i = 0; i < 4 && this.spawnQueue.length; i++) {
      const s = this.spawnQueue.shift();
      this.spawnZombie(s.type, s.x, s.y, s.horde);
    }
    if (this.tips.length && this.time >= this.tips[0][0]) this.msg(this.tips.shift()[1], 'tip');

    this.hash.clear();
    for (const z of this.zombies) this.hash.insert(z);

    if (this.baseFieldDirty) { this.fieldTimer -= dt; if (this.fieldTimer <= 0) { this.rebuildBaseField(); this.fieldTimer = 0.5; } }

    this.updateBuildings(dt);
    this.updateUnits(dt);
    this.updateZombies(dt);
    this.updateProjectiles(dt);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);

    // Cleanup
    let killed = 0;
    for (const z of this.zombies) if (z.hp <= 0 && !z.dead) { z.dead = true; killed++; this.effect(z.x, z.y, 'puff', '#6b8f3e', 0.5); }
    if (killed) { this.kills += killed; this.zombies = this.zombies.filter((z) => !z.dead); }
    if (this.units.some((u) => u.dead)) {
      this.units = this.units.filter((u) => !u.dead);
      if (this.selection.kind === 'units') { this.selection.ids = this.selection.ids.filter((id) => this.byId.get(id) && !this.byId.get(id).dead); if (!this.selection.ids.length) this.clearSelection(); }
    }
    for (const u of this.units) if (u.dead) this.byId.delete(u.id);

    if (this.day > CFG.TOTAL_DAYS && this.hordeAlive === 0) this.endGame(true);
  }

  updateBuildings(dt) {
    for (const b of this.buildings) {
      const def = BUILDINGS[b.type];
      if (def.attack) {
        b.cd -= dt; b.scanT -= dt;
        if (b.scanT <= 0) { b.scanT = 0.2; b.target = this.nearestShootable(b.cx, b.cy, def.attack.range); }
        if (b.target && (b.target.dead || b.target.hp <= 0)) b.target = null;
        if (b.target && b.cd <= 0 && U.dist(b.cx, b.cy, b.target.x, b.target.y) <= def.attack.range + 0.5) {
          b.cd = def.attack.cd;
          this.fire(b, b.cx, b.cy, b.target, def.attack.dmg, '#ffd36b');
        }
      }
      if (def.trains && b.queue.length) {
        b.trainT += dt;
        const ut = UNITS[b.queue[0]];
        if (b.trainT >= ut.train) {
          b.trainT = 0;
          const p = this.freeTileNear(b.cx, b.cy, 4);
          if (p) { this.spawnUnit(b.queue.shift(), p.x, p.y); this.effect(p.x, p.y, 'ring', '#5db8ff', 0.5); }
        }
      }
    }
  }

  moveEntity(e, dx, dy, step, passFn) {
    const W = this.world;
    const len = Math.hypot(dx, dy) || 1;
    const nx = U.clamp(e.x + (dx / len) * step, 0.2, W.w - 0.2), ny = U.clamp(e.y + (dy / len) * step, 0.2, W.h - 0.2);
    if (passFn(Math.floor(nx), Math.floor(e.y))) e.x = nx;
    if (passFn(Math.floor(e.x), Math.floor(ny))) e.y = ny;
  }

  updateUnits(dt) {
    const pass = (x, y) => this.unitPass(x, y);
    for (const u of this.units) {
      const def = UNITS[u.type];
      u.cd -= dt; u.scanT -= dt;
      if (u.alert) { u.alert.t -= dt; if (u.alert.t <= 0 || u.alert.z.dead || u.alert.z.hp <= 0) u.alert = null; }
      if (u.scanT <= 0) { u.scanT = 0.2; u.target = this.nearestShootable(u.x, u.y, def.aggro) || (u.alert ? u.alert.z : null); }
      if (u.target && (u.target.dead || u.target.hp <= 0)) u.target = null;
      const td = u.target ? U.dist(u.x, u.y, u.target.x, u.target.y) : Infinity;

      if (u.order) {
        const o = u.order, tx = Math.floor(u.x), ty = Math.floor(u.y);
        if (tx === o.x && ty === o.y) {
          if (U.dist(u.x, u.y, o.fx, o.fy) < 0.15) { u.post = { x: o.fx, y: o.fy }; u.order = null; }
          else this.moveEntity(u, o.fx - u.x, o.fy - u.y, Math.min(def.speed * dt, U.dist(u.x, u.y, o.fx, o.fy)), pass);
        } else {
          const next = this.world.fieldStep(this.getUnitField(o.x, o.y), tx, ty, pass);
          if (!next) { u.post = { x: u.x, y: u.y }; u.order = null; }
          else this.moveEntity(u, next.x + 0.5 - u.x, next.y + 0.5 - u.y, def.speed * dt, pass);
        }
      } else if (u.target) {
        if (td > def.range - 0.3) this.moveEntity(u, u.target.x - u.x, u.target.y - u.y, def.speed * dt, pass);
      } else if (U.dist(u.x, u.y, u.post.x, u.post.y) > 0.4) {
        const tx = Math.floor(u.x), ty = Math.floor(u.y), px = Math.floor(u.post.x), py = Math.floor(u.post.y);
        if (tx === px && ty === py) this.moveEntity(u, u.post.x - u.x, u.post.y - u.y, Math.min(def.speed * dt, U.dist(u.x, u.y, u.post.x, u.post.y)), pass);
        else {
          const next = this.world.fieldStep(this.getUnitField(px, py), tx, ty, pass);
          if (!next) u.post = { x: u.x, y: u.y };
          else this.moveEntity(u, next.x + 0.5 - u.x, next.y + 0.5 - u.y, def.speed * dt, pass);
        }
      }
      if (u.target && td <= def.range + 0.3 && u.cd <= 0) {
        u.cd = def.cd;
        this.fire(u, u.x, u.y, u.target, def.dmg, '#ffffff');
      }
    }
    // Keep units from stacking on one spot.
    const us = this.units;
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.36 && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (0.6 - d) * 0.5 * dt * 4;
        const px = (dx / d) * push, py = (dy / d) * push;
        if (pass(Math.floor(a.x - px), Math.floor(a.y - py))) { a.x -= px; a.y -= py; }
        if (pass(Math.floor(b.x + px), Math.floor(b.y + py))) { b.x += px; b.y += py; }
      }
    }
  }

  updateZombies(dt) {
    const W = this.world;
    const zpass = (x, y) => !W.terrainBlocked(x, y);
    for (const z of this.zombies) {
      const def = ZOMBIES[z.type];
      z.cd -= dt; z.scanT -= dt;
      if (z.hit > 0) z.hit -= dt;
      if (z.target && (z.target.dead || z.target.hp <= 0)) { z.target = null; z.state = z.horde ? 'horde' : 'idle'; }

      if (z.state === 'idle') {
        if (z.scanT <= 0) {
          z.scanT = 0.4 + Math.random() * 0.3;
          const t = this.findZombieTarget(z, def.aggro, 3.5);   // idle zombies only notice buildings up close
          if (t) { z.target = t; z.state = 'chase'; }
        }
        if (z.state === 'idle') {
          z.wanderT -= dt;
          if (z.wanderT <= 0) {
            z.wanderT = 2 + Math.random() * 5;
            if (Math.random() < 0.55) { z.wx = 0; z.wy = 0; }
            else { const a = Math.random() * Math.PI * 2; z.wx = Math.cos(a); z.wy = Math.sin(a); }
          }
          if (z.wx || z.wy) this.moveZombie(z, z.wx, z.wy, def.speed * 0.35 * dt, dt);
          continue;
        }
      }

      if (z.state === 'horde') {
        if (z.scanT <= 0) {
          z.scanT = 0.4 + Math.random() * 0.3;
          const t = this.findZombieTarget(z, 3.5);
          if (t) { z.target = t; z.state = 'chase'; }
        }
        if (z.state === 'horde') {
          const tx = Math.floor(z.x), ty = Math.floor(z.y);
          const next = this.baseField ? W.fieldStep(this.baseField, tx, ty, zpass) : null;
          if (next) {
            const o = W.occAt(next.x, next.y);
            if (o !== -1) { z.target = this.byId.get(o); z.state = 'chase'; }
            else this.moveZombie(z, next.x + 0.5 - z.x, next.y + 0.5 - z.y, def.speed * dt, dt);
          } else {
            z.target = this.findZombieTarget(z, 10) || this.cc; z.state = 'chase';
          }
        }
      }

      if (z.state === 'chase') {
        const t = z.target;
        if (!t) { z.state = z.horde ? 'horde' : 'idle'; continue; }
        const info = this.reachInfo(z, t);
        if (t.kind === 'u' && info.d > def.aggro * 2.2) { z.target = null; z.state = z.horde ? 'horde' : 'idle'; }
        else if (info.inReach) { if (z.cd <= 0) { z.cd = def.cd; this.damage(t, def.dmg, z); } }
        else this.moveZombie(z, info.dx, info.dy, def.speed * dt, dt);
      }
    }
    // Separation so hordes spread instead of stacking into one point.
    for (const z of this.zombies) {
      let px = 0, py = 0;
      this.hash.each(z.x, z.y, 0.55, (q, d2) => {
        if (q === z) return;
        const d = Math.sqrt(d2) || 0.01;
        const f = (0.55 - d) / d;
        px += (z.x - q.x) * f; py += (z.y - q.y) * f;
      });
      if (px || py) {
        const nx = z.x + px * dt * 2, ny = z.y + py * dt * 2;
        if (W.inBounds(Math.floor(nx), Math.floor(z.y)) && !W.terrainBlocked(Math.floor(nx), Math.floor(z.y)) && W.occAt(Math.floor(nx), Math.floor(z.y)) === -1) z.x = nx;
        if (W.inBounds(Math.floor(z.x), Math.floor(ny)) && !W.terrainBlocked(Math.floor(z.x), Math.floor(ny)) && W.occAt(Math.floor(z.x), Math.floor(ny)) === -1) z.y = ny;
      }
    }
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      const t = p.target;
      if (!t || t.dead || t.hp <= 0) { t.incoming -= p.dmg; continue; }
      const d = U.dist(p.x, p.y, t.x, t.y), step = p.speed * dt;
      if (d <= step) { t.incoming -= p.dmg; this.damage(t, p.dmg, p.src); continue; }
      p.x += (t.x - p.x) / d * step; p.y += (t.y - p.y) / d * step;
      keep.push(p);
    }
    this.projectiles = keep;
  }

  endGame(won) {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    this.result = { won, day: this.day, kills: this.kills, time: this.time };
    this.emit('end', this.result);
  }

  // ------------------------------------------------------------- save/load
  serialize() {
    return JSON.stringify({
      v: 1, seed: this.seed, difficulty: this.difficulty, tiles: Array.from(this.world.tiles),
      res: this.res, time: this.time, day: this.day, speed: this.speed, kills: this.kills, lostBuildings: this.lostBuildings,
      hordes: this.hordes, tips: this.tips,
      buildings: this.buildings.map((b) => ({ type: b.type, x: b.x, y: b.y, hp: b.hp, queue: b.queue, trainT: b.trainT })),
      units: this.units.map((u) => ({ type: u.type, x: u.x, y: u.y, hp: u.hp, post: u.post })),
      zombies: this.zombies.map((z) => ({ type: z.type, x: z.x, y: z.y, hp: z.hp, horde: z.horde })),
      spawnQueue: this.spawnQueue,
    });
  }

  load(json) {
    const s = JSON.parse(json);
    if (!s || s.v !== 1) throw new Error('Unknown save format');
    this.seed = s.seed;
    this.difficulty = DIFFICULTY[s.difficulty] ? s.difficulty : 'normal';
    this.world = new World(s.seed, s.tiles);
    this.res = s.res; this.rates = { gold: 0, wood: 0, stone: 0, food: 0 }; this.workers = { cap: 0, used: 0 };
    this.time = s.time; this.day = s.day; this.speed = s.speed || 1; this.paused = false;
    this.buildings = []; this.units = []; this.zombies = []; this.projectiles = []; this.effects = [];
    this.byId = new Map(); this.nextId = 1; this.kills = s.kills || 0; this.lostBuildings = s.lostBuildings || 0;
    this.state = 'playing'; this.result = null;
    this.spawnQueue = s.spawnQueue || [];
    this.hordes = s.hordes; this.tips = s.tips || [];
    this.selection = { kind: null, ids: [] }; this.placing = null;
    this.fieldStamp = 0; this.unitFields = new Map();
    this.baseField = null; this.baseFieldDirty = true; this.fieldTimer = 0;
    this.hash = new SpatialHash(4, this.world.w, this.world.h);
    this.terrainDirty = true;
    for (const b of s.buildings) {
      const nb = this.addBuilding(b.type, b.x, b.y, b.hp);
      nb.queue = b.queue || []; nb.trainT = b.trainT || 0;
      if (b.type === 'cc') this.cc = nb;
    }
    for (const u of s.units) { const nu = this.spawnUnit(u.type, u.x, u.y, u.hp); nu.post = u.post || { x: u.x, y: u.y }; }
    for (const z of s.zombies) this.spawnZombie(z.type, z.x, z.y, z.horde, z.hp);
    this.recalcEconomy();
    this.rebuildBaseField();
  }
}
