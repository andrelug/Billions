import { BUILDINGS } from './buildings.js';
import { UNITS } from './units.js';
import { INFECTED } from './infected.js';
import { THEMES } from './maps.js';
import { PX } from '../view/placeholder.js';

// Every sprite the game draws. The placeholder generator writes one PNG per
// entry to assets/<file>; replace any PNG with real art at the same size.
// Rules (also in ASSETS.md):
//  - 64 px = 1 map tile. Top-down view.
//  - Buildings: anchor top-left of the footprint; size = footprint x 64.
//  - Units and infected: art faces RIGHT (the game mirrors it); the body is
//    measured and scaled to FIGURE_H radii tall, feet on the ground point.
//  - Terrain tiles: 64x64, seamless, 4 variants per type and theme.
// Characters stand FIGURE_H collision radii tall from feet to head (a Ranger
// is about 0.8 cell, so a squad reads clearly next to a 2x2 house, as in They
// Are Billions), with their feet FEET radii below the entity's centre. The renderer measures the body in each sprite,
// so the art's padding does not change the size on screen.
export const FIGURE_H = 2.6;
export const FEET = 0.4;

const CAT_COLOR = { colony: '#c9a24b', food: '#9fbf4a', resource: '#9c6b3c', energy: '#5aa0d8', research: '#8f6bc4', military: '#b04a4a', defense: '#7d7d86', wonder: '#e0c060' };
const LABEL = {
  cc: 'CC', tent: 'TENT', cottage: 'COT', stonehouse: 'HOUSE', hunter: 'HUNT', fisherman: 'FISH', farm: 'FARM', advfarm: 'FARM+',
  sawmill: 'SAW', quarry: 'QRY', advquarry: 'QRY+', oilplatform: 'OIL', tesla: 'T', mill: 'MILL', advmill: 'MILL+', powerplant: 'POWER',
  warehouse: 'STORE', market: 'MKT', bank: 'BANK', inn: 'INN', woodworkshop: 'WOOD WS', stoneworkshop: 'STONE WS', foundry: 'FOUNDRY',
  soldierscenter: 'SOLDIERS', engineeringcenter: 'ENGINEER', lookout: 'LO', radar: 'RAD', woodwall: '', stonewall: '', woodgate: 'GATE',
  stonegate: 'GATE', woodtower: 'TW', stonetower: 'TW', ballista: 'BAL', executor: 'EXE', shocking: 'SHK', wasp: 'W', stakes: '', wirefence: '',
  mine: 'M', telescope: 'EYE', crystalpalace: 'PALACE', academy: 'ACADEMY', victory: 'VICTORY', spire: 'SPIRE', transmutator: 'ATLAS',
};
const SHAPE = { tent: 'house', cottage: 'house', stonehouse: 'house', hunter: 'house', fisherman: 'house', farm: 'field', advfarm: 'field',
  woodwall: 'wall', stonewall: 'wall', woodgate: 'gate', stonegate: 'gate', woodtower: 'tower', stonetower: 'tower', lookout: 'tower', radar: 'tower',
  tesla: 'tower', wasp: 'tower', ballista: 'tower', executor: 'tower', shocking: 'tower', stakes: 'trap', wirefence: 'trap', mine: 'tower',
  telescope: 'wonder', crystalpalace: 'wonder', academy: 'wonder', victory: 'wonder', spire: 'wonder', transmutator: 'wonder' };
const BCOLOR = { woodwall: '#8a6a44', stonewall: '#8d8d8d', woodgate: '#7a5a34', stonegate: '#7d7d7d', woodtower: '#8a6a44', stonetower: '#9a9a9a',
  stakes: '#6b5232', wirefence: '#6b6b70', mine: '#5a5a40', cc: '#c9a24b', telescope: '#d8c27a' };
const UCOLOR = { ranger: '#5db8ff', soldier: '#2f6db5', sniper: '#3f8f8f', pyro: '#d06a2a', rocketeer: '#8a5ac4', titan: '#6b7480', mutant: '#7a3a8a' };
const ULABEL = { ranger: 'R', soldier: 'S', sniper: 'SN', pyro: 'P', rocketeer: 'RK', titan: 'TI', mutant: 'MU' };
const ZLABEL = { decrepit: '', aged: '', young: '', colonist: '', fresh: '', executive: 'E', chubby: 'C', harpy: 'H', venom: 'V', giant: 'G', behemoth: 'B' };
export const TERRAIN_DECO = { grass: 'tufts', forest: 'trees', mountain: 'rocks', stone: 'rocks', iron: 'ore', gold: 'ore', water: 'waves', oil: 'oil', mud: 'tufts' };
const TERRAIN_BASE = { stone: '#8f8f88', iron: '#7a5a48', gold: '#8a7a48', oil: null };

