import { assetSpecs } from '../js/data/art.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { UNITS } from '../js/data/units.js';
import { THEMES } from '../js/data/maps.js';

const building = {
  cc: 'Fortified Victorian colony headquarters with teal slate roofs, central brass clock turret, brick and stone walls, two chimneys, warm windows and blue banners.',
  tent: 'Modest cream canvas A-frame colony tent with blue trim, timber poles, rolled entrance flap, ropes and one crate within the footprint.',
  cottage: 'Small timber cottage, teal pitched roof, blue door, stone chimney, tiny lit windows and short porch.',
  stonehouse: 'Compact two-storey stone dwelling with teal mansard roof, dormer windows, blue door and a stone chimney.',
  hunter: 'Tiny timber hunting lodge, mossy roof, hide drying rack, bow and bundled traps; no animals or people.',
  fisherman: 'Tiny timber fishing hut with blue-gray roof, bundled fishing nets, coiled rope and barrels; no water outside footprint.',
  farm: 'Compact farm plot, orderly golden wheat rows, small timber shed and wooden fences within square footprint.',
  advfarm: 'Advanced agricultural plot, golden crop rows, brass irrigation pipes and compact glass greenhouse within footprint.',
  sawmill: 'Timber sawmill, teal roof, exposed large circular saw, neatly stacked cut logs and brass drive machinery.',
  quarry: 'Small stone quarry works with piles of gray cut rock, wooden crane and timber winch shed.',
  advquarry: 'Advanced stone quarry works with steel crane, stone piles, steam drilling machinery and brass engine.',
  oilplatform: 'Compact industrial oil derrick on iron supports, black pipework, cylindrical tanks and brass pump engine.',
  tesla: 'Slender brass electricity relay tower on a square stone base, stacked ceramic insulators, one blue glowing coil.',
  mill: 'Wooden steampunk windmill with four broad cream canvas sails, teal roof and brass generator at its base.',
  advmill: 'Advanced wind turbine with iron support frame, multiple broad metal vanes, teal housings and brass generator.',
  powerplant: 'Heavy steam power station, two brick chimneys, cylindrical brass boilers, teal roof and iron pipework.',
  warehouse: 'Broad timber and brick warehouse with teal roof, wide loading doors, crates and barrels at entrance.',
  market: 'Compact colony marketplace, timber hall with teal roof, striped blue awnings, produce baskets and stalls within footprint.',
  bank: 'Formal stone bank, brass vault doorway, columned facade, teal roof, subtle blue banners; no words or symbols.',
  inn: 'Victorian timber inn, teal gabled roof, lit windows, broad porch, brass lanterns and blue hanging pennant.',
  woodworkshop: 'Timber research workshop with teal roof, wood benches, saws, cogwheel machinery and stacked lumber.',
  stoneworkshop: 'Stone research workshop with teal roof, masonry benches, cut blocks, small brass apparatus and crane.',
  foundry: 'Large iron foundry with brick furnaces, short smokestacks, glowing orange crucible, brass machinery and iron roof.',
  soldierscenter: 'Fortified stone barracks with teal roof, wide gate, training yard inside footprint and two restrained blue banners.',
  engineeringcenter: 'Industrial engineering hangar, teal and iron roof, tall workshop doors, steam pipes and heavy brass machinery.',
  lookout: 'Tall narrow timber lookout scaffold, square platform with blue canopy and brass spyglass.',
  radar: 'Tall iron radar observation tower, square stone base, compact brass rotating dish and blue signal light.',
  woodwall: 'One contiguous square tile of sharpened timber palisade with heavy cross braces; connects flush to neighboring tiles.',
  stonewall: 'One contiguous square tile of thick gray stone battlement with iron reinforcements; connects flush to neighboring tiles.',
  woodgate: 'Timber palisade double gate, three tiles wide and one tile deep, heavy wood frame and iron hinges, closed.',
  woodgate_v: 'Timber palisade double gate rotated in world space: one tile wide and three tiles deep, running from image top to bottom, viewed from above, closed.',
  stonegate: 'Stone battlement double gate, three tiles wide and one tile deep, gray stone piers and iron doors, closed.',
  stonegate_v: 'Stone battlement double gate rotated in world space: one tile wide and three tiles deep, running from image top to bottom, viewed from above, closed.',
  woodtower: 'Compact defensive timber tower, square firing platform with low palisade rails, blue pennant and ladder.',
  stonetower: 'Compact defensive gray stone tower, crenellated square firing platform, iron door and small blue pennant.',
  ballista: 'Huge wooden ballista on a compact stone firing platform, broad bow arms and brass winding mechanism, pointing right.',
  executor: 'Heavy multi-barrel steam-powered machine-gun turret on square stone platform, brass ammunition feed and blue armor plates, pointing right.',
  shocking: 'Heavy brass electrical defense tower, stacked blue glowing tesla coils, thick iron supports and square stone base.',
  wasp: 'Small compact single machine-gun turret on low square iron base, blue armor and brass ammunition box, pointing right.',
  stakes: 'Square low trap patch of sharpened timber stakes in a crossing pattern, no frame or terrain background.',
  wirefence: 'Square low barbed wire trap, tangled coils of steel wire anchored to small iron stakes, no background.',
  mine: 'Small low circular iron pressure land mine with brass rivets and one tiny red indicator, no writing.',
  telescope: 'Great brass astronomical telescope on an ornate observatory rooftop with teal dome, stone platform and clockwork gears. Telescope angled up to right.',
  crystalpalace: 'Grand Victorian crystal greenhouse palace, glass vaulted teal frames, symmetrical wings, bright green foliage within glass and ornate brass finials.',
  academy: 'Grand fortified war academy, stone walls, teal roof, square towers, central courtyard and blue military banners.',
  victory: 'Massive square fortress monument, stone buttresses, brass central statue of a shield-bearing guardian, teal metal accents and blue banners.',
  spire: 'Monumental lightning power spire, towering brass conductor, large glowing blue coils, symmetrical iron generators and square stone base.',
  transmutator: 'Monumental clockwork chemical refinery, brass spherical reaction chamber, teal tanks, thick pipes, iron gears and square stone base.',
};
const units = {
  ranger: 'Female human bow scout, short blue hooded cape, brown leather armor, quiver, boots and bow held toward right.',
  soldier: 'Armored human rifle soldier with blue steel breastplate, brass helmet, brown boots and compact long rifle held toward right.',
  sniper: 'Human sharpshooter in short teal cloak, dark leather gear and goggles, long brass scoped rifle aimed toward right.',
  pyro: 'Heavy human flamethrower trooper in orange and iron protective armor, brass fuel tanks on back, short hose and flamethrower nozzle held toward right; no emitted flame.',
  rocketeer: 'Human rocket artillery trooper in violet and iron armor, brass rocket pack and shoulder launcher pointing right; no launched projectile.',
  titan: 'Large bipedal steam war machine, blue-gray iron armor, brass pistons, stout legs and twin heavy machine-gun arms pointing right.',
  mutant: 'Large allied muscular engineered humanoid brute, purple-gray skin, blue colony harness with brass fittings, giant clawed hands reaching toward right.',
};
const infected = {
  decrepit: 'Frail hunched elderly adult infected, olive-gray skin, ragged tan clothes, thin limbs and slack reaching arms.',
  aged: 'Stooped adult infected in torn brown waistcoat and gray trousers, yellow-gray skin, one dragging leg and clawing arms.',
  young: 'Lean adult infected in ragged olive shirt, pale green skin, slightly crouched shambling pose and reaching arms.',
  colonist: 'Infected former colony worker, tattered cream shirt, brown overalls, green-gray skin, leaning forward in running pose.',
  fresh: 'Recently infected adult runner, torn green jacket, dark trousers, mottled pale green skin, aggressive compact crouch.',
  executive: 'Infected former Victorian executive, torn charcoal coat, white shirt, faded burgundy waistcoat, slate green skin, reaching hands.',
  chubby: 'Large bloated infected brute, sickly dark olive skin, torn brown work clothes, broad belly, heavy shoulders and reaching hands.',
  harpy: 'Lean agile adult mutated infected, pale yellow-green skin, long clawed arms, sinewy legs, ragged dark hair and torn brown clothing; no wings.',
  venom: 'Hunched acid-spitting adult infected, sickly green skin, swollen luminous lime throat sacs, dark tattered clothes, compact reaching pose.',
  giant: 'Huge lumbering infected giant, dark mossy skin, massive shoulders, enormous fists, torn cloth loin covering and crude hunched stance.',
  behemoth: 'Huge fast mutated infected brute, purple-gray skin, muscular hunched torso, long powerful claw arms and torn dark clothing.',
};
const items = {
  gold: 'three chunky gold ingots and two coins', wood: 'three bundled cut timber logs with visible end grain',
  stone: 'three pale gray angular stone blocks', iron: 'three dark iron ingots with warm rust edges',
  oil: 'small black oil can with brass spout and one glossy black drop', food: 'bundle of golden wheat with a red apple and green leaf',
  energy: 'bright blue lightning shape held between two brass terminal contacts', workers: 'one brass-rimmed work helmet beside a small wrench',
  colonists: 'two friendly adult colonist bust silhouettes with cream shirts, one blue cap and one brown bonnet',
};
const fx = {
  arrow: 'one thin wood arrow with pale fletching on LEFT and iron pointed tip on RIGHT, perfectly horizontal',
  bolt: 'one heavy crossbow bolt with pale fletching on LEFT and sharp brass metal tip on RIGHT, perfectly horizontal',
  rocket: 'one compact metal rocket with tail fins and tiny orange exhaust on LEFT, pointed nose on RIGHT, perfectly horizontal',
  acid: 'one bright lime acid globule with small internal highlight, compact circular blob',
  blast: 'one compact radial explosion with bright golden center, orange flame lobes and dark smoke tips, seen from above',
  acidsplash: 'one irregular lime-green acid puddle splash with a few detached droplets, seen from above',
  blood: 'one small flat dark crimson blood stain and a few detached droplets, no body or anatomy, seen from above',
  ichor: 'one small flat dark olive infected ichor stain and a few detached droplets, no body or anatomy, seen from above',
  ring: 'one thin luminous white-blue circular pulse ring, transparent center and outside, soft bright edge, seen straight from above',
};
const biomeNotes = {
  FA: 'lush temperate deep forest, moss greens, dark evergreen foliage, cool gray rocks, calm blue water',
  BR: 'dark moorland, muted gray olive ground, sparse dark pines, charcoal cliffs, dark blue water, wet brown soil',
  TM: 'peaceful lowlands, fresh warm green meadows, broadleaf green woods, warm gray rocks, clear blue water',
  AL: 'frozen highlands, pale blue-white snowy ground, snow-dusted dark firs, icy blue-gray rock, cold blue water and frost',
  DS: 'desolated wasteland, ochre sandy ground, sparse dusty olive scrub, reddish sandstone, muted turquoise water',
  VO: 'caustic lands, muted yellow-olive ground, sickly dark trees, charcoal-brown rocks, murky toxic green water',
};
const terrainSubject = {
  grass: 'low even ground texture with sparse tiny grass tufts and natural subtle variation, completely flat and unobtrusive',
  forest: 'ONLY two or three dense overlapping evergreen tree crowns viewed from above, crowns fill entire tile with big readable foliage masses; one tile of forest at the scale of a single small building',
  mountain: 'large rugged impassable rock outcrops with strong upper-left highlights and deep crevices, visible rock masses',
  stone: 'low pale gray stone deposit with readable angular boulders and broken rock pieces',
  iron: 'low dark rock ore deposit with unmistakable rusty orange-brown iron veins and charcoal fragments',
  gold: 'low dark rock ore deposit with unmistakable bright warm gold mineral veins and small ochre nuggets',
  water: 'calm water surface, subtle small ripples and restrained reflections, NO shore, NO land, NO objects',
  oil: 'flat dark black oil pool with faint glossy blue highlights on biome ground, no barrels or machinery',
  mud: 'low flat damp earthy mud texture with sparse small stones, subtle footprints-free surface, no vegetation taller than tufts',
};

