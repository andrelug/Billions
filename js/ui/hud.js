import { $, el, clear, resIcon, fmtTime } from './dom.js';
import { fmt } from '../core/util.js';
import { HOUR, DAY } from '../data/maps.js';
import { SIDES } from '../sim/waves.js';

// Heads-up display: resources, clock, swarm warning, toasts, rails, minimap.
export class Hud {
  constructor(app) {
    this.app = app;
    this.t = 0; this.miniT = 0;
    this.toastEl = $('toasts');
    $('btn-menu').onclick = () => app.pause(true);
    $('btn-army').onclick = () => app.ctrl.selectArmy();
    $('btn-home').onclick = () => app.goHome();
    $('btn-alert').onclick = () => app.jumpToAlert();
    $('btn-select').onclick = () => app.setSelectMode(!app.input.selectMode);
    $('btn-grid').onclick = () => { app.showGrid = !app.showGrid; $('btn-grid').classList.toggle('on', app.showGrid); };
    $('res-bar').onclick = () => { $('res-detail').classList.toggle('hidden'); this.renderDetail(); };
    const mm = $('minimap');
    const jump = (e) => { const r = mm.getBoundingClientRect(), g = app.game; app.renderer.cam.center((e.clientX - r.left) / r.width * g.world.w, (e.clientY - r.top) / r.height * g.world.h); };
    mm.addEventListener('pointerdown', (e) => { mm.setPointerCapture(e.pointerId); this.mmDown = true; jump(e); });
    mm.addEventListener('pointermove', (e) => { if (this.mmDown) jump(e); });
    mm.addEventListener('pointerup', () => { this.mmDown = false; });
    this.buildRes();
    this.renderGroups();
    // Measure the top bar so floating pieces sit below it.
    const top = $('top');
    const layout = () => document.documentElement.style.setProperty('--top-h', top.getBoundingClientRect().height + 'px');
    if (window.ResizeObserver) new ResizeObserver(layout).observe(top); else window.addEventListener('resize', layout);
    const bottom = $('bottom');
    const layoutB = () => document.documentElement.style.setProperty('--bottom-h', bottom.getBoundingClientRect().height + 'px');
    if (window.ResizeObserver) new ResizeObserver(layoutB).observe(bottom);
  }

  buildRes() {
    const a = this.app.assets, bar = clear($('res-bar'));
    this.chips = {};
    for (const k of ['gold', 'wood', 'stone', 'iron', 'oil', 'colonists', 'workers', 'food', 'energy']) {
      const c = el('div', { class: 'chip', title: k }, resIcon(a, k, 16), el('b'), el('small'));
      bar.append(c); this.chips[k] = c;
    }
    const sp = clear($('speed'));
    this.speedBtns = [];
    const add = (label, v, title) => { const b = el('button', { title, onclick: () => this.app.setSpeed(v) }, label); sp.append(b); this.speedBtns.push([v, b]); };
    add('⏸', 0, 'Pause (Space)'); add('▶', 1, 'Play');
    if (this.app.profile.settings.fastForward) { add('⏩', 2, 'Fast'); add('⏭', 3, 'Faster'); }
  }

