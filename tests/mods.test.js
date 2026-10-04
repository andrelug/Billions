import test from 'node:test';
import assert from 'node:assert/strict';
import { Mods } from '../js/sim/mods.js';

test('modifiers combine specific, wildcard and tag paths', () => {
  const m = new Mods();
  m.apply([{ path: 'unit.ranger.range', add: 1 }, { path: 'unit.*.hp', pct: 0.2 }, { path: 'unit.#ranged.dmg', pct: 0.5 }, { flag: 'walls.stone' }]);
  assert.equal(m.stat('unit', 'ranger', 'range', 6), 7);
  assert.equal(m.stat('unit', 'soldier', 'hp', 100), 120);
  assert.equal(m.stat('unit', 'sniper', 'dmg', 10, ['ranged']), 15);
  assert.equal(m.stat('unit', 'sniper', 'dmg', 10), 10);
  assert.ok(m.has('walls.stone'));
  const r = Mods.from(JSON.parse(JSON.stringify(m.serialize())));
  assert.equal(r.stat('unit', 'ranger', 'range', 6), 7);
});
