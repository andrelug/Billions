import { $, el, clear } from './dom.js';
import { THEMES, THEME_ORDER, POPULATIONS, POP_ORDER, DURATIONS, DURATION_ORDER, scoreFactor } from '../data/maps.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { fmt } from '../core/util.js';

// Full-screen menus. Each `show*` builds its screen into #scr-generic or a
// dedicated section and wires the buttons back to the app.
export class Screens {
  constructor(app) { this.app = app; }

  show(id) {
    $('overlay').classList.remove('hidden');
    for (const s of document.querySelectorAll('#overlay .screen')) s.classList.add('hidden');
    $(id).classList.remove('hidden');
  }
  hide() { $('overlay').classList.add('hidden'); }

  generic(title, body, buttons) {
    $('gen-title').textContent = title;
    const b = clear($('gen-body')); b.append(body);
    const btns = clear($('gen-btns'));
    for (const [label, fn, cls] of buttons) btns.append(el('button', { class: 'big ' + (cls || ''), onclick: fn }, label));
    this.show('scr-generic');
  }

  title() {
    const app = this.app, p = app.profile;
    const saves = p.listSaves();
    $('t-continue').classList.toggle('hidden', !saves.length);
    $('t-continue').onclick = () => saves.length === 1 ? app.continueGame(saves[0].id) : this.loadList();
    $('t-survival').onclick = () => this.setup();
    $('t-challenge').onclick = () => this.weekly();
    $('t-campaign').onclick = () => this.campaign();
    $('t-scores').onclick = () => this.scores();
    $('t-help').onclick = () => this.help(() => this.title());
    $('t-settings').onclick = () => this.settings(() => this.title());
    this.show('scr-title');
  }

  loadList() {
    const app = this.app, body = el('div', { class: 'list' });
    for (const s of app.profile.listSaves()) {
      body.append(el('div', { class: 'save-row' },
        el('div', {}, el('b', {}, s.name), el('div', { class: 'muted small' }, `${s.label} · Day ${s.day} · ${new Date(s.at).toLocaleString()}`)),
        el('button', { class: 'primary', onclick: () => app.continueGame(s.id) }, 'Continue'),
        el('button', { class: 'danger', onclick: () => app.confirmDialog(`Delete "${s.name}"? This cannot be undone.`, () => { app.profile.deleteGame(s.id); this.loadList(); }) }, '🗑')));
    }
    this.generic('Continue', body.children.length ? body : el('p', { class: 'muted' }, 'No games in progress.'), [['Back', () => this.title()]]);
  }

