import { $, el, clear, spriteIcon, costNodes, resIcon, fmtTime } from './dom.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { TECHS } from '../data/research.js';
import { MAYORS, mayorName } from '../data/mayors.js';
import { fmt } from '../core/util.js';
import { upgradeCost } from '../sim/game.js';

// Context panel for the current selection, plus the mayor dialog.
export class Panel {
  constructor(app) { this.app = app; this.key = ''; this.t = 0; this.open = window.innerWidth > 640 && window.innerHeight > 600; }

  update(dt, force) {
    this.t -= dt;
    if (!force && this.t > 0) return;
    this.t = 0.3;
    const app = this.app, c = app.ctrl, box = $('context');
    if (c.placing) { box.classList.add('hidden'); return; }
    const b = c.selBuilding, units = c.selectedUnits(), o = c.selOther;
    if (!b && !units.length && !o) { box.classList.add('hidden'); this.key = ''; return; }
    const key = this.keyOf(b, units, o);
    if (!force && key === this.key) return;
    this.key = key;
    box.classList.remove('hidden');
    clear(box);
    if (b) this.building(box, b);
    else if (units.length) this.units(box, units);
    else this.other(box, o);
  }

  keyOf(b, units, o) {
    const g = this.app.game;
    if (b) return ['b', b.id, b.type, b.state, Math.round(b.hp), Math.round(b.barrier), b.off, b.powered, b.queue.map((q) => q.type + Math.floor(q.t)).join(), b.rq.map((r) => r.id + Math.floor(r.t)).join(), b.garrison.join(), b.prio, b.mineDelay, Math.floor(g.res.gold / 25), Math.floor(g.res.wood / 5), g.techs.size, (b.mercs || []).length, Math.floor(g.eco.free('workers')), Math.floor(g.eco.free('energy')), this.open].join('|');
    if (units.length) return ['u', units.map((u) => u.id + ':' + Math.round(u.hp) + (u.vet ? 'v' : '') + Math.floor(u.xp)).join(), this.open].join('|');
    return ['o', o.id, Math.round(o.hp)].join('|');
  }

  head(box, icon, title, sub) {
    box.append(el('h3', {}, icon, el('span', {}, title, sub ? el('small', { class: 'muted' }, ' ' + sub) : null),
      el('button', { class: 'x info' + (this.open ? ' on' : ''), title: 'Details', onclick: () => { this.open = !this.open; this.update(0, true); } }, 'ⓘ'),
      el('button', { class: 'x', onclick: () => this.app.ctrl.clear() }, '✕')));
  }

  bars(box, e) {
    box.append(el('div', { class: 'bar' }, el('div', { style: { width: (e.hp / e.maxHp * 100).toFixed(0) + '%' } })));
    if (e.maxBarrier) box.append(el('div', { class: 'bar gold' }, el('div', { style: { width: (e.barrier / e.maxBarrier * 100).toFixed(0) + '%' } })));
  }

