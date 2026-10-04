// Fog of war. `explored` is permanent; `visible` is recomputed periodically
// from every vision source (player buildings and units). No line-of-sight
// occlusion, matching the reference game where vision is a plain radius.
export class Vision {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
    this.dirty = true;          // render layer should refresh
    this.revealAll = false;
  }

  recompute(sources) {
    const w = this.w, h = this.h, vis = this.visible, exp = this.explored;
    vis.fill(0);
    let newly = 0;
    for (const s of sources) {
      const r = s.r, r2 = r * r;
      const x0 = Math.max(0, Math.floor(s.x - r)), x1 = Math.min(w - 1, Math.ceil(s.x + r));
      const y0 = Math.max(0, Math.floor(s.y - r)), y1 = Math.min(h - 1, Math.ceil(s.y + r));
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - s.y, dy2 = dy * dy;
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - s.x;
          if (dx * dx + dy2 <= r2) {
            const i = row + x;
            vis[i] = 1;
            if (!exp[i]) { exp[i] = 1; newly++; }
          }
        }
      }
    }
    this.dirty = true;
    return newly;
  }

  isVisible(x, y) {
    if (this.revealAll) return true;
    const tx = x | 0, ty = y | 0;
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.visible[tx + ty * this.w] === 1;
  }
  isExplored(tx, ty) {
    if (this.revealAll) return true;
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.explored[tx + ty * this.w] === 1;
  }
  exploredFraction() {
    let n = 0; for (let i = 0; i < this.explored.length; i++) n += this.explored[i];
    return n / this.explored.length;
  }
}
