import { $, el, clear, spriteIcon, costNodes } from './dom.js';
import { BUILDINGS, BUILD_MENU } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { footprint } from '../sim/placement.js';

// Bottom tray: build menu (tabs + cards) or the unit command bar.
export class Tray {
  constructor(app) { this.app = app; this.tab = 'colony'; this.mode = null; this.t = 0; }

  render() {
    const app = this.app, c = app.ctrl;
    const units = c.selectedUnits();
    const mode = c.placing ? 'place' : units.length ? 'units' : 'build';
    this.mode = mode;
    if (mode === 'units') this.renderCommands(units);
    else this.renderBuild();
    this.renderPlaceBar();
  }

  renderBuild() {
    const g = this.app.game, tabs = clear($('tabs')), tray = clear($('tray'));
    const menu = BUILD_MENU.slice();
    const hasBonus = Object.values(g.bonus.buildings).some((n) => n > 0) || Object.values(g.bonus.units).some((n) => n > 0);
    if (hasBonus) menu.push({ id: 'bonus', name: '★ Bonus', items: [] });
    if (!menu.some((m) => m.id === this.tab)) this.tab = 'colony';
    for (const m of menu) tabs.append(el('button', { class: this.tab === m.id ? 'on' : '', onclick: () => { this.tab = m.id; this.render(); } }, m.name));
    this.cards = [];
    if (this.tab === 'bonus') {
      for (const t in g.bonus.buildings) if (g.bonus.buildings[t] > 0) this.card(tray, t, `×${g.bonus.buildings[t]} free`);
      for (const t in g.bonus.units) if (g.bonus.units[t] > 0) {
        const d = UNITS[t];
        const b = el('button', { class: 'card', onclick: () => { const why = g.claimBonusUnit(t); this.app.toast(why || `${d.name} joined the colony`, why ? 'warn' : 'good'); this.render(); } },
          spriteIcon(this.app.assets, 'unit/' + t), el('span', { class: 'nm' }, d.name), el('span', { class: 'cs' }, `×${g.bonus.units[t]} free`));
        tray.append(b);
      }
      return;
    }
    const m = menu.find((x) => x.id === this.tab);
    for (const t of m.items) this.card(tray, t);
    this.refresh();
  }

  card(tray, type, note) {
    const g = this.app.game, d = BUILDINGS[type];
    const b = el('button', { class: 'card', title: d.desc, onclick: () => { const lock = g.lockReason(type); if (lock && !(g.bonus.buildings[type] > 0)) { this.app.toast(lock, 'warn'); return; } this.app.ctrl.startPlace(type); } },
      spriteIcon(this.app.assets, 'building/' + type), el('span', { class: 'nm' }, d.name), el('span', { class: 'cs' }, note || costNodes(this.app.assets, d.cost)));
    b.dataset.type = type;
    tray.append(b);
    this.cards.push(b);
  }

  // Cheap periodic refresh of card states.
  refresh() {
    const g = this.app.game; if (!g || this.mode !== 'build' || !this.cards) return;
    for (const b of this.cards) {
      const t = b.dataset.type;
      const lock = g.lockReason(t);
      const free = g.bonus.buildings[t] > 0;
      b.classList.toggle('locked', !!lock && !free);
      b.classList.toggle('off', !lock && !!g.costBlocker(t));
      b.classList.toggle('on', !!(this.app.ctrl.placing && this.app.ctrl.placing.type === t));
    }
  }

