// Optional interface art. Every "ui/..." entry in assets/manifest.json turns
// into CSS when the game starts; with no entries the plain interface stays.
//
//   Frames (9-slice): { "file": "ui/frame.png", "slice": [t, r, b, l], "border": [t, r, b, l]? }
//     slice  = insets in image pixels that must not stretch (corners, rivets)
//     border = how many screen pixels those insets take (default: half the
//              slice, for art drawn at 2x)
//   Images: ui/title_bg (cover), ui/logo (contain)
//   Icons:  ui/icon/<name>, drawn in place of the text glyph of the buttons
//   Font:   ui/font (a .woff2 file) for titles, buttons and the HUD
//   Colours: "ui/vars": { "--accent": "#d9b45a", ... } overrides CSS variables
const FRAMES = {
  'ui/frame': '.panel, .modal-card, .scroll',
  'ui/toast': '.toast',
  'ui/button': 'button',
  'ui/button_down': 'button:active:not(:disabled)',
  'ui/button_primary': 'button.primary',
  'ui/button_danger': 'button.danger',
  'ui/slot': '.card, .cmd, .rail, #groups button, .unitbtn, .tech',
  'ui/button_on': 'button.on, #tabs button.on, .card.on, .cmd.on, .rail.on, .opts button.on, #groups button.set',
  'ui/tab': '#tabs button',
  'ui/tab_on': '#tabs button.on',
  'ui/chip': '.chip',
  'ui/bar_top': '#top',
  'ui/bar_bottom': '#bottom',
  'ui/minimap': '#minimap',
  'ui/clock': '#clock',
};
const FONT_TARGETS = 'h1, h2, h3, button, .chip, #clock, #wave-bar, .section, .setup-label, .mult';

export function applySkin(manifest, base = 'assets/') {
  const css = [], url = (m) => `url("${base}${m.file}")`;
  const ui = Object.keys(manifest || {}).filter((k) => k.startsWith('ui/'));
  if (!ui.length) return 0;
  for (const key of ui) {
    const m = manifest[key];
    if (key === 'ui/vars' && m && typeof m === 'object') {
      css.push(`:root { ${Object.entries(m).filter(([k]) => k.startsWith('--')).map(([k, v]) => `${k}: ${v};`).join(' ')} }`);
      continue;
    }
    if (!m || !m.file) continue;
    if (FRAMES[key]) {
      const s = m.slice || [16, 16, 16, 16], b = m.border || s.map((v) => Math.round(v / 2));
      css.push(`${FRAMES[key]} { border-style: solid; border-color: transparent; border-width: ${b.map((v) => v + 'px').join(' ')}; border-image: ${url(m)} ${s.join(' ')} fill / ${b.map((v) => v + 'px').join(' ')} ${m.repeat || 'stretch'}; background: transparent; border-radius: 0; box-shadow: none; }`);
    } else if (key === 'ui/title_bg') {
      css.push(`#overlay { background: ${url(m)} center / cover no-repeat, #0b0e14; }`);
    } else if (key === 'ui/logo') {
      css.push(`.logo { color: transparent; text-shadow: none; background: ${url(m)} center / contain no-repeat; height: clamp(90px, 24vw, 180px); margin-bottom: 8px; }`);
    } else if (key === 'ui/font') {
      css.push(`@font-face { font-family: "BillionsUI"; src: ${url(m)}; font-display: swap; }`);
      css.push(`${FONT_TARGETS} { font-family: "BillionsUI", system-ui, sans-serif; }`);
    } else if (key.startsWith('ui/icon/')) {
      const name = key.slice(8).replace(/[^a-z0-9_-]/gi, '');
      css.push(`.ico[data-icon="${name}"] { display: inline-block; width: 1.35em; height: 1.35em; vertical-align: middle; overflow: hidden; color: transparent; text-indent: 200%; white-space: nowrap; background: ${url(m)} center / contain no-repeat; }`);
    }
  }
  const style = document.createElement('style');
  style.id = 'skin';
  style.textContent = css.join('\n');
  document.head.append(style);
  document.documentElement.classList.add('skinned');
  return ui.length;
}
