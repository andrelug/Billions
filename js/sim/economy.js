import { T } from './worldgen.js';
import { worksUnpowered } from './power.js';

// Economy, following the reference rules:
//  - Stockpiles: gold, wood, stone, iron, oil. Paid every TICK (30 s).
//    Storage: each resource caps at the sum of `storage` (CC 50 + 50 per
//    Warehouse); gold caps at 40x that. Overflow is lost, or auto-sold when a
//    Market exists.
//  - Capacities: workers, food, energy (supply - demand) and colonists.
//  - Zones: Warehouse +20% production, Market -20% house food, Bank +30%,
//    Inn +10%, Victory Monument +20% house gold. Same-kind zones don't stack;
//    a building must be fully inside a zone.
export const STOCKS = ['gold', 'wood', 'stone', 'iron', 'oil'];
export const CAPS = ['workers', 'food', 'energy'];
export const PRICE = { wood: 20, stone: 40, iron: 80, oil: 160 };

export class Economy {
  constructor(game) {
    this.g = game;
    this.income = { gold: 0, wood: 0, stone: 0, iron: 0, oil: 0 };   // per tick, net
    this.gross = { gold: 0, wood: 0, stone: 0, iron: 0, oil: 0 };
    this.upkeep = { gold: 0, wood: 0, stone: 0, iron: 0, oil: 0 };
    this.cap = { gold: 2000, wood: 50, stone: 50, iron: 50, oil: 50 };
    this.supply = { workers: 0, food: 0, energy: 0 };
    this.demand = { workers: 0, food: 0, energy: 0 };
    this.colonists = 0;
    this.bonusCap = { workers: 0, food: 0, energy: 0 };   // from map pickups (permanent)
    this.unpaidTicks = 0; this.noFoodTicks = 0;
    this.dirty = true;
  }

  free(k) { return this.supply[k] - this.demand[k]; }
  markets() { return this.g.buildings.filter((b) => b.def.trade && b.state === 'ok' && b.powered).length; }

  // Zone test: is building b fully inside the zone of z?
  inZone(b, z) {
    const r = z.def.zone.radius;
    return b.x >= z.x - r && b.y >= z.y - r && b.x + b.w <= z.x + z.w + r && b.y + b.h <= z.y + z.h + r;
  }

