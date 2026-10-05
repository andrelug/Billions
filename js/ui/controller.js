import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { footprint } from '../sim/placement.js';
import { dist, line } from '../core/util.js';
import { FIGURE_H, FEET } from '../data/art.js';

// Interprets gestures into selection, placement and unit commands.
export class Controller {
  constructor(app) {
    this.app = app;
    this.sel = new Set();          // selected unit ids
    this.selBuilding = null;       // selected building
    this.selOther = null;          // inspected infected / nest
    this.placing = null;           // { type, def, x, y, rot, line, anchor, reason }
    this.targeting = null;         // pending command needing a tap: 'amove' | 'patrol' | 'move' | 'rally'
    this.groups = [[], [], [], [], [], [], [], []];
  }
  get g() { return this.app.game; }
  get cam() { return this.app.renderer.cam; }

  // ------------------------------------------------------------- selection
  selectedUnits() { const out = []; for (const id of this.sel) { const u = this.g.byId.get(id); if (u && u.kind === 'u' && !u.dead) out.push(u); } return out; }
  setUnits(list) { this.sel = new Set(list.map((u) => u.id)); this.selBuilding = null; this.selOther = null; this.changed(); if (list.length) this.app.voice('select', list); }
  setBuilding(b) { this.sel.clear(); this.selBuilding = b; this.selOther = null; this.changed(); }
  clear() { this.sel.clear(); this.selBuilding = null; this.selOther = null; this.targeting = null; this.changed(); }
  changed() { this.app.onSelection(); }
  prune() {
    let ch = false;
    for (const id of this.sel) { const u = this.g.byId.get(id); if (!u || u.dead) { this.sel.delete(id); ch = true; } }
    if (this.selBuilding && this.selBuilding.dead) { this.selBuilding = null; ch = true; }
    if (this.selOther && (this.selOther.dead || this.selOther.hp <= 0)) { this.selOther = null; ch = true; }
    if (ch) this.changed();
  }

