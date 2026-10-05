import { T } from '../sim/worldgen.js';

// Survival setup. Six map themes unlocked in order, five population levels and
// four game lengths. The score multiplier is theme x population x duration.
export const MAP_SIZE = 184;     // playable square; swarm generators sit 85 cells from the centre
export const HOUR = 3.75;          // seconds per game hour
export const DAY = 90;             // seconds per game day
export const TICK = 30;            // resources are paid every 8 game hours
// Movement pace. Speeds in the unit and infected tables are the original
// game's panel values (Ranger 4, Soldier 2.4); everything walks at this
// fraction of them. Tuned by eye against footage of the original game, where
// troops, patrols and swarms move more slowly than the raw numbers suggest.
export const MOVE_SCALE = 0.75;

export const THEMES = {
  FA: {
    name: 'The Deep Forest', order: 1, score: 0.8, unlock: null,
    desc: 'Lots of pockets and choke points. No special infected on the map.',
    food: { earth: 0.2, grass: 0.3, trees: 0.6 },
    giants: 0, behemoths: 0, villages: 1, villageSize: [3, 4], nestFactor: 0.5, density: 0.35,
    tiers: { weak: 34, medium: 58, strong: 82, powerful: 200 },
    treasures: [3, 4], oldTowers: [1, 2], energy: [2, 3], foodPick: [2, 3], ravens: 8,
    gen: { water: 0.05, mountain: 0.1, forest: 0.32, mud: 0.06, stone: 14, iron: 9, gold: 4, oil: 6, scales: { water: 18, mountain: 12, forest: 9 } },
    ground: 'grass', palette: { grass: '#4f7f3a', forest: '#2c5a26', mountain: '#6b6b63', water: '#2f6f9f', mud: '#6b5a3a' },
  },
  BR: {
    name: 'The Dark Moorland', order: 2, score: 1.0, unlock: { theme: 'FA', score: 0.2 },
    desc: 'Intricate gorges, rivers and pools. First map with special infected and a Giant.',
    food: { earth: 0.15, grass: 0.3, trees: 0.6 },
    giants: 1, behemoths: 1, villages: 1, villageSize: [5, 7], nestFactor: 0.8, density: 0.38,
    tiers: { weak: 34, medium: 52, strong: 70, powerful: 92 },
    treasures: [3, 4], oldTowers: [1, 2], energy: [2, 3], foodPick: [2, 3], ravens: 12,
    gen: { water: 0.13, mountain: 0.17, forest: 0.12, mud: 0.12, stone: 13, iron: 8, gold: 4, oil: 6, scales: { water: 9, mountain: 8, forest: 7 } },
    ground: 'moor', palette: { grass: '#566b3c', forest: '#2f4a2a', mountain: '#5e5a54', water: '#2b5878', mud: '#5a4c36' },
  },
  TM: {
    name: 'The Peaceful Lowlands', order: 3, score: 1.15, unlock: { theme: 'BR', score: 0.4 },
    desc: 'Open land and large lakes. Four Villages of Doom.',
    food: { earth: 0.1, grass: 0.3, trees: 0.5 },
    giants: 1, behemoths: 1, villages: 4, villageSize: [7, 10], nestFactor: 1, density: 0.4,
    tiers: { weak: 32, medium: 50, strong: 68, powerful: 88 },
    treasures: [4, 5], oldTowers: [1, 2], energy: [2, 3], foodPick: [1, 2], ravens: 24,
    gen: { water: 0.15, mountain: 0.06, forest: 0.1, mud: 0.06, stone: 12, iron: 8, gold: 3, oil: 6, scales: { water: 26, mountain: 14, forest: 10 } },
    ground: 'grass', palette: { grass: '#5c8f3e', forest: '#2f6a2a', mountain: '#727068', water: '#3378a8', mud: '#6b5a3a' },
  },
  AL: {
    name: 'The Frozen Highlands', order: 4, score: 1.35, unlock: { theme: 'TM', score: 0.6 },
    desc: 'Snowy mountains. Buildings need 30% more energy, units are slower, infected hear less.',
    food: { earth: 0, grass: 0.4, trees: 0.6 },
    giants: 1, behemoths: 2, villages: 2, villageSize: [7, 10], nestFactor: 1, density: 0.4,
    tiers: { weak: 30, medium: 48, strong: 66, powerful: 86 },
    treasures: [3, 4], oldTowers: [1, 2], energy: [5, 6], foodPick: [1, 2], ravens: 0,
    mods: [{ path: 'building.*.need.energy', pct: 0.3 }, { path: 'awareness', pct: -0.5 }, { path: 'unit.*.speed', pct: -0.2 }],
    gen: { water: 0.1, mountain: 0.23, forest: 0.1, mud: 0.04, stone: 12, iron: 8, gold: 3, oil: 5, scales: { water: 14, mountain: 11, forest: 8 } },
    ground: 'snow', palette: { grass: '#d8e2ea', forest: '#3d5a4a', mountain: '#8b95a0', water: '#6d9cc4', mud: '#a8b4bf' },
  },
  DS: {
    name: 'The Desolated Wasteland', order: 5, score: 1.55, unlock: { theme: 'AL', score: 0.8 },
    desc: 'Open desert, many deposits, far sight. Infected are 30% more alert.',
    food: { earth: 0, grass: 0.3, trees: 0.6 },
    giants: 1, behemoths: 3, villages: 3, villageSize: [8, 10], nestFactor: 1, density: 0.42,
    tiers: { weak: 28, medium: 46, strong: 64, powerful: 82 },
    treasures: [5, 6], oldTowers: [2, 3], energy: [1, 2], foodPick: [5, 6], ravens: 40,
    mods: [{ path: 'awareness', pct: 0.3 }, { path: 'vision', pct: 0.1 }],
    gen: { water: 0.03, mountain: 0.15, forest: 0.06, mud: 0.15, stone: 20, iron: 14, gold: 6, oil: 12, scales: { water: 5, mountain: 5, forest: 5 } },
    ground: 'sand', palette: { grass: '#c9a86a', forest: '#6b7a3a', mountain: '#9a6b4a', water: '#3f86a8', mud: '#b08a58' },
  },
  VO: {
    name: 'Caustic Lands', order: 6, score: 1.75, unlock: { theme: 'DS', score: 1.0 },
    desc: 'Toxic land with one giant Village of Doom of 22 buildings.',
    food: { earth: 0.15, grass: 0.3, trees: 0.6 },
    giants: 2, behemoths: 4, villages: 1, villageSize: [22, 22], nestFactor: 1.5, density: 0.45,
    tiers: { weak: 24, medium: 36, strong: 52, powerful: 70 },
    treasures: [3, 4], oldTowers: [2, 3], energy: [2, 3], foodPick: [2, 3], ravens: 12,
    gen: { water: 0.1, mountain: 0.18, forest: 0.12, mud: 0.15, stone: 14, iron: 10, gold: 7, goldMin: 18, oil: 7, scales: { water: 12, mountain: 10, forest: 8 } },
    ground: 'caustic', palette: { grass: '#6b7a3a', forest: '#3a4a26', mountain: '#5a5048', water: '#4a8a5a', mud: '#7a6a3a' },
  },
};
export const THEME_ORDER = ['FA', 'BR', 'TM', 'AL', 'DS', 'VO'];

