// October 2026 art brief: delivery dimensions and optional asset contracts.
export const UPDATE_ID = 'tab-scale-2026-10';
export function buildingSize(id, footprint) {
  if (id.endsWith('gate_v')) return [128, 448];
  if (id.endsWith('gate')) return [384, 192];
  const n = footprint[0];
  const rise = n === 1 ? (['woodwall','stonewall','stakes','wirefence','mine'].includes(id) ? 64 : 128)
    : n === 2 ? 128 : n <= 4 ? 192 : 256;
  return [n * 128, footprint[1] * 128 + rise];
}

export const biomes = {
  FA: { trees: ['dark green pine','dense dark green oak'], rock: 'cool gray granite with moss', palette: 'deep moss greens and cool gray' },
  BR: { trees: ['golden orange autumn oak','red autumn oak','white birch with golden leaves'], rock: 'dark damp charcoal stone', palette: 'warm ochre, orange, crimson and muted brown, pale birch trunks' },
  TM: { trees: ['light green broadleaf oak','light green broadleaf elm'], rock: 'large rounded warm sandstone blocks', palette: 'fresh light greens and warm sandstone' },
  AL: { trees: ['snow-covered dark pine','snow-covered fir'], rock: 'blue-gray rock with a snowy top', palette: 'icy pale blue, white snow, deep evergreen' },
  DS: { trees: ['dead dry oak','dead leafless twisted tree'], rock: 'cracked reddish sandstone', palette: 'dusty ochre, weathered dry timber and reddish brown' },
  VO: { trees: ['twisted dead tree with subtle toxic green glow','gnarled toxic trunk'], rock: 'black basalt with gray ash crust', palette: 'charcoal black, gray ash and restrained toxic green' },
};
export const propJobs = Object.entries(biomes).flatMap(([map,b]) =>
  Object.entries({tree:6,rock:6,stone:3,iron:3,gold:3}).flatMap(([kind,count]) =>
    Array.from({length:count},(_,i) => {
      const [w,h,cells] = kind==='tree' ? [256,448,1.4] : kind==='rock' ? [320,384,1.6] : [192,160,1.2];
      const subject = kind==='tree' ? `one full ${b.trees[i % b.trees.length]}, from roots to crown, broad dense foliage unless dead, a substantial trunk`
        : kind==='rock' ? `one massive tall jagged rock outcrop, ${b.rock}, broad lit left faces and shaded right faces`
        : `one low clustered ${b.rock} mineral deposit${kind==='iron'?', broad rusty orange iron veins':kind==='gold'?', bright gold veins and chunky sparkling nuggets':', pale exposed stone surfaces'}`;
      return {key:`prop/${map}/${kind}_${i}`,file:`prop/${map}/${kind}_${i}.png`,w,h,cells,transparent_background:true,
        prompt:`Use case: stylized-concept. Asset type: ONE original painterly steampunk survival game terrain prop. Subject: ${subject}. Palette: ${b.palette}. Variant ${i+1}: vary the silhouette and branching or fracture arrangement. High three-quarter top-down orthographic camera, light from upper left, dimensional volume with clear dark outline. Canvas aspect ${w}:${h}, complete object filling 95% of width and height, base touches bottom edge, all top and side tips contained. REAL alpha transparent outside. No ground, platform, scenery, cast shadow, text, labels, people or additional objects. Neighboring props must form dense continuous forest or rock walls at small RTS scale.`};
    })));

