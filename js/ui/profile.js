// Persistent player profile in localStorage: settings, unlocked maps, high
// scores, achievements, weekly challenge attempts and the in-progress games
// (ironman: one save per game, written on "Save & Quit" and autosave).
const KEY = 'billions-profile-v2';
const SAVE_PREFIX = 'billions-save-v2:';

const DEFAULTS = {
  settings: { sound: true, music: true, volume: 0.7, showHp: false, visibleAlerts: false, fastForward: false, flat: false, edgeScroll: false },
  unlocked: ['FA'], bestFactor: {}, scores: [], achievements: {}, lifetimeKills: 0, weekly: {}, saves: [],
};

export class Profile {
  constructor() {
    this.data = structuredClone(DEFAULTS);
    try { const raw = localStorage.getItem(KEY); if (raw) this.data = deepMerge(structuredClone(DEFAULTS), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  }
  get settings() { return this.data.settings; }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- games
  listSaves() { return this.data.saves.slice().sort((a, b) => b.at - a.at); }
  writeGame(id, meta, state) {
    try {
      localStorage.setItem(SAVE_PREFIX + id, JSON.stringify(state));
      this.data.saves = this.data.saves.filter((s) => s.id !== id);
      this.data.saves.push({ id, at: Date.now(), ...meta });
      this.save();
      return true;
    } catch (e) {
      // Out of space: drop the oldest other save and retry once.
      const others = this.listSaves().filter((s) => s.id !== id);
      if (others.length) { this.deleteGame(others[others.length - 1].id); return this.writeGame(id, meta, state); }
      return false;
    }
  }
  readGame(id) { try { return JSON.parse(localStorage.getItem(SAVE_PREFIX + id)); } catch (e) { return null; } }
  deleteGame(id) { try { localStorage.removeItem(SAVE_PREFIX + id); } catch (e) { /* ignore */ } this.data.saves = this.data.saves.filter((s) => s.id !== id); this.save(); }

  // ---------------------------------------------------------------- results
  recordResult(r) {
    this.data.scores.push(r);
    this.data.scores.sort((a, b) => b.score - a.score);
    this.data.scores = this.data.scores.slice(0, 50);
    this.save();
  }
  unlock(theme) { if (!this.data.unlocked.includes(theme)) { this.data.unlocked.push(theme); this.save(); return true; } return false; }
  achieve(id) { if (this.data.achievements[id]) return false; this.data.achievements[id] = Date.now(); this.save(); return true; }
}

function deepMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
