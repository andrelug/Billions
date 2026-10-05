import { Camera } from './camera.js';
import { TerrainLayer, FogLayer, PROP_NAMES } from './terrain.js';
import { TERRAIN } from '../data/terrain.js';
import { BUILDINGS } from '../data/buildings.js';
import { footprint } from '../sim/placement.js';
import { gridRadius } from '../sim/power.js';
import { clamp } from '../core/util.js';
import { FIGURE_H, FEET } from '../data/art.js';

const FX_LIFE = { tracer: 0.08, flame: 0.25, zap: 0.25, pulse: 0.45, blast: 0.5, splat: 0.6, infect: 1.2, ring: 0.6, burst: 0.7, smash: 0.3, acid: 0.5, hit: 0.15 };

export class Renderer {
  constructor(canvas, assets) {
    this.c = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets; this.cam = new Camera();
    this.dpr = 1; this.g = null;
    this.flip = new Map();   // mirrored sprite cache
    this.animCache = new Map();   // sprite key -> which animation states exist
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 2);
    const W = window.innerWidth, H = window.innerHeight;
    this.c.width = Math.floor(W * this.dpr); this.c.height = Math.floor(H * this.dpr);
    this.c.style.width = W + 'px'; this.c.style.height = H + 'px';
    this.cam.setViewport(W, H);
  }

  setGame(g) {
    this.g = g;
    this.cam.setMap(g.world.w, g.world.h);
    const theme = g.settings.theme;
    this.tileKeys = [];
    for (const id in TERRAIN) for (let v = 0; v < 4; v++) this.tileKeys[id * 4 + v] = `terrain/${theme}/${TERRAIN[id].key}_${v}`;
    this.terrain = new TerrainLayer(g.world, this.assets, (x, y) => { const i = x + y * g.world.w; return this.tileKeys[g.world.tiles[i] * 4 + g.world.variant[i]]; });
    // Prop art for this map, if any: prop/<map>/tree_0, tree_1, rock_0 ...
    const props = { any: false };
    for (const name of Object.values(PROP_NAMES)) { props[name] = this.assets.keys(`prop/${theme}/${name}_`); if (props[name].length) props.any = true; }
    this.terrain.props = props;
    this.fog = new FogLayer(g.vision);
    this.miniBase = null;
  }

  sprite(key) { return this.assets.get(key); }

  // Draws a sprite with its anchor at world (x, y), w/h in tiles. flip mirrors horizontally.
  drawSprite(key, x, y, wTiles, hTiles, flip, alpha) {
    const a = this.assets.get(key); if (!a) return;
    const ctx = this.ctx, s = this.cam.scale;
    const [sx, sy] = this.cam.toScreen(x, y);
    const dw = wTiles * s, dh = hTiles * s;
    const fx = a.frames > 1 ? (Math.floor(performance.now() / 1000 * a.fps) % a.frames) * a.w : 0;
    if (alpha != null) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save(); ctx.translate(sx, sy); ctx.scale(-1, 1);
      ctx.drawImage(a.img, fx, 0, a.w, a.h, -dw * (1 - a.ax), -dh * a.ay, dw, dh);
      ctx.restore();
    } else ctx.drawImage(a.img, fx, 0, a.w, a.h, sx - dw * a.ax, sy - dh * a.ay, dw, dh);
    if (alpha != null) ctx.globalAlpha = 1;
  }

  // Optional animation states: "<key>_attack" while firing, "<key>_walk"
  // while moving, otherwise the base sprite.
  anims(key) {
    let a = this.animCache.get(key);
    if (!a) { a = { walk: this.assets.has(key + '_walk'), attack: this.assets.has(key + '_attack') }; a.any = a.walk || a.attack; this.animCache.set(key, a); }
    return a.any ? a : null;
  }
  animKey(key, moving, attacking) {
    const a = this.anims(key); if (!a) return key;
    if (attacking && a.attack) return key + '_attack';
    if (moving && a.walk) return key + '_walk';
    return key;
  }

  // Building art spans the footprint's width; a taller image (perspective
  // art) keeps its aspect ratio and rises above the footprint.
  drawBuildingSprite(key, x, y, w, h, alpha) {
    const a = this.assets.get(key); if (!a) return;
    const ht = Math.max(h, w * a.h / a.w);
    this.drawSprite(key, x, y + h - ht, w, ht, false, alpha);
  }

  // Units and infected. The visible body (measured from the art, so padding
  // does not matter) is FIGURE_H collision radii tall, with the feet on the
  // ground just below the entity's centre. `base` is the still sprite whose
  // framing every animation strip of that character shares.
  drawFigure(key, base, x, y, r, flip, alpha) {
    const a = this.assets.get(key); if (!a) return;
    const f = this.assets.figure(base) || this.assets.figure(key);
    const ctx = this.ctx, s = this.cam.scale;
    const dh = FIGURE_H * r / Math.max(0.05, f.bottom - f.top), H = dh * s, W = H * a.w / a.h;
    const [px, py] = this.cam.toScreen(x, y + FEET * r), top = py - f.bottom * H;
    const src = a.frames > 1 ? (Math.floor(performance.now() / 1000 * a.fps) % a.frames) * a.w : 0;
    const c = this.assets.crop(key), kx = W / a.w, ky = H / a.h;
    const ox = c.x * kx, oy = top + c.y * ky, cw = c.w * kx, ch = c.h * ky;
    if (alpha != null) ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(px, 0); ctx.scale(-1, 1); ctx.drawImage(a.img, src + c.x, c.y, c.w, c.h, -f.cx * W + ox, oy, cw, ch); ctx.restore(); }
    else ctx.drawImage(a.img, src + c.x, c.y, c.w, c.h, px - f.cx * W + ox, oy, cw, ch);
    if (alpha != null) ctx.globalAlpha = 1;
  }
  headY(e) { return e.y + FEET * e.r - FIGURE_H * e.r; }
  headBar(e, k, color) {
    const w = Math.max(0.55, e.r * 2.2);
    this.bar(e.x - w / 2, this.headY(e) - 0.16, w, k, color);
  }
  shadow(e) {
    const ctx = this.ctx, s = this.cam.scale, [sx, sy] = this.cam.toScreen(e.x, e.y + FEET * e.r);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, e.r * 1.05 * s, e.r * 0.45 * s, 0, 0, 7); ctx.fill();
  }

  draw(ui) {
    const g = this.g, ctx = this.ctx, cam = this.cam, s = cam.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, cam.W, cam.H);
    if (!g) return;
    const b = cam.bounds(1);
    const vis = (x, y, pad = 2) => x >= b.fx0 - pad && x <= b.fx1 + pad && y >= b.fy0 - pad && y <= b.fy1 + pad;
    this.terrain.draw(ctx, cam);
    const V = g.vision;

    // Energy grid overlay.
    if (ui.showGrid || (ui.placing && !ui.placing.def.onCC)) this.drawGrid(b, ui);
    // Farm wheat.
    if (g.eco.claimMap && s >= 10) {
      ctx.fillStyle = 'rgba(232,196,80,0.35)';
      const cm = g.eco.claimMap, w = g.world.w;
      for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) if (cm[x + y * w] === 2) { const [sx, sy] = cam.toScreen(x, y); ctx.fillRect(sx + s * 0.1, sy + s * 0.1, s * 0.8, s * 0.8); }
    }
    // Corpses.
    if (s >= 10) for (const c of g.corpses) {
      if (!vis(c.x, c.y) || !V.isExplored(c.x | 0, c.y | 0)) continue;
      const a = clamp(1 - (g.time - c.t) / 40, 0, 1) * 0.8;
      this.drawSprite(c.human ? 'fx/blood' : 'fx/ichor', c.x, c.y, c.r * 2.4, c.r * 2.4, false, a);
    }

    // Loot and barrels lie on the ground, under everything that stands.
    for (const p of g.pickups) if (vis(p.x, p.y) && V.isExplored(p.x | 0, p.y | 0)) {
      const bob = Math.sin(performance.now() / 300 + p.id) * 0.06;
      this.drawSprite('pickup/' + p.type, p.x, p.y + bob, 0.75, 0.75);
    }
    for (const x of g.barrels) if (!x.carriedBy && vis(x.x, x.y) && V.isExplored(x.x | 0, x.y | 0)) this.drawSprite('barrel', x.x, x.y, 0.6, 0.6);

    // Buildings, nests, units and infected share one pass sorted by the line
    // they stand on, so tall art and characters overlap each other correctly.
    const list = this.dl || (this.dl = []); list.length = 0;
    for (const x of g.buildings) if (vis(x.cx, x.cy, Math.max(x.w, x.h) + 2) && V.isExplored(x.cx | 0, x.cy | 0)) { x._dk = x.y + x.h; list.push(x); }
    for (const n of g.nests) if (vis(n.x, n.y, 4) && V.isExplored(n.x | 0, n.y | 0)) { n._dk = n.y + n.h; list.push(n); }
    for (const u of g.units) if (!u.garrisoned && vis(u.x, u.y, 3)) { u._dk = u.y + FEET * u.r; list.push(u); }
    // Far out, infected become dots so huge swarms stay cheap to draw.
    const dots = s < 13, zdots = this.zl || (this.zl = []); zdots.length = 0;
    let drawn = 0;
    for (const z of g.infected) {
      if (!vis(z.x, z.y, 3)) continue;
      if (!V.revealAll && V.visible[(z.x | 0) + (z.y | 0) * g.world.w] !== 1) continue;
      drawn++;
      if (dots) zdots.push(z); else { z._dk = z.y + FEET * z.r; list.push(z); }
    }
    list.sort((a, c) => a._dk - c._dk);
    const selB = ui.selBuilding, shadows = s >= 16 && drawn < 800;   // skip infected shadows in huge swarms
    for (const e of list) {
      if (e.kind === 'b') this.drawBuilding(e, e === selB, ui);
      else if (e.kind === 'n') {
        this.drawBuildingSprite('nest/' + e.size, e.x, e.y, e.w, e.h, e.flash > 0 ? 0.6 : 1);
        if (ui.sel && ui.sel.has(e.id)) this.outline(e.x, e.y, e.w, e.h, '#ff6b6b');
      } else if (e.kind === 'u') {
        if (ui.sel && ui.sel.has(e.id)) this.ring(e.x, e.y + FEET * e.r * 0.5, e.r + 0.14, '#7dff9a');
        this.shadow(e);
        this.drawFigure(this.animKey('unit/' + e.type, e.moving, g.time - (e.firedAt ?? -9) < 0.35), 'unit/' + e.type, e.x, e.y, e.r, e.face < 0, null);
        if (e.flash > 0) { ctx.globalAlpha = 0.45; this.ring(e.x, e.y - FIGURE_H * e.r * 0.3, e.r, '#ff4040', true); ctx.globalAlpha = 1; }
        if (e.carrying) this.drawSprite('barrel', e.x + e.r * 0.8, e.y + e.r * 0.2, 0.35, 0.35);
      } else {
        const key = 'infected/' + e.type;
        let k = key;
        if (this.anims(key)) {
          if (e.x !== e.rx || e.y !== e.ry) { e.rx = e.x; e.ry = e.y; e.rmt = g.time; }
          k = this.animKey(key, g.time - (e.rmt ?? -9) < 0.2, g.time - (e.firedAt ?? -9) < 0.35);
        }
        if (shadows) this.shadow(e);
        this.drawFigure(k, key, e.x, e.y, e.r, e.face < 0, e.flash > 0 ? 0.55 : null);
      }
    }
    for (const z of zdots) {
      const [sx, sy] = cam.toScreen(z.x, z.y), r = Math.max(1.4, z.r * s * 1.2);
      ctx.fillStyle = z.flash > 0 ? '#fff' : z.def.color;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    if (s >= 8) for (const r of g.ravens) if (!r.gone && vis(r.x, r.y) && V.isVisible(r.x, r.y)) this.drawSprite('raven', r.x + Math.sin(performance.now() / 700 + r.x) * 0.2, r.y - 0.6, 0.55, 0.55);
    // Health bars sit above everything, as in the original game: green for
    // the colony, red for the infected. Shown when hurt, selected or on Alt.
    this.batching = true;
    for (const e of list) {
      if (e.kind === 'b') this.buildingBars(e, ui);
      else if (e.kind === 'u') {
        if (e.hp < e.maxHp || ui.showHp || (ui.sel && ui.sel.has(e.id))) this.headBar(e, e.hp / e.maxHp, '#5df07a');
      } else if (e.kind === 'z') {
        if (e.hp < e.maxHp - 0.5 || ui.showHp || (ui.sel && ui.sel.has(e.id))) this.headBar(e, e.hp / e.maxHp, '#e03a3a');
      } else if (e.kind === 'n') {
        if (e.hp < e.maxHp && V.isVisible(e.x + 1, e.y + 1)) this.bar(e.x, e.y - 0.25, e.w, e.hp / e.maxHp, '#e04040');
      }
    }
    this.batching = false; this.flushBars();
    for (const e of list) if (e.kind === 'u' && e.vet) this.star(e.x + e.r * 0.9, this.headY(e) + 0.05);
    this.lastDrawn = drawn;

    // Projectiles.
    for (const p of g.projectiles) {
      if (!vis(p.x, p.y)) continue;
      if (p.type === 'acid') { this.drawSprite('fx/acid', p.x, p.y, 0.35, 0.35); continue; }
      const key = p.type === 'rocket' ? 'fx/rocket' : p.type === 'bolt' ? 'fx/bolt' : 'fx/arrow';
      const ang = Math.atan2(p.ty - p.y, p.tx - p.x), [sx, sy] = cam.toScreen(p.x, p.y), a = this.sprite(key);
      if (!a) continue;
      const w = (p.type === 'bolt' ? 0.8 : 0.55) * s, h = w * a.h / a.w;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.drawImage(a.img, 0, 0, a.w, a.h, -w / 2, -h / 2, w, h); ctx.restore();
    }
    this.drawFx(ui.dt || 0.016, vis);

    // Fog.
    this.fog.draw(ctx, cam);

    // Overlays above the fog.
    if (ui.placing) this.drawPlacement(ui);
    if (ui.selBuilding) this.drawSelectionInfo(ui.selBuilding);
    if (ui.selUnitsRange) for (const u of ui.selUnitsRange) if (!u.garrisoned) this.circle(u.x, u.y, g.unitStat(u, 'range'), 'rgba(120,200,255,0.35)');
    if (ui.box) {
      const bx = ui.box; ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(125,255,154,0.08)';
      ctx.fillRect(Math.min(bx.x0, bx.x1), Math.min(bx.y0, bx.y1), Math.abs(bx.x1 - bx.x0), Math.abs(bx.y1 - bx.y0));
      ctx.strokeRect(Math.min(bx.x0, bx.x1), Math.min(bx.y0, bx.y1), Math.abs(bx.x1 - bx.x0), Math.abs(bx.y1 - bx.y0));
    }
    if (ui.ping) this.drawPing(ui.ping);
    this.drawWeather(ui.dt || 0.016);
    this.drawSwarmMarkers(b);
  }

  // Visual-only weather: snow on the Frozen Highlands, passing rain showers
  // on the Moorland and Lowlands, ash on the Caustic Lands.
  drawWeather(dt) {
    const g = this.g, t = g.settings.theme, ctx = this.ctx, cam = this.cam;
    const kind = t === 'AL' ? 'snow' : t === 'VO' ? 'ash' : (t === 'BR' || t === 'TM') && Math.sin(g.time / 400) > 0.55 ? 'rain' : null;
    if (!kind) { this.drops = null; return; }
    if (!this.drops || this.dropKind !== kind) {
      this.dropKind = kind;
      this.drops = Array.from({ length: kind === 'rain' ? 140 : 90 }, () => ({ x: Math.random() * cam.W, y: Math.random() * cam.H, s: 0.5 + Math.random() }));
    }
    ctx.save();
    if (kind === 'rain') { ctx.strokeStyle = 'rgba(180,200,230,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); }
    else ctx.fillStyle = kind === 'snow' ? 'rgba(255,255,255,0.75)' : 'rgba(200,190,160,0.5)';
    for (const d of this.drops) {
      if (kind === 'rain') { d.y += 700 * d.s * dt; d.x -= 120 * dt; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 12 * d.s); }
      else { d.y += 30 * d.s * dt; d.x += Math.sin((d.y + d.s * 100) / 40) * 12 * dt; ctx.fillRect(d.x, d.y, 2 * d.s, 2 * d.s); }
      if (d.y > cam.H) { d.y = -10; d.x = Math.random() * cam.W; }
      if (d.x < -10) d.x = cam.W;
    }
    if (kind === 'rain') ctx.stroke();
    ctx.restore();
  }

  drawGrid(b, ui) {
    const g = this.g, ctx = this.ctx, cam = this.cam, s = cam.scale, W = g.world;
    ctx.fillStyle = 'rgba(80,190,255,0.16)';
    for (let y = b.y0; y < b.y1; y++) {
      let run = -1;
      for (let x = b.x0; x <= b.x1; x++) {
        const on = x < b.x1 && W.power[x + y * W.w] > 0;
        if (on && run < 0) run = x;
        if (!on && run >= 0) { const [sx, sy] = cam.toScreen(run, y); ctx.fillRect(sx, sy, (x - run) * s + 0.5, s + 0.5); run = -1; }
      }
    }
    // Preview the extra grid of a tesla being placed.
    const p = ui.placing;
    if (p && p.def.grid && p.x != null) {
      const r = g.mods.stat('building', p.def.id, 'grid', p.def.grid);
      this.circle(p.x + 0.5, p.y + 0.5, r + 0.5, 'rgba(120,220,255,0.8)', false, 2);
    }
  }

  drawBuilding(x, selected, ui) {
    const g = this.g, ctx = this.ctx, def = x.def;
    let key = 'building/' + x.type;
    if (def.rotate && x.rot) key += '_v';
    const building = x.state === 'build';
    const alpha = building ? 0.45 + 0.4 * x.progress : x.state === 'upgrade' ? 0.8 : 1;
    if (x.type === 'telescope') this.drawBuildingSprite(key, x.x + 1, x.y + 1, 3, 3, alpha);
    else this.drawBuildingSprite(key, x.x, x.y, x.w, x.h, alpha);
    const [sx, sy] = this.cam.toScreen(x.x, x.y), s = this.cam.scale, sw = x.w * s, sh = x.h * s;
    if (def.gate && x.gateOpen > 0) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx, sy, sw, sh); }
    if (building && s > 8) {
      ctx.strokeStyle = 'rgba(255,220,120,0.7)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k <= x.w + x.h; k++) { ctx.moveTo(sx + Math.min(k, x.w) * s, sy + Math.max(0, k - x.w) * s); ctx.lineTo(sx + Math.max(0, k - x.h) * s, sy + Math.min(k, x.h) * s); }
      ctx.stroke();
    }
    if (x.state === 'infected') {
      ctx.fillStyle = x.neutral ? 'rgba(60,70,40,0.55)' : 'rgba(80,160,40,0.45)'; ctx.fillRect(sx, sy, sw, sh);
      if (s > 10) { ctx.fillStyle = '#b5ff6b'; ctx.font = `bold ${Math.max(10, s * 0.45)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(x.neutral ? 'RUIN' : '☣', sx + sw / 2, sy + sh / 2); }
    }
    if (x.off) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(sx, sy, sw, sh); }
    if (x.state === 'ok' && !x.powered && !x.neutral && !(def.wall || def.gate || def.trap || def.mine || def.garrison || def.house || def.id === 'cc' || def.id === 'hunter' || def.id === 'fisherman' || def.id === 'farm')) {
      if (s > 10) { ctx.fillStyle = '#ffd34d'; ctx.font = `bold ${Math.max(10, s * 0.5)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', sx + sw / 2, sy + sh * 0.25); }
    }
    if (def.garrison && x.garrison.length && s > 10) {
      ctx.fillStyle = '#7dd3ff'; ctx.font = `bold ${Math.max(9, s * 0.35)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('●'.repeat(x.garrison.length), sx + sw / 2, sy + sh + Math.max(9, s * 0.3));
    }
    if (selected) this.outline(x.x, x.y, x.w, x.h, '#ffffff');
  }

  // Progress and health bars of a building, drawn after every sprite so a
  // character walking in front never hides them. Health sits above the art.
  buildingBars(x, ui) {
    const def = x.def, s = this.cam.scale;
    if (x.state === 'build' || x.state === 'upgrade' || x.state === 'repair') this.bar(x.x, x.y + x.h + 0.05, x.w, x.progress, '#f2c14e');
    const damaged = x.hp < x.maxHp - 0.5 || (x.maxBarrier && x.barrier < x.maxBarrier - 0.5);
    if ((damaged || ui.showHp) && !def.trap && !def.mine && x.state !== 'build') {
      let key = 'building/' + x.type; if (def.rotate && x.rot) key += '_v';
      const a = this.assets.get(key), top = a ? x.y + x.h - Math.max(x.h, x.w * a.h / a.w) : x.y;
      this.bar(x.x, top - 0.22, x.w, x.hp / x.maxHp, '#5df07a');
      if (x.maxBarrier) this.bar(x.x, top - 0.38, x.w, x.barrier / x.maxBarrier, '#f2c14e');
    }
    if (x.queue && x.queue.length && s > 8) this.bar(x.x, x.y + x.h + 0.05, x.w, x.queue[0].t / x.queue[0].time, '#6fb6ff');
    if (x.rq && x.rq.length && s > 8) this.bar(x.x, x.y + x.h + 0.05, x.w, x.rq[0].t / x.rq[0].time, '#c79bff');
  }

  drawSelectionInfo(x) {
    const g = this.g, def = x.def;
    if (def.attack) this.circle(x.cx, x.cy, def.attack.range, 'rgba(255,200,120,0.6)');
    if (def.garrison) this.circle(x.cx, x.cy, 6 + def.garrison.range, 'rgba(120,200,255,0.45)');
    if (def.grid && x.state === 'ok') this.circle(x.cx, x.cy, gridRadius(g, x) + 0.5, 'rgba(120,220,255,0.7)');
    if (def.zone) this.rect(x.x - def.zone.radius, x.y - def.zone.radius, x.w + def.zone.radius * 2, x.h + def.zone.radius * 2, 'rgba(242,193,78,0.6)');
    if (def.harvest) this.rect(x.x - def.harvest.radius, x.y - def.harvest.radius, x.w + def.harvest.radius * 2, x.h + def.harvest.radius * 2, 'rgba(255,255,255,0.55)');
    if (x.rally) { this.ring(x.rally.x, x.rally.y, 0.3, '#7dff9a'); }
  }

  drawPlacement(ui) {
    const g = this.g, ctx = this.ctx, cam = this.cam, s = cam.scale, p = ui.placing;
    if (p.x == null) return;
    const def = p.def, [w, h] = footprint(def, p.rot);
    const ok = !p.reason;
    const tiles = p.line && p.line.length ? p.line : [{ x: p.x, y: p.y, ok }];
    for (const t of tiles) {
      const [sx, sy] = cam.toScreen(t.x, t.y);
      ctx.globalAlpha = 0.6;
      this.drawBuildingSprite('building/' + def.id + (def.rotate && p.rot ? '_v' : ''), t.x, t.y, w, h, 0.6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.ok ? 'rgba(90,255,120,0.28)' : 'rgba(255,80,80,0.35)';
      ctx.fillRect(sx, sy, w * s, h * s);
      ctx.strokeStyle = t.ok ? '#7dff9a' : '#ff6b6b'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, w * s, h * s);
    }
    if (def.attack) this.circle(p.x + w / 2, p.y + h / 2, def.attack.range, 'rgba(255,200,120,0.7)');
    if (def.garrison) this.circle(p.x + w / 2, p.y + h / 2, 6 + def.garrison.range, 'rgba(120,200,255,0.5)');
    if (def.zone) this.rect(p.x - def.zone.radius, p.y - def.zone.radius, w + def.zone.radius * 2, h + def.zone.radius * 2, 'rgba(242,193,78,0.6)');
    if (def.harvest) this.rect(p.x - def.harvest.radius, p.y - def.harvest.radius, w + def.harvest.radius * 2, h + def.harvest.radius * 2, 'rgba(255,255,255,0.7)');
    if (def.vision >= 20) this.circle(p.x + w / 2, p.y + h / 2, def.vision, 'rgba(200,200,255,0.4)');
  }

  drawSwarmMarkers(b) {
    const g = this.g, ctx = this.ctx, cam = this.cam;
    for (const grp of g.waves.groups) {
      const [sx, sy] = cam.toScreen(grp.x, grp.y);
      const inside = sx > 30 && sy > 70 && sx < cam.W - 30 && sy < cam.H - 110;
      if (inside) continue;
      const cx = cam.W / 2, cy = cam.H / 2, dx = sx - cx, dy = sy - cy;
      const k = Math.min((cam.W / 2 - 34) / Math.abs(dx || 1e-6), (cam.H / 2 - 120) / Math.abs(dy || 1e-6));
      const ex = cx + dx * k, ey = cy + dy * k, ang = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,200,40,0.95)'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`☠ ${grp.n}`, clamp(ex, 30, cam.W - 30), clamp(ey + (ey < cam.H / 2 ? 26 : -18), 80, cam.H - 100));
    }
  }

  drawPing(p) {
    const ctx = this.ctx, t = (performance.now() - p.t0) / 1000;
    if (t > 2) return;
    const r = 0.5 + t * 2;
    ctx.globalAlpha = 1 - t / 2; this.ring(p.x, p.y, r, '#ff4040'); ctx.globalAlpha = 1;
  }

  drawFx(dt, vis) {
    const g = this.g, ctx = this.ctx, cam = this.cam, s = cam.scale;
    for (const f of g.fxq) f.t += dt;
    g.fxq = g.fxq.filter((f) => f.t < (FX_LIFE[f.type] || 0.4));
    for (const f of g.fxq) {
      if (!vis(f.x, f.y, 10)) continue;
      const life = FX_LIFE[f.type] || 0.4, k = f.t / life, [sx, sy] = cam.toScreen(f.x, f.y);
      ctx.globalAlpha = 1 - k;
      switch (f.type) {
        case 'tracer': { const [ex, ey] = cam.toScreen(f.a, f.b); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); break; }
        case 'flame': { const [ex, ey] = cam.toScreen(f.a, f.b); const gr = ctx.createLinearGradient(sx, sy, ex, ey); gr.addColorStop(0, 'rgba(255,240,150,0.9)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); ctx.strokeStyle = gr; ctx.lineWidth = s * 0.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineCap = 'butt'; break; }
        case 'zap': { const [ex, ey] = cam.toScreen(f.a, f.b); ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); for (let i = 1; i < 6; i++) ctx.lineTo(sx + (ex - sx) * i / 6 + (Math.random() - 0.5) * s * 0.5, sy + (ey - sy) * i / 6 + (Math.random() - 0.5) * s * 0.5); ctx.lineTo(ex, ey); ctx.stroke(); break; }
        case 'pulse': { ctx.strokeStyle = '#9fdcff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, f.a * s * Math.min(1, k * 1.5), 0, 7); ctx.stroke(); break; }
        case 'blast': this.drawSprite('fx/blast', f.x, f.y, f.a * 2 * (0.6 + k * 0.6), f.a * 2 * (0.6 + k * 0.6)); break;
        case 'acid': this.drawSprite('fx/acidsplash', f.x, f.y, f.a * 2, f.a * 2); break;
        case 'splat': break;
        case 'ring': ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, (0.3 + k) * s * (f.a || 1), 0, 7); ctx.stroke(); break;
        case 'burst': case 'infect': {
          ctx.strokeStyle = f.type === 'infect' ? '#9cff5a' : '#ff9a3c'; ctx.lineWidth = 3;
          for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, r0 = k * s * f.a * 0.4, r1 = (0.3 + k) * s * f.a; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0); ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1); ctx.stroke(); }
          break;
        }
        case 'smash': { const [ex, ey] = cam.toScreen(f.a, f.b); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, Math.hypot(ex - sx, ey - sy), Math.atan2(ey - sy, ex - sx) - 1, Math.atan2(ey - sy, ex - sx) + 1); ctx.stroke(); break; }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ primitives
  // Bars are queued and drawn together by flushBars(): hundreds of separate
  // small fills are far slower than one path per colour.
  bar(x, y, w, k, color) {
    const [sx, sy] = this.cam.toScreen(x, y), sw = Math.round(w * this.cam.scale), h = Math.round(Math.max(2, Math.min(5, this.cam.scale * 0.07)));
    (this.barQ || (this.barQ = [])).push(Math.round(sx), Math.round(sy), sw, h, Math.max(1, Math.round(sw * clamp(k, 0, 1))), color);
    if (!this.batching) this.flushBars();
  }
  flushBars() {
    const q = this.barQ, ctx = this.ctx;
    if (!q || !q.length) return;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.beginPath();
    for (let i = 0; i < q.length; i += 6) ctx.rect(q[i] - 1, q[i + 1] - 1, q[i + 2] + 2, q[i + 3] + 2);
    ctx.fill();
    const colors = new Set(); for (let i = 5; i < q.length; i += 6) colors.add(q[i]);
    for (const c of colors) {
      ctx.fillStyle = c; ctx.beginPath();
      for (let i = 0; i < q.length; i += 6) if (q[i + 5] === c) ctx.rect(q[i], q[i + 1], q[i + 4], q[i + 3]);
      ctx.fill();
    }
    q.length = 0;
  }
  ring(x, y, r, color, fill) {
    const ctx = this.ctx, [sx, sy] = this.cam.toScreen(x, y);
    ctx.beginPath(); ctx.arc(sx, sy, r * this.cam.scale, 0, 7);
    if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
  }
  circle(x, y, r, color, fill, lw = 1.5) {
    const ctx = this.ctx, [sx, sy] = this.cam.toScreen(x, y);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(sx, sy, r * this.cam.scale, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  rect(x, y, w, h, color) {
    const ctx = this.ctx, [sx, sy] = this.cam.toScreen(x, y), s = this.cam.scale;
    ctx.setLineDash([6, 5]); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(sx, sy, w * s, h * s); ctx.setLineDash([]);
  }
  outline(x, y, w, h, color) {
    const ctx = this.ctx, [sx, sy] = this.cam.toScreen(x, y), s = this.cam.scale;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(sx - 1, sy - 1, w * s + 2, h * s + 2);
  }
  star(x, y) {
    const ctx = this.ctx, [sx, sy] = this.cam.toScreen(x, y), r = Math.max(3, this.cam.scale * 0.12);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  // ---------------------------------------------------------------- minimap
  drawMinimap(mc) {
    const g = this.g; if (!g) return;
    const W = g.world, ctx = mc.getContext('2d');
    if (!this.miniBase || this.miniBase.width !== W.w || g.world.version !== this.miniVer) {
      this.miniBase = document.createElement('canvas'); this.miniBase.width = W.w; this.miniBase.height = W.h;
      const c = this.miniBase.getContext('2d'), img = c.createImageData(W.w, W.h), pal = g.theme.palette;
      const col = {}; for (const id in TERRAIN) { const k = TERRAIN[id].key; col[id] = hexRgb(pal[k] || (k === 'stone' ? '#9a9a90' : k === 'iron' ? '#8a5a40' : k === 'gold' ? '#c8a840' : k === 'oil' ? '#202020' : pal.grass)); }
      for (let i = 0; i < W.w * W.h; i++) { const c3 = col[W.tiles[i]]; img.data[i * 4] = c3[0]; img.data[i * 4 + 1] = c3[1]; img.data[i * 4 + 2] = c3[2]; img.data[i * 4 + 3] = 255; }
      c.putImageData(img, 0, 0);
      this.miniVer = g.world.version;
    }
    const sc = mc.width / W.w;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.miniBase, 0, 0, mc.width, mc.height);
    const V = g.vision;
    for (const b of g.buildings) { if (!V.isExplored(b.cx | 0, b.cy | 0)) continue; ctx.fillStyle = b.neutral ? '#777' : b.state === 'infected' ? '#9cff5a' : b.def.wall || b.def.gate ? '#d8d8d8' : '#4ade80'; ctx.fillRect(b.x * sc, b.y * sc, Math.max(1.5, b.w * sc), Math.max(1.5, b.h * sc)); }
    for (const n of g.nests) if (V.isExplored(n.x | 0, n.y | 0)) { ctx.fillStyle = '#b02020'; ctx.fillRect(n.x * sc, n.y * sc, n.w * sc + 1, n.h * sc + 1); }
    ctx.fillStyle = '#ff3b3b';
    for (const z of g.infected) {
      if (!V.revealAll && V.visible[(z.x | 0) + (z.y | 0) * W.w] !== 1) continue;
      if (z.def.giant || z.type === 'behemoth') continue;
      ctx.fillRect(z.x * sc - 0.6, z.y * sc - 0.6, 1.4, 1.4);
    }
    for (const z of g.infected) if ((z.def.giant || z.type === 'behemoth') && (V.revealAll || V.isExplored(z.x | 0, z.y | 0))) { ctx.fillStyle = z.def.giant ? '#ff8a00' : '#d050ff'; ctx.beginPath(); ctx.arc(z.x * sc, z.y * sc, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#6fd0ff'; for (const u of g.units) ctx.fillRect(u.x * sc - 1, u.y * sc - 1, 2.5, 2.5);
    // Fog on the minimap.
    if (!V.revealAll) {
      if (!this.miniFog || this.miniFog.width !== W.w) { this.miniFog = document.createElement('canvas'); this.miniFog.width = W.w; this.miniFog.height = W.h; this.miniFogImg = this.miniFog.getContext('2d').createImageData(W.w, W.h); }
      const d = this.miniFogImg.data; for (let i = 0; i < W.w * W.h; i++) d[i * 4 + 3] = V.explored[i] ? (V.visible[i] ? 0 : 90) : 255;
      this.miniFog.getContext('2d').putImageData(this.miniFogImg, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(this.miniFog, 0, 0, mc.width, mc.height);
    }
    for (const grp of g.waves.groups) { ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☠', grp.x * sc, grp.y * sc); }
    const b = this.cam.bounds(0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(b.fx0 * sc, b.fy0 * sc, (b.fx1 - b.fx0) * sc, (b.fy1 - b.fy0) * sc);
  }
}

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
