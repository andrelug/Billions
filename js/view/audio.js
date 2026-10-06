// Sound effects, music and ambience. Each sound key plays the file listed for
// it in assets/audio/manifest.json, otherwise a short synthesized placeholder.
// Sounds are rate-limited per key and attenuated by distance from the camera.
// The manifest's "music" and "ambience" objects list streamed loops.
const SYNTH = {
  bow:        { type: 'noise', dur: 0.08, f: 2400, q: 1.2, vol: 0.18 },
  rifle:      { type: 'noise', dur: 0.12, f: 1200, q: 0.7, vol: 0.28 },
  sniper:     { type: 'noise', dur: 0.22, f: 900, q: 0.5, vol: 0.32 },
  mg:         { type: 'noise', dur: 0.06, f: 1500, q: 0.8, vol: 0.2 },
  ballista:   { type: 'tone', dur: 0.14, f: 220, f2: 90, wave: 'triangle', vol: 0.25 },
  rocket:     { type: 'noise', dur: 0.35, f: 400, q: 0.6, vol: 0.3 },
  explosion:  { type: 'noise', dur: 0.5, f: 180, q: 0.4, vol: 0.4 },
  flame:      { type: 'noise', dur: 0.25, f: 700, q: 0.3, vol: 0.15 },
  zap:        { type: 'tone', dur: 0.18, f: 1400, f2: 300, wave: 'sawtooth', vol: 0.12 },
  hit:        { type: 'noise', dur: 0.05, f: 600, q: 1, vol: 0.12 },
  groan:      { type: 'tone', dur: 0.4, f: 110, f2: 70, wave: 'sawtooth', vol: 0.08 },
  die:        { type: 'tone', dur: 0.25, f: 160, f2: 60, wave: 'square', vol: 0.08 },
  build:      { type: 'tone', dur: 0.1, f: 520, f2: 640, wave: 'square', vol: 0.12 },
  complete:   { type: 'chord', dur: 0.35, notes: [523, 659, 784], vol: 0.12 },
  research:   { type: 'chord', dur: 0.5, notes: [440, 554, 659, 880], vol: 0.12 },
  click:      { type: 'tone', dur: 0.04, f: 900, f2: 900, wave: 'square', vol: 0.06 },
  gate:       { type: 'tone', dur: 0.22, f: 150, f2: 110, wave: 'triangle', vol: 0.1 },
  error:      { type: 'tone', dur: 0.15, f: 180, f2: 140, wave: 'square', vol: 0.12 },
  alert:      { type: 'chord', dur: 0.45, notes: [880, 660, 880], seq: true, vol: 0.14 },
  horde:      { type: 'chord', dur: 1.4, notes: [98, 104, 147], vol: 0.25 },
  victory:    { type: 'chord', dur: 1.6, notes: [523, 659, 784, 1046], seq: true, vol: 0.18 },
  defeat:     { type: 'chord', dur: 1.6, notes: [392, 311, 262, 196], seq: true, vol: 0.18 },
};

// New sound keys that borrow a placeholder until their own file exists.
// Keys missing from both lists stay silent until a file is added.
const FALLBACK = { collapse: 'explosion', infect: 'groan' };

// Music and ambience (see ASSETS.md). Moods: menu, calm, tension, swarm,
// final, victory, defeat. Ambience: one loop per map id (FA, BR, TM, AL, DS, VO).
const MUSIC_VOL = 0.5, AMB_VOL = 0.3, FADE = 2.5;
const ONCE = new Set(['victory', 'defeat']);
// A mood without its own tracks borrows the closest one until they exist.
const MOOD_FALLBACK = { final: 'swarm', swarm: 'tension', tension: 'calm' };