const frameSpecs = [
  ['frame',192,192,48,'aged brass panel frame, rivets and small corner gears, almost opaque dark green glass centre'],
  ['toast',192,64,24,'thin brass message plate, dark green centre'],
  ['button',192,80,28,'dark aged bronze button, brass rim, four rivets, dark centre for cream text'],
  ['button_down',192,80,28,'pressed recessed dark bronze button, brass rim, four rivets, very dark centre'],
  ['button_primary',192,80,28,'illuminated green glass button, brass rim, four rivets, muted green centre for cream text'],
  ['button_danger',192,80,28,'dark crimson glass button, brass rim, four rivets, dark red centre for cream text'],
  ['button_on',192,80,28,'selected dark bronze button, glowing amber brass rim, dark green centre'],
  ['slot',128,128,32,'square command slot, dark green glass with subtle inner glow, thick brass rim and rivets'],
  ['tab',160,56,24,'brass category tab, dark bronze centre'],
  ['tab_on',160,56,24,'selected brass category tab with warm amber rim glow, dark green centre'],
  ['chip',128,48,20,'dark resource counter plate with thin brass rim, nearly black green centre'],
  ['bar_top',1024,96,[16,64,24,64],'long horizontal brass HUD strip, gears confined to the ends, dark green centre'],
  ['bar_bottom',1024,192,[32,64,16,64],'long horizontal bronze console tray, rivets confined to corners, dark green centre'],
  ['minimap',256,256,40,'square brass minimap frame, small gears at corners, very dark green empty centre'],
  ['clock',256,96,32,'wide dark day counter plate, brass rim with small gear confined to each corner, empty centre'],
];
const borders = {frame:[12,12,12,12],toast:[4,8,4,8],button:[6,12,6,12],button_down:[6,12,6,12],button_primary:[6,12,6,12],button_danger:[6,12,6,12],button_on:[6,12,6,12],slot:[6,6,6,6],tab:[4,10,4,10],tab_on:[4,10,4,10],chip:[3,5,3,5],bar_top:[8,16,12,16],bar_bottom:[12,16,8,16],minimap:[8,8,8,8],clock:[6,8,6,8]};
const symbols = {
  select:'an arrow cursor',army:'three soldier helmets',base:'a fortified headquarters',alert:'a warning bell',grid:'a square grid',menu:'three horizontal metal bars',pause:'two vertical bars',play:'one right-facing triangle',fast:'two right-facing triangles',faster:'three right-facing triangles',info:'an information emblem, simple stylized eye',close:'two crossed diagonal metal bars',
  move:'a marching boot and rightward arrow',attack:'two crossed swords',hold:'a shield with an anchor',stop:'an octagonal stop emblem without letters',patrol:'two arrows forming a loop',chase:'a boot with a forward arrow',nearest:'a target with a short inward arrow',strongest:'a target with a large clenched fist',leave:'an open gate with an outward arrow',drop:'a crate with a downward arrow',dismiss:'a helmet with a diagonal cross',deselect:'a dashed selection square with an outward arrow',
};
export const uiJobs = [
  ...frameSpecs.map(([id,w,h,inset,subject]) => {
    const slice=Array.isArray(inset)?inset:[inset,inset,inset,inset];
    return {key:`ui/${id}`,file:`ui/${id}.png`,w,h,slice,border:borders[id],transparent_background:true,
      prompt:`Use case: ui-mockup. Asset type: ONE production steampunk strategy game 9-slice UI skin asset. Subject: ${subject}. Canvas ${w}x${h}, aspect ${w}:${h}. Flat front view, no perspective. EXACT rectangular outer frame fills canvas to every edge; very small transparent outer corner cutouts only. All decorations stay within corner insets top/right/bottom/left ${slice.join('/')} pixels. Straight edges have uniform cross-section and no motifs along stretchable runs. Empty smooth almost opaque dark green centre, no controls or symbols. Aged warm brass and dark bronze, restrained bevel and highlights from upper left, crisp readable edges. No text, watermark, scene, mockup presentation, outside drop shadow or extra frames.`};
  }),
  ...Object.entries(symbols).map(([id,subject])=>({key:`ui/icon/${id}`,file:`ui/icon/${id}.png`,w:128,h:128,transparent_background:true,
    prompt:`Use case: stylized-concept. ONE steampunk strategy game UI command icon: ${subject}. Cream and brass engraved silhouette with dark outline, broad simple shapes readable at 24 pixels. Flat front view, square 128x128 target, centered complete emblem fills 80% of frame. REAL transparent alpha background. No panel, badge, frame, text, numbers, labels, watermark or extra symbols.`})),
  {key:'ui/title_bg',file:'ui/title_bg.jpg',w:1920,h:1080,transparent_background:false,
    prompt:'Use case: stylized-concept. Original painterly steampunk colony survival game menu background, 16:9. Walled Victorian colony at dusk, weathered timber and warm stone, teal roofs, aged brass, warmly lit windows and slender blue Tesla towers, distant infected horde silhouettes on the horizon. Architecture occupies left and right edges. Central 45% of the image is dark quiet empty space for menu buttons. High three-quarter aerial camera, atmospheric dim upper-left lighting. Detailed hand-painted strategy game art, subdued ochre and teal palette. No text, logos, UI, lettering, watermark or close-up characters.'},
  {key:'ui/logo',file:'ui/logo.png',w:1200,h:360,transparent_background:true,
    prompt:'Use case: logo-brand. ONE original steampunk strategy game wordmark. Text exactly "BILLIONS", all uppercase, spelled B I L L I O N S. Wide 10:3 transparent canvas. Heavy elegant engraved aged brass lettering, warm cream highlights and dark bronze bevels, small restrained rivets and gear accents integrated into letter edges. Entire word centered, fills 92% width, readable at 300 pixels wide. Real alpha transparent background, no panel, scene, additional words or watermark.'},
];