  building(box, b) {
    const app = this.app, g = app.game, d = b.def, a = app.assets;
    const stateTxt = { build: 'under construction', upgrade: 'upgrading', repair: 'repairing', infected: b.neutral ? 'abandoned ruin' : 'INFECTED', ok: '' }[b.state];
    this.head(box, spriteIcon(a, 'building/' + b.type, 30), d.name, stateTxt + (b.off ? ' (off)' : '') + (b.state === 'ok' && !b.powered && !b.neutral ? ' (no power)' : ''));
    this.bars(box, b);
    if (b.state === 'build' || b.state === 'upgrade' || b.state === 'repair') box.append(el('div', { class: 'bar blue' }, el('div', { style: { width: (b.progress * 100).toFixed(0) + '%' } })), el('div', { class: 'muted small' }, `${fmtTime((1 - b.progress) * b.buildTime)} left`));
    const st = el('div', { class: 'stats' });
    if (this.open) box.append(el('div', { class: 'muted small' }, d.desc), st);
    else if (b.output) box.append(el('div', { class: 'small' }, 'Makes ' + Object.entries(b.output).map(([k, v]) => `+${fmt(v)} ${k}`).join(', ') + ' per tick'));
    const row = (k, v) => st.append(el('div', {}, el('span', {}, k), el('b', {}, v)));
    row('HP', `${fmt(b.hp)}/${fmt(b.maxHp)}`);
    if (b.maxBarrier) row('Barrier', `${fmt(b.barrier)}/${fmt(b.maxBarrier)}`);
    for (const k of ['workers', 'energy', 'food']) if (d.need[k]) row(`Needs ${k}`, fmt(g.mods.stat('building', d.id, 'need.' + k, d.need[k])));
    for (const k in d.supply) row(`+${k}`, fmt(g.mods.stat('building', d.id, 'supply.' + k, d.supply[k])));
    for (const k in d.income) row(`+${k}/tick`, fmt(g.mods.stat('building', d.id, 'income.' + k, d.income[k])));
    for (const k in d.upkeep) row(`−${k}/tick`, fmt(d.upkeep[k]));
    if (b.output) for (const k in b.output) row(`Makes ${k}`, `+${fmt(b.output[k])}/tick`);
    if (d.attack) row('Damage / range', `${d.attack.dmg} / ${d.attack.range}`);
    if (d.garrison) row('Garrison', `${b.garrison.length}/${d.garrison.max} (+${d.garrison.range} range)`);
    if (d.grid) row('Grid radius', fmt(g.mods.stat('building', d.id, 'grid', d.grid)));
    if (d.vision >= 12) row('Vision', d.vision);
    if (d.trap) row('Durability', fmt(b.hp));

    const actions = el('div', { class: 'row' });
    const act = (label, fn, why, cls) => actions.append(el('button', { class: cls || '', disabled: !!why, title: why || '', onclick: fn }, label));
    const run = (fn) => () => { const why = fn(); if (why) app.toast(why, 'warn'); this.update(0, true); app.tray.render(); };
    if (d.upgradeTo && !b.neutral) {
      const to = BUILDINGS[d.upgradeTo], why = g.upgradeBlocker(b);
      actions.append(el('button', { disabled: !!why, title: why || '', onclick: run(() => g.upgrade(b)) }, `⬆ ${to.name} `, costNodes(a, upgradeCost(d, to), g.res)));
    }
    if (b.state === 'infected' || b.hp < b.maxHp || b.barrier < b.maxBarrier) {
      const why = g.repairBlocker(b);
      actions.append(el('button', { disabled: !!why, title: why || '', onclick: run(() => g.repair(b)) }, b.neutral ? '🔧 Reclaim ' : '🔧 Repair ', costNodes(a, g.repairCost(b), g.res)));
    }
    if (d.toggle && b.state === 'ok') act(b.off ? '▶ Switch on' : '⏸ Switch off', run(() => g.toggle(b)));
    if ((d.attack && !d.inert && d.attack.type !== 'pulse') || d.garrison) act(b.prio === 'strongest' ? '★ Target strongest' : '◎ Target nearest', () => { b.prio = b.prio === 'strongest' ? 'nearest' : 'strongest'; for (const id of b.garrison) { const u = g.byId.get(id); if (u) u.prio = b.prio; } this.update(0, true); });
    if (d.garrison && b.garrison.length) act('⇩ Unload', () => { for (const id of b.garrison.slice()) g.ungarrison(g.byId.get(id), b); this.update(0, true); });
    if (d.mine) act(`⏱ Delay ${b.mineDelay || 0}s`, () => { b.mineDelay = ((b.mineDelay || 0) + 1) % 4; this.update(0, true); });
    if (d.trains) act('⚑ Rally point', () => { app.ctrl.targeting = 'rally'; app.toast('Tap the rally point', 'info'); });
    if (!d.noDemolish && b.type !== 'cc' && !b.neutral) {
      const why = g.demolishBlocker(b);
      act(b.state === 'build' ? '✕ Cancel (full refund)' : '🗑 Demolish (50%)', () => app.confirmDialog(`Demolish this ${d.name}?`, run(() => g.demolish(b))), why, 'danger');
    }
    if (actions.children.length) box.append(actions);

    if (d.trains && b.state === 'ok') this.training(box, b);
    if (d.research && b.state === 'ok') this.research(box, b);
    if (d.trade && b.state === 'ok') this.market(box, b);
    if (d.mercenaries && b.state === 'ok') this.inn(box, b);
    if (b.type === 'cc') this.ccExtra(box, b);
  }

  training(box, b) {
    const app = this.app, g = app.game, a = app.assets;
    const row = el('div', { class: 'row' });
    for (const t of b.def.trains) {
      const d = UNITS[t], why = g.trainBlocker(b, t), free = g.bonus.units[t] > 0;
      row.append(el('button', { class: 'unitbtn', disabled: !!why && !free, title: why || d.desc, onclick: () => { const r = g.train(b, t); if (r) app.toast(r, 'warn'); this.update(0, true); } },
        spriteIcon(a, 'unit/' + t, 26), el('span', {}, d.name), el('small', {}, free ? 'free' : costNodes(a, d.cost, g.res))));
    }
    box.append(el('div', { class: 'section' }, 'Train'), row);
    if (b.queue.length) {
      const q = el('div', { class: 'queue' });
      b.queue.forEach((it, i) => q.append(el('button', { class: 'qitem', title: 'Tap to cancel', onclick: () => { g.cancelTrain(b, i); this.update(0, true); } }, spriteIcon(a, 'unit/' + it.type, 22), i === 0 ? el('div', { class: 'bar blue mini' }, el('div', { style: { width: (it.t / it.time * 100).toFixed(0) + '%' } })) : null)));
      box.append(q);
    }
  }

