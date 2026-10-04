import test from 'node:test';
import assert from 'node:assert/strict';
import { FlowField, AStar } from '../js/core/pathing.js';
import { SpatialGrid } from '../js/core/spatial.js';

test('flow field reaches around a wall and is fast on a 256 map', () => {
  const w = 256, h = 256, cost = new Uint16Array(w * h).fill(10), solid = new Uint8Array(w * h);
  for (let y = 0; y < 200; y++) { cost[128 + y * w] = 0; solid[128 + y * w] = 1; }
  const ff = new FlowField(w, h);
  const t0 = performance.now();
  ff.compute([200 + 10 * w], cost, solid);
  const ms = performance.now() - t0;
  assert.ok(ff.dist[10 + 10 * w] < 0xFFFFFFFF, 'reachable around wall');
  assert.ok(ff.dist[10 + 10 * w] > 190 * 10 * 2, 'had to detour');
  // Descend the field from the far side and make sure we arrive.
  let x = 10, y = 10, steps = 0;
  while (ff.dist[x + y * w] > 0 && steps++ < 2000) { const n = ff.step(x, y, solid); assert.notEqual(n, -1); x = n % w; y = (n - x) / w; }
  assert.equal(x + y * w, 200 + 10 * w);
  console.log(`  flow field 256x256: ${ms.toFixed(1)} ms`);
});

test('incremental flow field equals one-shot result', () => {
  const w = 96, h = 96, cost = new Uint16Array(w * h).fill(10), solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (i % 13 === 0) cost[i] = 200;
  for (let i = 0; i < w * h; i++) if (i % 29 === 0) { cost[i] = 0; solid[i] = 1; }
  const a = new FlowField(w, h).compute([40 + 40 * w], cost, solid);
  const b = new FlowField(w, h);
  b.begin([40 + 40 * w], cost, solid);
  let rounds = 0; while (!b.run(500)) rounds++;
  assert.ok(rounds > 5);
  assert.deepEqual(Array.from(a.dist), Array.from(b.dist));
});

test('A* finds a path and reports closest point when blocked', () => {
  const w = 64, h = 64, solid = new Uint8Array(w * h);
  for (let y = 0; y < 64; y++) if (y !== 40) solid[30 + y * w] = 1;
  const a = new AStar(w, h), pass = (i) => !solid[i];
  const p = a.find(5, 5, 50, 5, pass, solid);
  assert.equal(p[p.length - 1], 50 + 5 * w);
  for (let y = 0; y < 64; y++) solid[30 + y * w] = 1;
  const q = a.find(5, 5, 50, 5, pass, solid);
  const last = q[q.length - 1];
  assert.equal(last % w, 29, 'stops next to the wall');
});

test('spatial grid query matches brute force', () => {
  const g = new SpatialGrid(4, 100, 100), list = [];
  for (let i = 0; i < 3000; i++) list.push({ x: (i * 37.3) % 100, y: (i * 91.7) % 100 });
  g.rebuild(list);
  let n = 0; g.query(50, 50, 7, () => { n++; });
  const brute = list.filter((e) => Math.hypot(e.x - 50, e.y - 50) <= 7).length;
  assert.equal(n, brute);
});
