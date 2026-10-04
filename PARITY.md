# Feature parity with *They Are Billions*

The goal is the full Survival-mode feature set of *They Are Billions* (v1.1.x), playable
on phones and in desktop browsers. This file lists what matches the original, what had
to be inferred, and what is not built yet.

## Sources for numbers

- **Stats.** Building, unit, infected and research numbers (HP, armour, damage, range,
  cooldowns, costs, upkeep, build and research times, noise values, swarm event
  timings) come from the vanilla rules data (v1.1.3) published by the modding
  community, and from the community wiki.
- **Inferred values.** Where neither source gives a value, it is estimated from data
  points and flagged under *Assumptions* below.
- **Timing.** 1 game hour = 3.75 s, 1 day = 90 s, and resources are paid every 8 hours
  (30 s), as in the original.

## Survival mode

| Feature | Status |
|---|---|
| 6 maps with their own terrain mix, resources, food factors, infected density and climate modifiers (Frozen Highlands: energy +30%, unit speed −20%, awareness −50%; Desolated Wasteland: awareness +30%, vision +10%) | Done |
| Maps unlock in order by winning on the previous one | Done |
| 5 infected population levels and 4 durations (80 / 100 / 120 / 150 days) | Done |
| Score factor from map × population × duration | Done (matches every published value, 410% to 900%) |
| Mayors on/off | Done |
| Ironman saves: Save & Quit, periodic autosave, a loss deletes the save, several games in progress | Done |
| Pause, with building and orders while paused | Done |
| No fast-forward | Matches by default. An optional 2x/3x setting exists but is off. |

## Colony and economy

| Feature | Status |
|---|---|
| All 46 buildings, including the 6 wonders and both gate orientations | Done |
| Stockpiles (gold, wood, stone, iron, oil) with storage caps and per-tick income | Done |
| Capacities (workers, food, energy) and colonists | Done |
| Warehouses: storage increase and +20% production zone | Done |
| Energy grid: CC and Tesla Towers relay power; Lightning Spire is a second root; losing a relay cascades; placement needs a powered footprint | Done |
| Placement rules: margins, house adjacency, the near-water / near-forest / near-mineral / oil rules, no building next to infected | Done |
| Production preview before placing (hunters, fishermen, farms, sawmills, quarries) | Done |
| Upgrades (Tent → Cottage → Stone House, Wood → Stone Tower, Mill → Advanced Mill, and others) paying the cost difference | Done |
| Repair (including reclaiming neutral ruins), demolish with refund, on/off toggles | Done |
| Market: buy and sell, auto-sell of overflow, −20% house food zone | Done |
| Bank: +30% gold zone; Inn: +10% zone and mercenaries | Done |
| Upkeep, unpaid wages and desertion | Done |
| 35 technologies across Wood Workshop, Stone Workshop and Foundry; losing a workshop loses its research | Done |
| 96 mayors at 30 / 200 / 600 / 1200 colonists (pick 1 of 2), with Bonus tab units and buildings | Done |

## Military

| Feature | Status |
|---|---|
| 7 units (Ranger, Soldier, Sniper, Pyro, Rocketeer, Titan, Mutant) with the original stats | Done |
| Veterancy for Ranger, Soldier and Sniper (XP thresholds); the War Academy trains veterans | Done |
| Commands: move, attack-move, attack, hold, stop, patrol, chase, garrison, carry barrel | Done |
| Garrisoning Rangers, Soldiers and Snipers in towers for range and protection | Done |
| Towers and traps: Great Ballista, Executor, Shocking Tower, Wasp, Stakes, Wire Fence, Land Mine | Done |
| Walls and gates; gates open for units and make noise | Done |
| Projectiles, splash, flame cones with friendly fire, burning, knock-back, armour, acid that ignores armour | Done |
| Explosive barrels | Done |

## Infected