// Infected population: scales map infected, Villages of Doom and swarms.
// The score multiplier is theme x population x duration (inferred model that
// matches every published data point: 100% = Dark Moorland, Medium, 100 days;
// Very High + 80 days gives 410%..900% across the six themes).
export const POPULATIONS = {
  verylow:  { name: 'Very Low', factor: 0.5, score: 0.3 },
  low:      { name: 'Low', factor: 0.8, score: 0.75 },
  medium:   { name: 'Medium', factor: 1.0, score: 1.0 },
  high:     { name: 'High', factor: 1.2, score: 1.75 },
  veryhigh: { name: 'Very High', factor: 1.5, score: 2.8 },
};
export const POP_ORDER = ['verylow', 'low', 'medium', 'high', 'veryhigh'];

export const DURATIONS = {
  80:  { days: 80, score: 1.84, label: 'Brutal' },
  100: { days: 100, score: 1.0, label: 'Challenging' },
  120: { days: 120, score: 0.75, label: 'Accessible' },
  150: { days: 150, score: 0.5, label: 'Easy' },
};
export const DURATION_ORDER = [150, 120, 100, 80];

export const TERRAIN_KEYS = { [T.GRASS]: 'grass', [T.FOREST]: 'forest', [T.MOUNTAIN]: 'mountain', [T.STONE]: 'stone', [T.IRON]: 'iron', [T.GOLD]: 'gold', [T.WATER]: 'water', [T.OIL]: 'oil', [T.MUD]: 'mud' };

export function scoreFactor(theme, pop, days) {
  return THEMES[theme].score * POPULATIONS[pop].score * DURATIONS[days].score;
}
