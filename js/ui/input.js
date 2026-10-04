import { dist } from '../core/util.js';

// Turns pointer/wheel/keyboard events into high-level gestures:
//   onTap(sx, sy, e)        short tap or click without movement
//   onLongPress(sx, sy)     touch held ~450 ms without movement
//   onBox(x0, y0, x1, y1)   drag rectangle in select mode or with mouse left-drag + shift
//   onBoxPreview(rect|null) live rectangle for drawing
//   onSecondary(sx, sy)     right click (desktop): contextual command
//   onKey(e)
// Camera gestures (one-finger drag, pinch, wheel, arrow keys, screen-edge
// mouse scroll) are applied directly.
export class Input {
  constructor(el, camera, handlers) {
    this.el = el; this.cam = camera; this.h = handlers;
    this.ptr = new Map();
    this.pinch = null;
    this.selectMode = false;     // touch: drag draws a selection box instead of panning
    this.box = null;
    this.longTimer = null;
    this.keys = new Set();
    this.edgeScroll = false;     // desktop: pan when the mouse touches a screen edge
    this.mouse = null;
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.mouse = { x: e.clientX, y: e.clientY, over: !(e.target.closest && e.target.closest('#overlay, #modal')) }; });
    document.addEventListener('mouseleave', () => { this.mouse = null; });
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e, false));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => { this.keys.add(e.key.toLowerCase()); if (this.h.onKey) this.h.onKey(e); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    this.el.setPointerCapture(e.pointerId);
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button, type: e.pointerType, shift: e.shiftKey, t: performance.now() };
    this.ptr.set(e.pointerId, p);
    clearTimeout(this.longTimer);
    if (this.ptr.size === 1 && e.pointerType !== 'mouse') {
      this.longTimer = setTimeout(() => { if (!p.moved && this.ptr.has(p.id)) { p.long = true; if (this.h.onLongPress) this.h.onLongPress(p.x, p.y); } }, 450);
    }
    if (this.ptr.size === 2) {
      const [a, b] = [...this.ptr.values()];
      this.pinch = { d: dist(a.x, a.y, b.x, b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.box = null; if (this.h.onBoxPreview) this.h.onBoxPreview(null);
    }
  }

  isBoxGesture(p) {
    if (p.type === 'mouse') return p.button === 0 && (this.selectMode || p.shift || this.h.mouseBoxDefault);
    return this.selectMode;
  }

  move(e) {
    const p = this.ptr.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && dist(p.x, p.y, p.sx, p.sy) > 9) { p.moved = true; clearTimeout(this.longTimer); }
    if (this.ptr.size === 1 && p.moved) {
      if (this.isBoxGesture(p)) {
        this.box = { x0: p.sx, y0: p.sy, x1: p.x, y1: p.y };
        if (this.h.onBoxPreview) this.h.onBoxPreview(this.box);
      } else if (p.button === 0 || p.button === 1 || p.type !== 'mouse') {
        this.cam.pan(dx, dy);
      }
    } else if (this.ptr.size === 2 && this.pinch) {
      const [a, b] = [...this.ptr.values()];
      const d = dist(a.x, a.y, b.x, b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (this.pinch.d > 0) this.cam.zoomAt(d / this.pinch.d, mx, my);
      this.cam.pan(mx - this.pinch.mx, my - this.pinch.my);
      this.pinch = { d, mx, my };
      a.moved = b.moved = true;
    }
  }

  up(e, cancel) {
    const p = this.ptr.get(e.pointerId);
    this.ptr.delete(e.pointerId);
    clearTimeout(this.longTimer);
    if (this.ptr.size < 2) this.pinch = null;
    if (!p || cancel) { this.box = null; if (this.h.onBoxPreview) this.h.onBoxPreview(null); return; }
    if (this.box && this.ptr.size === 0) {
      const b = this.box; this.box = null;
      if (this.h.onBoxPreview) this.h.onBoxPreview(null);
      if (this.h.onBox) this.h.onBox(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.max(b.x0, b.x1), Math.max(b.y0, b.y1), e);
      return;
    }
    if (p.moved || p.long || this.ptr.size) return;
    if (p.type === 'mouse' && p.button === 2) { if (this.h.onSecondary) this.h.onSecondary(e.clientX, e.clientY, e); return; }
    if (this.h.onTap) this.h.onTap(e.clientX, e.clientY, e);
  }

  // Keyboard camera scroll, called every frame.
  update(dt) {
    const k = this.keys, sp = 900 * dt;
    let dx = 0, dy = 0;
    if (k.has('arrowleft')) dx += sp; if (k.has('arrowright')) dx -= sp;
    if (k.has('arrowup')) dy += sp; if (k.has('arrowdown')) dy -= sp;
    const m = this.mouse, E = 6;
    if (this.edgeScroll && m && m.over && !this.ptr.size) {
      if (m.x <= E) dx += sp; else if (m.x >= window.innerWidth - E) dx -= sp;
      if (m.y <= E) dy += sp; else if (m.y >= window.innerHeight - E) dy -= sp;
    }
    if (dx || dy) this.cam.pan(dx, dy);
  }
}
