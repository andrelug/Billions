import fs from 'node:fs';
import path from 'node:path';
import { assetSpecs } from '../js/data/art.js';

export function writeSpriteList(root, manifest) {
  const lines = ['# Sprite list', '',
    'Replace any PNG with your art at the same path. Sizes below match the current manifest and describe one frame.',
    'The reference scale is 64 px per map tile; higher-resolution art is scaled by the renderer. See ASSETS.md for drawing rules.', '',
    '| Key | File | Size | Notes |', '|---|---|---|---|'];
  const specs=assetSpecs(), known=new Set(specs.map(s=>s.key));
  const optional=Object.keys(manifest).filter(key=>!known.has(key)).sort().map(key=>({key,desc:`Optional animation: ${key}`}));
  for (const s of [...specs,...optional]) {
    const m = manifest[s.key] || s;
    lines.push(`| ${s.key} | assets/${m.file} | ${m.w}x${m.h} | ${s.desc}${m.frames>1?`, ${m.frames} frames at ${m.fps} fps`:''} |`);
  }
  fs.writeFileSync(path.join(root, 'assets/SPRITES.md'), lines.join('\n') + '\n');
}