  setup() {
    const app = this.app, p = app.profile;
    const st = this.setupState = this.setupState || { theme: p.data.unlocked[p.data.unlocked.length - 1] || 'FA', pop: 'medium', days: 100, mayors: true, seed: '' };
    const body = clear($('setup-body'));
    const opts = (label, items, cur, fn) => {
      body.append(el('div', { class: 'setup-label' }, label));
      const row = el('div', { class: 'opts' });
      for (const it of items) row.append(el('button', { class: it.id === cur ? 'on' : '', disabled: it.locked, onclick: () => { fn(it.id); this.setup(); } }, it.name, el('small', {}, it.sub)));
      body.append(row);
    };
    opts('Map', THEME_ORDER.map((t) => {
      const th = THEMES[t], locked = !p.data.unlocked.includes(t);
      const u = th.unlock;
      return { id: t, name: th.name, sub: locked ? `🔒 Win ${THEMES[u.theme].name} at ${Math.round(u.score * 100)}%+` : `${Math.round(th.score * 100)}% · ${th.desc}`, locked };
    }), st.theme, (v) => { st.theme = v; });
    opts('Infected population', POP_ORDER.map((k) => ({ id: k, name: POPULATIONS[k].name, sub: `${Math.round(POPULATIONS[k].factor * 100)}% infected` })), st.pop, (v) => { st.pop = v; });
    opts('Days to survive', DURATION_ORDER.map((d) => ({ id: d, name: `${d} days`, sub: DURATIONS[d].label })), st.days, (v) => { st.days = v; });
    opts('Mayors', [{ id: true, name: 'On', sub: 'Elect mayors at 30/200/600/1200 colonists' }, { id: false, name: 'Off', sub: 'No mayors' }], st.mayors, (v) => { st.mayors = v; });
    const seedIn = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'random', value: st.seed, oninput: (e) => { st.seed = e.target.value.replace(/[^0-9-]/g, ''); } });
    body.append(el('div', { class: 'setup-label' }, 'Map seed (optional)'), seedIn);
    body.append(el('div', { class: 'mult' }, `Score factor ${Math.round(scoreFactor(st.theme, st.pop, st.days) * 100)}%`));
    $('setup-back').onclick = () => this.title();
    $('setup-go').onclick = () => app.newGame({ mode: 'survival', theme: st.theme, pop: st.pop, days: st.days, mayors: st.mayors, seed: st.seed ? +st.seed : undefined });
    this.show('scr-setup');
  }

  // Weekly community challenge: same map for everyone this week, one attempt.
  weekly() {
    const app = this.app, w = weekInfo();
    const done = app.profile.data.weekly[w.id];
    const body = el('div', {},
      el('p', {}, `Week ${w.week} of ${w.year}: ${THEMES[w.theme].name}, Medium population, 50 days (final swarm on day 46).`),
      el('p', { class: 'muted' }, `Everyone playing this week gets the same map. You have one attempt. The score factor is fixed at ${Math.round(THEMES[w.theme].score * 100)}%. Scores are kept on this device (there is no online leaderboard).`),
      done ? el('p', { class: done.score != null ? 'good' : 'warn' }, done.score != null ? `Your result this week: ${fmt(done.score)} points (${done.won ? 'survived' : 'fell on day ' + done.day}).` : 'Your attempt is in progress.') : null);
    const btns = [['Back', () => this.title()]];
    if (!done) btns.push(['Start challenge', () => app.newGame({ mode: 'challenge', theme: w.theme, pop: 'medium', days: 50, mayors: true, seed: w.seed, fixedScore: THEMES[w.theme].score, week: w.id }), 'primary']);
    btns.push(['50 Days Challenge', () => this.fifty()]);
    this.generic('Weekly Challenge', body, btns);
  }

  fifty() {
    const app = this.app;
    this.generic('The 50 Days Challenge', el('div', {},
      el('p', {}, 'A fast survival game: 50 days to build a colony before the final swarm arrives on day 46. Fewer infected roam the map, and neighbouring colonies send reinforcements every few days.'),
      el('p', { class: 'muted' }, 'Map: The Dark Moorland. Score factor 100%.')),
      [['Back', () => this.weekly()], ['Start', () => app.newGame({ mode: 'fifty', theme: 'BR', pop: 'low', days: 50, mayors: true, fixedScore: 1.0 }), 'primary']]);
  }

  campaign() {
    this.generic('Campaign', el('div', {},
      el('p', {}, 'The story campaign (colony, swarm and hero missions on an empire map with a research tree) is not in this version yet.'),
      el('p', { class: 'muted' }, 'Survival, the Weekly Challenge and the 50 Days Challenge are fully playable.')), [['Back', () => this.title()]]);
  }

  scores() {
    const app = this.app, p = app.profile.data;
    const t = el('table', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Score'), el('th', {}, 'Map'), el('th', {}, 'Result'), el('th', {}, 'Factor')));
    p.scores.slice(0, 20).forEach((s, i) => t.append(el('tr', {}, el('td', {}, i + 1), el('td', {}, fmt(s.score)), el('td', {}, `${THEMES[s.theme]?.name || s.theme}${s.mode !== 'survival' ? ' (' + s.mode + ')' : ''}`), el('td', {}, s.won ? `Won (${s.days}d)` : `Day ${s.day}/${s.days}`), el('td', {}, Math.round(s.factor * 100) + '%'))));
    const ach = el('div', { class: 'ach' });
    for (const a of ACHIEVEMENTS) ach.append(el('div', { class: 'ach-row' + (p.achievements[a.id] ? ' got' : '') }, el('b', {}, (p.achievements[a.id] ? '🏆 ' : '🔒 ') + a.name), el('span', { class: 'muted small' }, a.desc)));
    const body = el('div', {}, p.scores.length ? t : el('p', { class: 'muted' }, 'No finished games yet.'), el('h3', {}, `Achievements (${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length})`), el('p', { class: 'muted small' }, `Infected killed in total: ${fmt(p.lifetimeKills)}`), ach);
    this.generic('High Scores', body, [['Back', () => this.title()]]);
  }

  help(back) {
    const H = (t) => el('h3', {}, t), P = (t) => el('p', {}, t);
    const body = el('div', {},
      H('Goal'), P('Keep the Command Center alive until the last day. If it is destroyed or infected, the colony falls. Ten swarms attack during a game; each is announced 8 hours ahead with its direction. The final swarm comes from every side, and everything left on the map joins it.'),
      H('Energy grid'), P('Everything must be built inside the energy grid (the blue area). The Command Center and Tesla Towers project it. Mills and Power Plants produce energy; most buildings consume it. Losing a Tesla Tower can cut power to everything behind it.'),
      H('Economy'), P('Gold, wood, stone, iron and oil are stockpiled and paid every 8 game hours (30 s). Storage is limited; Warehouses add more. Workers, food and energy are capacities: a building needs enough free capacity to be placed. Dwellings give colonists, workers and gold. Food comes from hunters, fishermen and farms.'),
      H('Research'), P('Build a Wood Workshop, then a Stone Workshop and a Foundry, to research new buildings, units and wonders. Losing a workshop loses its research.'),
      H('Infection'), P('Infected drain a building\'s yellow barrier first. Once it is gone, the next hit infects the building: it stops working and its colonists and workers turn into infected. Repair infected buildings or demolish them. Walls, gates, towers and traps cannot be infected, only destroyed.'),
      H('Noise'), P('Every shot makes noise. Infected hear noise from up to four times their sight range and come to investigate. Rangers are quiet, Soldiers are loud, rockets are deafening. Infected attacking walls make noise too.'),
      H('Units'), P('Tap a unit to select it, tap the ground to move. Moving units ignore enemies; use Attack to attack-move. Hold keeps position, Patrol walks back and forth, Chase hunts infected. Tap a tower to put Rangers, Soldiers or Snipers inside for extra range and protection. Rangers, Soldiers and Snipers become veterans with experience.'),
      H('Touch controls'), P('Drag to pan, pinch to zoom. Long-press the ground with units selected to attack-move. Use the Select button to drag a selection box. Hold a group button to assign the selection; tap it to recall, tap twice to jump to it. Double-tap a unit to select all units of that type on screen.'),
      H('Keyboard and mouse'), P('Left click selects and places, drag selects, right click commands. Space pauses. Esc cancels or opens the menu. F2 selects the army, Enter the Command Center. Q attack-move, H hold, S stop, P patrol, C chase. Ctrl+1-8 assigns groups, 1-8 recalls. R or Tab rotates gates while placing; otherwise Tab hides the HUD. E shows the energy grid, F4 the flat terrain grid, Alt shows health bars. Arrow keys pan, wheel zooms. With a training building selected: Q Ranger, W Soldier, R Sniper, U Pyro, I Titan, O Rocketeer, P Mutant.'),
      H('Villages of Doom'), P('Clusters of infected buildings that spawn more infected when disturbed and send raids from day 20. Destroy them for loot.'),
      H('Mayors'), P('At 30, 200, 600 and 1200 colonists you elect a mayor who brings units, buildings, resources, research or lasting bonuses.'),
      H('Saving'), P('Survival is ironman: the game is saved when you leave (Save & Quit) and periodically. A lost game deletes its save.'));
    this.generic('How to Play', body, [['Back', back]]);
  }

  settings(back) {
    const app = this.app, s = app.profile.settings;
    const toggle = (key, label, sub) => el('label', { class: 'setting' }, el('input', { type: 'checkbox', checked: s[key], onchange: (e) => { s[key] = e.target.checked; app.profile.save(); app.applySettings(); } }), el('span', {}, el('b', {}, label), el('small', { class: 'muted' }, sub)));
    const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, oninput: (e) => { s.volume = +e.target.value; app.profile.save(); app.applySettings(); } });
    const body = el('div', { class: 'settings' },
      toggle('sound', 'Sound', 'Sound effects'), el('label', { class: 'setting' }, el('span', {}, el('b', {}, 'Volume')), vol),
      toggle('showHp', 'Always show health bars', 'Otherwise bars show only when damaged (hold Alt on desktop)'),
      toggle('visibleAlerts', 'Show visible alerts', 'Also alert for attacks that are on screen'),
      toggle('flat', 'Flat mode', 'Draw terrain as flat colours to see gaps clearly'),
      toggle('edgeScroll', 'Edge scrolling', 'Desktop: move the camera when the mouse touches the screen edge'),
      toggle('fastForward', 'Allow fast-forward', 'Adds 2x and 3x speed buttons. The original game has no fast-forward.'));
    this.generic('Settings', body, [['Back', back]]);
  }

  pause() {
    const app = this.app;
    this.generic('Paused', el('p', { class: 'muted' }, `${app.game.theme.name} · Day ${app.game.day}/${app.game.totalDays}`), [
      ['Resume', () => app.pause(false), 'primary'],
      ['How to Play', () => this.help(() => this.pause())],
      ['Settings', () => this.settings(() => this.pause())],
      ['Save & Quit', () => app.saveAndQuit()],
      ['Abandon game', () => app.confirmDialog('Abandon this game? It counts as a loss and the save is deleted.', () => app.abandon()), 'danger'],
    ]);
  }

  end(r, extra) {
    const app = this.app, g = app.game;
    const t = el('table', { class: 'score' });
    for (const [k, v] of r.parts) t.append(el('tr', {}, el('td', {}, k), el('td', {}, fmt(v))));
    t.append(el('tr', {}, el('td', {}, 'Score factor'), el('td', {}, `× ${Math.round(r.factor * 100)}%`)));
    t.append(el('tr', { class: 'total' }, el('td', {}, 'Final score'), el('td', {}, fmt(r.score))));
    const s = g.stats;
    const body = el('div', {},
      el('p', {}, r.reason),
      t,
      el('p', { class: 'muted small' }, `Infected killed ${fmt(s.kills)} · Units lost ${s.unitsLost} · Colonists infected ${s.colonistsInfected} · Max colonists ${fmt(s.maxColonists)} · Buildings built ${s.built}`),
      ...(extra || []).map((x) => el('p', { class: 'good' }, x)));
    this.generic(r.won ? '🏆 The colony survived!' : '☠ The colony has fallen', body, [['Title', () => app.toTitle(), 'primary'], ['High Scores', () => this.scores()]]);
  }
}

// ISO week number; the weekly challenge map rotates through the first five themes.
export function weekInfo(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  const id = `${year}-W${week}`;
  const theme = THEME_ORDER[(year * 53 + week) % 5];
  let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return { id, year, week, theme, seed: h >>> 1 };
}
