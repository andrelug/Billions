// All Survival buildings. Values follow the reference game's rules table.
// Units: build time in seconds; per-tick values are paid every TICK (30 s).
//   cost     : paid at placement
//   need     : capacities reserved while the building exists (workers/energy/food)
//   supply   : capacities provided once built (colonists/workers/food/energy/storage)
//   income   : resources added each tick (gold, oil)
//   upkeep   : resources removed each tick
//   barrier  : defensive barrier (yellow bar) drained by infected before infection
//   harvest  : production from surrounding cells, see sim/buildings.js
//   place    : terrain requirement: empty | nearSea | nearWood | nearMineral | nearGrass | oil | cc
//   margin   : free ring other buildings may not use; ignoreMargin: may sit in others' margins
//   sameMargin: minimum gap to another building of the same family
//   tech     : research needed; needs: building that must exist
export const BUILDINGS = {
  cc: {
    name: 'Command Center', cat: 'colony', size: [5, 5], hp: 5000, barrier: 2500, vision: 16,
    cost: { gold: 2000, wood: 50, stone: 50 }, need: {}, supply: { colonists: 10, workers: 10, food: 20, energy: 30, storage: 50 },
    income: { gold: 200 }, grid: 10, fire: 0.5, infectable: true, endGame: true, noDemolish: true, margin: 1, fixed: true,
    desc: 'Heart of the colony. Projects the energy grid. If it is infected or destroyed, the game is lost.',
  },
  tent: {
    name: 'Tent', cat: 'colony', size: [2, 2], hp: 60, barrier: 15, vision: 6, build: 21,
    cost: { gold: 30 }, need: { energy: 1, food: 4 }, supply: { colonists: 4, workers: 2 }, income: { gold: 8 },
    house: true, margin: 0, maxAdjacent: 2, minEmpty: 3, upgradeTo: 'cottage', infectable: true, fire: 1,
    desc: 'Basic dwelling. 4 colonists, 2 workers, +8 gold per tick.',
  },
  cottage: {
    name: 'Wooden Cottage', cat: 'colony', size: [2, 2], hp: 200, barrier: 50, vision: 6, build: 36, upgradeTime: 14,
    cost: { gold: 120, wood: 12 }, need: { energy: 3, food: 8 }, supply: { colonists: 8, workers: 4 }, income: { gold: 18 },
    house: true, margin: 0, maxAdjacent: 2, minEmpty: 3, upgradeTo: 'stonehouse', tech: 'woodhouse', infectable: true, fire: 1,
    desc: 'Upgraded dwelling. 8 colonists, 4 workers, +18 gold per tick.',
  },
  stonehouse: {
    name: 'Stone House', cat: 'colony', size: [2, 2], hp: 500, barrier: 125, vision: 6, build: 48, upgradeTime: 21,
    cost: { gold: 300, wood: 5, stone: 10 }, need: { energy: 10, food: 16 }, supply: { colonists: 16, workers: 8 }, income: { gold: 40 },
    house: true, margin: 0, maxAdjacent: 2, minEmpty: 3, tech: 'stonehouse', infectable: true, fire: 0.5,
    desc: 'Best dwelling. 16 colonists, 8 workers, +40 gold per tick.',
  },
  hunter: {
    name: 'Hunter Cottage', cat: 'food', size: [1, 1], hp: 160, barrier: 40, vision: 6, build: 30,
    cost: { gold: 80 }, need: { energy: 1 }, supply: { colonists: 2 }, upkeep: { gold: 2 },
    harvest: { kind: 'hunt', radius: 3, per: 0.8 }, margin: 1, infectable: true, fire: 1,
    desc: 'Food from wild land around it (radius 3). Forest gives most, open grass less.',
  },
  fisherman: {
    name: 'Fisherman Cottage', cat: 'food', size: [1, 1], hp: 160, barrier: 40, vision: 6, build: 30,
    cost: { gold: 80 }, need: { energy: 1 }, supply: { colonists: 2 }, upkeep: { gold: 2 },
    harvest: { kind: 'fish', radius: 3, per: 0.66 }, place: 'nearSea', margin: 1, infectable: true, fire: 1,
    desc: 'Food from water cells within radius 3. Must touch water.',
  },
  farm: {
    name: 'Farm', cat: 'food', size: [2, 2], hp: 300, barrier: 75, vision: 6, build: 45,
    cost: { gold: 300, wood: 30 }, need: { energy: 4 }, supply: { colonists: 12 }, upkeep: { gold: 20 },
    harvest: { kind: 'farm', radius: 2, per: 2, max: 32 }, place: 'nearGrass', margin: 1, sameMargin: 4, upgradeTo: 'advfarm',
    tech: 'farms', infectable: true, fire: 1,
    desc: 'Plants wheat on grass within radius 2: 2 food per cell, up to 64.',
  },
  advfarm: {
    name: 'Advanced Farm', cat: 'food', size: [2, 2], hp: 500, barrier: 125, vision: 7, build: 60, upgradeTime: 26,
    cost: { gold: 1200, wood: 30, stone: 20, iron: 20, oil: 20 }, need: { energy: 30 }, supply: { colonists: 24 }, upkeep: { gold: 50 },
    harvest: { kind: 'farm', radius: 2, per: 4, max: 32 }, place: 'nearGrass', margin: 1, sameMargin: 4, tech: 'advfarm', needs: 'foundry',
    infectable: true, fire: 0.5,
    desc: 'Wheat on grass within radius 2: 4 food per cell, up to 128.',
  },
  sawmill: {
    name: 'Sawmill', cat: 'resource', size: [2, 2], hp: 200, barrier: 50, vision: 6, build: 39,
    cost: { gold: 300 }, need: { workers: 4, energy: 4 }, upkeep: { gold: 4 },
    harvest: { kind: 'wood', radius: 3, per: 0.5 }, place: 'nearWood', margin: 1, toggle: true, infectable: true, fire: 1,
    desc: 'Cuts wood from forest within radius 3: 0.5 wood per tree cell each tick.',
  },
  quarry: {
    name: 'Quarry', cat: 'resource', size: [2, 2], hp: 200, barrier: 50, vision: 6, build: 39,
    cost: { gold: 300, wood: 30 }, need: { workers: 4, energy: 4 }, upkeep: { gold: 6 },
    harvest: { kind: 'mine', radius: 2, per: 0.5, goldPer: 10 }, place: 'nearMineral', margin: 1, toggle: true, upgradeTo: 'advquarry',
    infectable: true, fire: 1,
    desc: 'Mines stone from mountains and stone deposits, and iron, within radius 2 (0.5 per cell), plus 10 gold per gold-ore cell.',
  },
  advquarry: {
    name: 'Advanced Quarry', cat: 'resource', size: [2, 2], hp: 600, barrier: 150, vision: 7, build: 45, upgradeTime: 21,
    cost: { gold: 1200, wood: 30, iron: 20, oil: 20 }, need: { workers: 6, energy: 15 }, upkeep: { gold: 30 },
    harvest: { kind: 'mine', radius: 2, per: 1, goldPer: 20 }, place: 'nearMineral', margin: 1, toggle: true, tech: 'advquarry', needs: 'foundry',
    infectable: true, fire: 0.5,
    desc: 'Mines 1 stone (mountains and stone deposits) or iron per cell and 20 gold per gold-ore cell within radius 2.',
  },
  oilplatform: {
    name: 'Oil Platform', cat: 'resource', size: [2, 2], hp: 500, barrier: 125, vision: 7, build: 60,
    cost: { gold: 1200, stone: 20, iron: 20 }, need: { workers: 10, energy: 30 }, upkeep: { gold: 80 }, income: { oil: 10 },
    place: 'oil', ignoreMargin: true, toggle: true, tech: 'oilplatform', needs: 'foundry', infectable: true, fire: 0.25,
    desc: 'Pumps 10 oil per tick. Must be built on an oil pool.',
  },
  tesla: {
    name: 'Tesla Tower', cat: 'energy', size: [1, 1], hp: 140, barrier: 35, vision: 8, build: 30,
    cost: { gold: 200, wood: 10 }, need: { workers: 1 }, upkeep: { gold: 4 }, grid: 8,
    margin: 0, sameMargin: 4, ignoreMargin: true, infectable: true, fire: 1,
    desc: 'Extends the energy grid 8 cells around it. Must be placed inside the grid.',
  },
  mill: {
    name: 'Mill', cat: 'energy', size: [2, 2], hp: 200, barrier: 50, vision: 6, build: 39,
    cost: { gold: 300, wood: 20 }, need: { workers: 4 }, upkeep: { gold: 6 }, supply: { energy: 30 },
    margin: 1, sameMargin: 4, family: 'mill', upgradeTo: 'advmill', infectable: true, fire: 1,
    desc: 'Wind mill. +30 energy. Must be 4 cells from other mills.',
  },
  advmill: {
    name: 'Advanced Mill', cat: 'energy', size: [2, 2], hp: 600, barrier: 150, vision: 7, build: 45, upgradeTime: 21,
    cost: { gold: 800, iron: 20 }, need: { workers: 6 }, upkeep: { gold: 30 }, supply: { energy: 60 },
    margin: 1, sameMargin: 4, family: 'mill', tech: 'ironmill', needs: 'foundry', infectable: true, fire: 0.25,
    desc: 'Steel wind mill. +60 energy.',
  },
  powerplant: {
    name: 'Power Plant', cat: 'energy', size: [3, 3], hp: 800, barrier: 200, vision: 6, build: 60,
    cost: { gold: 800, wood: 50, stone: 30 }, need: { workers: 8 }, upkeep: { gold: 40, wood: 10 }, supply: { energy: 160 },
    margin: 1, tech: 'powerplant', needs: 'stoneworkshop', infectable: true, fire: 0.25,
    desc: 'Burns 10 wood per tick for +160 energy.',
  },
  warehouse: {
    name: 'Warehouse', cat: 'resource', size: [4, 4], hp: 1000, barrier: 250, vision: 7, build: 75,
    cost: { gold: 400, wood: 40, stone: 40 }, need: { workers: 10, energy: 8 }, upkeep: { gold: 30 }, supply: { storage: 50 },
    zone: { kind: 'warehouse', radius: 12, prod: 0.2 }, margin: 1, sameMargin: 12, infectable: true, fire: 0.5,
    desc: '+50 storage (and +2000 gold storage). +20% production for producers in its zone.',
  },
  market: {
    name: 'Market', cat: 'colony', size: [3, 3], hp: 500, barrier: 125, vision: 7, build: 60,
    cost: { gold: 400, wood: 30, stone: 40 }, need: { workers: 8, energy: 8 }, upkeep: { gold: 30 },
    zone: { kind: 'market', radius: 12, food: -0.2 }, trade: true, max: 3, colonistsPer: 200, margin: 1, sameMargin: 12,
    tech: 'market', needs: 'woodworkshop', infectable: true, fire: 1,
    desc: 'Buy and sell resources; sells overflow automatically. Dwellings in its zone eat 20% less.',
  },
  bank: {
    name: 'Bank', cat: 'colony', size: [3, 3], hp: 1000, barrier: 250, vision: 7, build: 60,
    cost: { gold: 1000, wood: 50, stone: 50 }, need: { workers: 12, energy: 20 },
    zone: { kind: 'bank', radius: 12, gold: 0.3 }, max: 3, colonistsPer: 400, margin: 1, sameMargin: 12,
    tech: 'bank', needs: 'stoneworkshop', infectable: true, fire: 0.5,
    desc: 'Dwellings fully inside its zone give 30% more gold.',
  },
  inn: {
    name: 'Inn', cat: 'colony', size: [4, 4], hp: 1200, barrier: 300, vision: 10, build: 90,
    cost: { gold: 2000, wood: 100, stone: 100 }, need: { energy: 50, food: 100 }, upkeep: { wood: 30 }, supply: { workers: 100 },
    zone: { kind: 'inn', radius: 24, gold: 0.1 }, mercenaries: true, max: 1, colonistsPer: 200, margin: 1, sameMargin: 24, minEmpty: 16,
    extraInfected: 100, tech: 'inn', needs: 'woodworkshop', infectable: true, fire: 0.5,
    desc: '+100 workers. Hires mercenaries every 5 days. +10% gold for dwellings in its zone.',
  },
  woodworkshop: {
    name: 'Wood Workshop', cat: 'research', size: [4, 4], hp: 800, barrier: 200, vision: 7, build: 90,
    cost: { gold: 500, wood: 40 }, need: { workers: 10, energy: 10 }, upkeep: { gold: 16 },
    research: true, max: 1, noDemolish: true, margin: 1, infectable: true, fire: 1,
    desc: 'Researches basic technologies.',
  },
  stoneworkshop: {
    name: 'Stone Workshop', cat: 'research', size: [4, 4], hp: 1000, barrier: 250, vision: 7, build: 90,
    cost: { gold: 1000, wood: 40, stone: 40 }, need: { workers: 20, energy: 20 }, upkeep: { gold: 40 },
    research: true, max: 1, noDemolish: true, margin: 1, tech: 'stoneworkshop', infectable: true, fire: 0.5,
    desc: 'Researches advanced technologies.',
  },
  foundry: {
    name: 'Foundry', cat: 'research', size: [4, 4], hp: 1500, barrier: 375, vision: 7, build: 90,
    cost: { gold: 3000, wood: 30, stone: 50, iron: 50 }, need: { workers: 40, energy: 50 }, upkeep: { gold: 100 },
    research: true, max: 1, noDemolish: true, margin: 1, tech: 'foundry', infectable: true, fire: 0.25,
    desc: 'Researches industrial technologies.',
  },
  soldierscenter: {
    name: 'Soldiers Center', cat: 'military', size: [3, 3], hp: 800, barrier: 400, vision: 7, build: 60,
    cost: { gold: 450, wood: 20, stone: 20 }, need: { workers: 8, energy: 6 }, upkeep: { gold: 14 },
    trains: ['ranger', 'soldier', 'sniper'], margin: 1, minEmpty: 12, infectable: true, fire: 0.5,
    desc: 'Trains Rangers, Soldiers and Snipers.',
  },
  engineeringcenter: {
    name: 'Engineering Center', cat: 'military', size: [3, 3], hp: 1000, barrier: 500, vision: 7, build: 60,
    cost: { gold: 3000, stone: 40, iron: 40, oil: 20 }, need: { workers: 30, energy: 50 }, upkeep: { gold: 100 },
    trains: ['pyro', 'rocketeer', 'titan', 'mutant'], needsOilIncome: true, margin: 1, minEmpty: 12,
    tech: 'engineering', needs: 'foundry', infectable: true, fire: 0.25,
    desc: 'Trains heavy units. Needs positive oil income.',
  },
  lookout: {
    name: 'Lookout Tower', cat: 'defense', size: [1, 1], hp: 300, barrier: 75, vision: 24, build: 39,
    cost: { gold: 300, wood: 10 }, need: { workers: 1 }, upgradeTo: 'radar', margin: 1, ignoreMargin: true,
    tech: 'lookout', needs: 'woodworkshop', infectable: true, fire: 1,
    desc: 'Sees 24 cells around it.',
  },
  radar: {
    name: 'Radar Tower', cat: 'defense', size: [1, 1], hp: 500, barrier: 125, vision: 40, build: 45, upgradeTime: 20,
    cost: { gold: 800, wood: 10, stone: 10, iron: 10 }, need: { workers: 2, energy: 10 }, upkeep: { gold: 30 },
    margin: 1, ignoreMargin: true, tech: 'radar', needs: 'foundry', infectable: true, fire: 0.25,
    desc: 'Sees 40 cells around it.',
  },
  woodwall: {
    name: 'Wood Wall', cat: 'defense', size: [1, 1], hp: 400, build: 15,
    cost: { gold: 10, wood: 3 }, wall: true, upgradeTo: 'stonewall', margin: 0, ignoreMargin: true, fire: 1,
    desc: 'Blocks infected and your own units. Infected must break it.',
  },
  stonewall: {
    name: 'Stone Wall', cat: 'defense', size: [1, 1], hp: 1000, build: 30, upgradeTime: 26,
    cost: { gold: 30, stone: 3 }, upgradeCost: { gold: 20, stone: 3 }, wall: true, margin: 0, ignoreMargin: true,
    tech: 'stonewall', needs: 'stoneworkshop', fire: 0.5,
    desc: 'Strong wall.',
  },
  woodgate: {
    name: 'Wood Gate', cat: 'defense', size: [3, 1], hp: 600, build: 30, rotate: true,
    cost: { gold: 50, wood: 10 }, gate: true, onWalls: true, upgradeTo: 'stonegate', margin: 0, ignoreMargin: true, fire: 1,
    desc: 'Opens for your units, blocks infected. Can be placed on a wall.',
  },
  stonegate: {
    name: 'Stone Gate', cat: 'defense', size: [3, 1], hp: 1500, build: 45, rotate: true,
    cost: { gold: 200, wood: 3, stone: 6 }, upgradeCost: { gold: 150, stone: 6 }, gate: true, onWalls: true, margin: 0, ignoreMargin: true,
    tech: 'stonewall', needs: 'stoneworkshop', fire: 0.5,
    desc: 'Strong gate.',
  },
  woodtower: {
    name: 'Wood Tower', cat: 'defense', size: [1, 1], hp: 800, barrier: 200, build: 39,
    cost: { gold: 120, wood: 10 }, garrison: { max: 4, range: 3 }, onWalls: true, upgradeTo: 'stonetower', margin: 1, sameMargin: 1, ignoreMargin: true, fire: 1,
    desc: 'Up to 4 Rangers, Soldiers or Snipers fire from it with +3 range and cannot be hit.',
  },
  stonetower: {
    name: 'Stone Tower', cat: 'defense', size: [1, 1], hp: 2000, barrier: 500, build: 60, upgradeTime: 23,
    cost: { gold: 450, wood: 10, stone: 10 }, upgradeCost: { gold: 330, stone: 10 }, garrison: { max: 4, range: 4 }, onWalls: true,
    margin: 1, sameMargin: 1, ignoreMargin: true, tech: 'stonetower', needs: 'stoneworkshop', fire: 0.5,
    desc: 'Stronger tower, +4 range for 4 garrisoned units.',
  },
  ballista: {
    name: 'Great Ballista', cat: 'defense', size: [2, 2], hp: 1000, barrier: 500, vision: 12, build: 45,
    cost: { gold: 500, wood: 20 }, need: { workers: 3, energy: 3 }, upkeep: { gold: 15 },
    attack: { type: 'bolt', dmg: 150, range: 9, cd: 1.0, aoe: 0.3, noise: 5, push: 1, sound: 'ballista', overkill: true },
    needsEnergy: true, upgradeTo: 'executor', margin: 1, tech: 'ballista', needs: 'woodworkshop', infectable: true, fire: 0.25,
    desc: 'Heavy bolt, 150 damage, range 9. Quiet.',
  },
  executor: {
    name: 'Executor', cat: 'defense', size: [2, 2], hp: 2000, barrier: 1000, vision: 12, build: 45, upgradeTime: 23,
    cost: { gold: 1200, iron: 20, oil: 10 }, need: { workers: 5, energy: 10 }, upkeep: { gold: 50 },
    attack: { type: 'mg', dmg: 100, range: 9, cd: 0.5, aoe: 0.6, aoeFull: true, noise: 20, sound: 'mg', overkill: true },
    needsEnergy: true, margin: 1, tech: 'executor', needs: 'foundry', infectable: true, fire: 0.25,
    desc: 'Rapid heavy gun. 100 damage in a small area twice per second, range 9. Loud.',
  },
  shocking: {
    name: 'Shocking Tower', cat: 'defense', size: [2, 2], hp: 1000, barrier: 500, vision: 8, build: 45,
    cost: { gold: 600, wood: 30, stone: 30 }, need: { workers: 2, energy: 20 }, upkeep: { gold: 20 },
    attack: { type: 'pulse', dmg: 60, range: 6, cd: 4.5, noise: 20, sound: 'zap' },
    needsEnergy: true, margin: 1, sameMargin: 3, tech: 'shocking', needs: 'stoneworkshop', infectable: true, fire: 0.25,
    desc: 'Electric pulse hits every infected within 6 cells for 60 damage every 4 s.',
  },
  wasp: {
    name: 'Wasp', cat: 'defense', size: [1, 1], hp: 300, vision: 8, build: 30,
    cost: { gold: 320, iron: 10 }, need: { energy: 1 }, upkeep: { gold: 2 },
    attack: { type: 'mg', dmg: 20, range: 6, cd: 0.33, noise: 3, sound: 'mg', overkill: true },
    inert: true, blocksJump: true, needsEnergy: true, margin: 0, ignoreMargin: true, tech: 'wasp', needs: 'stoneworkshop', fire: 0,
    desc: 'Small machine-gun turret. Infected ignore it unless it hurts them. Stops Harpy jumps.',
  },
  stakes: {
    name: 'Stakes Trap', cat: 'defense', size: [1, 1], hp: 150, build: 15,
    cost: { gold: 30, wood: 3 }, trap: { dmg: 5, slow: 0.5 }, upgradeTo: 'wirefence', margin: 0, ignoreMargin: true, tech: 'stakes',
    desc: 'Every 0.5 s deals 5 damage to each infected on it and slows everyone by half.',
  },
  wirefence: {
    name: 'Wire Fence Trap', cat: 'defense', size: [1, 1], hp: 350, build: 15, upgradeTime: 7,
    cost: { gold: 100, iron: 3 }, upgradeCost: { gold: 70, iron: 3 }, trap: { dmg: 10, slow: 0.5 }, margin: 0, ignoreMargin: true,
    tech: 'wirefence', needs: 'foundry',
    desc: 'Every 0.5 s deals 10 damage to each infected on it.',
  },
  mine: {
    name: 'Land Mine', cat: 'defense', size: [1, 1], hp: 1, build: 1.5,
    cost: { gold: 100, iron: 3 }, mine: { dmg: 500, radius: 1.9 }, invincible: true, margin: 0, ignoreMargin: true, tech: 'mine', needs: 'stoneworkshop',
    desc: 'Explodes under infected: 500 damage within 1.9 cells. Hurts your units too.',
  },
  telescope: {
    name: 'The Great Telescope', cat: 'wonder', size: [5, 5], hp: 1200, barrier: 300, build: 30, onCC: true,
    cost: { gold: 7000, wood: 100, stone: 100, iron: 150 }, wonder: { vp: 1000, reveal: true }, max: 1, place: 'cc',
    tech: 'w_telescope', needs: 'woodworkshop', infectable: true, fire: 0.5,
    desc: 'Mounted on the Command Center. Reveals the whole map.',
  },
  crystalpalace: {
    name: 'The Crystal Palace', cat: 'wonder', size: [6, 6], hp: 2000, barrier: 500, vision: 12, build: 90,
    cost: { gold: 6000, wood: 150, stone: 200, iron: 150 }, upkeep: { gold: 100 }, supply: { food: 800, colonists: 60 },
    wonder: { vp: 1500 }, max: 1, margin: 1, tech: 'w_palace', needs: 'woodworkshop', infectable: true, fire: 0,
    desc: '+800 food and +60 colonists.',
  },
  academy: {
    name: 'The War Academy', cat: 'wonder', size: [4, 4], hp: 3000, barrier: 1500, vision: 16, build: 90,
    cost: { gold: 7000, wood: 200, stone: 200, iron: 100 }, need: { workers: 50, energy: 50 }, upkeep: { gold: 120 },
    wonder: { vp: 1000, veterans: true }, max: 1, margin: 1, tech: 'w_academy', needs: 'stoneworkshop', infectable: true, fire: 0.5,
    desc: 'Every Ranger, Soldier and Sniper becomes a veteran.',
  },
  victory: {
    name: 'The Victory Monument', cat: 'wonder', size: [4, 4], hp: 10000, barrier: 8000, armor: 0.5, vision: 16, build: 90,
    cost: { gold: 7000, stone: 100, iron: 200, oil: 100 }, need: { workers: 50, energy: 50 }, upkeep: { gold: 120, oil: 10 },
    zone: { kind: 'victory', radius: 24, gold: 0.2 }, wonder: { vp: 2000 }, max: 1, margin: 1, sameMargin: 24,
    tech: 'w_victory', needs: 'stoneworkshop', infectable: true, fire: 0.5,
    desc: 'Massive fortress. +20% gold for dwellings in its zone.',
  },
  spire: {
    name: 'The Lightning Spire', cat: 'wonder', size: [6, 6], hp: 3000, barrier: 750, vision: 36, build: 90,
    cost: { gold: 8000, stone: 150, iron: 200, oil: 100 }, need: { workers: 60 }, upkeep: { gold: 100 }, supply: { energy: 800 }, grid: 30,
    wonder: { vp: 1500 }, max: 1, margin: 1, tech: 'w_spire', needs: 'foundry', infectable: true, fire: 0.5,
    desc: '+800 energy and an energy grid of radius 30.',
  },
  transmutator: {
    name: 'The Transmutator', cat: 'wonder', size: [5, 5], hp: 2000, barrier: 500, vision: 16, build: 90,
    cost: { gold: 8000, stone: 100, iron: 200, oil: 200 }, need: { workers: 50, energy: 100 }, upkeep: { gold: 120, wood: 20, stone: 20, iron: 10 },
    income: { oil: 40 }, wonder: { vp: 2000 }, max: 1, margin: 1, tech: 'w_transmutator', needs: 'foundry', infectable: true, fire: 0,
    desc: 'Turns 20 wood, 20 stone and 10 iron into 40 oil every tick.',
  },
};