// A tenth of a second of silence, played once inside a tap so that Safari
// lets each music element start later without one.
function silentWav() {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.buffers = new Map();
    this.enabled = true; this.volume = 0.7;
    this.last = new Map();       // key -> time last played (rate limit)
    this.listener = { x: 0, y: 0, scale: 40, W: 800, H: 600 };
    this.files = null;           // assets/audio/manifest.json once loaded
    this.lists = { music: {}, ambience: {} };
    this.musicOn = true; this.moodName = null; this.ambName = null; this.musicCh = null; this.ambCh = null;
    this.pool = { music: [], amb: [] };   // two <audio> elements per channel, for crossfades
    try { const v = localStorage.getItem('billions-audio'); if (v) { const o = JSON.parse(v); this.enabled = o.enabled !== false; this.volume = o.volume ?? 0.7; } } catch (e) { /* ignore */ }
    // The track list is fetched right away so the first tap can start the menu music.
    this.loadManifest();
    // Browsers, Safari above all, only start sound inside a tap, click or key
    // press, and iOS ignores the start of a touch. Every such event unlocks
    // whatever is still locked, so a refused first attempt is retried.
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => { if (this.ctx) { if (document.hidden) this.ctx.suspend(); else this.ctx.resume().catch(() => {}); } });
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Music elements are made once and reused: Safari remembers per element
    // that a tap allowed it to play.
    for (const kind of ['music', 'amb']) for (let i = 0; i < 2; i++) {
      const el = new window.Audio(), gain = this.ctx.createGain();
      el.preload = 'auto'; gain.gain.value = 0;
      try { this.ctx.createMediaElementSource(el).connect(gain); gain.connect(this.master); } catch (e) { continue; }
      el._gain = gain; el._file = null; el._unlocked = false;
      this.pool[kind].push(el);
    }
    this.decodeSounds();
    this.refreshMusic();
  }

  // Called from every tap, click and key press.
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    for (const el of [...this.pool.music, ...this.pool.amb]) {
      if (el._unlocked) continue;
      if (el._file) { el.play().then(() => { el._unlocked = true; }).catch(() => {}); continue; }
      if (!this.silent) this.silent = silentWav();
      el.src = this.silent;
      el.play().then(() => { el._unlocked = true; if (!el._file) el.pause(); }).catch(() => {});
    }
  }

  async loadManifest() {
    try {
      const res = await fetch('assets/audio/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      this.files = await res.json();
      this.lists.music = this.files.music || {}; this.lists.ambience = this.files.ambience || {};
      this.decodeSounds();
      this.refreshMusic();
    } catch (e) { /* no audio files: synth only */ }
  }

  // One-shot sounds are decoded once both the manifest and the audio context
  // exist. A key may list several files; each play picks one at random.
  decodeSounds() {
    if (!this.ctx || !this.files || this.decoded) return;
    this.decoded = true;
    for (const key in this.files) {
      if (key === 'music' || key === 'ambience') continue;
      for (const file of [].concat(this.files[key])) {
        if (typeof file !== 'string') continue;
        fetch('assets/audio/' + file).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b))
          .then((buf) => { const list = this.buffers.get(key) || []; list.push(buf); this.buffers.set(key, list); }).catch(() => {});
      }
    }
  }

  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? this.volume : 0; this.persist(); this.refreshMusic(); }
  setVolume(v) { this.volume = v; if (this.master && this.enabled) this.master.gain.value = v; this.persist(); }
  persist() { try { localStorage.setItem('billions-audio', JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch (e) { /* ignore */ } }

  // Plays `key`. If (x,y) world tile position is given, volume falls off with
  // distance from the screen centre and is muted far off-screen.
  play(key, x, y, minGap = 0.05) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(key) || -1) < minGap) return;
    let vol = 1;
    if (x != null) {
      const L = this.listener, dx = (x - L.x) * L.scale, dy = (y - L.y) * L.scale;
      const d = Math.hypot(dx, dy) / Math.max(L.W, L.H);
      if (d > 1.2) return;
      vol = Math.max(0, 1 - d * 0.8) * Math.min(1, L.scale / 30);
    }
    this.last.set(key, now);
    let bufs = this.buffers.get(key);
    if (!bufs && !SYNTH[key] && FALLBACK[key]) { key = FALLBACK[key]; bufs = this.buffers.get(key); }
    const buf = bufs && bufs[(Math.random() * bufs.length) | 0];
    if (buf) { const src = this.ctx.createBufferSource(); src.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol; src.connect(g).connect(this.master); src.start(); return; }
    const s = SYNTH[key]; if (!s) return;
    this.synth(s, vol);
  }

  // Plays the first of `keys` that has a file (voice lines have no
  // synthesized placeholder, so nothing plays until the files exist).
  playFirst(keys, minGap = 1) {
    for (const k of keys) if (this.buffers.has(k)) { this.play(k, null, null, minGap); return; }
  }

  // ------------------------------------------------------------- music
  setMusic(on) { this.musicOn = on; this.refreshMusic(); }
  mood(name) { if (this.moodName === name) return; this.moodName = name; this.refreshMusic(); }
  setAmbience(name) { if (this.ambName === name) return; this.ambName = name; this.refreshMusic(); }
  refreshMusic() {
    if (!this.ctx || !this.pool.music.length) return;
    const on = this.enabled && this.musicOn;
    this.musicCh = this.cue(this.musicCh, on ? this.choose(this.moodList(), this.musicCh) : null, MUSIC_VOL, 'music');
    this.ambCh = this.cue(this.ambCh, on ? this.choose(this.lists.ambience[this.ambName], this.ambCh) : null, AMB_VOL, 'amb');
  }
  moodList() {
    let m = this.moodName;
    while (m && !this.lists.music[m]) m = MOOD_FALLBACK[m];
    return m ? this.lists.music[m] : null;
  }
  // A mood may list several files: the current one keeps playing while it
  // belongs to the mood, otherwise one is picked at random.
  choose(list, cur, avoid) {
    if (!list) return null;
    const files = Array.isArray(list) ? list : [list];
    if (cur && !avoid && files.includes(cur.file)) return cur.file;
    const pool = files.length > 1 && avoid ? files.filter((f) => f !== avoid) : files;
    return pool[(Math.random() * pool.length) | 0];
  }
  // Crossfades a channel to `file` (null fades it out) on the element of its
  // pair that is not playing. Returns the channel.
  cue(ch, file, vol, kind) {
    if (ch && ch.file === file) return ch;
    if (ch) this.fadeOut(ch);
    if (!file) return null;
    const pair = this.pool[kind], el = pair.find((e) => !ch || e !== ch.el) || pair[0];
    if (!el) return null;
    clearTimeout(el._stop);
    const gain = el._gain, now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(vol, now + FADE);
    const list = kind === 'music' ? this.moodList() : this.lists.ambience[this.ambName];
    const many = Array.isArray(list) && list.length > 1, once = kind === 'music' && ONCE.has(this.moodName);
    el._file = file; el.src = 'assets/audio/' + file; el.loop = !many && !once;
    const nc = { file, el, gain };
    // With several tracks, the next one starts when this one ends.
    el.onended = !many ? null : () => {
      if (kind === 'music' && this.musicCh === nc) this.musicCh = this.cue(null, this.choose(this.moodList(), null, file), vol, kind);
      if (kind === 'amb' && this.ambCh === nc) this.ambCh = this.cue(null, this.choose(this.lists.ambience[this.ambName], null, file), vol, kind);
    };
    el.play().then(() => { el._unlocked = true; }).catch(() => {});
    return nc;
  }
  fadeOut(ch) {
    const el = ch.el, now = this.ctx.currentTime, g = ch.gain.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + FADE);
    el.onended = null; el._file = null;
    clearTimeout(el._stop);
    el._stop = setTimeout(() => { if (!el._file) el.pause(); }, FADE * 1000 + 100);
  }

  synth(s, vol) {
    const c = this.ctx, t = c.currentTime, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.001, s.vol * vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    g.connect(this.master);
    if (s.type === 'noise') {
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = s.f; f.Q.value = s.q;
      src.connect(f).connect(g); src.start(t, Math.random() * 0.5, s.dur + 0.05);
    } else if (s.type === 'tone') {
      const o = c.createOscillator(); o.type = s.wave; o.frequency.setValueAtTime(s.f, t); o.frequency.exponentialRampToValueAtTime(s.f2, t + s.dur);
      o.connect(g); o.start(t); o.stop(t + s.dur + 0.05);
    } else if (s.type === 'chord') {
      s.notes.forEach((n, i) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = n;
        const start = s.seq ? t + i * (s.dur / s.notes.length) : t;
        o.connect(g); o.start(start); o.stop(t + s.dur + 0.05);
      });
    }
  }
}
