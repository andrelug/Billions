import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/sim/game.js';
import { placementBlocker } from '../js/sim/placement.js';
import { T } from '../js/sim/worldgen.js';
import { MOVE_SCALE, THEMES, MAP_SIZE } from '../js/data/maps.js';
import { generateMap } from '../js/sim/worldgen.js';

function freshGame(theme = 'FA', seed = 11) {
  const g = new Game();
  g.setup({ theme, pop: 'medium', days: 100, seed });
  // Clear the map population for controlled scenarios.
  g.infected = []; g.nests = []; g.zgrid.rebuild(g.infected);
  return g;
}
// Open grass around the Command Center, for scenarios that are not about terrain.
function openGround(g, r = 32) {
  const W = g.world, cx = Math.floor(g.cc.cx), cy = Math.floor(g.cc.cy);
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (W.inside(x, y) && Math.hypot(x - cx, y - cy) <= r) W.setTile(x, y, T.GRASS);
  g.afterLoad();   // power, economy, cost map and the colony flow field
}
const run = (g, sec) => { for (let i = 0; i < sec * 20 && g.state === 'playing'; i++) g.step(0.05); };
// First tile (scanning outward from the CC) where `ok(x, y)` holds.
function find(g, ok, minR = 0, maxR = 40) {
  const cx = Math.floor(g.cc.cx), cy = Math.floor(g.cc.cy);
  for (let r = minR; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (ok(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
  }
  return null;
}

test('new game matches the reference start', () => {
  const g = new Game(); g.setup({ theme: 'BR', pop: 'medium', days: 100, seed: 5 });
  assert.equal(g.res.gold, 100); assert.equal(g.res.wood, 20);
  assert.deepEqual(g.units.map((u) => u.type).sort(), ['ranger', 'ranger', 'ranger', 'ranger', 'soldier']);
  assert.equal(g.cc.w, 5); assert.equal(g.eco.supply.workers, 10); assert.equal(g.eco.supply.food, 20); assert.equal(g.eco.supply.energy, 30);
  assert.equal(g.eco.cap.gold, 2000); assert.equal(g.eco.cap.wood, 50);
  assert.ok(g.infected.length > 500, 'map is populated');
  assert.ok(g.nests.length >= 5, 'village of doom placed');
});

test('rangers kill approaching walkers', () => {
  const g = freshGame();
  openGround(g);
  const cx = g.cc.cx, cy = g.cc.cy;
  for (const u of g.units) { u.x = cx + 0.5; u.y = cy + 4; u.post = { x: u.x, y: u.y }; }
  const far = find(g, (x, y) => g.world.walkable(x, y) && g.colonyField.dist[x + y * g.world.w] < 0xFFFFFFFF, 14, 30);
  for (let i = 0; i < 6; i++) { const p = g.freeCellNear(far.x, far.y, 4); g.addInfected('decrepit', p.x, p.y, { cc: true }); }
  run(g, 60 / MOVE_SCALE);   // walkers need longer to arrive at the slower pace
  assert.equal(g.infected.length, 0, 'all walkers dead');
  assert.equal(g.stats.kills, 6);
  assert.ok(g.units.length === 5);
});

test('buildings: barrier drains, then infection spawns infected', () => {
  const g = freshGame();
  const why = g.build('tent', g.cc.x - 3, g.cc.y); assert.equal(why, null);
  const t = g.buildings.find((b) => b.type === 'tent');
  run(g, 25);
  assert.equal(t.state, 'ok');
  for (const u of g.units.slice()) g.removeUnit(u);
  const z = g.addInfected('fresh', t.x - 0.6, t.y + 0.5); z.st = 2; z.target = t;
  run(g, 10);
  assert.equal(t.state, 'infected');
  assert.ok(g.stats.colonistsInfected >= 2);
  assert.ok(g.infected.length >= 3, 'tent spawned infected');
});

test('energy grid: buildings must be inside, teslas extend it and cascade when lost', () => {
  const g = freshGame();
  openGround(g);
  g.res.gold = 2000; g.res.wood = 50;
  const outside = find(g, (x, y) => g.world.power[x + y * g.world.w] === 0 && g.world.terrain(x, y).build && g.world.terrain(x + 1, y + 1).build && g.world.terrain(x + 1, y).build && g.world.terrain(x, y + 1).build, 12, 30);
  assert.match(g.buildBlocker('tent', outside.x, outside.y, 0), /energy grid/);
  const spot = find(g, (x, y) => !g.buildBlocker('tesla', x, y, 0) && Math.hypot(x - outside.x, y - outside.y) < 9, 6, 12);
  assert.ok(spot, 'room for a tesla toward the outside spot');
  assert.equal(g.build('tesla', spot.x, spot.y), null);
  const tesla = g.buildings.find((b) => b.type === 'tesla');
  run(g, 31);
  assert.equal(tesla.state, 'ok');
  const ext = find(g, (x, y) => !g.buildBlocker('tent', x, y, 0) && g.world.power[x + y * g.world.w] > 0 && Math.hypot(x + 1 - tesla.cx, y + 1 - tesla.cy) < 6 && Math.hypot(x + 1 - g.cc.cx, y + 1 - g.cc.cy) > 12, 8, 24);
  assert.ok(ext, 'tesla extends buildable area beyond the CC grid');
  g.destroyBuilding(tesla); g.step(0.05);
  assert.match(g.buildBlocker('tent', ext.x, ext.y, 0) || '', /energy grid/);
});

test('research unlocks buildings; losing the workshop loses the tech', () => {
  const g = freshGame();
  g.res.gold = 2000; g.res.wood = 50;
  const lock = g.lockReason('farm'); assert.match(lock, /Research/);
  g.eco.bonusCap.energy += 50; g.eco.bonusCap.workers += 50; g.eco.recalc();
  const ws0 = find(g, (x, y) => !g.buildBlocker('woodworkshop', x, y, 0), 3, 12);
  assert.ok(ws0);
  assert.equal(g.build('woodworkshop', ws0.x, ws0.y), null);
  const ws = g.buildings.find((b) => b.type === 'woodworkshop');
  g.eco.bonusCap.energy += 50; g.eco.bonusCap.workers += 50; g.eco.dirty = true;
  run(g, 95);
  assert.equal(ws.state, 'ok');
  g.res.gold = 2000;
  assert.equal(g.research(ws, 'farms'), null);
  run(g, 80);
  assert.ok(g.techs.has('farms'));
  assert.equal(g.lockReason('farm'), null);
  g.destroyBuilding(ws);
  assert.ok(!g.techs.has('farms'));
});

test('resources are paid every tick and capped by storage', () => {
  const g = freshGame();
  const before = g.res.gold;
  run(g, 29); assert.equal(Math.round(g.res.gold), before);
  run(g, 2); assert.ok(g.res.gold > before + 150);
  g.res.gold = 1990; run(g, 31); assert.ok(g.res.gold <= 2000);
});

test('veterancy after enough kills', () => {
  const g = freshGame();
  const r = g.units.find((u) => u.type === 'ranger');
  for (let i = 0; i < 60; i++) g.killInfected({ type: 'decrepit', def: { power: 1 }, x: 0, y: 0, r: 0.3 }, r);
  assert.ok(r.vet);
  assert.equal(g.unitAttack(r).cd, 0.5);
});

test('save and load round trip', () => {
  const g = new Game(); g.setup({ theme: 'TM', pop: 'medium', days: 80, seed: 9 });
  run(g, 40);
  const s = JSON.parse(JSON.stringify(g.serialize()));
  const h = new Game(); h.load(s);
  assert.equal(h.infected.length, g.infected.length);
  assert.equal(h.buildings.length, g.buildings.length);
  assert.equal(h.time, g.time);
  run(h, 5);
  assert.equal(h.state, 'playing');
});

test('swarm schedule matches the reference for 100 and 80 days', () => {
  const g = new Game(); g.setup({ theme: 'FA', pop: 'medium', days: 100, seed: 1 });
  const sw = g.waves.list.filter((e) => e.swarm);
  assert.equal(sw.length, 10);
  const days = sw.map((e) => Math.floor(e.at / 24) + 1);
  const ref = [13, 23, 33, 43, 50, 57, 64, 71, 78, 92];
  days.forEach((d, i) => assert.ok(d >= ref[i] && d <= ref[i] + 1, `swarm ${i + 1} on day ${d}`));
  const f = new Game(); f.setup({ theme: 'FA', pop: 'medium', days: 80, seed: 1 });
  assert.equal(Math.floor(f.waves.list.find((e) => e.final).at), Math.ceil(2208 * 0.8));
});

test('quarry: mountains count as stone for placement and mining', () => {
  const g = freshGame();
  const W = g.world;
  const ring = (x, y, pred) => {
    for (let ty = y - 1; ty < y + 3; ty++) for (let tx = x - 1; tx < x + 3; tx++) {
      if (tx >= x && tx < x + 2 && ty >= y && ty < y + 2) continue;
      if (W.inside(tx, ty) && pred(W.tiles[tx + ty * W.w])) return true;
    }
    return false;
  };
  const grass2x2 = (x, y) => [0, 1].every((dy) => [0, 1].every((dx) => W.tile(x + dx, y + dy) === T.GRASS && W.occAt(x + dx, y + dy) === -1));
  const deposit = (t) => t === T.STONE || t === T.IRON || t === T.GOLD;
  const opts = { ignorePower: true, ignoreLock: true };
  // Next to a mountain only: allowed, and the mountain cells yield stone.
  const m = find(g, (x, y) => grass2x2(x, y) && ring(x, y, (t) => t === T.MOUNTAIN) && !ring(x, y, deposit), 4, 60);
  assert.ok(m, 'found grass next to a mountain');
  assert.equal(placementBlocker(g, 'quarry', m.x, m.y, 0, opts), null);
  assert.ok(g.eco.preview('quarry', m.x, m.y, 2, 2).stone > 0, 'mountain cells give stone');
  // Next to a stone deposit still works.
  const s = find(g, (x, y) => grass2x2(x, y) && ring(x, y, (t) => t === T.STONE), 4, 60);
  assert.ok(s, 'found grass next to a stone deposit');
  assert.equal(placementBlocker(g, 'quarry', s.x, s.y, 0, opts), null);
  // Open grass with no rock around is still refused.
  const rock = (t) => t === T.MOUNTAIN || deposit(t);
  const o = find(g, (x, y) => grass2x2(x, y) && !ring(x, y, rock), 4, 60);
  assert.ok(o, 'found open grass');
  assert.equal(placementBlocker(g, 'quarry', o.x, o.y, 0, opts), 'Must be next to stone, iron or gold');
});

test('movement runs at the tuned pace', () => {
  const g = freshGame();
  const u = g.units.find((x) => x.type === 'soldier');
  const x0 = u.x, y0 = u.y;
  const to = find(g, (x, y) => g.world.walkable(x, y) && Math.hypot(x + 0.5 - x0, y + 0.5 - y0) > 6, 6, 12);
  g.unitSys.command([u], { t: 'move', x: to.x + 0.5, y: to.y + 0.5 });
  run(g, 1);
  const moved = Math.hypot(u.x - x0, u.y - y0);
  assert.ok(moved <= 2.4 * MOVE_SCALE * 1.05 + 1e-6, `soldier moved ${moved.toFixed(2)} cells in 1 s`);
  assert.ok(moved >= 2.4 * MOVE_SCALE * 0.5, `soldier moved ${moved.toFixed(2)} cells in 1 s`);
});

test('maps vary in layout and keep resources reachable', () => {
  const blocks = [T.MOUNTAIN, T.STONE, T.IRON, T.GOLD, T.WATER, T.FOREST];
  const layouts = new Set();
  for (const theme of Object.keys(THEMES)) for (const seed of [3, 17, 29, 41]) {
    const m = generateMap(seed, MAP_SIZE, { ...THEMES[theme].gen, blocks });
    layouts.add(m.layout);
    const { w, tiles, start, reach } = m;
    // A quarry can stand next to the deposit: open, reached ground beside it.
    const usable = { [T.STONE]: [], [T.IRON]: [], [T.GOLD]: [] };
    for (let i = 0; i < tiles.length; i++) {
      if (!usable[tiles[i]]) continue;
      const open = [1, -1, w, -w].some((d) => reach[i + d] && (tiles[i + d] === T.GRASS || tiles[i + d] === T.MUD));
      if (open) usable[tiles[i]].push(Math.hypot(i % w - start.x, Math.floor(i / w) - start.y));
    }
    const tag = `${theme}:${seed}`;
    assert.ok(usable[T.STONE].filter((d) => d < 26).length >= 15, `${tag} stone near the colony`);
    assert.ok(usable[T.IRON].filter((d) => d < 40).length >= 8, `${tag} iron within reach`);
    assert.ok(usable[T.GOLD].length >= 10, `${tag} gold somewhere`);
    assert.ok(Math.min(...usable[T.GOLD]) >= (THEMES[theme].gen.goldMin || 36) - 3, `${tag} gold stays far away`);
    // Swarms enter from every side: the middle of each edge reaches the colony.
    for (const [x, y] of [[w >> 1, 1], [w >> 1, w - 2], [1, w >> 1], [w - 2, w >> 1]]) {
      let ok = false;
      for (let d = 0; d < 30 && !ok; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const xx = x + dx, yy = y + dy; if (xx > 0 && yy > 0 && xx < w && yy < w && reach[xx + yy * w]) ok = true; }
      assert.ok(ok, `${tag} edge at ${x},${y} connects to the colony`);
    }
  }
  assert.ok(layouts.size >= 4, `layouts seen: ${[...layouts].join(', ')}`);
});