  renderCommands(units) {
    const app = this.app, g = app.game, c = app.ctrl, tabs = clear($('tabs')), tray = clear($('tray'));
    this.cards = null;
    const counts = {};
    for (const u of units) counts[u.type] = (counts[u.type] || 0) + 1;
    tabs.append(el('span', { class: 'sel-sum' }, Object.keys(counts).map((t) => `${counts[t]} ${UNITS[t].name}`).join(' · ')));
    const cmd = (icon, label, fn, on, title) => tray.append(el('button', { class: 'cmd' + (on ? ' on' : ''), title, onclick: fn }, el('span', {}, icon), label));
    cmd('➜', 'Move', () => { c.targeting = c.targeting === 'move' ? null : 'move'; this.render(); app.toast('Tap where to move', 'info'); }, c.targeting === 'move', 'Move, ignoring enemies');
    cmd('⚔', 'Attack', () => { c.targeting = c.targeting === 'amove' ? null : 'amove'; this.render(); app.toast('Tap where to attack-move', 'info'); }, c.targeting === 'amove', 'Attack-move (Q)');
    cmd('⛨', 'Hold', () => { g.unitSys.command(units, { t: 'hold' }); this.render(); }, units.every((u) => u.cmd.t === 'hold'), 'Hold position (H)');
    cmd('■', 'Stop', () => { g.unitSys.command(units, { t: 'stop' }); this.render(); }, false, 'Stop (S)');
    cmd('⇄', 'Patrol', () => { c.targeting = c.targeting === 'patrol' ? null : 'patrol'; this.render(); app.toast('Tap the far end of the patrol', 'info'); }, c.targeting === 'patrol', 'Patrol (P)');
    cmd('➹', 'Chase', () => { g.unitSys.command(units, { t: 'chase' }); this.render(); }, units.every((u) => u.cmd.t === 'chase'), 'Seek and destroy (C)');
    const strongest = units.every((u) => u.prio === 'strongest');
    cmd(strongest ? '★' : '◎', strongest ? 'Strongest' : 'Nearest', () => { for (const u of units) u.prio = strongest ? 'nearest' : 'strongest'; this.render(); }, false, 'Target priority');
    if (units.some((u) => u.garrisoned)) cmd('⇩', 'Leave', () => { for (const u of units) if (u.garrisoned) g.ungarrison(u); this.render(); }, false, 'Leave tower');
    if (units.some((u) => u.carrying)) cmd('⤓', 'Drop', () => { for (const u of units) if (u.carrying) g.unitSys.dropBarrel(u); this.render(); }, false, 'Drop barrel');
    if (units.length === 1) cmd('♻', 'Dismiss', () => app.confirmDialog(`Dismiss this ${units[0].def.name} for a 50% refund?`, () => { const why = g.dismiss(units[0]); app.toast(why || 'Unit dismissed', why ? 'warn' : 'info'); }), false, 'Dismiss near a Soldiers Center');
    cmd('✕', 'Deselect', () => c.clear(), false, 'Deselect (Esc)');
  }

  renderPlaceBar() {
    const app = this.app, g = app.game, p = app.ctrl.placing, bar = $('place-bar');
    if (!p) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    clear(bar);
    const d = p.def, free = g.bonus.buildings[p.type] > 0;
    const head = el('div', {}, el('b', {}, d.name), ' ', free ? el('span', { class: 'good' }, 'free (mayor bonus)') : costNodes(app.assets, d.cost, g.res));
    const needs = [];
    for (const k of ['workers', 'energy', 'food']) if (d.need[k]) needs.push(`${k} ${Math.ceil(g.mods.stat('building', d.id, 'need.' + k, d.need[k]))}`);
    const info = el('div', { class: 'muted small desc' }, d.desc, needs.length ? ` Needs ${needs.join(', ')}.` : '');
    if (needs.length) head.append(el('span', { class: 'muted small' }, ' · ' + needs.join(', ')));
    let status;
    if (p.x == null) status = el('div', {}, p.lineMode ? 'Tap the start of the line.' : 'Tap the map to place it.');
    else if (p.lineMode) {
      const ok = (p.line || []).filter((t) => t.ok).length;
      status = el('div', { class: ok ? 'good' : 'bad' }, ok ? `${ok} of ${p.line.length} can be built. Tap the end of the line, then Build.` : p.reason || 'Tap the end of the line.');
    } else if (p.reason) status = el('div', { class: 'bad' }, p.reason);
    else {
      const pv = p.preview;
      status = el('div', { class: 'good' }, pv ? 'Production here: ' + Object.entries(pv).map(([k, v]) => `+${Math.round(v)} ${k}`).join(', ') + ' per tick' : 'Good spot. Tap Build or tap the ghost again.');
    }
    const acts = el('div', { class: 'acts' });
    acts.append(el('button', { class: 'primary', onclick: () => app.ctrl.confirm() }, '✓ Build'));
    if (d.rotate) acts.append(el('button', { class: 'opt', onclick: () => app.ctrl.rotate() }, '⟳ Rotate'));
    if (d.wall || d.trap || d.gate) acts.append(el('button', { class: 'opt' + (p.lineMode ? ' on' : ''), onclick: () => app.ctrl.toggleLine() }, '📏 Line'));
    acts.append(el('button', { class: 'x', onclick: () => app.ctrl.cancelPlace() }, '✕'));
    bar.append(head, info, status, acts);
  }
}