| Feature | Status |
|---|---|
| Walkers (Decrepit, Aged, Young), runners (Colonist, Fresh, Executive), Chubby, Harpy, Venom, Giant, Behemoth | Done |
| Noise system: per-attack activity, decay, hearing at 4× watch range, alertness per type, attack alerts within radius 1, map awareness modifier | Done |
| Barrier first, then infection: infected buildings spawn infected and make noise | Done |
| Harpies jump walls unless a powered Wasp is near; Venom spits acid; the Giant's smash damages its own side; the Giant is deaf | Done |
| Villages of Doom (3 sizes): produce infected when disturbed, refill, send raids from day 20, drop loot | Done |
| Swarm events: roaming groups, easy and hard swarms from one side with an 8 h warning, and the final swarm from all sides with a 24 h warning, after which the whole map attacks | Done |
| Swarms look for weak points (cheap walls) rather than the shortest path | Done |

## Map, information and interface

| Feature | Status |
|---|---|
| Fog of war, explored versus visible areas, Radar and Lookout towers, Great Telescope revealing the map | Done |
| Map pickups, ravens that fly off when units come near, neutral infected towers to reclaim | Done |
| Minimap: colony green, infected red, swarm markers, tap to jump | Done |
| Energy grid view (E / G), health bars (Alt), flat terrain mode, F4 grid view, Tab to hide the HUD | Done |
| Alerts for colony under attack, building infected, swarms and mayors; jump to alert; "Show visible alerts" option | Done |
| Original default hotkeys, including training keys and Ctrl+1–8 groups | Done (no rebinding) |
| Weather: rain, snow and ash (visual only, as in the original) | Done |
| End screen with score breakdown, local high scores, statistics | Done |
| 30 achievements (all of the Steam list except the 4 campaign ones), stored locally | Done |
| Weekly Challenge (same seed for everyone each ISO week, one attempt, fixed factor) | Done; scores are local only |
| The 50 Days Challenge | Done |

## Not built yet

| Feature | Why |
|---|---|
| **Campaign** "The New Empire" (48 missions, empire map, hero missions, campaign research tree, trains) | A separate game in scale; it needs mission scripts, maps and story content. The title screen says so. |
| **Level editor, custom levels, Workshop** | Needs an editor UI and a sharing back end. |
| **Online leaderboards** and a shared Weekly Challenge board | Needs a server. Scores are stored on the device. |
| **Key rebinding** | Default bindings only. |
| **Music and voice lines** ("your colony is under attack") | No audio assets yet; sound effects are synthesized placeholders (see ASSETS.md). |
| **Languages other than English** | Not started. |
| **Giant footprint**: Giants should not fit through 1-tile gaps | Giants currently path like other infected. |
| **Fast Timers Optimization** option | Not needed: the simulation runs at a fixed 20 Hz step independent of frame rate. |

## Assumptions and known differences

- **Swarm growth between repetitions.** The base counts and timings are exact, but the
  growth formula is not published. Repetition *n* multiplies the base count by
  `1 + growth × n`, up to a cap (`growth` and `cap` in `js/sim/waves.js`). The result is
  then scaled by the population factor.
- **Roaming events** spawn at the map edge and walk toward the Command Center, as the
  original's behaviour suggests.
- **Score factor.** Values are modelled as map × population × duration. This fits every
  published combination; unpublished ones (very low population, 150 days) are
  extrapolated.
- **Early victory.** The game is won on the last day, or earlier once the final swarm has
  spawned and every infected and Village of Doom on the map is gone.
- **Map size.** The playable area is 184×184 cells, with swarm entry points 85 cells
  from the centre. The original's exact playable rectangle inside its 256×256 grid is not
  published.
- **Inn mercenaries** refresh every 5 days. The available types depend on the colony's
  progress.
- **Two names differ from the original** so they read clearly in English: the flame unit
  is the **Pyro** and the rocket unit is the **Rocketeer**. The infected "Mutant" is
  called the **Behemoth** to avoid a clash with the Mutant player unit.
- **Mobile additions** that the original does not have: touch gestures, a box-select
  button, group buttons and a compact HUD. They change no rules.

## Before a public release

The game title ("Billions") and most building, unit, map and wonder names follow the
original so that parity can be checked side by side. *They Are Billions* is a trademark
of Numantian Games. Rename the game and its distinctive names, and use original art,
before publishing it anywhere public. All placeholder art and code in this repository are
original.