  research(box, b) {
    const app = this.app, g = app.game, a = app.assets;
    const grid = el('div', { class: 'tech-grid' });
    for (const id in TECHS) {
      const t = TECHS[id];
      if (t.at !== b.type) continue;
      const done = g.techs.has(id), q = b.rq.findIndex((r) => r.id === id), why = done || q >= 0 ? null : g.researchBlocker(b, id);
      const cls = 'tech' + (done ? ' done' : q >= 0 ? ' busy' : why ? ' lock' : '');
      const status = done ? '✓ researched' : q >= 0 ? (q === 0 ? `${fmtTime(b.rq[0].time - b.rq[0].t)} left` : 'queued') : '';
      grid.append(el('button', { class: cls, title: why || '', onclick: () => {
        if (done) return;
        if (q >= 0) { g.cancelResearch(b, q); this.update(0, true); return; }
        const r = g.research(b, id); if (r) app.toast(r, 'warn'); this.update(0, true);
      } }, el('b', {}, t.name), el('small', {}, status || costNodes(a, t.cost, g.res)), el('small', {}, t.unlocks.map((u) => (BUILDINGS[u] || UNITS[u]).name).join(', '))));
    }
    box.append(el('div', { class: 'section' }, 'Research'), grid);
  }

  market(box, b) {
    const app = this.app, g = app.game, a = app.assets, e = g.eco;
    const t = el('table', { class: 'trade' });
    for (const k of ['wood', 'stone', 'iron', 'oil']) {
      t.append(el('tr', {}, el('td', {}, resIcon(a, k, 14), ' ', k),
        el('td', {}, el('button', { onclick: () => { const r = e.trade(k, 1, true); if (r) app.toast(r, 'warn'); this.update(0, true); } }, `Buy 5 · ${Math.ceil(e.buyPrice(k) * 5)}`)),
        el('td', {}, el('button', { onclick: () => { const r = e.trade(k, 1, false); if (r) app.toast(r, 'warn'); this.update(0, true); } }, `Sell 5 · ${Math.floor(e.sellPrice(k) * 5)}`))));
    }
    box.append(el('div', { class: 'section' }, `Market (${e.markets()} built): overflow is sold automatically`), t);
  }

  inn(box, b) {
    const app = this.app, g = app.game, a = app.assets;
    const row = el('div', { class: 'row' });
    (b.mercs || []).forEach((m, i) => {
      const d = UNITS[m.type];
      row.append(el('button', { class: 'unitbtn', onclick: () => { const r = g.hireMercenary(b, i); if (r) app.toast(r, 'warn'); this.update(0, true); } },
        spriteIcon(a, 'unit/' + m.type, 26), el('span', {}, (m.vet ? 'Veteran ' : '') + d.name), el('small', {}, costNodes(a, { gold: m.price }, g.res))));
    });
    const next = 5 - (g.day - (b.mercDay || 0));
    box.append(el('div', { class: 'section' }, `Mercenaries (prestige ${b.prestige || 0}, new offer in ${Math.max(0, next)} days)`), row.children.length ? row : el('div', { class: 'muted small' }, 'No mercenaries right now.'));
  }

  ccExtra(box, b) {
    const g = this.app.game;
    const w = BUILDINGS.telescope, why = g.lockReason('telescope');
    if (!g.buildings.some((x) => x.type === 'telescope')) {
      box.append(el('div', { class: 'row' }, el('button', { disabled: !!why, title: why || '', onclick: () => this.app.ctrl.startPlace('telescope') }, `👁 Build ${w.name} `, costNodes(this.app.assets, w.cost, g.res))));
    }
  }

