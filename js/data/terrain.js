import { T } from '../sim/worldgen.js';
export { T };

// Per-terrain behaviour. walk: units and infected can cross. build: buildings
// may be placed. resource: what harvesting buildings collect from it.
export const TERRAIN = {
  [T.GRASS]:    { key: 'grass',    name: 'Grass',          walk: true,  build: true,  resource: 'grass' },
  [T.FOREST]:   { key: 'forest',   name: 'Forest',         walk: false, build: false, resource: 'wood' },
  [T.MOUNTAIN]: { key: 'mountain', name: 'Mountain',       walk: false, build: false, resource: 'stone' },
  [T.STONE]:    { key: 'stone',    name: 'Stone deposit',  walk: false, build: false, resource: 'stone' },
  [T.IRON]:     { key: 'iron',     name: 'Iron deposit',   walk: false, build: false, resource: 'iron' },
  [T.GOLD]:     { key: 'gold',     name: 'Gold deposit',   walk: false, build: false, resource: 'goldore' },
  [T.WATER]:    { key: 'water',    name: 'Water',          walk: false, build: false, resource: 'water' },
  [T.OIL]:      { key: 'oil',      name: 'Oil pool',       walk: true,  build: false, resource: 'oil' },
  [T.MUD]:      { key: 'mud',      name: 'Mud',            walk: true,  build: true,  resource: null, slow: 0.6 },
};
export const TERRAIN_COUNT = Object.keys(TERRAIN).length;
