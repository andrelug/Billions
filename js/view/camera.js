import { clamp } from '../core/util.js';

// Camera in world-tile units. `scale` = screen CSS pixels per tile.
export class Camera {
  constructor() { this.x = 0; this.y = 0; this.scale = 40; this.W = 1; this.H = 1; this.mapW = 1; this.mapH = 1; this.min = 8; this.max = 120; }
  setViewport(W, H) { this.W = W; this.H = H; this.updateLimits(); this.clamp(); }
  setMap(w, h) { this.mapW = w; this.mapH = h; this.updateLimits(); this.clamp(); }
  updateLimits() {
    // Allow zooming out until the whole map nearly fits the shorter side.
    this.min = Math.max(4, Math.min(this.W / this.mapW, this.H / this.mapH) * 0.95);
    this.max = Math.max(this.min * 2, 110);
  }
  toScreen(tx, ty) { return [(tx - this.x) * this.scale + this.W / 2, (ty - this.y) * this.scale + this.H / 2]; }
  toWorld(sx, sy) { return [(sx - this.W / 2) / this.scale + this.x, (sy - this.H / 2) / this.scale + this.y]; }
  center(tx, ty) { this.x = tx; this.y = ty; this.clamp(); }
  pan(dxScreen, dyScreen) { this.x -= dxScreen / this.scale; this.y -= dyScreen / this.scale; this.clamp(); }
  zoomAt(factor, sx, sy) {
    const [bx, by] = this.toWorld(sx, sy);
    this.scale = clamp(this.scale * factor, this.min, this.max);
    const [ax, ay] = this.toWorld(sx, sy);
    this.x -= ax - bx; this.y -= ay - by;
    this.clamp();
  }
  clamp() {
    const hw = this.W / 2 / this.scale, hh = this.H / 2 / this.scale;
    const pad = 2;
    this.x = this.mapW <= hw * 2 ? this.mapW / 2 : clamp(this.x, hw - pad, this.mapW - hw + pad);
    this.y = this.mapH <= hh * 2 ? this.mapH / 2 : clamp(this.y, hh - pad, this.mapH - hh + pad);
  }
  // Visible tile bounds (inclusive start, exclusive end), clamped to the map.
  bounds(pad = 0) {
    const [x0, y0] = this.toWorld(0, 0), [x1, y1] = this.toWorld(this.W, this.H);
    return {
      x0: Math.max(0, Math.floor(x0) - pad), y0: Math.max(0, Math.floor(y0) - pad),
      x1: Math.min(this.mapW, Math.ceil(x1) + pad), y1: Math.min(this.mapH, Math.ceil(y1) + pad),
      fx0: x0, fy0: y0, fx1: x1, fy1: y1,
    };
  }
}
