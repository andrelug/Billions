import { $, el, clear } from './dom.js';
import { Game } from '../sim/game.js';
import { Renderer } from '../view/render.js';
import { Assets } from '../view/assets.js';
import { Audio } from '../view/audio.js';
import { Input } from './input.js';
import { Controller } from './controller.js';
import { Hud } from './hud.js';
import { Tray } from './tray.js';
import { Panel } from './panel.js';
import { Screens, weekInfo } from './screens.js';
import { Profile } from './profile.js';
import { assetSpecs } from '../data/art.js';
import { applySkin } from './skin.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { THEMES, THEME_ORDER, POPULATIONS } from '../data/maps.js';
import { TERRAIN } from '../data/terrain.js';
import { UNITS } from '../data/units.js';

const TRAIN_KEYS = { q: 'ranger', w: 'soldier', r: 'sniper', u: 'pyro', i: 'titan', o: 'rocketeer', p: 'mutant' };

const AUTOSAVE = 120;   // seconds of real play between autosaves
const SWARM_MUSIC = 150;  // game seconds of swarm music after a swarm arrives, then back to calm

export class App {
  constructor() {
    this.profile = new Profile();
    this.audio = new Audio();
    this.assets = new Assets(assetSpecs());
    this.renderer = new Renderer($('game'), this.assets);
    this.ctrl = new Controller(this);
    this.screens = new Screens(this);
    this.game = null; this.showGrid = false; this.altHp = false; this.ping = null; this.saveT = AUTOSAVE; this.achT = 5;
    this.input = new Input($('game'), this.renderer.cam, {
      onTap: (x, y, e) => this.ctrl.tap(x, y, e),
      onLongPress: (x, y) => this.ctrl.longPress(x, y),
      onSecondary: (x, y) => this.ctrl.secondary(x, y),
      onBox: (x0, y0, x1, y1, e) => this.ctrl.box(x0, y0, x1, y1, e),
      onBoxPreview: (b) => { this.boxPreview = b; },
      onKey: (e) => this.key(e),
      mouseBoxDefault: true,
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Alt') this.altHp = false; if (e.key === 'e' || e.key === 'E') this.holdGrid = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.game && this.game.state === 'playing') { this.autosave(); this.pause(true); } });
    window.addEventListener('pagehide', () => this.autosave());
    this.last = performance.now();
  }

  async boot() {
    this.screens.show('scr-loading');
    await this.assets.load((f) => { $('load-bar').style.width = (f * 100).toFixed(0) + '%'; });
    applySkin(this.assets.manifest);
    this.hud = new Hud(this);
    this.tray = new Tray(this);
    this.panel = new Panel(this);
    this.applySettings();
    this.screens.title();
    requestAnimationFrame((t) => this.frame(t));
  }

  applySettings() {
    const s = this.profile.settings;
    this.audio.setEnabled(s.sound); this.audio.setVolume(s.volume); this.audio.setMusic(s.music !== false);
    if (this.input) this.input.edgeScroll = !!s.edgeScroll;
    if (this.game) {
      this.setFlat(s.flat);
      if (!s.fastForward && this.game.speed > 1) this.game.speed = 1;
    }
    if (this.hud) this.hud.buildRes();
  }

  setFlat(on) {
    const t = this.renderer.terrain; if (!t) return;
    if (on) {
      const pal = this.game.theme.palette, col = {};
      for (const id in TERRAIN) { const k = TERRAIN[id].key; col[id] = pal[k] || (k === 'stone' ? '#a0a098' : k === 'iron' ? '#8a5a40' : k === 'gold' ? '#c8a840' : k === 'oil' ? '#151515' : pal.grass); }
      t.flat = col;
    } else t.flat = null;
    t.cache.clear(); t.bytes = 0;
  }

  // ------------------------------------------------------------- game life
  newGame(settings) {
    const g = new Game();
    this.attach(g);
    g.setup(settings);
    this.gameId = 'g' + Date.now().toString(36);
    if (settings.mode === 'challenge') { this.profile.data.weekly[settings.week] = { started: Date.now() }; this.profile.save(); }
    this.started();
  }

  continueGame(id) {
    const state = this.profile.readGame(id);
    if (!state) { this.toast('That save could not be read', 'warn'); this.profile.deleteGame(id); this.screens.title(); return; }
    const g = new Game();
    this.attach(g);
    try { g.load(state); } catch (e) { console.error(e); this.toast('That save could not be loaded', 'warn'); this.screens.title(); return; }
    this.gameId = id;
    this.started();
  }

  attach(g) {
    this.game = g;
    this.lastKills = 0;
    g.ev.on('msg', (t, k, where) => this.toast(t, k, where));
    g.ev.on('alert', (where, text) => {
      const cam = this.renderer.cam, [sx, sy] = cam.toScreen(where.x, where.y);
      const onScreen = sx > 0 && sy > 0 && sx < cam.W && sy < cam.H;
      if (onScreen && !this.profile.settings.visibleAlerts) return;
      this.toast(`⚠ ${text}`, 'danger', where); this.sound('alert');
    });
    g.ev.on('sound', (k, x, y) => this.audio.play(k, x, y, k === 'mg' || k === 'rifle' || k === 'bow' ? 0.09 : 0.05));
    g.ev.on('end', (r) => this.ended(r));
    g.ev.on('mayor', (offer) => this.panel.mayor(offer));
    g.ev.on('completed', () => this.tray.refresh());
    g.ev.on('tech', () => this.tray.render());
    g.ev.on('swarmWarning', (ev) => { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); this.audio.mood(ev.final ? 'final' : 'tension'); });
    g.ev.on('swarm', (ev) => { this.audio.mood(ev.final ? 'final' : 'swarm'); this.calmAt = ev.final ? null : g.time + SWARM_MUSIC; });
  }

  started() {
    const g = this.game;
    this.renderer.setGame(g);
    this.terrainView = false; $('hud').classList.remove('hidden');
    this.setFlat(this.profile.settings.flat);
    const cam = this.renderer.cam;
    cam.scale = Math.min(window.innerWidth, window.innerHeight) < 600 ? 34 : 44;
    this.goHome();
    this.ctrl.clear(); this.ctrl.placing = null; this.ctrl.groups = [[], [], [], [], [], [], [], []];
    clear($('toasts'));
    $('hud').classList.remove('hidden');
    this.screens.hide();
    this.hud.buildRes(); this.hud.renderGroups();
    this.tray.render();
    this.saveT = AUTOSAVE;
    if (g.mayorOffer) this.panel.mayor(g.mayorOffer);
    this.audio.setAmbience(g.settings.theme);
    this.audio.mood(g.waves.finalSpawned ? 'final' : 'calm'); this.calmAt = null;
    if (g.time < 1) this.toast(`${g.theme.name}: survive ${g.totalDays} days. Build Tents next to the Command Center first.`, 'good');
  }

  saveMeta() {
    const g = this.game, s = g.settings;
    return { name: `${THEMES[s.theme].name}${s.mode !== 'survival' ? ' · ' + (s.mode === 'challenge' ? 'Weekly' : '50 Days') : ''}`, label: `${POPULATIONS[s.pop].name} · ${s.days} days`, day: g.day, mode: s.mode };
  }
  autosave() {
    const g = this.game;
    if (!g || g.state !== 'playing') return;
    const ok = this.profile.writeGame(this.gameId, this.saveMeta(), g.serialize());
    if (!ok) this.toast('Could not save: device storage is full', 'warn');
  }
  saveAndQuit() { this.autosave(); this.toTitle(); }
  abandon() { const g = this.game; if (g && g.state === 'playing') g.endGame(false, 'You abandoned the colony'); }
  toTitle() {
    $('hud').classList.add('hidden');
    this.closeModal();
    if (this.game && this.game.state === 'playing') this.autosave();
    this.game = null;
    this.screens.title();
  }

  ended(r) {
    const g = this.game, p = this.profile, s = g.settings;
    this.audio.mood(r.won ? 'victory' : 'defeat'); this.audio.setAmbience(null); this.calmAt = null;
    this.profile.deleteGame(this.gameId);
    this.syncKills();
    const extra = [];
    p.recordResult({ score: r.score, won: r.won, day: g.day, days: s.days, theme: s.theme, factor: r.factor, mode: s.mode, at: Date.now() });
    if (s.mode === 'challenge' && s.week) { p.data.weekly[s.week] = { score: r.score, won: r.won, day: g.day }; p.save(); }
    if (r.won && s.mode === 'survival') {
      p.data.bestFactor[s.theme] = Math.max(p.data.bestFactor[s.theme] || 0, r.factor);
      for (const t of THEME_ORDER) { const u = THEMES[t].unlock; if (u && u.theme === s.theme && r.factor >= u.score && p.unlock(t)) extra.push(`New map unlocked: ${THEMES[t].name}`); }
      p.save();
    }
    for (const a of ACHIEVEMENTS) {
      const ok = a.check ? a.check(g, r, p) : a.live(g, p);
      if (ok && p.achieve(a.id)) extra.push(`Achievement: ${a.name}`);
    }
    $('hud').classList.add('hidden');
    this.screens.end(r, extra);
  }

  syncKills() {
    const g = this.game; if (!g) return;
    const d = g.stats.kills - this.lastKills;
    if (d > 0) { this.profile.data.lifetimeKills += d; this.lastKills = g.stats.kills; this.profile.save(); }
  }

  // ------------------------------------------------------------- controls
  pause(on) {
    const g = this.game; if (!g || g.state !== 'playing') return;
    g.paused = on;
    if (on) { g.stats.paused = true; this.screens.pause(); } else this.screens.hide();
  }
  setSpeed(v) {
    const g = this.game; if (!g) return;
    if (v === 0) { g.paused = !g.paused; if (g.paused) g.stats.paused = true; return; }
    g.paused = false; g.speed = v;
  }
  goHome() { const g = this.game; if (g && g.cc) this.renderer.cam.center(g.cc.cx, g.cc.cy + 2); }
  jumpToAlert() { const g = this.game; if (g && g.lastAlert) { this.renderer.cam.center(g.lastAlert.x, g.lastAlert.y); this.ping = { x: g.lastAlert.x, y: g.lastAlert.y, t0: performance.now() }; } }
  setSelectMode(on) { this.input.selectMode = on; $('btn-select').classList.toggle('on', on); if (on) this.toast('Drag on the map to select units', 'info'); }
  ack(x, y, what) { this.ping = null; this.game.fx('ring', x, y, 0.6); this.sound('click'); if (what) this.voice(what); }
  sound(k) { this.audio.play(k); }
  // Unit voice lines, as in the original game: voice_<unit>_<what>, else
  // voice_<what>. what = select, move, attack, garrison or pickup.
  voice(what, units) {
    const u = (units || this.ctrl.selectedUnits())[0]; if (!u) return;
    this.audio.playFirst([`voice_${u.type}_${what}`, `voice_${what}`], 1.2);
  }

  onSelection() { this.tray.render(); this.panel.update(0, true); }
  onPlacing() { this.ctrl.updateGhost(); this.tray.render(); this.panel.update(0, true); }

  key(e) {
    const g = this.game, c = this.ctrl;
    if (!g || g.state !== 'playing' || !$('modal').classList.contains('hidden')) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); if (!$('overlay').classList.contains('hidden')) return; this.setSpeed(0); return; }
    if (k === 'Escape') { if (c.placing) c.cancelPlace(); else if (c.targeting) { c.targeting = null; this.onSelection(); } else if (c.sel.size || c.selBuilding) c.clear(); else this.pause(!g.paused); return; }
    if (!$('overlay').classList.contains('hidden')) return;
    if (k === 'Alt') { e.preventDefault(); this.altHp = true; return; }
    if (/^[1-8]$/.test(k)) { const i = +k - 1; if (e.ctrlKey || e.metaKey) { e.preventDefault(); c.assignGroup(i); } else c.recallGroup(i, e.shiftKey); return; }
    const units = c.selectedUnits();
    // Training hotkeys while a Soldiers or Engineering Center is selected.
    const b = c.selBuilding, tk = TRAIN_KEYS[k.toLowerCase()];
    if (b && !c.placing && !units.length && tk && b.def.trains && b.def.trains.includes(tk)) { const why = g.train(b, tk); if (why) this.toast(why, 'warn'); this.onSelection(); return; }
    switch (k.toLowerCase()) {
      case 'f2': e.preventDefault(); c.selectArmy(); break;
      case 'enter': c.setBuilding(g.cc); this.goHome(); break;
      case 'q': case 'a': if (units.length) { c.targeting = 'amove'; this.onSelection(); } break;
      case 'h': if (units.length) { g.unitSys.command(units, { t: 'hold' }); this.onSelection(); } else this.goHome(); break;
      case 's': if (units.length) { g.unitSys.command(units, { t: 'stop' }); this.onSelection(); } break;
      case 'p': if (units.length) { c.targeting = 'patrol'; this.onSelection(); } break;
      case 'c': if (units.length) { g.unitSys.command(units, { t: 'chase' }); this.onSelection(); } break;
      case 'r': if (c.placing) c.rotate(); break;
      case 'tab': e.preventDefault(); if (c.placing) c.rotate(); else $('hud').classList.toggle('hidden'); break;
      case 'f4': e.preventDefault(); this.terrainView = !this.terrainView; this.setFlat(this.terrainView || this.profile.settings.flat); this.showGrid = this.terrainView; break;
      case 'e': this.holdGrid = true; break;
      case 'g': this.showGrid = !this.showGrid; break;
      case '+': case '=': this.renderer.cam.zoomAt(1.2, this.renderer.cam.W / 2, this.renderer.cam.H / 2); break;
      case '-': this.renderer.cam.zoomAt(1 / 1.2, this.renderer.cam.W / 2, this.renderer.cam.H / 2); break;
      case 'delete': if (c.selBuilding) { const why = g.demolish(c.selBuilding); if (why) this.toast(why, 'warn'); } break;
    }
  }

  // ------------------------------------------------------------- dialogs
  toast(t, k, where) { if (this.hud) this.hud.toast(t, k, where); }
  modal(body, buttons, sticky) {
    const m = $('modal'), b = clear($('modal-body')), bt = clear($('modal-btns'));
    b.append(body);
    for (const [label, fn, cls] of buttons) bt.append(el('button', { class: 'big ' + (cls || ''), onclick: () => { this.closeModal(); fn && fn(); } }, label));
    m.classList.remove('hidden');
    m.onclick = (e) => { if (e.target === m && !sticky) this.closeModal(); };
    if (this.game) this.game.modalPause = true;
  }
  closeModal() { $('modal').classList.add('hidden'); if (this.game) this.game.modalPause = false; }
  confirmDialog(text, fn) { this.modal(el('p', {}, text), [['Cancel', null], ['OK', fn, 'danger']]); }

  // ----------------------------------------------------------------- loop
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // Dynamic resolution: drop to 1x pixels when frames run long.
    this.ft = (this.ft || 16) * 0.97 + (now - (this.prevNow || now)) * 0.03; this.prevNow = now;
    if (this.ft > 28 && this.renderer.dpr > 1 && !document.hidden) { this.renderer.maxDpr = 1; this.renderer.resize(); this.ft = 16; }
    const g = this.game;
    if (g) {
      if (!g.modalPause) g.update(dt);
      this.input.update(dt);
      this.ctrl.prune();
      if (this.ctrl.placing) { this.ghostT = (this.ghostT || 0) - dt; if (this.ghostT <= 0) { this.ghostT = 0.3; this.ctrl.updateGhost(); this.tray.renderPlaceBar(); } }
      const sel = this.ctrl.selectedUnits();
      this.renderer.draw({
        dt, sel: new Set([...this.ctrl.sel, ...(this.ctrl.selOther ? [this.ctrl.selOther.id] : [])]), selBuilding: this.ctrl.selBuilding,
        selUnitsRange: sel.length <= 12 ? sel : null, placing: this.ctrl.placing, box: this.boxPreview,
        showGrid: this.showGrid || this.holdGrid, showHp: this.profile.settings.showHp || this.altHp, ping: this.ping,
      });
      const L = this.audio.listener, cam = this.renderer.cam; L.x = cam.x; L.y = cam.y; L.scale = cam.scale; L.W = cam.W; L.H = cam.H;
      if (g.state === 'playing') {
        this.hud.update(dt);
        if (this.calmAt != null && g.time > this.calmAt) { this.calmAt = null; if (this.audio.moodName === 'swarm') this.audio.mood('calm'); }
        this.panel.update(dt);
        this.trayT = (this.trayT || 0) - dt; if (this.trayT <= 0) { this.trayT = 0.5; this.tray.refresh(); }
        if (!g.paused) { this.saveT -= dt; if (this.saveT <= 0) { this.saveT = AUTOSAVE; this.autosave(); } }
        this.achT -= dt;
        if (this.achT <= 0) {
          this.achT = 5; this.syncKills();
          for (const a of ACHIEVEMENTS) if (a.live && !this.profile.data.achievements[a.id] && a.live(g, this.profile) && this.profile.achieve(a.id)) this.toast(`🏆 Achievement: ${a.name}`, 'good');
        }
      }
    } else this.renderer.draw({});
    requestAnimationFrame((t) => this.frame(t));
  }
}