  units(box, units) {
    const app = this.app, g = app.game, a = app.assets;
    if (units.length === 1) {
      const u = units[0], d = u.def, at = g.unitAttack(u);
      this.head(box, spriteIcon(a, 'unit/' + u.type, 30), (u.vet ? 'Veteran ' : '') + d.name, u.garrisoned ? 'in tower' : u.cmd.t);
      this.bars(box, u);
      const st = el('div', { class: 'stats' });
      const row = (k, v) => st.append(el('div', {}, el('span', {}, k), el('b', {}, v)));
      row('HP', `${fmt(u.hp)}/${u.maxHp}`); row('Armor', `${Math.round(d.armor * 100)}%`);
      row('Damage', fmt(at.dmg)); row('Range', g.unitStat(u, 'range').toFixed(1)); row('Attacks/s', (1 / at.cd).toFixed(2));
      row('Speed', d.speed); row('Vision', fmt(g.unitStat(u, 'vision'))); row('Noise', at.noise);
      if (d.xp) row('Experience', u.vet ? 'Veteran' : `${Math.floor(u.xp)}/${d.xp}`);
      row('Wage', `${d.upkeep.gold || 0}g${d.upkeep.oil ? ` ${d.upkeep.oil} oil` : ''}/tick`);
      if (this.open) box.append(el('div', { class: 'muted small' }, d.desc), st);
      else box.append(el('div', { class: 'muted small' }, `Tap the ground to move. ${d.xp ? (u.vet ? 'Veteran.' : `XP ${Math.floor(u.xp)}/${d.xp}.`) : ''}`));
      return;
    }
    this.head(box, '⚔', `${units.length} units`, '');
    const list = el('div', { class: 'units' });
    for (const u of units.slice(0, 40)) list.append(el('button', { class: 'u', onclick: () => app.ctrl.setUnits([u]) }, spriteIcon(a, 'unit/' + u.type, 24), el('div', { class: 'bar mini' }, el('div', { style: { width: (u.hp / u.maxHp * 100).toFixed(0) + '%' } }))));
    box.append(list);
  }

  other(box, o) {
    const a = this.app.assets;
    if (o.kind === 'z') {
      const d = o.def;
      this.head(box, spriteIcon(a, 'infected/' + o.type, 30), d.name, '');
      this.bars(box, o);
      box.append(el('div', { class: 'stats' }, ...[['HP', `${fmt(o.hp)}/${fmt(o.maxHp)}`], ['Armor', `${Math.round(d.armor * 100)}%`], ['Damage', d.attack.dmg], ['Speed', d.speed], ['Vision', d.vision], ['Hearing', d.hearing], ['Alertness', d.awareness]].map(([k, v]) => el('div', {}, el('span', {}, k), el('b', {}, String(v))))));
    } else if (o.kind === 'n') {
      this.head(box, spriteIcon(a, 'nest/' + o.size, 30), o.def.name, 'Village of Doom');
      this.bars(box, o);
      box.append(el('div', { class: 'muted small' }, `Has spawned ${o.made} of ${o.max} infected. Destroy it for loot. Attacking it rouses more infected.`));
    } else if (o.kind === 'x') {
      this.head(box, spriteIcon(a, 'barrel', 30), 'Explosive barrel', '');
      box.append(el('div', { class: 'muted small' }, 'Soldiers, Snipers and Pyros can carry it. Shoot it to explode for 1000 damage.'));
    }
  }

  // Mayor election dialog.
  mayor(offer) {
    const app = this.app, g = app.game, a = app.assets;
    const body = el('div', {}, el('h2', {}, `Elect a mayor (level ${offer.level})`), el('p', { class: 'muted' }, 'Your colony has grown. Choose one of these candidates.'));
    const row = el('div', { class: 'mayors' });
    for (const id of offer.options) {
      const m = MAYORS.find((x) => x.id === id);
      row.append(el('button', { class: 'mayor', onclick: () => { g.chooseMayor(id); app.closeModal(); app.toast(`${mayorName(m)} is the new mayor`, 'good'); app.tray.render(); app.hud.buildRes(); } },
        spriteIcon(a, 'mayor/' + m.gender, 56), el('b', {}, mayorName(m)), el('span', {}, describeMayor(m))));
    }
    body.append(row);
    app.modal(body, [], true);
  }
}

export function describeMayor(m) {
  const parts = [];
  if (m.units) for (const t in m.units) parts.push(`The colony gets ${m.units[t]}× ${UNITS[t].name}`);
  if (m.buildings) for (const t in m.buildings) parts.push(`Free ${m.buildings[t]}× ${BUILDINGS[t].name}`);
  if (m.res) parts.push('Reserves: ' + Object.entries(m.res).map(([k, v]) => `+${v} ${k}`).join(', '));
  if (m.techs) for (const t of m.techs) parts.push(`Grants research: ${TECHS[t].name}`);
  if (m.mods) for (const x of m.mods) parts.push(describeMod(x));
  return parts.join('. ');
}
function describeMod(x) {
  if (x.path === 'refund') return `Demolition refund ${Math.round(x.set * 100)}%`;
  const [grp, id, ...rest] = x.path.split('.');
  const what = rest.join(' ').replace('supply.', '').replace('income.', '').replace('need.', 'needed ').replace('upkeep.gold', 'wages');
  const who = id === '*' ? (grp === 'unit' ? 'All units' : 'All buildings') : (grp === 'unit' ? UNITS[id] : BUILDINGS[id])?.name || id;
  const val = x.pct != null ? `${x.pct > 0 ? '+' : ''}${Math.round(x.pct * 100)}%` : `${x.add > 0 ? '+' : ''}${x.add}`;
  return `${who}: ${what} ${val}`;
}
