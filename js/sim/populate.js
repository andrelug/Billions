import { T } from './worldgen.js';
import { WALKERS } from '../data/infected.js';

// Fills a new survival map, following the theme parameters:
//  - map infected in distance tiers from the Command Center (walkers from
//    `weak`, runners from `medium`, executives/chubbies from `strong`,
//    harpies/venoms from `powerful`), clustered and scaled by population
//  - Giants (population >= Medium) and Behemoths far from the colony
//  - Villages of Doom, treasure and supply pickups, abandoned towers,
//    explosive barrels and raven flocks
export function populate(g) {
  const W = g.world, rng = g.rng, th = g.theme, pop = g.popFactor;
  const cx = W.start.x, cy = W.start.y;
  const d = (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  const free = (x, y) => W.inside(x, y) && W.walk[x + y * W.w] === 1 && W.occ[x + y * W.w] === -1;
  const reach = floodReach(g);

  // Cluster noise: a coarse random field so infected gather in groups.
  const cs = 6, cw = Math.ceil(W.w / cs), clusters = new Float32Array(cw * cw);
  for (let i = 0; i < clusters.length; i++) clusters[i] = rng.next() < 0.45 ? rng.range(0.6, 2.6) : rng.range(0, 0.3);

  // Villages first so infected avoid their footprint.
  const vSizes = th.villageSize;
  for (let v = 0; v < th.villages; v++) placeVillage(g, rng.int(vSizes[0], vSizes[1]), reach);

  const k = 0.42 * th.density * pop;
  for (let y = 1; y < W.h - 1; y++) for (let x = 1; x < W.w - 1; x++) {
    const i = x + y * W.w;
    if (!W.walk[i] || W.occ[i] !== -1 || !reach[i]) continue;
    const dist = d(x, y);
    if (dist < th.tiers.weak) continue;
    const c = clusters[((x / cs) | 0) + ((y / cs) | 0) * cw];
    if (rng.next() > k * c) continue;
    let type;
    const r = rng.next();
    if (dist >= th.tiers.powerful && r < 0.14) type = r < 0.08 ? 'harpy' : 'venom';
    else if (dist >= th.tiers.strong && r < 0.3) type = r < 0.22 ? 'executive' : 'chubby';
    else if (dist >= th.tiers.medium && r < 0.62) type = rng.next() < 0.5 ? 'fresh' : 'colonist';
    else type = rng.pick(WALKERS);
    g.addInfected(type, x + rng.range(0.2, 0.8), y + rng.range(0.2, 0.8));
  }

  // Giants (only at Medium population or higher) and Behemoths.
  const giants = pop >= 1 ? th.giants + (pop >= 1.5 ? 3 : 0) : 0;
  for (let n = 0; n < giants; n++) { const p = farCell(g, reach, 60, 3); if (p) g.addInfected('giant', p.x, p.y); }
  for (let n = 0; n < th.behemoths; n++) { const p = farCell(g, reach, 70, 1); if (p) g.addInfected('behemoth', p.x, p.y); }

  // Pickups.
  const scatter = (count, type, amount, minD) => {
    for (let n = 0; n < count; n++) {
      const p = farCell(g, reach, minD, 0, minD + 60);
      if (p) g.pickups.push({ id: g.nextId++, type, amount, x: p.x, y: p.y });
    }
  };
  scatter(rng.int(th.treasures[0], th.treasures[1]), 'gold', 500, 26);
  scatter(rng.int(th.energy[0], th.energy[1]), 'energy', 20, 18);
  scatter(rng.int(th.foodPick[0], th.foodPick[1]), 'food', 20, 18);
  scatter(rng.int(1, 3), 'workers', 20, 20);
  for (const t of ['wood', 'stone', 'iron', 'oil']) scatter(rng.int(1, 2), t, 10, 22);

  // Abandoned (infected) towers that can be repaired once inside the grid.
  const oldCount = rng.int(th.oldTowers[0], th.oldTowers[1]) + rng.int(1, 2);
  for (let n = 0; n < oldCount; n++) {
    const type = n === 0 ? 'radar' : rng.pick(['radar', 'executor', 'shocking']);
    const size = type === 'radar' ? 1 : 2;
    for (let tries = 0; tries < 60; tries++) {
      const p = farCell(g, reach, 22, 0, 70);
      if (!p) break;
      const x = Math.floor(p.x), y = Math.floor(p.y);
      let ok = true;
      for (let ty = y; ty < y + size && ok; ty++) for (let tx = x; tx < x + size && ok; tx++) if (!free(tx, ty) || W.tiles[tx + ty * W.w] !== T.GRASS) ok = false;
      if (!ok) continue;
      const b = g.addBuilding(type, x, y, { built: true, neutral: true, state: 'infected' });
      b.hp = b.maxHp * 0.6; b.barrier = 0;
      break;
    }
  }

  // Explosive barrels.
  const barrels = rng.int(6, 12);
  for (let n = 0; n < barrels; n++) {
    const p = farCell(g, reach, 12, 0, 80);
    if (p) { const x = { id: g.nextId++, kind: 'x', x: p.x, y: p.y, hp: 5, carriedBy: 0 }; g.barrels.push(x); g.byId.set(x.id, x); }
  }

  // Raven flocks (decorative; they fly off when units approach).
  for (let n = 0; n < th.ravens; n++) { const p = farCell(g, reach, 10, 0, 100); if (p) g.ravens.push({ x: p.x, y: p.y, gone: false }); }
}

function floodReach(g) {
  const W = g.world, reach = new Uint8Array(W.w * W.h), start = W.start.x + W.start.y * W.w, q = [start];
  reach[start] = 1;
  while (q.length) {
    const c = q.pop(), x = c % W.w, y = (c - x) / W.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W.w || ny >= W.h) continue;
      const ni = nx + ny * W.w;
      if (reach[ni] || !W.walk[ni]) continue;
      reach[ni] = 1; q.push(ni);
    }
  }
  return reach;
}