  renderGroups() {
    const box = clear($('groups')), c = this.app.ctrl;
    for (let i = 0; i < 5; i++) {
      let pressT = null, long = false;
      const b = el('button', { class: c.groups[i].length ? 'set' : '', title: `Group ${i + 1}: tap to select, hold to assign` }, String(i + 1));
      b.addEventListener('pointerdown', () => { long = false; pressT = setTimeout(() => { long = true; c.assignGroup(i); if (navigator.vibrate) navigator.vibrate(25); }, 450); });
      b.addEventListener('pointerup', () => { clearTimeout(pressT); if (!long) { const now = performance.now(); c.recallGroup(i, now - (b.lastT || 0) < 350); b.lastT = now; } });
      b.addEventListener('pointerleave', () => clearTimeout(pressT));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); c.assignGroup(i); });
      box.append(b);
    }
  }

  update(dt) {
    const g = this.app.game; if (!g) return;
    this.t -= dt; this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.4; this.app.renderer.drawMinimap($('minimap')); }
    if (this.t > 0) return;
    this.t = 0.25;
    const e = g.eco, r = g.res;
    const set = (k, main, sub, bad, full) => { const c = this.chips[k]; c.children[1].textContent = main; c.children[2].textContent = sub; c.classList.toggle('bad', !!bad); c.classList.toggle('full', !!full); };
    for (const k of ['gold', 'wood', 'stone', 'iron', 'oil']) {
      const inc = e.income[k];
      set(k, fmt(r[k]), (inc >= 0 ? '+' : '') + fmt(inc), inc < 0 && r[k] < Math.abs(inc) * 2, r[k] >= e.cap[k] - 0.5);
    }
    set('colonists', fmt(e.colonists), '', false, false);
    for (const k of ['workers', 'food', 'energy']) set(k, `${fmt(e.free(k))}`, `/${fmt(e.supply[k])}`, e.free(k) < 0, false);
    // Clock.
    const hour = Math.floor((g.time % DAY) / HOUR);
    $('day').textContent = `Day ${g.day}/${g.totalDays} · ${String(hour).padStart(2, '0')}:00`;
    $('daybar').firstElementChild.style.width = ((g.time % DAY) / DAY * 100).toFixed(1) + '%';
    for (const [v, b] of this.speedBtns) b.classList.toggle('on', g.paused ? v === 0 : v === g.speed);
    this.renderWave();
    if (!$('res-detail').classList.contains('hidden')) this.renderDetail();
    $('btn-alert').classList.toggle('hot', !!(g.lastAlert && g.time - g.lastAlert.t < 8));
  }

  renderWave() {
    const g = this.app.game, wb = $('wave-bar'), h = g.time / HOUR;
    const live = g.waves.groups.reduce((a, x) => a + x.n, 0) + g.waves.queue.length;
    const ev = g.waves.list.find((x) => x.swarm && !x.done && x.warned);
    let text = '', cls = '';
    if (ev) {
      const left = (ev.at - h) * HOUR;
      text = ev.final ? `☠ FINAL SWARM from every side in ${fmtTime(left)}` : `⚠ Swarm from the ${SIDES[ev.side]} in ${fmtTime(left)}`;
      cls = 'near';
    } else if (live > 0) { text = `☠ Swarm attacking · ${live} infected`; cls = 'live'; }
    else {
      const next = g.waves.nextSwarm();
      const done = g.waves.list.filter((x) => x.swarm && x.done).length;
      text = next ? `Swarms survived: ${done}/10` : 'No more swarms: hold out to the end';
    }
    if (wb.textContent !== text) wb.textContent = text;
    wb.className = cls;
  }

  renderDetail() {
    const g = this.app.game, e = g.eco, box = clear($('res-detail')), a = this.app.assets;
    const t = el('table');
    t.append(el('tr', {}, el('th', {}, ''), el('th', {}, 'Stock'), el('th', {}, 'Cap'), el('th', {}, '+ / tick'), el('th', {}, '− / tick')));
    for (const k of ['gold', 'wood', 'stone', 'iron', 'oil']) t.append(el('tr', {}, el('td', {}, resIcon(a, k, 14), ' ', k), el('td', {}, fmt(g.res[k])), el('td', {}, fmt(e.cap[k])), el('td', { class: 'good' }, '+' + fmt(e.gross[k])), el('td', { class: 'bad' }, '−' + fmt(e.upkeep[k]))));
    const t2 = el('table');
    t2.append(el('tr', {}, el('th', {}, ''), el('th', {}, 'Free'), el('th', {}, 'Supply'), el('th', {}, 'Used')));
    for (const k of ['workers', 'food', 'energy']) t2.append(el('tr', {}, el('td', {}, resIcon(a, k, 14), ' ', k), el('td', { class: e.free(k) < 0 ? 'bad' : '' }, fmt(e.free(k))), el('td', {}, fmt(e.supply[k])), el('td', {}, fmt(e.demand[k]))));
    const tickLeft = 30 - g.tickT;
    box.append(el('div', { class: 'muted' }, `Resources are paid every 8 hours (next in ${fmtTime(tickLeft)}). Colonists: ${fmt(e.colonists)}. Units: ${g.units.length}.`), t, t2,
      el('div', { class: 'muted small' }, `Score factor ${Math.round(g.scoreFactor * 100)}% · Infected killed ${fmt(g.stats.kills)} · Mayors ${g.mayors.length}/4`));
  }

  toast(text, kind, where) {
    const t = el('div', { class: 'toast ' + (kind || 'info') }, text);
    if (where) { t.classList.add('jump'); t.onclick = () => { this.app.renderer.cam.center(where.x, where.y); t.remove(); }; }
    this.toastEl.append(t);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
    const life = kind === 'danger' || kind === 'warn' ? 6500 : 4500;
    setTimeout(() => t.classList.add('fade'), life);
    setTimeout(() => t.remove(), life + 700);
  }
}
