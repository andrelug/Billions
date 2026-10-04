// Infected types. Stats from the reference rules table.
//   power = experience given to the killer and threat weight
//   walk = idle roaming speed, speed = running speed (cells/s)
//   vision = watch range; hearing = 4 x vision; awareness = noise sensitivity
//   attack.cd = seconds per attack. infects: hits on units can turn them.
export const INFECTED = {
  // Walkers: decrepit / aged / young. Runners: colonist / fresh / executive.
  // Specials: chubby, harpy (jumps walls), venom (ranged acid), giant (deaf,
  // huge area swipe that also hits infected), behemoth (very alert, loud).
  decrepit: {
    name: 'Infected Decrepit', power: 1, hp: 35, armor: 0, regen: 2.8, vision: 5, walk: 0.13, speed: 0.4, r: 0.28, awareness: 2,
    attack: { type: 'claw', dmg: 6, range: 0.5, cd: 1.0, noise: 1 }, color: '#7d8f5a',
  },
  aged: {
    name: 'Infected Aged', power: 1, hp: 35, armor: 0, regen: 2.8, vision: 5, walk: 0.13, speed: 0.4, r: 0.28, awareness: 2,
    attack: { type: 'claw', dmg: 6, range: 0.5, cd: 1.0, noise: 1 }, color: '#8a8a5f',
  },
  young: {
    name: 'Infected Young', power: 1, hp: 35, armor: 0, regen: 2.8, vision: 5, walk: 0.334, speed: 0.4, r: 0.25, awareness: 2,
    attack: { type: 'claw', dmg: 6, range: 0.5, cd: 1.0, noise: 1 }, color: '#80955f',
  },
  colonist: {
    name: 'Infected Colonist', power: 2, hp: 45, armor: 0.05, regen: 3.6, vision: 6, walk: 0.3, speed: 1.75, r: 0.3, awareness: 3,
    attack: { type: 'claw', dmg: 9, range: 0.6, cd: 0.9, noise: 1 }, color: '#6b8f3e',
  },
  fresh: {
    name: 'Infected Fresh', power: 2, hp: 45, armor: 0.05, regen: 3.6, vision: 6, walk: 0.3, speed: 1.75, r: 0.32, awareness: 3,
    attack: { type: 'claw', dmg: 10, range: 0.6, cd: 1.0, noise: 2 }, color: '#5f8a4a',
  },
  executive: {
    name: 'Infected Executive', power: 5, hp: 80, armor: 0.1, regen: 6.4, vision: 6, walk: 0.08, speed: 1.75, r: 0.32, awareness: 3,
    attack: { type: 'claw', dmg: 12, range: 0.6, cd: 0.8, noise: 3 }, color: '#4f6a6e',
  },
  chubby: {
    name: 'Infected Chubby', power: 10, hp: 500, armor: 0.15, regen: 20, vision: 5, walk: 0.3, speed: 1.75, r: 0.45, awareness: 3, special: true,
    attack: { type: 'claw', dmg: 40, range: 0.7, cd: 1.0, noise: 10 }, color: '#3e5b2a',
  },
  harpy: {
    name: 'Infected Harpy', power: 10, hp: 120, armor: 0.1, regen: 9.6, vision: 9, walk: 0.3, speed: 5, r: 0.3, awareness: 8, special: true, jump: true,
    attack: { type: 'claw', dmg: 30, range: 0.8, cd: 0.3, noise: 10 }, color: '#9ab84e',
  },
  venom: {
    name: 'Infected Venom', power: 10, hp: 120, armor: 0.1, regen: 9.6, vision: 8, walk: 0.4, speed: 1.75, r: 0.32, awareness: 4, special: true, fire: 1.5,
    attack: { type: 'acid', dmg: 30, range: 4, cd: 2.0, aoe: 0.75, aoeFull: true, noise: 10, speed: 4, infects: true }, color: '#8cd23a',
  },
  giant: {
    name: 'Infected Giant', power: 100, hp: 10000, armor: 0.3, regen: 50, vision: 10, walk: 1, speed: 4, r: 1.0, awareness: 0, special: true, giant: true, wide: true,
    attack: { type: 'smash', dmg: 160, range: 3, cd: 0.8, cone: 120, aoe: 3.5, noise: 20, push: 1.5, friendly: true }, color: '#2f4a22',
  },
  behemoth: {
    name: 'Infected Behemoth', power: 50, hp: 4000, hpRange: [1500, 8000], armor: 0.1, regen: 160, vision: 12, walk: 1.8, speed: 6, r: 0.8, awareness: 10, special: true, fire: 0.5,
    attack: { type: 'claw', dmg: 30, range: 2, cd: 0.5, cone: 120, aoe: 2.6, aoeFull: true, noise: 200, push: 1 }, color: '#5a2f6e',
  },
};
for (const id in INFECTED) { const z = INFECTED[id]; z.id = id; z.fire = z.fire == null ? 1 : z.fire; z.hearing = z.vision * 4; }

export const WALKERS = ['decrepit', 'aged', 'young'];
export const RUNNERS = ['colonist', 'fresh', 'executive'];
export const SPECIALS = ['chubby', 'harpy', 'venom'];