export function assetSpecs() {
  const out = [];
  const add = (s) => { s.file = s.file || s.key + '.png'; out.push(s); };
  for (const id in BUILDINGS) {
    const d = BUILDINGS[id];
    const color = BCOLOR[id] || CAT_COLOR[d.cat] || '#999';
    add({ key: 'building/' + id, kind: 'building', w: d.size[0] * PX, h: d.size[1] * PX, color, label: LABEL[id] ?? d.name, shape: SHAPE[id], ax: 0, ay: 0, desc: `${d.name}, ${d.size[0]}x${d.size[1]} tiles` });
    if (d.rotate) add({ key: 'building/' + id + '_v', kind: 'building', w: d.size[1] * PX, h: d.size[0] * PX, color, label: LABEL[id] ?? d.name, shape: SHAPE[id], ax: 0, ay: 0, desc: `${d.name}, rotated ${d.size[1]}x${d.size[0]}` });
  }
  for (const id in UNITS) {
    const u = UNITS[id], s = Math.max(64, Math.ceil(u.r * 2.6 * PX / 32) * 32);
    add({ key: 'unit/' + id, kind: 'unit', w: s, h: s, color: UCOLOR[id], label: ULABEL[id], radius: u.r * PX / s * 1.05, ax: 0.5, ay: 0.5, desc: `${u.name}, faces right` });
  }
  for (const id in INFECTED) {
    const z = INFECTED[id], s = Math.max(48, Math.ceil(z.r * 2.6 * PX / 16) * 16);
    add({ key: 'infected/' + id, kind: 'infected', w: s, h: s, color: z.color, label: ZLABEL[id], radius: z.r * PX / s * 1.05, ax: 0.5, ay: 0.5, desc: `${z.name}, faces right` });
  }
  for (const [size, n, c] of [['small', 2, '#5a3a3a'], ['medium', 3, '#6a3030'], ['large', 4, '#7a2626']]) {
    add({ key: 'nest/' + size, kind: 'building', w: n * PX, h: n * PX, color: c, label: 'DOOM', shape: 'house', ax: 0, ay: 0, desc: `Village of Doom building (${size})` });
  }
  for (const t in THEMES) {
    const th = THEMES[t];
    for (const type of ['grass', 'forest', 'mountain', 'stone', 'iron', 'gold', 'water', 'oil', 'mud']) {
      for (let v = 0; v < 4; v++) {
        const base = type === 'oil' ? th.palette.grass : TERRAIN_BASE[type] || th.palette[type] || th.palette.grass;
        add({ key: `terrain/${t}/${type}_${v}`, kind: 'terrain', w: PX, h: PX, color: base, color2: type === 'forest' ? th.palette.forest : type === 'mountain' || type === 'stone' ? shadeHex(base, 0.25) : undefined, color3: type === 'iron' ? '#c9772e' : type === 'gold' ? '#ffd34d' : undefined, deco: TERRAIN_DECO[type], ax: 0, ay: 0, desc: `${th.name} ${type} tile ${v}` });
      }
    }
  }
  const PICK = { gold: '#ffd34d', wood: '#9c6b3c', stone: '#9a9a9a', iron: '#c9772e', oil: '#333', food: '#9fbf4a', energy: '#5aa0d8', workers: '#e0e0e0' };
  for (const k in PICK) add({ key: 'pickup/' + k, kind: 'icon', w: 48, h: 48, color: PICK[k], label: k[0].toUpperCase(), ax: 0.5, ay: 0.5, desc: `Map pickup: ${k}` });
  for (const k in PICK) add({ key: 'icon/' + k, kind: 'icon', w: 48, h: 48, color: PICK[k], label: k === 'workers' ? 'W' : k[0].toUpperCase(), ax: 0.5, ay: 0.5, desc: `HUD icon: ${k}` });
  add({ key: 'icon/colonists', kind: 'icon', w: 48, h: 48, color: '#e8c39e', label: 'C', ax: 0.5, ay: 0.5, desc: 'HUD icon: colonists' });
  add({ key: 'barrel', kind: 'icon', w: 40, h: 40, color: '#c43a2a', label: '!', ax: 0.5, ay: 0.5, desc: 'Explosive barrel' });
  add({ key: 'raven', kind: 'icon', w: 32, h: 32, color: '#222', label: '', ax: 0.5, ay: 0.5, desc: 'Raven' });
  add({ key: 'mayor/m', kind: 'icon', w: 128, h: 128, color: '#6b5a8a', label: 'M', ax: 0.5, ay: 0.5, desc: 'Mayor portrait (male)' });
  add({ key: 'mayor/f', kind: 'icon', w: 128, h: 128, color: '#8a5a6b', label: 'F', ax: 0.5, ay: 0.5, desc: 'Mayor portrait (female)' });
  const FX = { arrow: ['bolt', '#e8d8b0', 32, 8], bolt: ['bolt', '#f0e0c0', 48, 12], rocket: ['rocket', '#888', 40, 16], acid: ['dot', '#8cd23a', 24, 24],
    blast: ['blast', '#ff9a3c', 128, 128], acidsplash: ['splat', '#8cd23a', 64, 64], blood: ['splat', '#5a1a14', 48, 48], ichor: ['splat', '#3a4a1a', 48, 48], ring: ['ring', '#ffffff', 64, 64] };
  for (const k in FX) { const [shape, color, w, h] = FX[k]; add({ key: 'fx/' + k, kind: 'fx', shape, color, w, h, ax: 0.5, ay: 0.5, desc: `Effect: ${k}` }); }
  return out;
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f;
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
