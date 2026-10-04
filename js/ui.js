'use strict';
// DOM HUD: resources, build bar, placement flow, selection panel, toasts,
// title/pause/end screens, minimap and persistence.
class UI {
  constructor(game, renderer) {
    this.g = game; this.r = renderer;
    this.$ = (id) => document.getElementById(id);
    this.hud = this.$('hud'); this.overlay = this.$('overlay');
    this.toastEl = this.$('toasts'); this.panel = this.$('panel');
    this.placeBar = this.$('place-bar'); this.placeInfo = this.$('place-info');
    this.minimap = this.$('minimap');
    this.tickT = 0; this.miniT = 0; this.panelKey = '';
    this.buildBuildBar();
    this.wire();
    game.on('msg', (t, k, where) => this.toast(t, k, where));
    game.on('select', () => this.renderPanel(true));
    game.on('end', (res) => this.showEnd(res));
    game.on('autosave', () => this.save());
    game.on('horde', () => { if (navigator.vibrate) navigator.vibrate([80, 60, 80]); });
    this.$('btn-continue').classList.toggle('hidden', !this.hasSave());
  }

  // ------------------------------------------------------------- wiring
  wire() {
    const $ = this.$;
    $('btn-new').onclick = () => this.startNew();
    $('btn-continue').onclick = () => this.continueGame();
    $('btn-help').onclick = () => this.showScreen('help');
    $('btn-help2').onclick = () => { this.helpReturn = 'pause'; this.showScreen('help'); };
    $('btn-help-back').onclick = () => this.showScreen(this.helpReturn || 'title');
    $('btn-resume').onclick = () => this.togglePause(false);
    $('btn-quit').onclick = () => { this.save(); this.toTitle(); };
    $('btn-end-new').onclick = () => this.startNew();
    $('btn-end-title').onclick = () => this.toTitle();
    $('btn-menu').onclick = () => this.togglePause(true);
    $('btn-army').onclick = () => this.selectArmy();
    $('btn-home').onclick = () => this.goHome();
    $('place-ok').onclick = () => this.confirmPlace();
    $('place-cancel').onclick = () => this.cancelPlace();
    $('place-line').onclick = () => { const p = this.g.placing; if (p) { p.line = !p.line; p.anchor = null; $('place-line').classList.toggle('on', p.line); this.updatePlaceInfo(); } };
    for (const b of $('speed').querySelectorAll('button')) b.onclick = () => this.setSpeed(+b.dataset.speed);
    this.difficulty = 'normal';
    try { if (DIFFICULTY[localStorage.getItem('billions-difficulty')]) this.difficulty = localStorage.getItem('billions-difficulty'); } catch (e) { /* ignore */ }
    for (const b of $('difficulty').querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.diff === this.difficulty);
      b.onclick = () => {
        this.difficulty = b.dataset.diff;
        try { localStorage.setItem('billions-difficulty', this.difficulty); } catch (e) { /* ignore */ }
        for (const o of $('difficulty').querySelectorAll('button')) o.classList.toggle('on', o === b);
      };
    }
    this.minimap.addEventListener('pointerdown', (e) => {
      const rect = this.minimap.getBoundingClientRect();
      const tx = (e.clientX - rect.left) / rect.width * CFG.MAP_W, ty = (e.clientY - rect.top) / rect.height * CFG.MAP_H;
      this.r.centerOnTile(tx, ty);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.g.state === 'playing') { this.save(); this.togglePause(true); } });
    window.addEventListener('pagehide', () => { if (this.g.state === 'playing') this.save(); });
    // Keep the floating HUD pieces below the (variable height) top bar.
    const stack = $('top-stack');
    const layout = () => document.documentElement.style.setProperty('--hud-top', stack.getBoundingClientRect().height + 'px');
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stack); else window.addEventListener('resize', layout);
    layout();
  }

  buildBuildBar() {
    const bar = this.$('build-bar');
    bar.innerHTML = '';
    this.bbtns = {};
    for (const type of BUILD_ORDER) {
      const def = BUILDINGS[type];
      const b = document.createElement('button');
      b.className = 'bbtn';
      b.innerHTML = `<span class="ic">${def.icon}</span><span class="nm">${def.name}</span><span class="cs">${U.costStr(def.cost)}</span>`;
      b.title = def.desc;
      b.onclick = () => this.startPlace(type);
      bar.appendChild(b); this.bbtns[type] = b;
    }
  }

  // ------------------------------------------------------------- screens
  showScreen(name) {
    this.overlay.classList.remove('hidden');
    for (const s of this.overlay.querySelectorAll('.screen')) s.classList.add('hidden');
    this.$('screen-' + name).classList.remove('hidden');
    if (name === 'title') this.$('btn-continue').classList.toggle('hidden', !this.hasSave());
  }
  hideScreens() { this.overlay.classList.add('hidden'); }

  startNew() {
    this.g.newGame(undefined, this.difficulty);
    this.afterLoad();
  }
  continueGame() {
    try { this.g.load(localStorage.getItem(CFG.SAVE_KEY)); }
    catch (e) { console.error(e); this.toast('Could not load the save. Starting a new game.', 'warn'); this.g.newGame(); }
    this.afterLoad();
  }
  afterLoad() {
    this.hideScreens();
    this.hud.classList.remove('hidden');
    this.toastEl.innerHTML = '';
    this.cancelPlace();
    this.r.cam.zoom = Math.min(window.innerWidth, window.innerHeight) < 600 ? 1.1 : 1.3;
    this.goHome();
    this.setSpeed(this.g.speed || 1);
    this.renderPanel(true);
    this.updateHud(true);
  }
  toTitle() {
    this.g.state = 'title';
    this.hud.classList.add('hidden');
    this.showScreen('title');
  }
  togglePause(force) {
    const g = this.g;
    if (g.state !== 'playing') return;
    const want = force == null ? !g.paused : force;
    g.paused = want;
    if (want) { this.helpReturn = 'pause'; this.showScreen('pause'); } else this.hideScreens();
  }
  showEnd(res) {
    this.save(true);
    this.$('end-title').textContent = res.won ? '🏆 The colony survived!' : '☠️ The colony has fallen';
    const diff = DIFFICULTY[this.g.difficulty].name;
    this.$('end-text').textContent = res.won
      ? `You held out for all ${CFG.TOTAL_DAYS} days on ${diff} and destroyed ${res.kills} of the dead.`
      : `The Command Center fell on day ${res.day} (${diff}). ${res.kills} zombies were put down before the end.`;
    this.showScreen('end');
  }
  setSpeed(s) {
    const g = this.g;
    if (s === 0) { this.togglePause(true); return; }
    g.speed = s;
    for (const b of this.$('speed').querySelectorAll('button')) b.classList.toggle('on', +b.dataset.speed === s);
  }

  // ----------------------------------------------------------- persistence
  hasSave() { try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; } }
  save(clear) {
    try {
      if (clear || this.g.state !== 'playing') localStorage.removeItem(CFG.SAVE_KEY);
      else localStorage.setItem(CFG.SAVE_KEY, this.g.serialize());
    } catch (e) { /* storage unavailable */ }
  }

  // ------------------------------------------------------------ placement
  startPlace(type) {
    const g = this.g;
    if (g.state !== 'playing') return;
    if (g.placing && g.placing.type === type) { this.cancelPlace(); return; }
    g.clearSelection();
    g.placing = { type, x: null, y: null, line: false, anchor: null };
    for (const t in this.bbtns) this.bbtns[t].classList.toggle('on', t === type);
    this.placeBar.classList.remove('hidden');
    this.panel.classList.add('hidden');
    this.$('place-line').classList.toggle('hidden', !BUILDINGS[type].wall);
    this.$('place-line').classList.remove('on');
    this.$('place-ok').classList.toggle('hidden', !!BUILDINGS[type].wall);
    this.updatePlaceInfo();
  }
  cancelPlace() {
    this.g.placing = null;
    for (const t in this.bbtns) this.bbtns[t].classList.remove('on');
    this.placeBar.classList.add('hidden');
  }
  confirmPlace() {
    const p = this.g.placing;
    if (!p || p.x == null) { this.toast('Tap the map to choose a spot first', 'warn'); return; }
    if (this.g.tryBuild(p.type, p.x, p.y)) {
      this.flashCost();
      p.x = p.y = null;
      if (this.g.buildBlocker(p.type)) this.cancelPlace();   // can't afford another: leave placement mode
      else this.updatePlaceInfo();
    } else this.updatePlaceInfo();
  }
  placeLine(ax, ay, bx, by) {
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx - dy, x = ax, y = ay, n = 0, built = 0;
    for (;;) {
      if (this.g.tryBuild('wall', x, y, true)) built++;
      if (x === bx && y === by) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (++n > 200) break;
    }
    if (built) this.flashCost(); else this.toast('Could not build the wall line', 'warn');
  }
  updatePlaceInfo() {
    const g = this.g, p = g.placing;
    if (!p) return;
    const def = BUILDINGS[p.type];
    let html = `<b>${def.icon} ${def.name}</b> <span class="muted">${U.costStr(def.cost)}</span> — ${def.desc}`;
    if (def.wall) {
      html += p.line ? '<br><span class="good">Line mode: tap the start, then the end.</span>' : '<br>Tap the map to place walls one by one.';
    } else if (p.x == null) {
      html += '<br>Tap the map to choose a spot.';
    } else {
      const c = g.canPlace(p.type, p.x, p.y);
      const blocker = g.buildBlocker(p.type);
      if (!c.ok) html += `<br><span class="bad">${c.reason}</span>`;
      else if (blocker) html += `<br><span class="bad">${blocker}</span>`;
      else {
        const y = g.previewYield(p.type, p.x, p.y);
        html += y != null ? `<br><span class="good">Yield here: +${y} ${def.yields.res}/day</span>` : '<br><span class="good">Good spot. Tap ✓ or tap the ghost again to build.</span>';
      }
    }
    this.placeInfo.innerHTML = html;
  }
  flashCost() { this.updateHud(true); }

  // ------------------------------------------------------------ selection
  selectArmy() {
    const g = this.g;
    if (!g.units.length) { this.toast('No units. Build a Barracks to train some.', 'warn'); return; }
    this.cancelPlace();
    g.selectUnits(g.units.map((u) => u.id));
    this.toast('Army selected — tap the ground to move it.', 'info');
  }
  goHome() { if (this.g.cc) this.r.centerOnTile(this.g.cc.cx, this.g.cc.cy); }

  renderPanel(force) {
    const g = this.g;
    const b = g.selectedBuilding(), us = g.selectedUnits();
    if (!b && !us.length) { this.panel.classList.add('hidden'); this.panelKey = ''; return; }
    if (g.placing) return;
    this.panel.classList.remove('hidden');
    let key, html;
    if (b) {
      const def = BUILDINGS[b.type];
      key = `b${b.id}:${Math.round(b.hp)}:${b.queue.join()}:${Math.floor(b.trainT)}`;
      if (!force && key === this.panelKey) return;
      html = `<h3>${def.icon} ${def.name}<button class="x" data-act="close">✕</button></h3>`;
      html += `<div class="hp"><div style="width:${(b.hp / b.maxHp * 100).toFixed(0)}%"></div></div>`;
      html += `<div class="muted">${def.desc}</div>`;
      if (def.yields) html += `<div>Yield: <b>+${b.yield} ${def.yields.res}/day</b></div>`;
      if (def.attack) html += `<div>Range ${def.attack.range} · ${def.attack.dmg} damage</div>`;
      if (def.trains) {
        html += '<div class="row">';
        for (const t of def.trains) { const u = UNITS[t]; html += `<button data-act="train" data-type="${t}">${u.icon} ${u.name} <small class="muted">${U.costStr(u.cost)}</small></button>`; }
        html += '</div>';
        if (b.queue.length) {
          const cur = UNITS[b.queue[0]];
          html += `<div class="q">Training ${cur.name} (${b.queue.length} queued)<div class="bar"><div style="width:${(b.trainT / cur.train * 100).toFixed(0)}%"></div></div></div>`;
        }
      }
      if (!def.fixed) html += `<div class="row"><button data-act="demolish">🗑 Demolish (50% back)</button></div>`;
    } else {
      key = `u${us.map((u) => u.id + ':' + Math.round(u.hp)).join(',')}`;
      if (!force && key === this.panelKey) return;
      if (us.length === 1) {
        const u = us[0], def = UNITS[u.type];
        html = `<h3>${def.icon} ${def.name}<button class="x" data-act="close">✕</button></h3>`;
        html += `<div class="hp"><div style="width:${(u.hp / u.maxHp * 100).toFixed(0)}%"></div></div>`;
        html += `<div class="muted">${def.desc} Range ${def.range}. Tap the ground to move.</div>`;
      } else {
        const counts = {};
        for (const u of us) counts[u.type] = (counts[u.type] || 0) + 1;
        html = `<h3>🪖 ${us.length} units<button class="x" data-act="close">✕</button></h3>`;
        html += `<div class="muted">${Object.keys(counts).map((t) => `${counts[t]} ${UNITS[t].name}`).join(', ')}. Tap the ground to move them.</div>`;
      }
    }
    this.panelKey = key;
    this.panel.innerHTML = html;
    for (const btn of this.panel.querySelectorAll('button')) {
      btn.onclick = () => {
        const act = btn.dataset.act;
        if (act === 'close') g.clearSelection();
        else if (act === 'demolish') g.demolish(b);
        else if (act === 'train') { if (g.train(b, btn.dataset.type)) this.renderPanel(true); }
      };
    }
  }

  // ---------------------------------------------------------------- toasts
  toast(text, kind, where) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = text;
    if (where) {
      el.classList.add('jump');
      el.textContent += ' (tap to view)';
      el.onclick = () => { this.r.centerOnTile(where.cx != null ? where.cx : where.x, where.cy != null ? where.cy : where.y); el.remove(); };
    }
    this.toastEl.appendChild(el);
    while (this.toastEl.children.length > 4) this.toastEl.removeChild(this.toastEl.firstChild);
    const life = kind === 'danger' || kind === 'warn' ? 7000 : 5500;
    setTimeout(() => el.classList.add('fade'), life);
    setTimeout(() => el.remove(), life + 700);
  }

  // ------------------------------------------------------------------ hud
  updateHud(force) {
    const g = this.g;
    if (g.state !== 'playing' && !force) return;
    const $ = this.$;
    const setRes = (id, v, rate) => {
      const el = $(id); el.querySelector('span').textContent = U.fmt(v);
      const s = el.querySelector('small'); if (s) s.textContent = rate ? `+${rate}` : '';
    };
    setRes('r-gold', g.res.gold, g.rates.gold); setRes('r-wood', g.res.wood, g.rates.wood); setRes('r-stone', g.res.stone, g.rates.stone);
    const f = $('r-food'); f.querySelector('span').textContent = (g.rates.food >= 0 ? '+' : '') + g.rates.food; f.classList.toggle('bad', g.rates.food < 0);
    const w = $('r-workers'); w.querySelector('span').textContent = `${g.workers.cap - g.workers.used}/${g.workers.cap}`; w.classList.toggle('bad', g.workers.cap - g.workers.used <= 0);
    const frac = g.dayFrac;
    $('day').textContent = `Day ${Math.min(g.day, CFG.TOTAL_DAYS)}/${CFG.TOTAL_DAYS} ${frac > 0.6 ? '🌙' : '☀️'}`;
    $('daybar').firstElementChild.style.width = (frac * 100).toFixed(1) + '%';
    const hb = $('horde-bar');
    const alive = g.hordeAlive, nh = g.nextHorde;
    if (alive > 0) { hb.textContent = `🧟 Horde attacking · ${alive} left`; hb.classList.remove('calm'); }
    else if (nh) { const d = nh.day - g.day, from = nh.final ? 'ALL SIDES' : g.sideName(nh.sides); hb.textContent = d <= 0 ? `⚠️ Horde tonight · ${from}` : `Next horde: day ${nh.day} · ${from} · ${d}d`; hb.classList.toggle('calm', d > 1); }
    else { hb.textContent = 'No more hordes — survive the night!'; hb.classList.add('calm'); }
    for (const t in this.bbtns) this.bbtns[t].classList.toggle('off', !!g.buildBlocker(t));
  }

  tick(dt) {
    if (this.g.state !== 'playing') return;
    this.tickT += dt; this.miniT += dt;
    if (this.tickT >= 0.25) { this.tickT = 0; this.updateHud(); this.renderPanel(false); if (this.g.placing) this.updatePlaceInfo(); }
    if (this.miniT >= 0.33) { this.miniT = 0; this.r.drawMinimap(this.minimap); }
  }
}