  recalc() {
    const g = this.g, W = g.world, M = g.mods, theme = g.theme;
    const gross = { gold: 0, wood: 0, stone: 0, iron: 0, oil: 0 }, up = { gold: 0, wood: 0, stone: 0, iron: 0, oil: 0 };
    const sup = { ...this.bonusCap }, dem = { workers: 0, food: 0, energy: 0 };
    let storage = 0, colonists = 0;
    const zones = { warehouse: [], market: [], bank: [], inn: [], victory: [] };
    for (const b of g.buildings) if (b.def.zone && b.state === 'ok' && b.powered && !b.off) zones[b.def.zone.kind].push(b);
    const claimed = new Uint8Array(W.w * W.h);
    const list = g.buildings.slice().sort((a, b) => a.id - b.id);
    for (const b of list) {
      if (b.neutral) continue;
      const def = b.def, id = def.id;
      const active = b.state === 'ok' && !b.off;
      const powered = b.powered || worksUnpowered(def);
      // Demand is reserved from placement, except while infected (suspended).
      if (b.state !== 'infected') {
        for (const k of CAPS) {
          const v = def.need[k];
          if (!v) continue;
          let need = M.stat('building', id, 'need.' + k, v);
          if (k === 'food' && def.house && zones.market.some((z) => this.inZone(b, z))) need = Math.round(need * 0.8);
          if (k === 'workers' && b.off) continue;    // switched-off producers free their workers
          dem[k] += k === 'workers' ? need : Math.ceil(need - 1e-9);
        }
      }
      b.output = null;
      if (!active || !powered) continue;
      for (const k in def.supply) {
        const v = M.stat('building', id, 'supply.' + k, def.supply[k]);
        if (k === 'storage') storage += v; else if (k === 'colonists') colonists += v; else sup[k] += v;
      }
      if (def.house) colonists += 0; // colonists already added via supply
      for (const k in def.upkeep) up[k] += M.stat('building', id, 'upkeep.' + k, def.upkeep[k]);
      let houseMul = 1;
      if (def.house) {
        if (zones.bank.some((z) => this.inZone(b, z))) houseMul += 0.3;
        if (zones.inn.some((z) => this.inZone(b, z))) houseMul += 0.1;
        if (zones.victory.some((z) => this.inZone(b, z))) houseMul += 0.2;
      }
      for (const k in def.income) {
        let v = M.stat('building', id, 'income.' + k, def.income[k]);
        if (def.house && k === 'gold') v = Math.round(v * houseMul);
        if (k === 'oil' && zones.warehouse.some((z) => this.inZone(b, z))) v *= 1.2;
        gross[k] += v;
      }
      if (def.harvest) {
        const out = this.harvest(b, claimed, theme);
        const wb = zones.warehouse.some((z) => this.inZone(b, z)) ? 1.2 : 1;
        b.output = {};
        for (const k in out) {
          const v = k === 'food' ? Math.round(out[k] * wb) : Math.round(out[k] * wb);
          b.output[k] = v;
          if (k === 'food') sup.food += v; else gross[k] += v;
        }
      }
    }
    // Units: workers and food are reserved; wages paid per tick.
    for (const u of g.units) {
      dem.workers += u.def.need.workers || 0;
      dem.food += u.def.need.food || 0;
      for (const k in u.def.upkeep) up[k] += M.stat('unit', u.type, 'upkeep.' + k, u.def.upkeep[k]);
    }
    for (const q of g.pendingUnits()) { dem.workers += q.need.workers || 0; dem.food += q.need.food || 0; }
    // Map conditions such as the Frozen Highlands raise energy demand.
    dem.energy = Math.ceil(dem.energy);
    const cap = { gold: storage * 40 };
    for (const k of ['wood', 'stone', 'iron', 'oil']) cap[k] = storage;
    this.gross = gross; this.upkeep = up; this.cap = cap; this.supply = sup; this.demand = dem; this.colonists = colonists;
    this.income = {};
    for (const k of STOCKS) this.income[k] = Math.round((gross[k] - up[k]) * 10) / 10;
    this.claimMap = claimed;
    this.dirty = false;
    g.ev.emit('economy');
  }