function farCell(g, reach, minD, clearance = 0, maxD = 999) {
  const W = g.world, rng = g.rng, cx = W.start.x, cy = W.start.y;
  for (let tries = 0; tries < 400; tries++) {
    const a = rng.angle(), r = rng.range(minD, Math.min(maxD, W.w * 0.7));
    const x = Math.floor(cx + Math.cos(a) * r), y = Math.floor(cy + Math.sin(a) * r);
    if (!W.inside(x, y) || !reach[x + y * W.w] || W.occ[x + y * W.w] !== -1) continue;
    let ok = true;
    for (let dy = -clearance; dy <= clearance && ok; dy++) for (let dx = -clearance; dx <= clearance && ok; dx++) if (!W.walkable(x + dx, y + dy)) ok = false;
    if (ok) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

// A Village of Doom: a cluster of nest buildings with infected around it.
function placeVillage(g, count, reach) {
  const W = g.world, rng = g.rng;
  for (let tries = 0; tries < 80; tries++) {
    const c = farCell(g, reach, 42, 2, 90);
    if (!c) return;
    const placed = [];
    const spread = Math.max(6, Math.sqrt(count) * 4);
    for (let n = 0, guard = 0; n < count && guard < count * 40; guard++) {
      const size = n === 0 && count >= 5 ? 'large' : rng.next() < (count >= 7 ? 0.3 : 0.15) ? 'medium' : 'small';
      const s = size === 'large' ? 4 : size === 'medium' ? 3 : 2;
      const x = Math.floor(c.x + rng.range(-spread, spread)), y = Math.floor(c.y + rng.range(-spread, spread));
      let ok = x > 2 && y > 2 && x + s < W.w - 2 && y + s < W.h - 2;
      for (let ty = y - 1; ty <= y + s && ok; ty++) for (let tx = x - 1; tx <= x + s && ok; tx++) {
        if (!W.inside(tx, ty) || !W.walk[tx + ty * W.w] || W.occ[tx + ty * W.w] !== -1 || !reach[tx + ty * W.w]) ok = false;
      }
      if (!ok) continue;
      const nest = g.nestSys.add(size, x, y, true);
      placed.push(nest); n++;
    }
    if (placed.length) {
      for (const nest of placed) g.nestSys.produce(nest, 1.5, false), (nest.lastGen = -99);
      for (const z of g.infected) if (z.nest && z.st === 1) { z.st = 0; z.hx = z.x; z.hy = z.y; }
      return;
    }
  }
}