  // ------------------------------------------------------------ hit testing
  // Characters are drawn standing above their position, so a tap on the body
  // is matched against the body's middle, not the feet.
  unitAt(x, y) {
    let best = null, bd = Infinity;
    for (const u of this.g.units) {
      if (u.garrisoned) continue;
      const feet = u.y + FEET * u.r, head = feet - FIGURE_H * u.r, hw = Math.max(0.4, u.r * 1.3);
      if (Math.abs(u.x - x) > hw || y < head - 0.1 || y > feet + 0.25) continue;
      const d = (u.x - x) ** 2 + (u.y - y) ** 2;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  enemyAt(x, y) {
    const g = this.g;
    const z = g.zgrid.nearest(x, y + 0.45, 0.9, (q) => q.hp > 0 && (g.vision.revealAll || g.vision.isVisible(q.x, q.y)));
    if (z) return z;
    for (const n of g.nests) if (x >= n.x && x < n.x + n.w && y >= n.y && y < n.y + n.h && g.vision.isExplored(n.x | 0, n.y | 0)) return n;
    for (const b of g.barrels) if (!b.carriedBy && dist(b.x, b.y, x, y) < 0.6) return b;
    return null;
  }
  buildingAt(tx, ty) { const o = this.g.world.occAt(tx, ty); return o === -1 ? null : this.g.byId.get(o); }

  // ------------------------------------------------------------------ taps
  tap(sx, sy, ev) {
    const g = this.g; if (!g || g.state !== 'playing') return;
    const [wx, wy] = this.cam.toWorld(sx, sy);
    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (this.placing) { this.placeTap(tx, ty); return; }
    if (this.targeting) { this.targetTap(wx, wy); return; }
    const units = this.selectedUnits();
    const u = this.unitAt(wx, wy);
    if (u) {
      const now = performance.now();
      if (this.lastTapUnit === u.id && now - this.lastTapT < 350) this.selectSameType(u, ev && ev.shiftKey);
      else if (ev && (ev.ctrlKey || ev.metaKey)) this.selectSameType(u, ev.shiftKey);
      else if (ev && ev.shiftKey) { this.sel.has(u.id) ? this.sel.delete(u.id) : this.sel.add(u.id); this.selBuilding = null; this.changed(); }
      else this.setUnits([u]);
      this.lastTapUnit = u.id; this.lastTapT = now;
      return;
    }
    if (units.length) { this.command(wx, wy, false); return; }
    const b = this.buildingAt(tx, ty);
    if (b) { this.setBuilding(b); return; }
    const e = this.enemyAt(wx, wy);
    if (e) { this.sel.clear(); this.selBuilding = null; this.selOther = e; this.changed(); return; }
    this.clear();
  }

  // Context command at a world point (tap with units selected, right click,
  // or long press). attack: force attack-move. moveOnly: right click never
  // re-selects a friendly building, it walks the units next to it.
  command(wx, wy, attack, moveOnly) {
    const g = this.g, units = this.selectedUnits();
    if (!units.length) return;
    const e = this.enemyAt(wx, wy);
    const b = this.buildingAt(Math.floor(wx), Math.floor(wy));
    if (e && e.kind === 'x') {
      const carrier = units.find((u) => ['soldier', 'sniper', 'pyro'].includes(u.type) && !u.carrying);
      if (carrier && !attack) { g.unitSys.command([carrier], { t: 'pickup', barrel: e }); this.app.ack(wx, wy, 'pickup'); return; }
    }
    if (e) { g.unitSys.command(units, { t: 'attack', target: e }); this.app.ack(wx, wy, 'attack'); return; }
    if (b && b.def.garrison && !b.neutral && b.state === 'ok' && !attack) {
      const can = units.filter((u) => u.def.garrison);
      const room = b.def.garrison.max - b.garrison.length;
      if (can.length && room > 0) { g.unitSys.command(can.slice(0, room), { t: 'garrison', b: b.id }); this.app.ack(wx, wy, 'garrison'); return; }
    }
    if (b && !moveOnly && !b.def.gate && !b.neutral && !attack && !(b.def.wall)) { this.setBuilding(b); return; }
    g.unitSys.command(units, { t: attack ? 'amove' : 'move', x: wx, y: wy });
    this.app.ack(wx, wy, attack ? 'attack' : 'move');
  }

  longPress(sx, sy) {
    const g = this.g; if (!g || g.state !== 'playing' || this.placing) return;
    const [wx, wy] = this.cam.toWorld(sx, sy);
    if (this.selectedUnits().length) { this.command(wx, wy, true); if (navigator.vibrate) navigator.vibrate(20); }
    else if (this.selBuilding && this.selBuilding.def.trains) { this.selBuilding.rally = { x: wx, y: wy }; this.app.toast('Rally point set', 'info'); }
  }

  secondary(sx, sy) {
    const [wx, wy] = this.cam.toWorld(sx, sy);
    if (this.placing) { this.cancelPlace(); return; }
    if (this.targeting) { this.targeting = null; this.app.onSelection(); return; }
    if (this.selectedUnits().length) this.command(wx, wy, false, true);
    else if (this.selBuilding && this.selBuilding.def.trains) { this.selBuilding.rally = { x: wx, y: wy }; this.app.toast('Rally point set', 'info'); }
  }

  targetTap(wx, wy) {
    const g = this.g, units = this.selectedUnits(), t = this.targeting;
    this.targeting = null;
    if (t === 'rally' && this.selBuilding) { this.selBuilding.rally = { x: wx, y: wy }; this.app.toast('Rally point set', 'info'); this.app.onSelection(); return; }
    if (!units.length) { this.app.onSelection(); return; }
    if (t === 'amove') { const e = this.enemyAt(wx, wy); if (e) g.unitSys.command(units, { t: 'attack', target: e }); else g.unitSys.command(units, { t: 'amove', x: wx, y: wy }); }
    else if (t === 'patrol') g.unitSys.command(units, { t: 'patrol', x: wx, y: wy });
    else if (t === 'move') g.unitSys.command(units, { t: 'move', x: wx, y: wy });
    this.app.ack(wx, wy, t === 'move' ? 'move' : 'attack');
    this.app.onSelection();
  }

  box(x0, y0, x1, y1, ev) {
    const g = this.g; if (!g || this.placing) return;
    const [ax, ay] = this.cam.toWorld(x0, y0), [bx, by] = this.cam.toWorld(x1, y1);
    const list = g.units.filter((u) => !u.garrisoned && u.x >= ax && u.x <= bx && u.y >= ay && u.y <= by);
    if (ev && ev.shiftKey) { for (const u of list) this.sel.add(u.id); this.selBuilding = null; this.changed(); return; }
    if (list.length) this.setUnits(list); else this.clear();
    this.app.setSelectMode(false);
  }

  selectSameType(u, mapWide) {
    const b = this.cam.bounds(0);
    const list = this.g.units.filter((v) => v.type === u.type && !v.garrisoned && (mapWide || (v.x >= b.fx0 && v.x <= b.fx1 && v.y >= b.fy0 && v.y <= b.fy1)));
    this.setUnits(list);
  }
  selectArmy() { const list = this.g.units.filter((u) => !u.garrisoned); if (list.length) this.setUnits(list); else this.app.toast('No units', 'warn'); }

  // ----------------------------------------------------------- control groups
  assignGroup(i) {
    const units = this.selectedUnits();
    this.groups[i] = units.length ? units.map((u) => u.id) : this.selBuilding ? [this.selBuilding.id] : [];
    this.app.toast(this.groups[i].length ? `Group ${i + 1} set` : `Group ${i + 1} cleared`, 'info');
    this.app.hud.renderGroups();
  }
  recallGroup(i, center) {
    const ids = this.groups[i].filter((id) => this.g.byId.has(id));
    this.groups[i] = ids;
    if (!ids.length) return;
    const first = this.g.byId.get(ids[0]);
    if (first.kind === 'b') this.setBuilding(first); else this.setUnits(ids.map((id) => this.g.byId.get(id)).filter((u) => u && u.kind === 'u'));
    if (center) { const xs = ids.map((id) => this.g.byId.get(id)); this.cam.center(xs.reduce((a, e) => a + (e.cx ?? e.x), 0) / xs.length, xs.reduce((a, e) => a + (e.cy ?? e.y), 0) / xs.length); }
  }

  // ---------------------------------------------------------------- placing
  startPlace(type) {
    const g = this.g, def = BUILDINGS[type];
    if (def.onCC) { const why = g.build(type, 0, 0); this.app.toast(why || `${def.name} under construction`, why ? 'warn' : 'good'); return; }
    if (this.placing && this.placing.type === type) { this.cancelPlace(); return; }
    this.sel.clear(); this.selBuilding = null; this.targeting = null;
    this.placing = { type, def, x: null, y: null, rot: 0, line: def.wall || def.trap ? [] : null, lineMode: !!(def.wall || def.trap), anchor: null, reason: null };
    this.app.onPlacing();
  }
  cancelPlace() { this.placing = null; this.app.onPlacing(); }
  rotate() { const p = this.placing; if (p && p.def.rotate) { p.rot = 1 - p.rot; this.updateGhost(); this.app.onPlacing(); } }
  toggleLine() { const p = this.placing; if (!p) return; p.lineMode = !p.lineMode; p.anchor = null; p.line = p.lineMode ? [] : null; this.app.onPlacing(); }

  placeTap(tx, ty) {
    const p = this.placing, def = p.def, [w, h] = footprint(def, p.rot);
    const x = tx - Math.floor((w - 1) / 2), y = ty - Math.floor((h - 1) / 2);
    if (p.lineMode) {
      if (!p.anchor) { p.anchor = { x, y }; p.x = x; p.y = y; p.line = [{ x, y }]; }
      else { p.x = x; p.y = y; this.buildLinePreview(); }
      this.updateGhost(); this.app.onPlacing();
      return;
    }
    if (p.x === x && p.y === y) { this.confirm(); return; }
    p.x = x; p.y = y; this.updateGhost(); this.app.onPlacing();
  }

  buildLinePreview() {
    const p = this.placing, a = p.anchor;
    // Snap to straight lines (horizontal, vertical or 45 degrees).
    let { x, y } = p;
    const dx = x - a.x, dy = y - a.y;
    if (Math.abs(dx) > 2 * Math.abs(dy)) y = a.y; else if (Math.abs(dy) > 2 * Math.abs(dx)) x = a.x;
    const tiles = [];
    line(a.x, a.y, x, y, (lx, ly) => { tiles.push({ x: lx, y: ly }); return tiles.length < 120; });
    p.line = tiles;
  }

  updateGhost() {
    const p = this.placing, g = this.g;
    if (!p || p.x == null) return;
    if (p.lineMode && p.line) {
      for (const t of p.line) t.ok = !g.buildBlocker(p.type, t.x, t.y, p.rot);
      p.reason = p.line.some((t) => t.ok) ? null : g.buildBlocker(p.type, p.line[0].x, p.line[0].y, p.rot);
    } else p.reason = g.buildBlocker(p.type, p.x, p.y, p.rot);
    const [w, h] = footprint(p.def, p.rot);
    p.preview = p.def.harvest ? g.eco.preview(p.type, p.x, p.y, w, h) : null;
  }

  confirm() {
    const g = this.g, p = this.placing;
    if (!p || p.x == null) { this.app.toast('Tap the map to choose a spot', 'warn'); return; }
    if (p.lineMode) {
      if (!p.line || !p.line.length) return;
      let built = 0, why = null;
      for (const t of p.line) { const r = g.build(p.type, t.x, t.y, p.rot); if (!r) built++; else why = why || r; }
      if (!built) this.app.toast(why || 'Nothing could be built', 'warn');
      p.anchor = null; p.line = []; p.x = null;
      this.app.onPlacing();
      return;
    }
    const why = g.build(p.type, p.x, p.y, p.rot);
    if (why) { this.app.toast(why, 'warn'); this.app.sound('error'); return; }
    p.x = null;
    if (g.costBlocker(p.type)) this.cancelPlace(); else this.app.onPlacing();
  }
}
