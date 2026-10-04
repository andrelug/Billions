// Achievements, mirroring the reference game's list (campaign ones excluded
// until a campaign exists). `check` runs at the end of a game (and kill/
// colonist milestones also during play). r = result, g = game, p = profile.
const KILLS = [10e3, 50e3, 100e3, 500e3, 1e6, 2e6, 5e6, 10e6, 50e6, 100e6];
const POP = [1000, 2000, 5000, 10000];
const units = (g) => Object.keys(g.stats.unitTypes);
const onlyUnit = (g, t) => units(g).every((u) => u === t) && !g.stats.usedAttackTowers;

export const ACHIEVEMENTS = [
  ...KILLS.map((n, i) => ({ id: 'killer' + (i + 1), name: `Infected Killer ${i + 1}`, desc: `Kill ${n.toLocaleString()} infected in total`, live: (g, p) => p.data.lifetimeKills >= n })),
  ...POP.map((n, i) => ({ id: 'mayor' + (i + 1), name: `Colony Mayor ${i + 1}`, desc: `Reach a colony of ${n.toLocaleString()} colonists`, live: (g) => g.stats.maxColonists >= n })),
  { id: 'survivor1', name: 'Survivor 1', desc: 'Win a 150-day survival game', check: (g, r) => r.won && g.settings.days === 150 && g.settings.mode === 'survival' },
  { id: 'survivor2', name: 'Survivor 2', desc: 'Win a 120-day survival game', check: (g, r) => r.won && g.settings.days === 120 && g.settings.mode === 'survival' },
  { id: 'survivor3', name: 'Survivor 3', desc: 'Win a 100-day survival game', check: (g, r) => r.won && g.settings.days === 100 && g.settings.mode === 'survival' },
  { id: 'survivor4', name: 'Survivor 4', desc: 'Win an 80-day survival game', check: (g, r) => r.won && g.settings.days === 80 && g.settings.mode === 'survival' },
  { id: 'giant1', name: 'Giant Slayer 1', desc: 'Kill an Infected Giant', live: (g) => g.stats.giantsKilled >= 1 },
  { id: 'giant2', name: 'Giant Slayer 2', desc: 'Kill 2 Infected Giants on one map', live: (g) => g.stats.giantsKilled >= 2 },
  { id: 'giant3', name: 'Giant Slayer 3', desc: 'Kill 3 Infected Giants on one map', live: (g) => g.stats.giantsKilled >= 3 },
  { id: 'wonders', name: 'The Most Wonderful Colony', desc: 'Build all six wonders in one colony', live: (g) => ['telescope', 'crystalpalace', 'academy', 'victory', 'spire', 'transmutator'].every((w) => g.buildings.some((b) => b.type === w && b.state === 'ok')) },
  { id: 'openmind', name: 'Open Mind', desc: 'Win with a score factor of 100%+ without walls, gates or towers', check: (g, r) => r.won && g.scoreFactor >= 1 && !g.stats.usedWalls && !g.stats.usedTowers },
  { id: 'soldierwrath', name: 'Soldier Wrath', desc: 'Win at 100%+ using only Soldiers and no attack towers', check: (g, r) => r.won && g.scoreFactor >= 1 && onlyUnit(g, 'soldier') },
  { id: 'rangerrevenge', name: 'Ranger Revenge', desc: 'Win at 100%+ using only Rangers and no attack towers', check: (g, r) => r.won && g.scoreFactor >= 1 && onlyUnit(g, 'ranger') },
  { id: 'sniperslaughter', name: 'Sniper Slaughter', desc: 'Win at 100%+ using only Snipers and no attack towers', check: (g, r) => r.won && g.scoreFactor >= 1 && units(g).filter((u) => u !== 'ranger' && u !== 'soldier').every((u) => u === 'sniper') && g.stats.trained > 0 && !g.stats.usedAttackTowers },
  { id: 'notowers', name: 'No Towers Needed', desc: 'Win at 200%+ without Ballistas or Executors', check: (g, r) => r.won && g.scoreFactor >= 2 && !g.stats.usedBallista },
  { id: 'peaceful', name: 'Peaceful', desc: 'Win at 100%+ without training any unit', check: (g, r) => r.won && g.scoreFactor >= 1 && g.stats.trained === 0 },
  { id: 'unstoppable', name: 'Unstoppable', desc: 'Win at 100%+ without ever pausing', check: (g, r) => r.won && g.scoreFactor >= 1 && !g.stats.paused },
  { id: 'bestgeneral', name: 'Best General', desc: 'Win at 100%+ with no casualties and no attack towers', check: (g, r) => r.won && g.scoreFactor >= 1 && g.stats.unitsLost === 0 && g.stats.colonistsInfected === 0 && !g.stats.usedAttackTowers },
];
