// Procedural placeholder art. Used two ways:
//  1. tools/gen-placeholders.mjs renders these into PNG files under assets/
//     so every sprite exists as a real file the artist can overwrite.
//  2. At runtime, if an image file is missing or fails to load, the same
//     drawing is used so the game never shows a hole.
// Every spec: { key, kind, w, h, color, label, ... } in pixels.

export const PX = 64; // art pixels per map tile

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFor(str) { let a = hash(str); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function label(ctx, text, x, y, size, color) {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 6); ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawPlaceholder(ctx, spec) {
  const { w, h } = spec;
  ctx.clearRect(0, 0, w, h);
  const draw = DRAW[spec.kind] || DRAW.generic;
  draw(ctx, spec);
}

const DRAW = {
  terrain(ctx, s) {
    const rnd = rngFor(s.key), { w, h } = s, base = s.color;
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.25); ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2 + rnd() * 6); }
    const deco = s.deco;
    if (deco === 'trees') {
      for (let i = 0; i < 3; i++) {
        const x = 12 + rnd() * (w - 24), y = 12 + rnd() * (h - 24), r = 10 + rnd() * 8;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x + 3, y + 4, r, 0, 7); ctx.fill();
        ctx.fillStyle = s.color2 || '#2f5d2a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.fillStyle = shade(s.color2 || '#2f5d2a', 0.25); ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, 7); ctx.fill();
      }
    } else if (deco === 'rocks' || deco === 'ore') {
      for (let i = 0; i < 3; i++) {
        const x = 8 + rnd() * (w - 30), y = 10 + rnd() * (h - 30), r = 12 + rnd() * 8;
        ctx.fillStyle = s.color2 || '#8a8a82';
        ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + r * 0.4, y); ctx.lineTo(x + r * 1.2, y + r * 0.2); ctx.lineTo(x + r * 1.5, y + r * 1.1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x + r * 0.4, y); ctx.lineTo(x + r * 1.2, y + r * 0.2); ctx.lineTo(x + r * 0.8, y + r * 0.6); ctx.fill();
        if (deco === 'ore') { ctx.fillStyle = s.color3 || '#c9772e'; for (let k = 0; k < 4; k++) ctx.fillRect(x + rnd() * r, y + r * 0.3 + rnd() * r * 0.6, 4, 4); }
      }
    } else if (deco === 'waves') {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) { const y = 16 + i * 26 + rnd() * 8; ctx.beginPath(); ctx.moveTo(6, y); ctx.quadraticCurveTo(20, y - 6, 32, y); ctx.quadraticCurveTo(44, y + 6, 58, y); ctx.stroke(); }
    } else if (deco === 'oil') {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.38, h * 0.3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(120,80,200,0.35)'; ctx.beginPath(); ctx.ellipse(w / 2 - 6, h / 2 - 5, w * 0.15, h * 0.08, 0, 0, 7); ctx.fill();
    } else if (deco === 'tufts') {
      ctx.strokeStyle = s.color2 || 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const x = rnd() * w, y = rnd() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 6); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 5); ctx.stroke(); }
    }
  },

  building(ctx, s) {
    const { w, h } = s, c = s.color, pad = Math.max(3, Math.min(w, h) * 0.05);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(ctx, pad + 4, pad + 6, w - pad * 2, h - pad * 2, 8); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, shade(c, 0.18)); g.addColorStop(1, shade(c, -0.22));
    ctx.fillStyle = g; roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 8); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = shade(c, -0.55); ctx.stroke();
    const shape = s.shape || 'box';
    ctx.save(); ctx.translate(w / 2, h / 2);
    const u = Math.min(w, h) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    if (shape === 'house') { ctx.beginPath(); ctx.moveTo(-u * 0.6, u * 0.1); ctx.lineTo(0, -u * 0.55); ctx.lineTo(u * 0.6, u * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(-u * 0.45, u * 0.1, u * 0.9, u * 0.45); }
    else if (shape === 'tower') { ctx.beginPath(); ctx.arc(0, 0, u * 0.55, 0, 7); ctx.fill(); ctx.stroke(); }
    else if (shape === 'wall') { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-u, -u * 0.08, u * 2, u * 0.16); ctx.fillRect(-u * 0.08, -u, u * 0.16, u * 2); }
    else if (shape === 'gate') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-u * 0.5, -u * 0.8, u, u * 1.6); }
    else if (shape === 'field') { ctx.strokeStyle = 'rgba(60,40,10,0.45)'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-u * 0.85, i * u * 0.25); ctx.lineTo(u * 0.85, i * u * 0.25); ctx.stroke(); } }
    else if (shape === 'trap') { ctx.strokeStyle = 'rgba(40,20,0,0.8)'; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * u * 0.35, u * 0.6); ctx.lineTo(i * u * 0.35 + u * 0.15, -u * 0.6); ctx.stroke(); } }
    else if (shape === 'wonder') { ctx.beginPath(); ctx.moveTo(0, -u * 0.8); ctx.lineTo(u * 0.4, u * 0.6); ctx.lineTo(-u * 0.4, u * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(-u * 0.55, -u * 0.4, u * 1.1, u * 0.8); ctx.strokeRect(-u * 0.55, -u * 0.4, u * 1.1, u * 0.8); }
    ctx.restore();
    if (s.label) label(ctx, s.label, w / 2, h / 2, Math.max(12, Math.min(26, w / Math.max(3, s.label.length) * 1.1)));
  },

  unit(ctx, s) {
    const { w, h } = s, c = s.color, r = Math.min(w, h) * (s.radius || 0.32);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(w / 2 + 3, h / 2 + r * 0.75, r, r * 0.45, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(w / 2 - r * 0.3, h / 2 - r * 0.3, r * 0.1, w / 2, h / 2, r);
    g.addColorStop(0, shade(c, 0.35)); g.addColorStop(1, shade(c, -0.25));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, 7); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = s.ring || '#e8f4ff'; ctx.stroke();
    // facing marker: art faces right
    ctx.fillStyle = s.ring || '#e8f4ff'; ctx.beginPath(); ctx.moveTo(w / 2 + r + 1, h / 2); ctx.lineTo(w / 2 + r * 0.6, h / 2 - r * 0.3); ctx.lineTo(w / 2 + r * 0.6, h / 2 + r * 0.3); ctx.fill();
    if (s.label) label(ctx, s.label, w / 2, h / 2, Math.max(10, r * 0.9));
  },

  infected(ctx, s) {
    const { w, h } = s, c = s.color, r = Math.min(w, h) * (s.radius || 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(w / 2 + 2, h / 2 + r * 0.75, r, r * 0.45, 0, 0, 7); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, 7); ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.strokeStyle = 'rgba(20,30,10,0.9)'; ctx.stroke();
    ctx.fillStyle = '#ff3b3b';
    const e = r * 0.22; ctx.fillRect(w / 2 + r * 0.15, h / 2 - r * 0.35, e, e); ctx.fillRect(w / 2 + r * 0.15, h / 2 + r * 0.1, e, e);
    if (s.label) label(ctx, s.label, w / 2 - r * 0.15, h / 2, Math.max(9, r * 0.75), '#e8ffd0');
  },

  fx(ctx, s) {
    const { w, h } = s, c = s.color;
    ctx.save(); ctx.translate(w / 2, h / 2);
    const shape = s.shape || 'dot';
    if (shape === 'bolt') { ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, h * 0.2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-w * 0.42, 0); ctx.lineTo(w * 0.42, 0); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.25, -h * 0.4); ctx.lineTo(w * 0.25, h * 0.4); ctx.fill(); }
    else if (shape === 'rocket') { ctx.fillStyle = c; ctx.fillRect(-w * 0.35, -h * 0.18, w * 0.6, h * 0.36); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-w * 0.35, -h * 0.18); ctx.lineTo(-w * 0.5, 0); ctx.lineTo(-w * 0.35, h * 0.18); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(w * 0.25, -h * 0.18); ctx.lineTo(w * 0.45, 0); ctx.lineTo(w * 0.25, h * 0.18); ctx.fill(); }
    else if (shape === 'blast') { const g = ctx.createRadialGradient(0, 0, 1, 0, 0, w / 2); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, 7); ctx.fill(); }
    else if (shape === 'splat') { ctx.fillStyle = c; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, d = w * 0.22; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, w * 0.12, 0, 7); ctx.fill(); } ctx.beginPath(); ctx.arc(0, 0, w * 0.25, 0, 7); ctx.fill(); }
    else if (shape === 'ring') { ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, w * 0.06); ctx.beginPath(); ctx.arc(0, 0, w * 0.42, 0, 7); ctx.stroke(); }
    else { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.35, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, 7); ctx.fill(); }
    ctx.restore();
  },

  icon(ctx, s) {
    const { w, h } = s, c = s.color, r = Math.min(w, h) * 0.44;
    ctx.fillStyle = shade(c, -0.35); ctx.beginPath(); ctx.arc(w / 2, h / 2 + 1, r, 0, 7); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w / 2, h / 2 - 1, r * 0.92, 0, 7); ctx.fill();
    if (s.label) label(ctx, s.label, w / 2, h / 2, Math.max(10, r * (s.label.length > 1 ? 0.8 : 1.1)));
  },

  generic(ctx, s) {
    ctx.fillStyle = s.color || '#f0f'; ctx.fillRect(0, 0, s.w, s.h);
    if (s.label) label(ctx, s.label, s.w / 2, s.h / 2, 14);
  },
};
