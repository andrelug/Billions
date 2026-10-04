// Survival score.
//  win : (20000 + 0.5 x max colonists + kills / 10 - min(5000, 10 x units lost)
//         - min(5000, 10 x colonists infected) + wonder points) x score factor
//  loss: (1000 x days survived / total days + 0.5 x max colonists + kills / 10) x score factor
export function computeScore(g, won) {
  const s = g.stats;
  const parts = [];
  if (won) parts.push(['Survivor bonus', 20000]);
  else parts.push(['Days survived', Math.round(1000 * Math.min(1, (g.day - 1) / g.totalDays))]);
  parts.push(['Max colonists x 0.5', Math.round(s.maxColonists * 0.5)]);
  parts.push(['Infected killed / 10', Math.round(s.kills / 10)]);
  if (won) {
    parts.push(['Units lost x -10', -Math.min(5000, s.unitsLost * 10)]);
    parts.push(['Colonists infected x -10', -Math.min(5000, s.colonistsInfected * 10)]);
    let vp = 0;
    for (const b of g.buildings) if (b.def.wonder && b.state === 'ok') vp += b.def.wonder.vp;
    if (vp) parts.push(['Wonders', vp]);
  }
  const base = parts.reduce((a, [, v]) => a + v, 0);
  return { parts, base, factor: g.scoreFactor, score: Math.round(base * g.scoreFactor) };
}
