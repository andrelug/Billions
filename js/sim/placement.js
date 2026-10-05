import { T } from './worldgen.js';
import { TERRAIN } from '../data/terrain.js';
import { footprintPowered } from './power.js';

// All building placement rules. Returns null when allowed, else a reason.
const WALLISH = (def) => def.wall || def.gate;
// Rock a quarry can mine: mountains are stone too, as in the original game.
export const isMineral = (t) => t === T.MOUNTAIN || t === T.STONE || t === T.IRON || t === T.GOLD;

export function footprint(def, rot) {
  const [w, h] = def.size;
  return rot && def.rotate ? [h, w] : [w, h];
}

export function placementBlocker(game, type, x, y, rot, opts = {}) {
  const def = game.def(type), W = game.world;
  const [w, h] = footprint(def, rot);
  if (def.onCC) return null;
  if (x < 1 || y < 1 || x + w > W.w - 1 || y + h > W.h - 1) return 'Outside the map';
  if (!opts.ignoreLock) {
    const lock = game.lockReason(type);
    if (lock) return lock;
  }
  // Terrain and occupancy.
  let onWall = 0;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
    const i = tx + ty * W.w, t = W.tiles[i];
    if (def.place === 'oil') { if (t !== T.OIL) return 'Must be built on an oil pool'; }
    else if (!TERRAIN[t].build) return t === T.WATER ? 'Cannot build on water' : 'Terrain is not buildable';
    const o = W.occ[i];
    if (o !== -1) {
      const ob = game.byId.get(o);
      if (def.onWalls && ob && ob.def.wall && ob.state !== 'build') { onWall++; continue; }
      return 'Space is occupied';
    }
    if (W.trap[i] !== -1 && !def.trap && !def.mine) return 'A trap is in the way';
    if ((def.trap || def.mine) && W.trap[i] !== -1) return 'Space is occupied';
  }
  if (!opts.ignorePower && !footprintPowered(game, x, y, w, h)) return 'Outside the energy grid';
  // No enemies within 4 cells.
  const enemy = game.zgrid.nearest(x + w / 2, y + h / 2, 4 + Math.max(w, h) / 2, (z) => z.hp > 0);
  if (enemy) return 'Infected too close';
  for (const n of game.nests) if (n.hp > 0 && rectGap(x, y, w, h, n.x, n.y, n.w, n.h) < 4) return 'Infected too close';
  // Units standing on it.
  for (const u of game.units) if (!u.garrisoned && u.x >= x - 0.2 && u.x < x + w + 0.2 && u.y >= y - 0.2 && u.y < y + h + 0.2 && !(def.trap || def.mine)) return 'A unit is in the way';
  // Location requirements.
  if (def.place === 'nearSea' && !touches(W, x, y, w, h, (t) => t === T.WATER)) return 'Must be next to water';
  if (def.place === 'nearWood' && !near(W, x, y, w, h, 1, (t) => t === T.FOREST)) return 'Must be next to forest';
  if (def.place === 'nearMineral' && !near(W, x, y, w, h, 1, isMineral)) return 'Must be next to stone, iron or gold';
  if (def.place === 'nearGrass' && !near(W, x, y, w, h, 1, (t) => t === T.GRASS)) return 'Must be next to grass';
  // Margins: other buildings may not sit inside this building's margin and vice versa.
  for (const b of game.buildings) {
    if (b.def.trap || b.def.mine) continue;
    const gap = rectGap(x, y, w, h, b.x, b.y, b.w, b.h);
    if (gap > 26) continue;
    if (!def.ignoreMargin && !b.def.ignoreMargin) {
      const m = Math.max(def.margin || 0, b.def.margin || 0);
      if (m > 0 && gap < m && !(onWall && b.def.wall)) return `Too close to ${b.def.name}`;
      if (def.house && b.def.house) { /* houses may touch */ }
    } else if (!def.ignoreMargin && b.def.ignoreMargin && (def.margin || 0) > 0 && gap < def.margin && !WALLISH(b.def) && !b.def.garrison) {
      return `Too close to ${b.def.name}`;
    }
    if (def.sameMargin && b.def.family === def.family && gap < def.sameMargin) return `Must be ${def.sameMargin} cells from another ${b.def.name}`;
  }
  // Houses: at most 2 adjacent buildings and at least 3 free adjacent cells.
  if (def.house) {
    const adj = adjacentBuildings(game, x, y, w, h);
    if (adj.size > (def.maxAdjacent ?? 2)) return 'Too many buildings around this house';
    if (freeAdjacent(game, x, y, w, h) < (def.minEmpty || 0)) return 'A house needs free cells around it';
    for (const id of adj) { const b = game.byId.get(id); if (b && b.def.house && adjacentBuildings(game, b.x, b.y, b.w, b.h).size + 1 > (b.def.maxAdjacent ?? 2)) return 'A neighbouring house is too crowded'; }
  }
  if (def.minEmpty && !def.house && freeAdjacent(game, x, y, w, h) < def.minEmpty) return 'Needs more free space around it';
  // Walls: never three rows thick.
  if (def.wall && wallTooThick(game, x, y)) return 'Walls cannot be three rows thick';
  if (def.onWalls && onWall > 0 && onWall < w * h && !opts.partialWall) {
    // Partly on a wall is fine as long as the rest is free (already checked).
  }
  return null;
}