  // Production of a harvesting building from the cells around it.
  harvest(b, claimed, theme) {
    const g = this.g, W = g.world, hv = b.def.harvest, M = g.mods;
    const per = M.stat('building', b.type, 'harvest', hv.per);
    const r = hv.radius, out = {};
    let stone = 0, iron = 0, gold = 0, wood = 0, food = 0, cells = 0;
    for (let ty = b.y - r; ty < b.y + b.h + r; ty++) for (let tx = b.x - r; tx < b.x + b.w + r; tx++) {
      if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) continue;
      if (!W.inside(tx, ty)) continue;
      const i = tx + ty * W.w, t = W.tiles[i];
      if (W.occ[i] !== -1) continue;
      switch (hv.kind) {
        case 'wood': if (t === T.FOREST && !claimed[i]) { claimed[i] = 1; wood++; } break;
        case 'mine':
          if (claimed[i]) break;
          if (t === T.STONE || t === T.MOUNTAIN) { claimed[i] = 1; stone++; } else if (t === T.IRON) { claimed[i] = 1; iron++; } else if (t === T.GOLD) { claimed[i] = 1; gold++; }
          break;
        case 'farm': if ((t === T.GRASS) && !claimed[i] && W.trap[i] === -1 && cells < (hv.max || 99)) { claimed[i] = 2; cells++; } break;
        case 'fish': if (t === T.WATER && !claimed[i]) { claimed[i] = 1; cells++; } break;
        case 'hunt': {
          const f = t === T.FOREST ? theme.food.trees : t === T.GRASS ? theme.food.grass : t === T.MUD ? theme.food.earth : 0;
          food += f; break;
        }
      }
    }
    if (hv.kind === 'wood') out.wood = Math.ceil(wood * per - 1e-9) + M.stat('building', b.type, 'income.wood', 0);
    else if (hv.kind === 'mine') {
      if (stone) out.stone = Math.ceil(stone * per - 1e-9);
      if (iron) out.iron = Math.ceil(iron * per - 1e-9);
      if (gold) out.gold = gold * (hv.goldPer || 10) * (per / hv.per);
    } else if (hv.kind === 'farm') out.food = cells * per;
    else if (hv.kind === 'fish') out.food = cells * per + M.stat('building', b.type, 'supply.food', 0);
    else if (hv.kind === 'hunt') out.food = Math.round(food * per) + M.stat('building', b.type, 'supply.food', 0);
    b.tiles = cells || wood || stone + iron + gold;
    return out;
  }

  // Estimated production of `type` placed at (x, y), honouring cells that
  // other buildings already harvest.
  preview(type, x, y, w, h) {
    const def = this.g.def(type);
    if (!def.harvest) return null;
    const claimed = this.claimMap ? this.claimMap.slice() : new Uint8Array(this.g.world.w * this.g.world.h);
    return this.harvest({ type, def, x, y, w, h }, claimed, this.g.theme);
  }

  // Can we pay `cost` and reserve `need` (already modified)? Returns null or a reason.
  blocker(need, cost) {
    const g = this.g;
    for (const k in cost || {}) {
      if ((g.res[k] || 0) < cost[k]) return `Not enough ${k}`;
      if (cost[k] > this.cap[k]) return `Storage too small for ${k}`;
    }
    for (const k of CAPS) {
      const v = need && need[k] ? Math.ceil(need[k] - 1e-9) : 0;
      if (v > 0 && this.free(k) < v) return k === 'workers' ? 'Not enough workers' : k === 'food' ? 'Not enough food' : 'Not enough energy';
    }
    return null;
  }

  pay(cost) { const g = this.g; for (const k in cost) g.res[k] -= cost[k]; }
  give(res, overflowToMarket = true) {
    const g = this.g;
    for (const k in res) {
      const room = this.cap[k] - g.res[k];
      const add = Math.min(res[k], Math.max(0, room));
      g.res[k] += add;
      const over = res[k] - add;
      if (over > 0 && k !== 'gold' && overflowToMarket && this.markets() > 0) g.res.gold = Math.min(this.cap.gold, g.res.gold + over * this.sellPrice(k));
    }
  }
  buyPrice(k) { return PRICE[k] * (1 - 0.05 * (this.markets() - 1)); }
  sellPrice(k) { return PRICE[k] * (0.05 + 0.02 * (this.markets() - 1)); }

  trade(k, lots, buy) {
    const g = this.g, n = this.markets();
    if (!n) return 'You need a Market';
    const qty = 5 * lots;
    if (buy) {
      const cost = Math.ceil(this.buyPrice(k) * qty);
      if (g.res.gold < cost) return 'Not enough gold';
      if (g.res[k] + qty > this.cap[k]) return 'Not enough storage';
      g.res.gold -= cost; g.res[k] += qty;
    } else {
      if (g.res[k] < qty) return `Not enough ${k}`;
      g.res[k] -= qty; g.res.gold = Math.min(this.cap.gold, g.res.gold + Math.floor(this.sellPrice(k) * qty));
    }
    return null;
  }

  // Resource tick: production in, upkeep and wages out.
  payTick() {
    const g = this.g;
    if (this.dirty) this.recalc();
    const add = {};
    for (const k of STOCKS) add[k] = this.gross[k];
    this.give(add);
    // Units cost double wages while the colony lacks food.
    let extra = 0;
    if (this.free('food') < 0) for (const u of g.units) extra += g.mods.stat('unit', u.type, 'upkeep.gold', u.def.upkeep.gold || 0);
    for (const k of STOCKS) {
      g.res[k] -= this.upkeep[k] + (k === 'gold' ? extra : 0);
      if (k !== 'gold' && g.res[k] < 0) g.res[k] = 0;
    }
    if (g.res.gold < 0) {
      this.unpaidTicks++;
      g.stats.negGoldTicks++;
      g.notify('Not enough gold to pay wages!', 'danger');
      if (this.unpaidTicks >= 2) g.desertUnits();
      g.res.gold = 0;
    } else this.unpaidTicks = 0;
    if (this.free('food') < 0) g.stats.negFoodTicks++;
    g.ev.emit('tick');
  }
}
