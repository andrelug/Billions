'use strict';
// ---------------------------------------------------------------------------
// Game configuration: tuning numbers, buildings, units, zombies, hordes.
// All rates are "per day" unless stated otherwise.
// ---------------------------------------------------------------------------
const CFG = {
  TILE: 32,            // world pixels per tile
  MAP_W: 64,
  MAP_H: 64,
  DAY_LENGTH: 50,      // seconds of game time per day
  TOTAL_DAYS: 30,
  START_RES: { gold: 400, wood: 250, stone: 100 },
  AMBIENT_ZOMBIES: 120,
  AMBIENT_MIN_DIST: 17,    // tiles from the Command Center
  HORDE_SPAWN_FRAC: 0.5,   // hordes spawn at mid-day and reach the colony at night
  SAVE_KEY: 'billions-save-v1',
  MAX_SPEED: 3,
};

const T = { GRASS: 0, FOREST: 1, ROCK: 2, WATER: 3 };

const BUILDINGS = {
  cc: {
    name: 'Command Center', icon: '🏛️', w: 3, h: 3, hp: 2500, cost: {},
    workers: 12, food: 10, gold: 30, wood: 10, stone: 4,
    color: '#c9a24b', fixed: true,
    desc: 'The heart of the colony. If it falls, everything is lost.',
  },
  tent: {
    name: 'Tent', icon: '⛺', w: 1, h: 1, hp: 120, cost: { gold: 20, wood: 12 },
    workers: 4, food: -2, gold: 5, color: '#d9b36b', infect: 3,
    desc: '+4 workers, +5 gold/day. Eats 2 food. Turns into zombies if overrun!',
  },
  farm: {
    name: 'Farm', icon: '🌾', w: 2, h: 2, hp: 200, cost: { gold: 40, wood: 30 },
    workers: -2, yields: { res: 'food', tile: 0, radius: 2, per: 0.3 }, color: '#b8c24a',
    desc: 'Grows food on open grass around it (radius 2). Needs 2 workers.',
  },
  sawmill: {
    name: 'Sawmill', icon: '🪵', w: 2, h: 2, hp: 220, cost: { gold: 50, stone: 10 },
    workers: -3, yields: { res: 'wood', tile: 1, radius: 3, per: 1.0 }, color: '#9c6b3c',
    desc: 'Harvests wood from forest within radius 3. Needs 3 workers.',
  },
  quarry: {
    name: 'Quarry', icon: '⛏️', w: 2, h: 2, hp: 260, cost: { gold: 60, wood: 40 },
    workers: -4, yields: { res: 'stone', tile: 2, radius: 3, per: 1.5 }, color: '#8d8d8d',
    desc: 'Mines stone from rock within radius 3. Needs 4 workers.',
  },
  wall: {
    name: 'Wall', icon: '🧱', w: 1, h: 1, hp: 800, cost: { wood: 5, stone: 1 },
    workers: 0, color: '#6e6e6e', wall: true,
    desc: 'Cheap and sturdy. Zombies must chew through it. Your units can pass.',
  },
  tower: {
    name: 'Ballista', icon: '🏹', w: 1, h: 1, hp: 320, cost: { gold: 50, wood: 20, stone: 15 },
    workers: -1, attack: { range: 6, dmg: 18, cd: 1.1 }, color: '#7a5c9e',
    desc: 'Automated turret. Range 6, 18 damage, shoots over walls. Needs 1 worker.',
  },
  barracks: {
    name: 'Barracks', icon: '⚔️', w: 2, h: 2, hp: 450, cost: { gold: 120, wood: 70, stone: 30 },
    workers: -4, trains: ['ranger', 'soldier'], color: '#9e4a4a',
    desc: 'Trains Rangers and Soldiers. Needs 4 workers.',
  },
};
const BUILD_ORDER = ['tent', 'farm', 'sawmill', 'quarry', 'wall', 'tower', 'barracks'];

const UNITS = {
  ranger: {
    name: 'Ranger', icon: '🏹', hp: 60, speed: 2.6, range: 5, dmg: 9, cd: 0.8,
    cost: { gold: 40, wood: 10 }, train: 8, aggro: 7, color: '#5db8ff',
    desc: 'Fast, long range, fragile.',
  },
  soldier: {
    name: 'Soldier', icon: '🔫', hp: 160, speed: 1.9, range: 4, dmg: 16, cd: 0.9,
    cost: { gold: 90, wood: 20, stone: 10 }, train: 12, aggro: 6, color: '#2f6db5',
    desc: 'Tough and hard hitting.',
  },
};

const ZOMBIES = {
  walker: { name: 'Walker', hp: 35, speed: 0.9, dmg: 5, cd: 1.0, aggro: 6, r: 0.3, color: '#6b8f3e' },
  runner: { name: 'Runner', hp: 22, speed: 2.6, dmg: 4, cd: 0.7, aggro: 9, r: 0.26, color: '#9ab84e' },
  brute:  { name: 'Brute',  hp: 220, speed: 0.75, dmg: 30, cd: 1.5, aggro: 6, r: 0.5, color: '#3e5b2a' },
};

// Horde schedule. Sides are rolled when a new game starts.
const HORDES = [
  { day: 5,  comp: { walker: 30 } },
  { day: 10, comp: { walker: 55, runner: 15 } },
  { day: 15, comp: { walker: 80, runner: 25, brute: 3 } },
  { day: 20, comp: { walker: 110, runner: 35, brute: 6 } },
  { day: 25, comp: { walker: 150, runner: 60, brute: 12 } },
  { day: 30, comp: { walker: 240, runner: 100, brute: 24 }, final: true },
];

const SIDES = ['North', 'East', 'South', 'West'];

// Difficulty scales horde and raid sizes.
const DIFFICULTY = {
  easy:   { name: 'Easy',   horde: 0.6, raid: 0.5 },
  normal: { name: 'Normal', horde: 1.0, raid: 1.0 },
  hard:   { name: 'Hard',   horde: 1.4, raid: 1.3 },
};
