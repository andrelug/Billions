// Mayors: when the colony reaches 30 / 200 / 600 / 1200 colonists the player
// picks one of three random mayors of that level. A mayor grants units, free
// buildings (placed at no cost), resources, free techs or modifiers.
export const MAYOR_LEVELS = [30, 200, 600, 1200];

const m = (level, gender, effect) => ({ level, gender, ...effect });
const unit = (t, n = 1) => ({ units: { [t]: n } });
const bld = (o) => ({ buildings: o });
const res = (o) => ({ res: o });
const tech = (t) => ({ techs: [t] });
const mod = (...mods) => ({ mods });
const add = (path, v) => ({ path, add: v });
const pct = (path, v) => ({ path, pct: v });

export const MAYORS = [
  m(1, 'm', unit('sniper')), m(1, 'f', unit('ranger', 2)), m(1, 'm', unit('soldier')),
  m(1, 'f', bld({ woodwall: 10, woodgate: 1 })), m(1, 'm', bld({ woodtower: 2 })), m(1, 'm', bld({ stakes: 10 })),
  m(1, 'f', bld({ tesla: 1 })), m(1, 'm', bld({ mill: 1 })), m(1, 'f', bld({ ballista: 1 })), m(1, 'm', bld({ lookout: 1 })),
  m(1, 'f', bld({ farm: 1 })), m(1, 'm', bld({ quarry: 1 })),
  m(1, 'f', mod(add('building.cc.supply.food', 10), add('building.cc.income.gold', 10))),
  m(1, 'm', mod(add('building.cc.income.gold', 20))),
  m(1, 'f', mod(add('building.hunter.supply.food', 3))), m(1, 'm', mod(add('building.fisherman.supply.food', 3))),
  m(1, 'f', mod(add('building.cc.supply.energy', 20))), m(1, 'm', mod(add('building.cc.grid', 4), add('building.cc.vision', 4))),
  m(1, 'f', mod(add('building.sawmill.income.wood', 2))), m(1, 'm', mod(add('building.cc.supply.workers', 12))),
  m(1, 'f', res({ gold: 1000 })), m(1, 'f', res({ wood: 30 })), m(1, 'm', res({ stone: 20 })), m(1, 'f', res({ iron: 10 })),
  m(1, 'm', res({ gold: 600, wood: 10 })),
  m(1, 'f', tech('lookout')), m(1, 'm', tech('stakes')), m(1, 'f', tech('woodhouse')), m(1, 'm', tech('farms')),
  m(1, 'f', tech('market')), m(1, 'm', tech('sniper')), m(1, 'f', tech('ballista')),

  m(2, 'f', bld({ shocking: 1 })), m(2, 'm', mod(pct('building.mill.supply.energy', 0.2), pct('building.advmill.supply.energy', 0.2))),
  m(2, 'm', unit('pyro')), m(2, 'f', unit('rocketeer')), m(2, 'm', unit('sniper', 2)), m(2, 'f', unit('soldier', 3)),
  m(2, 'm', bld({ stonewall: 10, stonegate: 1 })), m(2, 'f', bld({ stonetower: 2 })), m(2, 'm', bld({ lookout: 2 })),
  m(2, 'f', bld({ advmill: 1 })), m(2, 'm', bld({ ballista: 2 })),
  m(2, 'f', mod(pct('building.woodwall.hp', 0.2), pct('building.woodgate.hp', 0.2))),
  m(2, 'm', mod(pct('unit.sniper.upkeep.gold', -0.4))), m(2, 'f', mod(pct('unit.soldier.upkeep.gold', -0.6))),
  m(2, 'm', mod(add('building.cc.supply.storage', 50))), m(2, 'f', mod({ path: 'refund', set: 0.75 })),
  m(2, 'm', mod(add('building.cc.income.gold', 40))), m(2, 'f', mod(pct('building.farm.harvest', 0.2))),
  m(2, 'm', mod(pct('unit.*.train', -0.1))),
  m(2, 'f', res({ gold: 3000 })), m(2, 'm', res({ wood: 120 })), m(2, 'f', res({ stone: 80 })), m(2, 'm', res({ iron: 40 })),
  m(2, 'f', tech('shocking')),

  m(3, 'm', unit('titan')), m(3, 'f', bld({ radar: 1 })), m(3, 'm', bld({ executor: 1 })), m(3, 'f', bld({ wirefence: 20 })),
  m(3, 'm', bld({ shocking: 2 })), m(3, 'f', bld({ advmill: 2 })), m(3, 'm', bld({ oilplatform: 1 })),
  m(3, 'f', mod(add('building.cottage.supply.workers', 1))), m(3, 'm', mod(pct('unit.pyro.upkeep.gold', -0.3))),
  m(3, 'f', mod(pct('unit.rocketeer.upkeep.gold', -0.3))), m(3, 'm', mod(pct('building.*.build', -0.2))),
  m(3, 'f', mod(add('building.cc.income.gold', 80))), m(3, 'm', mod(add('building.cc.supply.storage', 100))),
  m(3, 'f', res({ stone: 150 })), m(3, 'm', res({ iron: 80 })), m(3, 'f', res({ oil: 40 })),
  m(3, 'm', tech('radar')), m(3, 'f', tech('ironmill')), m(3, 'm', tech('executor')), m(3, 'f', tech('wirefence')),

  m(4, 'm', unit('titan', 2)), m(4, 'f', unit('pyro', 3)), m(4, 'm', unit('rocketeer', 3)), m(4, 'f', bld({ radar: 2 })),
  m(4, 'm', bld({ executor: 2 })), m(4, 'f', bld({ wirefence: 40 })), m(4, 'm', bld({ shocking: 3 })),
  m(4, 'f', mod(add('building.cc.income.gold', 120))), m(4, 'm', mod(pct('building.oilplatform.income.oil', 0.2))),
  m(4, 'f', mod(add('building.stonehouse.supply.workers', 2))), m(4, 'm', mod(pct('building.stonewall.hp', 0.2), pct('building.stonegate.hp', 0.2))),
  m(4, 'f', mod(pct('unit.titan.upkeep.gold', -0.3))), m(4, 'm', mod(pct('building.stonehouse.income.gold', 0.1))),
  m(4, 'f', mod(pct('building.advmill.supply.energy', 0.2))), m(4, 'm', mod(pct('building.powerplant.supply.energy', 0.2))),
  m(4, 'f', mod(pct('building.advfarm.harvest', 0.2))), m(4, 'm', mod(add('building.cc.supply.storage', 200))),
  m(4, 'f', mod(pct('building.*.barrier', 0.2))), m(4, 'm', res({ oil: 100 })), m(4, 'f', res({ iron: 200 })),
];
MAYORS.forEach((x, i) => { x.id = 'mayor' + i; });

const FIRST = { m: ['Aldric', 'Bastian', 'Conrad', 'Dorian', 'Edmund', 'Felix', 'Gideon', 'Horace', 'Ignatius', 'Jasper', 'Leopold', 'Magnus', 'Otto', 'Rupert', 'Silas', 'Tobias'],
  f: ['Adelaide', 'Beatrix', 'Clara', 'Delphine', 'Eleanor', 'Florence', 'Greta', 'Harriet', 'Isadora', 'Josephine', 'Lavinia', 'Matilda', 'Ottilie', 'Rosalind', 'Sybil', 'Theodora'] };
const LAST = ['Ashford', 'Blackwood', 'Crane', 'Dunmore', 'Everhart', 'Fairbanks', 'Greaves', 'Holloway', 'Ironside', 'Kestrel', 'Larkspur', 'Mercer', 'Norwood', 'Pemberton', 'Ravensworth', 'Sterling', 'Thorne', 'Whitlock'];
export function mayorName(x) {
  const n = parseInt(x.id.slice(5), 10);
  return FIRST[x.gender][(n * 7) % 16] + ' ' + LAST[(n * 11) % LAST.length];
}
