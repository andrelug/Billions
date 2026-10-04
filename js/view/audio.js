// Sound effects. Each key plays assets/audio/<key>.(mp3|ogg) when listed in
// assets/audio/manifest.json, otherwise a short synthesized placeholder.
// Sounds are rate-limited per key and attenuated by distance from the camera.
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

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.buffers = new Map();
    this.enabled = true; this.volume = 0.7;
    this.last = new Map();       // key -> time last played (rate limit)
    this.listener = { x: 0, y: 0, scale: 40, W: 800, H: 600 };
    this.files = {};
    try { const v = localStorage.getItem('billions-audio'); if (v) { const o = JSON.parse(v); this.enabled = o.enabled !== false; this.volume = o.volume ?? 0.7; } } catch (e) { /* ignore */ }
    const unlock = () => { this.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
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
    this.loadFiles();
  }

  async loadFiles() {
    try {
      const res = await fetch('assets/audio/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      this.files = await res.json();
      for (const key in this.files) {
        fetch('assets/audio/' + this.files[key]).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => this.buffers.set(key, buf)).catch(() => {});
      }
    } catch (e) { /* no audio files: synth only */ }
  }

  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? this.volume : 0; this.persist(); }
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
    const buf = this.buffers.get(key);
    if (buf) { const src = this.ctx.createBufferSource(); src.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol; src.connect(g).connect(this.master); src.start(); return; }
    const s = SYNTH[key]; if (!s) return;
    this.synth(s, vol);
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
