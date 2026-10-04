'use strict';
// Canvas renderer. World units are tiles; the camera stores its center in
// world pixels and a zoom factor.
class Renderer {
  constructor(canvas, game) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.game = game;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.terrain = null;
    this.W = 1; this.H = 1;
    this.minZoom = 0.4; this.maxZoom = 3;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.c.width = Math.floor(this.W * this.dpr); this.c.height = Math.floor(this.H * this.dpr);
    this.c.style.width = this.W + 'px'; this.c.style.height = this.H + 'px';
    this.minZoom = Math.max(0.3, Math.min(this.W, this.H) / (CFG.MAP_W * CFG.TILE) * 0.9);
  }

  centerOnTile(tx, ty) { this.cam.x = tx * CFG.TILE; this.cam.y = ty * CFG.TILE; this.clampCam(); }
  worldToScreen(wx, wy) { return [(wx - this.cam.x) * this.cam.zoom + this.W / 2, (wy - this.cam.y) * this.cam.zoom + this.H / 2]; }
  tileToScreen(tx, ty) { return this.worldToScreen(tx * CFG.TILE, ty * CFG.TILE); }
  screenToTile(sx, sy) { return [((sx - this.W / 2) / this.cam.zoom + this.cam.x) / CFG.TILE, ((sy - this.H / 2) / this.cam.zoom + this.cam.y) / CFG.TILE]; }

  clampCam() {
    const mw = CFG.MAP_W * CFG.TILE, mh = CFG.MAP_H * CFG.TILE;
    const hw = this.W / 2 / this.cam.zoom, hh = this.H / 2 / this.cam.zoom;
    this.cam.x = U.clamp(this.cam.x, Math.min(hw, mw / 2), Math.max(mw - hw, mw / 2));
    this.cam.y = U.clamp(this.cam.y, Math.min(hh, mh / 2), Math.max(mh - hh, mh / 2));
  }

  zoomAt(factor, sx, sy) {
    const [bx, by] = this.screenToTile(sx, sy);
    this.cam.zoom = U.clamp(this.cam.zoom * factor, this.minZoom, this.maxZoom);
    const [ax, ay] = this.screenToTile(sx, sy);
    this.cam.x -= (ax - bx) * CFG.TILE; this.cam.y -= (ay - by) * CFG.TILE;
    this.clampCam();
  }

  // ---------------------------------------------------------------- terrain
  buildTerrain() {
    const g = this.game, W = g.world, S = CFG.TILE;
    if (!this.terrain) { this.terrain = document.createElement('canvas'); this.terrain.width = W.w * S; this.terrain.height = W.h * S; }
    const t = this.terrain.getContext('2d');
    const grass = ['#4f7f3a', '#53823d', '#4b7a38', '#56863f'];
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      const i = x + y * W.w, v = W.variant[i], tile = W.tiles[i];
      const px = x * S, py = y * S;
      t.fillStyle = grass[v]; t.fillRect(px, py, S, S);
      if (tile === T.GRASS) {
        if (v === 1 || v === 3) { t.fillStyle = 'rgba(0,0,0,0.07)'; t.fillRect(px + 6 + v * 3, py + 10 + v * 2, 3, 2); t.fillRect(px + 20 - v, py + 22, 2, 3); }
      } else if (tile === T.FOREST) {
        const trees = v % 2 === 0 ? [[10, 12, 9], [22, 20, 8]] : [[16, 16, 11], [8, 24, 6]];
        for (const [ox, oy, r] of trees) {
          t.fillStyle = 'rgba(0,0,0,0.18)'; t.beginPath(); t.arc(px + ox + 2, py + oy + 3, r, 0, 7); t.fill();
          t.fillStyle = '#2f5d2a'; t.beginPath(); t.arc(px + ox, py + oy, r, 0, 7); t.fill();
          t.fillStyle = '#3f7a35'; t.beginPath(); t.arc(px + ox - r * 0.3, py + oy - r * 0.3, r * 0.55, 0, 7); t.fill();
        }
      } else if (tile === T.ROCK) {
        t.fillStyle = '#5f5f5a'; t.fillRect(px, py, S, S);
        t.fillStyle = '#8a8a82';
        t.beginPath(); t.moveTo(px + 4, py + 26); t.lineTo(px + 10, py + 8 + v); t.lineTo(px + 20, py + 4); t.lineTo(px + 28, py + 18); t.lineTo(px + 24, py + 28); t.closePath(); t.fill();
        t.fillStyle = '#a7a79f'; t.beginPath(); t.moveTo(px + 10, py + 8 + v); t.lineTo(px + 20, py + 4); t.lineTo(px + 18, py + 16); t.closePath(); t.fill();
      } else if (tile === T.WATER) {
        t.fillStyle = '#2f6f9f'; t.fillRect(px, py, S, S);
        t.strokeStyle = 'rgba(255,255,255,0.25)'; t.lineWidth = 2;
        t.beginPath(); t.moveTo(px + 4, py + 10 + v * 4); t.quadraticCurveTo(px + 10, py + 6 + v * 4, px + 16, py + 10 + v * 4); t.quadraticCurveTo(px + 22, py + 14 + v * 4, px + 28, py + 10 + v * 4); t.stroke();
      }
    }
    g.terrainDirty = false;
  }

  // ------------------------------------------------------------------ icons
  // Vector glyphs so buildings look identical on every device.
  icon(ctx, type, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = Math.max(1, s * 0.09);
    const h = s / 2;
    switch (type) {
      case 'cc':
        ctx.fillStyle = '#fff6d6'; ctx.fillRect(-h * 0.8, -h * 0.2, h * 1.6, h * 1.0);
        ctx.fillRect(-h * 0.8, -h * 0.55, h * 0.3, h * 0.4); ctx.fillRect(-h * 0.15, -h * 0.55, h * 0.3, h * 0.4); ctx.fillRect(h * 0.5, -h * 0.55, h * 0.3, h * 0.4);
        ctx.fillStyle = '#b53a3a'; ctx.fillRect(-h * 0.2, h * 0.2, h * 0.4, h * 0.6);
        ctx.strokeStyle = '#3a2a10'; ctx.beginPath(); ctx.moveTo(0, -h * 0.55); ctx.lineTo(0, -h * 1.05); ctx.stroke();
        ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.moveTo(0, -h * 1.05); ctx.lineTo(h * 0.5, -h * 0.9); ctx.lineTo(0, -h * 0.75); ctx.fill();
        break;
      case 'tent':
        ctx.fillStyle = '#fff3d0'; ctx.beginPath(); ctx.moveTo(-h * 0.9, h * 0.7); ctx.lineTo(0, -h * 0.8); ctx.lineTo(h * 0.9, h * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.moveTo(-h * 0.3, h * 0.7); ctx.lineTo(0, 0); ctx.lineTo(h * 0.3, h * 0.7); ctx.closePath(); ctx.fill();
        break;
      case 'farm':
        ctx.strokeStyle = '#3f5a12'; ctx.lineWidth = Math.max(1.5, s * 0.12);
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-h * 0.8, i * h * 0.5); ctx.lineTo(h * 0.8, i * h * 0.5); ctx.stroke(); }
        ctx.fillStyle = '#ffd34d'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * h * 0.4, -h * 0.5, s * 0.07, 0, 7); ctx.arc(i * h * 0.4 + h * 0.2, 0, s * 0.07, 0, 7); ctx.fill(); }
        break;
      case 'sawmill':
        ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.ellipse(-h * 0.15, 0, h * 0.75, h * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f2d4a8'; ctx.beginPath(); ctx.ellipse(h * 0.4, 0, h * 0.28, h * 0.45, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(h * 0.4, 0, h * 0.12, h * 0.2, 0, 0, 7); ctx.stroke();
        break;
      case 'quarry':
        ctx.strokeStyle = '#4a3520'; ctx.lineWidth = Math.max(2, s * 0.14); ctx.beginPath(); ctx.moveTo(-h * 0.7, h * 0.7); ctx.lineTo(h * 0.4, -h * 0.4); ctx.stroke();
        ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = Math.max(2, s * 0.16); ctx.beginPath(); ctx.arc(h * 0.15, -h * 0.15, h * 0.7, -Math.PI * 0.9, -Math.PI * 0.1); ctx.stroke();
        break;
      case 'wall':
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath(); ctx.moveTo(-h, -h * 0.33); ctx.lineTo(h, -h * 0.33); ctx.moveTo(-h, h * 0.33); ctx.lineTo(h, h * 0.33);
        ctx.moveTo(0, -h); ctx.lineTo(0, -h * 0.33); ctx.moveTo(-h * 0.5, -h * 0.33); ctx.lineTo(-h * 0.5, h * 0.33); ctx.moveTo(h * 0.5, -h * 0.33); ctx.lineTo(h * 0.5, h * 0.33); ctx.moveTo(0, h * 0.33); ctx.lineTo(0, h); ctx.stroke();
        break;
      case 'tower':
        ctx.strokeStyle = '#f0e0c0'; ctx.lineWidth = Math.max(2, s * 0.13);
        ctx.beginPath(); ctx.arc(0, h * 0.2, h * 0.8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, h * 0.8); ctx.lineTo(0, -h * 0.85); ctx.stroke();
        ctx.fillStyle = '#f0e0c0'; ctx.beginPath(); ctx.moveTo(0, -h * 1.0); ctx.lineTo(-h * 0.3, -h * 0.5); ctx.lineTo(h * 0.3, -h * 0.5); ctx.fill();
        break;
      case 'barracks':
        ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = Math.max(2, s * 0.13);
        ctx.beginPath(); ctx.moveTo(-h * 0.75, h * 0.75); ctx.lineTo(h * 0.65, -h * 0.65); ctx.moveTo(h * 0.75, h * 0.75); ctx.lineTo(-h * 0.65, -h * 0.65); ctx.stroke();
        ctx.strokeStyle = '#5a2a2a'; ctx.beginPath(); ctx.moveTo(-h * 0.85, h * 0.45); ctx.lineTo(-h * 0.45, h * 0.85); ctx.moveTo(h * 0.85, h * 0.45); ctx.lineTo(h * 0.45, h * 0.85); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------- draw
  draw() {
    const ctx = this.ctx, g = this.game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#141a24'; ctx.fillRect(0, 0, this.W, this.H);
    if (!g.world) return;
    if (g.terrainDirty || !this.terrain) this.buildTerrain();

    const S = CFG.TILE, z = this.cam.zoom, ts = S * z;
    const [ox, oy] = this.worldToScreen(0, 0);
    // Visible tile range.
    const [vx0, vy0] = this.screenToTile(0, 0), [vx1, vy1] = this.screenToTile(this.W, this.H);
    const tx0 = Math.max(0, Math.floor(vx0)), ty0 = Math.max(0, Math.floor(vy0));
    const tx1 = Math.min(g.world.w, Math.ceil(vx1)), ty1 = Math.min(g.world.h, Math.ceil(vy1));
    if (tx1 > tx0 && ty1 > ty0) {
      ctx.imageSmoothingEnabled = z < 1;
      ctx.drawImage(this.terrain, tx0 * S, ty0 * S, (tx1 - tx0) * S, (ty1 - ty0) * S,
        ox + tx0 * ts, oy + ty0 * ts, (tx1 - tx0) * ts, (ty1 - ty0) * ts);
    }
    const visible = (x, y, pad) => x >= vx0 - pad && x <= vx1 + pad && y >= vy0 - pad && y <= vy1 + pad;

    // Grid while placing.
    if (g.placing && z >= 0.8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = tx0; x <= tx1; x++) { ctx.moveTo(ox + x * ts, oy + ty0 * ts); ctx.lineTo(ox + x * ts, oy + ty1 * ts); }
      for (let y = ty0; y <= ty1; y++) { ctx.moveTo(ox + tx0 * ts, oy + y * ts); ctx.lineTo(ox + tx1 * ts, oy + y * ts); }
      ctx.stroke();
    }

    // Buildings.
    const sel = g.selectedBuilding();
    for (const b of g.buildings) {
      if (!visible(b.cx, b.cy, 3)) continue;
      const def = BUILDINGS[b.type];
      const sx = ox + b.x * ts, sy = oy + b.y * ts, sw = b.w * ts, sh = b.h * ts;
      const inset = b.type === 'wall' ? ts * 0.04 : ts * 0.08;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx + inset + ts * 0.08, sy + inset + ts * 0.1, sw - inset * 2, sh - inset * 2);
      ctx.fillStyle = def.color; ctx.fillRect(sx + inset, sy + inset, sw - inset * 2, sh - inset * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(1, ts * 0.05);
      ctx.strokeRect(sx + inset, sy + inset, sw - inset * 2, sh - inset * 2);
      if (z >= 0.55) this.icon(ctx, b.type, sx + sw / 2, sy + sh / 2, Math.min(sw, sh) * 0.62);
      if (b.hp < b.maxHp) this.hpBar(sx + inset, sy - ts * 0.18, sw - inset * 2, b.hp / b.maxHp, '#ffcc44');
      if (b === sel) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2); ctx.setLineDash([]);
        if (def.attack) this.rangeCircle(ox + b.cx * ts, oy + b.cy * ts, def.attack.range * ts, '#c9a2ff');
        if (def.yields) this.yieldRect(ox, oy, ts, b.x - def.yields.radius, b.y - def.yields.radius, b.w + def.yields.radius * 2, b.h + def.yields.radius * 2);
      }
    }

    // Units.
    const selIds = g.selection.kind === 'units' ? new Set(g.selection.ids) : null;
    for (const u of g.units) {
      if (!visible(u.x, u.y, 1)) continue;
      const def = UNITS[u.type], sx = ox + u.x * ts, sy = oy + u.y * ts, r = ts * 0.3;
      if (selIds && selIds.has(u.id)) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, r + 4, 0, 7); ctx.stroke();
        this.rangeCircle(sx, sy, def.range * ts, 'rgba(93,184,255,0.6)');
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx + 2, sy + r * 0.8, r, r * 0.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffffff';
      if (u.type === 'ranger') { ctx.beginPath(); ctx.arc(sx, sy, r * 0.35, 0, 7); ctx.fill(); }
      else ctx.fillRect(sx - r * 0.35, sy - r * 0.35, r * 0.7, r * 0.7);
      this.hpBar(sx - r, sy - r - 5, r * 2, u.hp / u.maxHp, '#5df07a');
    }

    // Zombies.
    const eyes = z >= 0.9;
    for (const zb of g.zombies) {
      if (!visible(zb.x, zb.y, 1)) continue;
      const def = ZOMBIES[zb.type], sx = ox + zb.x * ts, sy = oy + zb.y * ts, r = ts * def.r;
      ctx.fillStyle = zb.hit > 0 ? '#ffffff' : def.color;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      if (z >= 0.6) { ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke(); }
      if (eyes) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(sx - r * 0.45, sy - r * 0.25, r * 0.3, r * 0.3); ctx.fillRect(sx + r * 0.15, sy - r * 0.25, r * 0.3, r * 0.3); }
      if (zb.hp < zb.maxHp && (eyes || zb.type === 'brute')) this.hpBar(sx - r, sy - r - 4, r * 2, zb.hp / zb.maxHp, '#ff5555');
    }

    // Projectiles.
    ctx.lineWidth = Math.max(1, ts * 0.06);
    for (const p of g.projectiles) {
      const sx = ox + p.x * ts, sy = oy + p.y * ts;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.5, ts * 0.08), 0, 7); ctx.fill();
    }

    // Effects.
    for (const e of g.effects) {
      const k = e.t / e.dur, sx = ox + e.x * ts, sy = oy + e.y * ts;
      ctx.globalAlpha = 1 - k;
      if (e.type === 'puff') { ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(sx, sy, ts * (0.2 + k * 0.5), 0, 7); ctx.fill(); }
      else if (e.type === 'ring' || e.type === 'move') { ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, ts * (0.2 + k * 0.8), 0, 7); ctx.stroke(); }
      else if (e.type === 'burst') {
        ctx.strokeStyle = e.color; ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * ts * k * 0.5, sy + Math.sin(a) * ts * k * 0.5); ctx.lineTo(sx + Math.cos(a) * ts * (0.3 + k * 1.2), sy + Math.sin(a) * ts * (0.3 + k * 1.2)); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }

    // Placement ghost.
    if (g.placing && g.placing.x != null) {
      const p = g.placing, def = BUILDINGS[p.type];
      const ok = g.canPlace(p.type, p.x, p.y).ok && !g.buildBlocker(p.type);
      const sx = ox + p.x * ts, sy = oy + p.y * ts;
      if (def.yields) this.yieldRect(ox, oy, ts, p.x - def.yields.radius, p.y - def.yields.radius, def.w + def.yields.radius * 2, def.h + def.yields.radius * 2);
      if (def.attack) this.rangeCircle(sx + def.w * ts / 2, sy + def.h * ts / 2, def.attack.range * ts, '#c9a2ff');
      ctx.fillStyle = ok ? 'rgba(90,255,120,0.45)' : 'rgba(255,80,80,0.45)';
      ctx.fillRect(sx, sy, def.w * ts, def.h * ts);
      ctx.strokeStyle = ok ? '#7dff9a' : '#ff6b6b'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, def.w * ts, def.h * ts);
      this.icon(ctx, p.type, sx + def.w * ts / 2, sy + def.h * ts / 2, Math.min(def.w, def.h) * ts * 0.62);
      if (p.anchor) { const ax = ox + (p.anchor.x + 0.5) * ts, ay = oy + (p.anchor.y + 0.5) * ts; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ax, ay, ts * 0.4, 0, 7); ctx.stroke(); }
    }

    // Night overlay.
    const f = g.dayFrac;
    const night = f > 0.6 ? Math.sin((f - 0.6) / 0.4 * Math.PI) : 0;
    if (night > 0) { ctx.fillStyle = `rgba(8,12,40,${(night * 0.5).toFixed(3)})`; ctx.fillRect(0, 0, this.W, this.H); }

    this.drawHordeArrow(ctx);
  }

  drawHordeArrow(ctx) {
    const g = this.game;
    let n = 0, cx = 0, cy = 0;
    for (const z of g.zombies) if (z.horde) { n++; cx += z.x; cy += z.y; }
    if (n < 8) return;
    cx /= n; cy /= n;
    const [sx, sy] = this.tileToScreen(cx, cy);
    const pad = 36;
    if (sx > pad && sx < this.W - pad && sy > pad && sy < this.H - pad) return;
    const dx = sx - this.W / 2, dy = sy - this.H / 2;
    const ang = Math.atan2(dy, dx);
    const k = Math.min((this.W / 2 - pad) / Math.abs(dx || 1e-6), (this.H / 2 - pad) / Math.abs(dy || 1e-6));
    const ex = this.W / 2 + dx * k, ey = this.H / 2 + dy * k;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,60,60,0.9)'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff5c5c'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`HORDE ×${n}`, U.clamp(ex, 40, this.W - 40), U.clamp(ey + (ey < this.H / 2 ? 28 : -20), 14, this.H - 6));
  }

  hpBar(x, y, w, k, color) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * U.clamp(k, 0, 1), 3);
  }
  rangeCircle(x, y, r, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  yieldRect(ox, oy, ts, x, y, w, h) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.strokeRect(ox + x * ts, oy + y * ts, w * ts, h * ts); ctx.setLineDash([]);
  }

  // Minimap drawn into a small DOM canvas.
  drawMinimap(mc) {
    const g = this.game; if (!g.world || !this.terrain) return;
    const ctx = mc.getContext('2d'), s = mc.width / g.world.w;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0, mc.width, mc.height);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, mc.width, mc.height);
    for (const b of g.buildings) { ctx.fillStyle = b.type === 'wall' ? '#dddddd' : b.type === 'cc' ? '#ffe066' : '#ffb84d'; ctx.fillRect(b.x * s, b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s)); }
    ctx.fillStyle = '#5db8ff'; for (const u of g.units) ctx.fillRect(u.x * s - 1, u.y * s - 1, 2.5, 2.5);
    ctx.fillStyle = '#ff4040'; for (const z of g.zombies) ctx.fillRect(z.x * s - 0.5, z.y * s - 0.5, 1.6, 1.6);
    const [x0, y0] = this.screenToTile(0, 0), [x1, y1] = this.screenToTile(this.W, this.H);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s);
  }
}
