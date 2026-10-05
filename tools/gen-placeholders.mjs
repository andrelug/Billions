// Renders placeholder PNGs for every sprite the game uses into assets/ and
// writes assets/manifest.json. Existing PNG files are kept (your art is never
// overwritten) unless you pass --force.
//
//   node tools/gen-placeholders.mjs [--force]
//
// Needs Playwright with Chromium (npx playwright install chromium) because
// the placeholders are drawn with the browser Canvas API.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSpriteList } from './sprite-list.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  if (req.url === '/__blank') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); return; }
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/__blank`);
const out = await page.evaluate(async (base) => {
  const { assetSpecs } = await import(base + '/js/data/art.js');
  const { drawPlaceholder } = await import(base + '/js/view/placeholder.js');
  const result = [];
  for (const spec of assetSpecs()) {
    const c = document.createElement('canvas'); c.width = spec.w; c.height = spec.h;
    drawPlaceholder(c.getContext('2d'), spec);
    result.push({ key: spec.key, file: spec.file, w: spec.w, h: spec.h, ax: spec.ax, ay: spec.ay, data: c.toDataURL('image/png').split(',')[1], desc: spec.desc || '' });
  }
  return result;
}, `http://localhost:${port}`);
await browser.close();
server.close();

const manifestPath = path.join(root, 'assets', 'manifest.json');
let manifest = {};
if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let written = 0, kept = 0;
for (const a of out) {
  const file = path.join(root, 'assets', a.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const keep = fs.existsSync(file) && !force;
  if (keep) kept++;
  else { fs.writeFileSync(file, Buffer.from(a.data, 'base64')); written++; }
  // Keep the artist's manifest settings unless the placeholder was (re)written.
  const prev = keep ? manifest[a.key] || {} : {};
  manifest[a.key] = { file: a.file, w: prev.w || a.w, h: prev.h || a.h, frames: prev.frames || 1, fps: prev.fps || 8, ax: prev.ax ?? a.ax, ay: prev.ay ?? a.ay };
}
const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
fs.writeFileSync(manifestPath, JSON.stringify(sorted, null, 1) + '\n');

// Human-readable list for the artist.
writeSpriteList(root, manifest);
console.log(`placeholders: ${written} written, ${kept} kept (existing files), ${out.length} total`);
