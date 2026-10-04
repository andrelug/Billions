// Player units. Stats from the reference rules table.
//   speed in cells/s, vision in cells, armor = fraction of damage blocked,
//   regen in HP/s (only when not hit for a few seconds),
//   xp = experience (sum of killed infected "power") needed to become a veteran,
//   attack.cd = seconds per attack, noise = activity added per attack,
//   vet = replacement attack once veteran, upkeep paid each tick (30 s).
export const UNITS = {
  ranger: {
    name: 'Ranger', at: 'soldierscenter', hp: 60, armor: 0.05, regen: 0.6, vision: 8, speed: 4, r: 0.3, xp: 60,
    cost: { gold: 120, wood: 2 }, need: { workers: 1 }, upkeep: { gold: 1 }, train: 27, garrison: true, fire: 1,
    attack: { type: 'arrow', dmg: 10, range: 6, cd: 1.0, noise: 1, push: 0.1, sound: 'bow' },
    vet: { type: 'arrow', dmg: 12, range: 6.5, cd: 0.5, noise: 1, push: 0.15, sound: 'bow' },
    desc: 'Fast, quiet scout with a bow. Weak armour.',
  },
  soldier: {
    name: 'Soldier', at: 'soldierscenter', hp: 120, armor: 0.4, regen: 4.8, vision: 6, speed: 2.4, r: 0.32, xp: 80,
    cost: { gold: 240, iron: 2 }, need: { workers: 1, food: 1 }, upkeep: { gold: 3 }, train: 30, garrison: true, fire: 0.5,
    attack: { type: 'bullet', dmg: 16, range: 5, cd: 0.5, noise: 3, sound: 'rifle' },
    vet: { type: 'bullet', dmg: 26, range: 5.5, cd: 0.4, noise: 3, sound: 'rifle' },
    desc: 'Armoured rifleman. Solid damage, a bit noisy.',
  },
  sniper: {
    name: 'Sniper', at: 'soldierscenter', hp: 150, armor: 0.05, regen: 0.75, vision: 9, speed: 1.8, r: 0.32, xp: 140,
    cost: { gold: 300, wood: 2, iron: 2 }, need: { workers: 1, food: 1 }, upkeep: { gold: 5 }, train: 33, garrison: true, fire: 1,
    attack: { type: 'sniper', dmg: 100, range: 8, cd: 2.2, noise: 10, push: 1, sound: 'sniper' },
    vet: { type: 'sniper', dmg: 110, range: 8, cd: 1.1, noise: 10, push: 1, sound: 'sniper' },
    priority: 'special', tech: 'sniper',
    desc: 'Long range, huge damage, slow. Shoots special infected first.',
  },
  pyro: {
    name: 'Pyro', at: 'engineeringcenter', hp: 500, armor: 0.25, regen: 40, vision: 6, speed: 1.8, r: 0.38,
    cost: { gold: 600, oil: 15 }, need: { workers: 1, food: 2 }, upkeep: { gold: 12, oil: 1 }, train: 36, fire: 0, mech: true,
    attack: { type: 'flame', dmg: 24, range: 3.5, cd: 0.5, cone: 20, noise: 10, burn: 0.7, friendly: true, sound: 'flame' },
    tech: 'engineering',
    desc: 'Flamethrower. Burns everything in a cone, including your own units. Fire-proof.',
  },
  rocketeer: {
    name: 'Rocketeer', at: 'engineeringcenter', hp: 250, armor: 0.25, regen: 2.5, vision: 12, speed: 1.8, r: 0.38,
    cost: { gold: 600, iron: 10, oil: 20 }, need: { workers: 1, food: 2 }, upkeep: { gold: 16, oil: 1 }, train: 39, fire: 1, mech: true,
    attack: { type: 'melee', dmg: 20, range: 1.5, cd: 1.0, cone: 120, aoe: 1, noise: 3, sound: 'hit' },
    extra: { type: 'rocket', dmg: 70, range: 10, minRange: 3, cd: 3.0, aoe: 1.8, aoeMin: 0.2, noise: 500, push: 1, sound: 'rocket' },
    tech: 'rocketeer',
    desc: 'Fires area-damage rockets from long range. Very loud. Weak in melee.',
  },
  titan: {
    name: 'Titan', at: 'engineeringcenter', hp: 800, armor: 0.4, regen: 8, vision: 12, speed: 3, r: 0.6,
    cost: { gold: 2000, iron: 40, oil: 40 }, need: { workers: 1, food: 2 }, upkeep: { gold: 40, oil: 2 }, train: 45, fire: 1, mech: true,
    attack: { type: 'mg', dmg: 36, range: 9, cd: 0.2, aoe: 0.8, aoeFull: true, noise: 20, sound: 'mg' },
    tech: 'titan',
    desc: 'Walking war machine with rapid area fire.',
  },
  mutant: {
    name: 'Mutant', at: 'engineeringcenter', hp: 2000, armor: 0.25, regen: 10, vision: 12, speed: 6, r: 0.7,
    cost: { gold: 5000, iron: 20, oil: 60 }, need: { workers: 1, food: 20 }, upkeep: { gold: 80, oil: 5 }, train: 45, fire: 0.5, mech: true, noHold: true,
    attack: { type: 'claw', dmg: 30, range: 2, cd: 0.5, cone: 120, aoe: 2.6, aoeFull: true, noise: 20, push: 1, sound: 'hit' },
    tech: 'mutant',
    desc: 'Fast, huge brute that tears through crowds.',
  },
};
for (const id in UNITS) { const u = UNITS[id]; u.id = id; u.need = u.need || {}; u.upkeep = u.upkeep || {}; }
export const UNIT_ORDER = ['ranger', 'soldier', 'sniper', 'pyro', 'rocketeer', 'titan', 'mutant'];
