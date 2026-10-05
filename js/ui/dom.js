// Small DOM helpers shared by the UI modules.
export const $ = (id) => document.getElementById(id);
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }

// Returns a small canvas showing an asset sprite (for buttons and panels).
export function spriteIcon(assets, key, size = 34) {
  const a = assets.get(key);
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2; c.className = 'ic';
  c.style.width = size + 'px'; c.style.height = size + 'px';
  if (a) {
    // Only the opaque part of the frame, so characters fill their icon.
    const r = (assets.crop && assets.crop(key)) || { x: 0, y: 0, w: a.w, h: a.h };
    const ctx = c.getContext('2d'), k = Math.min(c.width / r.w, c.height / r.h);
    ctx.drawImage(a.img, r.x, r.y, r.w, r.h, (c.width - r.w * k) / 2, (c.height - r.h * k) / 2, r.w * k, r.h * k);
  }
  return c;
}
const ICON_CACHE = new Map();
export function resIcon(assets, k, size = 16) {
  const key = k + size;
  let url = ICON_CACHE.get(key);
  if (!url) { const c = spriteIcon(assets, 'icon/' + k, size); url = c.toDataURL(); ICON_CACHE.set(key, url); }
  return el('img', { src: url, class: 'ri', width: size, height: size, alt: k, style: { width: size + 'px', height: size + 'px' } });
}
export function costNodes(assets, cost, have) {
  const out = [];
  for (const k of ['gold', 'wood', 'stone', 'iron', 'oil']) {
    if (!cost || !cost[k]) continue;
    const short = have && (have[k] || 0) < cost[k];
    out.push(el('span', { class: 'cost' + (short ? ' bad' : '') }, resIcon(assets, k, 12), String(cost[k])));
  }
  return out;
}
export function fmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`; }
