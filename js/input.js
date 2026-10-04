'use strict';
// Pointer handling: tap to select/place, drag to pan, pinch or wheel to zoom.
class Input {
  constructor(canvas, game, renderer, ui) {
    this.c = canvas; this.g = game; this.r = renderer; this.ui = ui;
    this.pointers = new Map();
    this.pinch = null;
    this.dragging = false;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.r.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e));
  }

  down(e) {
    this.c.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: U.dist(a.x, a.y, b.x, b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (U.dist(p.x, p.y, p.sx, p.sy) > 8) p.moved = true;
    if (this.pointers.size === 1 && p.moved) {
      this.r.cam.x -= dx / this.r.cam.zoom; this.r.cam.y -= dy / this.r.cam.zoom; this.r.clampCam();
    } else if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = U.dist(a.x, a.y, b.x, b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (this.pinch.d > 0) this.r.zoomAt(d / this.pinch.d, mx, my);
      this.r.cam.x -= (mx - this.pinch.mx) / this.r.cam.zoom; this.r.cam.y -= (my - this.pinch.my) / this.r.cam.zoom; this.r.clampCam();
      this.pinch = { d, mx, my };
      a.moved = b.moved = true;
    }
  }

  up(e, cancel) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!p || cancel || p.moved || this.pointers.size) return;
    const [wx, wy] = this.r.screenToTile(e.clientX, e.clientY);
    this.tap(wx, wy);
  }

  tap(wx, wy) {
    const g = this.g;
    if (g.state !== 'playing') return;
    const tx = Math.floor(wx), ty = Math.floor(wy);
    if (!g.world.inBounds(tx, ty)) return;

    if (g.placing) {
      const p = g.placing, def = BUILDINGS[p.type];
      const x = tx - Math.floor((def.w - 1) / 2), y = ty - Math.floor((def.h - 1) / 2);
      if (def.wall) {
        if (p.line && p.anchor) {
          this.ui.placeLine(p.anchor.x, p.anchor.y, x, y);
          p.anchor = null;
        } else {
          if (g.tryBuild('wall', x, y)) this.ui.flashCost();
          if (p.line) p.anchor = { x, y };
        }
        p.x = x; p.y = y;
        return;
      }
      if (p.x === x && p.y === y) { this.ui.confirmPlace(); return; }
      p.x = x; p.y = y;
      this.ui.updatePlaceInfo();
      return;
    }

    const u = g.unitAt(wx, wy, 0.6);
    const b = g.buildingAt(tx, ty);
    const selected = g.selectedUnits();
    if (selected.length && !u && !b) { g.orderMove(selected.map((s) => s.id), wx, wy); return; }
    if (u) { g.selectUnits([u.id]); return; }
    if (b) { g.selectBuilding(b); return; }
    g.clearSelection();
  }

  key(e) {
    const g = this.g;
    if (g.state !== 'playing') return;
    if (e.key === 'Escape') { if (g.placing) this.ui.cancelPlace(); else g.clearSelection(); }
    else if (e.key === ' ') { e.preventDefault(); this.ui.togglePause(); }
    else if (e.key >= '1' && e.key <= '7') this.ui.startPlace(BUILD_ORDER[+e.key - 1]);
    else if (e.key === 'a' || e.key === 'A') this.ui.selectArmy();
    else if (e.key === 'h' || e.key === 'H') this.ui.goHome();
    else if (e.key === '+' || e.key === '=') this.r.zoomAt(1.2, this.r.W / 2, this.r.H / 2);
    else if (e.key === '-') this.r.zoomAt(1 / 1.2, this.r.W / 2, this.r.H / 2);
  }
}
