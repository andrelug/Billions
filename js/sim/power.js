// Energy grid. The Command Center (and the Lightning Spire) are grid roots.
// Tesla Towers relay power only while they are themselves inside a powered
// area, so losing one tower can cascade. world.power[i] > 0 means tile i is
// inside the active grid.
export function gridRadius(game, b) {
  if (!b.def.grid || b.state === 'infected' || b.state === 'build' || b.neutral) return 0;
  return game.mods.stat('building', b.type, 'grid', b.def.grid);
}

export function recomputePower(game) {
  const W = game.world, power = W.power;
  power.fill(0);
  const nodes = game.buildings.filter((b) => b.def.grid && gridRadius(game, b) > 0);
  const on = new Set();
  const stamp = (b) => {
    const r = gridRadius(game, b) + 0.5, r2 = r * r;
    const x0 = Math.max(0, Math.floor(b.cx - r)), x1 = Math.min(W.w - 1, Math.ceil(b.cx + r));
    const y0 = Math.max(0, Math.floor(b.cy - r)), y1 = Math.min(W.h - 1, Math.ceil(b.cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - b.cx, dy = y + 0.5 - b.cy;
      if (dx * dx + dy * dy <= r2) power[x + y * W.w]++;
    }
  };
  // Roots first, then relay through towers whose tile is powered.
  const queue = nodes.filter((b) => b.def.id === 'cc' || b.def.id === 'spire');
  for (const b of queue) { on.add(b); stamp(b); }
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of nodes) {
      if (on.has(b)) continue;
      if (power[Math.floor(b.cx) + Math.floor(b.cy) * W.w] > 0) { on.add(b); stamp(b); changed = true; }
    }
  }
  // Mark every building powered if its whole footprint is in the grid.
  for (const b of game.buildings) b.powered = footprintPowered(game, b.x, b.y, b.w, b.h);
  game.powerDirty = false;
  game.ev.emit('power');
}

export function footprintPowered(game, x, y, w, h) {
  const W = game.world;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) {
    if (!W.inside(tx, ty) || W.power[tx + ty * W.w] === 0) return false;
  }
  return true;
}

// Which buildings keep working without power.
export function worksUnpowered(def) {
  return !!(def.house || def.id === 'hunter' || def.id === 'fisherman' || def.id === 'farm' || def.id === 'advfarm'
    || def.wall || def.gate || def.garrison || def.trap || def.mine || def.id === 'cc' || def.id === 'crystalpalace');
}