export function rectGap(ax, ay, aw, ah, bx, by, bw, bh) {
  const dx = Math.max(0, bx - (ax + aw), ax - (bx + bw));
  const dy = Math.max(0, by - (ay + ah), ay - (by + bh));
  return Math.max(dx, dy);
}

function touches(W, x, y, w, h, pred) {
  for (let ty = y - 1; ty <= y + h; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
    if ((tx === x - 1 || tx === x + w) && (ty === y - 1 || ty === y + h)) continue;
    if (W.inside(tx, ty) && pred(W.tiles[tx + ty * W.w])) return true;
  }
  return false;
}
function near(W, x, y, w, h, r, pred) {
  for (let ty = y - r; ty < y + h + r; ty++) for (let tx = x - r; tx < x + w + r; tx++) {
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
    if (W.inside(tx, ty) && pred(W.tiles[tx + ty * W.w])) return true;
  }
  return false;
}
function adjacentBuildings(game, x, y, w, h) {
  const W = game.world, set = new Set();
  for (let ty = y - 1; ty <= y + h; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
    if ((tx === x - 1 || tx === x + w) && (ty === y - 1 || ty === y + h)) continue;
    const o = W.occAt(tx, ty);
    if (o !== -1) { const b = game.byId.get(o); if (b && !b.def.wall && !b.def.gate) set.add(o); }
  }
  return set;
}
function freeAdjacent(game, x, y, w, h) {
  const W = game.world; let n = 0;
  for (let ty = y - 1; ty <= y + h; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
    if ((tx === x - 1 || tx === x + w) && (ty === y - 1 || ty === y + h)) continue;
    if (W.inside(tx, ty) && W.occ[tx + ty * W.w] === -1 && TERRAIN[W.tiles[tx + ty * W.w]].walk) n++;
  }
  return n;
}
function wallTooThick(game, x, y) {
  const W = game.world;
  const isWall = (tx, ty) => { if (tx === x && ty === y) return true; const o = W.occAt(tx, ty); if (o === -1) return false; const b = game.byId.get(o); return !!(b && (b.def.wall || b.def.gate)); };
  // Any 3x3 block fully made of walls containing (x,y) is forbidden; so is a 3-thick line.
  for (let oy = -2; oy <= 0; oy++) for (let ox = -2; ox <= 0; ox++) {
    let full = true;
    for (let dy = 0; dy < 3 && full; dy++) for (let dx = 0; dx < 3 && full; dx++) if (!isWall(x + ox + dx, y + oy + dy)) full = false;
    if (full) return true;
  }
  for (let o = -2; o <= 0; o++) {
    if (isWall(x + o, y) && isWall(x + o + 1, y) && isWall(x + o + 2, y) && [0, 1, 2].every((k) => isWall(x + o + k, y - 1) && isWall(x + o + k, y + 1))) return true;
  }
  return false;
}