const style = 'Original detailed painterly steampunk RTS game art. Broad readable material planes, crisp silhouettes, subdued weathering, warm timber and brass, teal slate roofs and restrained blue colony accents. Consistent soft light from upper left. No text, letters, labels, logos, watermark, UI, borders or collage.';
export function makeJob(s) {
  const [group, id, tile] = s.key.split('/');
  let prompt, transparent = true, w = s.w * 2, h = s.h * 2;
  if (group === 'terrain') {
    const [type, variant] = tile.split('_');
    w = h = 64; transparent = false;
    prompt = `Use case: stylized-concept. Asset type: one square seamless tileable terrain PNG, game key ${s.key}. ${style}\nSubject: ${terrainSubject[type]}. Setting: ${THEMES[id].name}. Color and climate only: ${biomeNotes[id].split(',').slice(0,2).join(',')}. Palette base ${s.color}${s.color3 ? ', mineral accent ' + s.color3 : ''}.\nONE MATERIAL ONLY: this image represents ONLY ${type}; ${type==='water' ? 'no ground, shore, trees or rocks' : 'absolutely no water, rivers, lakes, streams or shoreline'}${type==='forest' ? ', no rocks, clearings, paths, buildings, logs or landscape compositions' : ''}. This is one SMALL 64x64 game tile, not a large aerial landscape; use 2-4 broad texture masses rather than dozens of tiny objects.\nCamera: high overhead orthographic terrain texture matching a top-down RTS, no horizon, no perspective landscape. Full-bleed opaque square tile. This is variant ${Number(variant)+1} of four interchangeable random tiles; change interior arrangement subtly while preserving identical edge palette, density and scale. Ground and edge textures must be homogeneous so ALL variants join at any edge. No frame, edge bevel, vignette, gradient, bright center, cast shadow outside tile, diorama or isolated square platform. Fine details must remain readable when reduced to 64x64. No transparent pixels.`;
  } else if (group === 'building' || group === 'nest') {
    const tall = ['tesla','lookout','radar','woodtower','stonetower','shocking','spire'].includes(id);
    if (tall) h = Math.round(w * 1.5);
    const subject = group === 'nest' ? `${id === 'small' ? 'Small abandoned timber cottage' : id === 'medium' ? 'Ruined two-storey stone dwelling' : 'Large ruined Victorian town hall'} infested by infected: broken brown roof, boarded black windows, sickly moss, dark red hanging scraps and scattered rubble contained inside footprint. No living figures.` : building[id];
    prompt = `Use case: stylized-concept. Asset type: ONE transparent building PNG sprite, game key ${s.key}, ${s.desc}. ${style}\nSubject: ${subject}\nCamera: high top-down three-quarter orthographic, front facade at bottom; axis-aligned rectangular base matching ${s.w/64} tiles wide by ${s.h/64} tiles deep. NOT diamond isometric. Canvas aspect ${w}:${h}. Complete object centered, occupying about 90% of width, all silhouette and roof fully visible, transparent 5% margin. Footprint bottom near lower image edge${tall ? ', extra tower height rises upward above compact square base' : ''}. Small subtle contact shadow. Transparent background with REAL alpha. No ground plane outside footprint, no scenery, characters, extra buildings or floating platform.`;
  } else if (group === 'unit' || group === 'infected') {
    prompt = `Use case: stylized-concept. Asset type: ONE transparent character sprite, game key ${s.key}. ${style}\nSubject: ${group === 'unit' ? units[id] : infected[id] + ' Non-graphic undead horror; no exposed viscera.'}\nCamera: high top-down three-quarter orthographic, see head and shoulders from above, NOT eye-level or portrait. Full body including feet. Faces RIGHT, nose, chest and weapon or reaching hands toward right. One compact idle combat pose, no motion blur. Keep entire body in CENTRAL 40% of square canvas width and height, center of torso at exact image center, about 30% empty transparent padding on ALL sides. Small compact contact shadow only. Large silhouette differences readable at 25px tall in crowds. REAL alpha transparency, no floor, scenery, writing or additional characters.`;
  } else if (group === 'mayor') {
    transparent = false;
    prompt = `Use case: stylized-concept. Asset type: ONE square mayor portrait for a steampunk RTS HUD. ${style}\nSubject: ${id === 'm' ? 'Distinguished middle-aged male colony mayor, salt-and-pepper beard, navy Victorian coat, brass collar pin, kind resolute expression' : 'Distinguished middle-aged female colony mayor, brown hair in a practical updo, navy Victorian jacket, brass collar pin, kind resolute expression'}. Head and upper shoulders fill 90% of square, face centered. Muted dark teal plain painted background, warm gentle face lighting, recognizable at 64px. No ornate frame, no words.`;
  } else if (group === 'fx') {
    prompt = `Use case: stylized-concept. Asset type: ONE transparent game effect sprite, ${s.key}, aspect ${w}:${h}. ${style}\nSubject: ${fx[id]}. Centered full object, fills 85% of intended ${w}:${h} frame, all tips contained. Opaque core and soft alpha edges where appropriate. REAL alpha transparent background, no backdrop or other elements. Effect must read immediately at small size.`;
  } else {
    const subject = group === 'pickup' ? `A small loot bundle of ${items[id]}, compact stacked grouping resting on ground but no ground patch` : group === 'icon' ? `Simple bold HUD resource symbol: ${items[id]}; minimal details, broad contours, high contrast, recognizable at 14px` : group === 'barrel' ? 'One small red iron explosive barrel with two dark bands, brass cap, seen from high above at three-quarter angle; no writing or hazard label' : 'One small black raven in flight, wings out, seen from above, head facing right, blue-black feathers';
    prompt = `Use case: stylized-concept. Asset type: ONE transparent game sprite for ${s.key}. ${style}\nSubject: ${subject}. Square canvas, complete isolated object centered filling 80% of width and height with clear transparent margin, simple readable silhouette. REAL alpha transparency. No circular badge, panel, frame, scenery or text.`;
  }
  return { key:s.key, file:s.file, w,h, transparent_background:transparent, prompt };
}

export const jobs = assetSpecs().map(makeJob);
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(jobs));