for (const id in BUILDINGS) {
  const b = BUILDINGS[id];
  b.id = id;
  b.need = b.need || {}; b.supply = b.supply || {}; b.income = b.income || {}; b.upkeep = b.upkeep || {};
  b.barrier = b.barrier || 0; b.armor = b.armor || 0; b.vision = b.vision || 0; b.margin = b.margin || 0;
  b.place = b.place || 'empty';
  b.family = b.family || id;
  if (b.fire == null) b.fire = 1;
}
// Upgrade sources (for "pay the difference" pricing).
for (const id in BUILDINGS) { const to = BUILDINGS[id].upgradeTo; if (to) BUILDINGS[to].upgradeFrom = id; }

export const BUILD_MENU = [
  { id: 'colony', name: 'Colony', items: ['tent', 'cottage', 'stonehouse', 'market', 'bank', 'inn'] },
  { id: 'food', name: 'Food', items: ['hunter', 'fisherman', 'farm', 'advfarm'] },
  { id: 'resource', name: 'Resources', items: ['sawmill', 'quarry', 'advquarry', 'oilplatform', 'warehouse'] },
  { id: 'energy', name: 'Energy', items: ['tesla', 'mill', 'advmill', 'powerplant'] },
  { id: 'research', name: 'Research', items: ['woodworkshop', 'stoneworkshop', 'foundry'] },
  { id: 'military', name: 'Military', items: ['soldierscenter', 'engineeringcenter'] },
  { id: 'walls', name: 'Walls', items: ['woodwall', 'stonewall', 'woodgate', 'stonegate', 'stakes', 'wirefence', 'mine'] },
  { id: 'defense', name: 'Defense', items: ['woodtower', 'stonetower', 'ballista', 'executor', 'shocking', 'wasp', 'lookout', 'radar'] },
  { id: 'wonder', name: 'Wonders', items: ['telescope', 'crystalpalace', 'academy', 'victory', 'spire', 'transmutator'] },
];
