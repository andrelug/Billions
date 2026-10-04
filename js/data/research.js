// Survival research. Each tech is bought once in one research building and
// unlocks buildings or units. Time in seconds (75 s x factor). Losing the
// workshop loses every tech researched in it.
export const TECHS = {
  // Wood Workshop
  woodhouse:   { name: 'Wooden Cottage', at: 'woodworkshop', cost: { gold: 350 }, time: 75, unlocks: ['cottage'] },
  farms:       { name: 'Farms', at: 'woodworkshop', cost: { gold: 400 }, time: 75, unlocks: ['farm'] },
  market:      { name: 'Market', at: 'woodworkshop', cost: { gold: 450 }, time: 75, unlocks: ['market'] },
  stoneworkshop: { name: 'Stone Workshop', at: 'woodworkshop', cost: { gold: 500 }, time: 75, unlocks: ['stoneworkshop'] },
  lookout:     { name: 'Lookout Tower', at: 'woodworkshop', cost: { gold: 300 }, time: 75, unlocks: ['lookout'] },
  ballista:    { name: 'Great Ballista', at: 'woodworkshop', cost: { gold: 700 }, time: 75, unlocks: ['ballista'] },
  stakes:      { name: 'Stakes Trap', at: 'woodworkshop', cost: { gold: 300 }, time: 75, unlocks: ['stakes'] },
  sniper:      { name: 'Sniper', at: 'woodworkshop', cost: { gold: 700 }, time: 75, unlocks: ['sniper'] },
  inn:         { name: 'Inn', at: 'woodworkshop', cost: { gold: 1000 }, time: 112.5, unlocks: ['inn'] },
  w_telescope: { name: 'The Great Telescope', at: 'woodworkshop', cost: { gold: 7000, wood: 100, stone: 100, iron: 150 }, time: 150, unlocks: ['telescope'], wonder: true },
  w_palace:    { name: 'The Crystal Palace', at: 'woodworkshop', cost: { gold: 6000, wood: 150, stone: 200, iron: 150 }, time: 150, unlocks: ['crystalpalace'], wonder: true },
  // Stone Workshop
  stonehouse:  { name: 'Stone House', at: 'stoneworkshop', cost: { gold: 600 }, time: 75, unlocks: ['stonehouse'] },
  stonetower:  { name: 'Stone Tower', at: 'stoneworkshop', cost: { gold: 500 }, time: 75, unlocks: ['stonetower'] },
  stonewall:   { name: 'Stone Walls', at: 'stoneworkshop', cost: { gold: 500 }, time: 75, unlocks: ['stonewall', 'stonegate'] },
  wasp:        { name: 'Wasp', at: 'stoneworkshop', cost: { gold: 800 }, time: 75, unlocks: ['wasp'] },
  powerplant:  { name: 'Power Plant', at: 'stoneworkshop', cost: { gold: 800 }, time: 75, unlocks: ['powerplant'] },
  foundry:     { name: 'Foundry', at: 'stoneworkshop', cost: { gold: 1000 }, time: 75, unlocks: ['foundry'] },
  bank:        { name: 'Bank', at: 'stoneworkshop', cost: { gold: 800 }, time: 75, unlocks: ['bank'] },
  shocking:    { name: 'Shocking Tower', at: 'stoneworkshop', cost: { gold: 900 }, time: 75, unlocks: ['shocking'] },
  mine:        { name: 'Land Mine', at: 'stoneworkshop', cost: { gold: 600 }, time: 75, unlocks: ['mine'] },
  w_victory:   { name: 'The Victory Monument', at: 'stoneworkshop', cost: { gold: 7000, stone: 100, iron: 200, oil: 100 }, time: 150, unlocks: ['victory'], wonder: true },
  w_academy:   { name: 'The War Academy', at: 'stoneworkshop', cost: { gold: 7000, wood: 200, stone: 200, iron: 100 }, time: 150, unlocks: ['academy'], wonder: true },
  // Foundry
  wirefence:   { name: 'Wire Fence Trap', at: 'foundry', cost: { gold: 900 }, time: 75, unlocks: ['wirefence'] },
  advquarry:   { name: 'Advanced Quarry', at: 'foundry', cost: { gold: 1500 }, time: 75, unlocks: ['advquarry'] },
  ironmill:    { name: 'Advanced Mill', at: 'foundry', cost: { gold: 1400 }, time: 75, unlocks: ['advmill'] },
  oilplatform: { name: 'Oil Platform', at: 'foundry', cost: { gold: 1200 }, time: 75, unlocks: ['oilplatform'] },
  radar:       { name: 'Radar Tower', at: 'foundry', cost: { gold: 1000 }, time: 75, unlocks: ['radar'] },
  engineering: { name: 'Engineering Center', at: 'foundry', cost: { gold: 2000 }, time: 75, unlocks: ['engineeringcenter', 'pyro'] },
  advfarm:     { name: 'Advanced Farm', at: 'foundry', cost: { gold: 1500 }, time: 75, unlocks: ['advfarm'] },
  executor:    { name: 'Executor', at: 'foundry', cost: { gold: 3000 }, time: 75, unlocks: ['executor'] },
  rocketeer:   { name: 'Rocketeer', at: 'foundry', cost: { gold: 2000 }, time: 75, unlocks: ['rocketeer'], requires: ['engineering'], needs: 'engineeringcenter' },
  titan:       { name: 'Titan', at: 'foundry', cost: { gold: 6000 }, time: 75, unlocks: ['titan'], requires: ['engineering'], needs: 'engineeringcenter' },
  mutant:      { name: 'Mutant', at: 'foundry', cost: { gold: 6000 }, time: 150, unlocks: ['mutant'], requires: ['engineering'], needs: 'engineeringcenter' },
  w_spire:     { name: 'The Lightning Spire', at: 'foundry', cost: { gold: 8000, stone: 150, iron: 200, oil: 100 }, time: 150, unlocks: ['spire'], wonder: true },
  w_transmutator: { name: 'The Transmutator', at: 'foundry', cost: { gold: 8000, stone: 100, iron: 200, oil: 200 }, time: 150, unlocks: ['transmutator'], wonder: true },
};
for (const id in TECHS) { TECHS[id].id = id; TECHS[id].requires = TECHS[id].requires || []; }

// Which tech unlocks each building or unit (absent = available from the start).
export const UNLOCKED_BY = {};
for (const id in TECHS) for (const u of TECHS[id].unlocks) UNLOCKED_BY[u] = id;
