// Resize generated PNGs for the renderer, preserve alpha, and record provenance.
// Usage: node tools/install-art.mjs <key> <source.png> [width height]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { jobs } from './art-prompts.mjs';
import { animationJobs } from './animation-prompts.mjs';
import { writeSpriteList } from './sprite-list.mjs';
import { UPDATE_ID } from './asset-update-spec.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function saveJSON(file, value, indent) {
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, JSON.stringify(value,null,indent)+'\n');
  fs.renameSync(temp, file);
}
const [key, source, width, height] = process.argv.slice(2);
const job = [...jobs,...animationJobs].find(j => j.key === key);
if (!job || !source) throw new Error('Provide a known sprite key and generated source PNG.');
const w = Number(width || job.w), h = Number(height || job.h);
const frames = job.frames || 1;
if (![w,h,frames].every(n=>Number.isInteger(n)&&n>0)) throw new Error('Dimensions and frames must be positive integers.');
const promptFile = process.env.ART_PROMPT_FILE;
const actualPrompt = promptFile ? fs.readFileSync(promptFile,'utf8').trim() : job.prompt;
// Keep manifest and provenance updates together when batches export at once.
const lock = path.join(root, 'art/.bin/install.lock');
fs.mkdirSync(path.dirname(lock), { recursive:true });
let acquired = false;
for(let attempt=0;attempt<600;attempt++) {
  try {
    const fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));fs.closeSync(fd);
    acquired=true;break;
  } catch(error) {
    if(error.code!=='EEXIST')throw error;
    let owner;
    try { owner=Number(fs.readFileSync(lock,'utf8')); } catch(error) { if(error.code==='ENOENT')continue;throw error; }
    if(owner) {
      try { process.kill(owner,0); } catch(error) { if(error.code==='ESRCH'){try{fs.unlinkSync(lock);}catch{}continue;} }
    } else if(fs.statSync(lock).mtimeMs<Date.now()-60000) { fs.unlinkSync(lock);continue; }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
}
if(!acquired)throw new Error('Another asset export held the installation lock for over a minute.');
process.on('exit',()=>{try{if(Number(fs.readFileSync(lock,'utf8'))===process.pid)fs.unlinkSync(lock);}catch{}});
const target = path.join(root, 'assets', job.file);
fs.mkdirSync(path.dirname(target), { recursive:true });
if (key.startsWith('unit/') || key.startsWith('infected/')) {
  const exporter = frames > 1 ? 'pack-animation' : 'pack-unit';
  const bin = path.join(root, 'art/.bin', exporter);
  const swift = path.join(root, 'tools', exporter+'.swift');
  fs.mkdirSync(path.dirname(bin), { recursive:true });
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(swift).mtimeMs)
    execFileSync('swiftc', [swift, '-o', bin], { stdio:'inherit' });
  execFileSync(bin, [source, target, String(w), String(h), ...(frames>1?[String(frames)]:[])], { stdio:'inherit' });
} else if (job.slice) {
  const bin=path.join(root,'art/.bin/pack-ui'), swift=path.join(root,'tools/pack-ui.swift');
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(swift).mtimeMs)
    execFileSync('swiftc',[swift,'-o',bin],{stdio:'inherit'});
  execFileSync(bin,[source,target,String(w),String(h),String(job.slice[3]),String(job.slice[1])],{stdio:'inherit'});
} else {
  execFileSync('/usr/bin/sips', ['-s','format',job.file.endsWith('.jpg')?'jpeg':'png','-z', String(h), String(w), source, '--out', target], { stdio:'ignore' });
  if (/^(building|nest|prop)\//.test(key)) {
    const bin=path.join(root,'art/.bin/anchor-object'), swift=path.join(root,'tools/anchor-object.swift');
    if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(swift).mtimeMs)
      execFileSync('swiftc',[swift,'-o',bin],{stdio:'inherit'});
    execFileSync(bin,[target,target],{stdio:'inherit'});
  }
}
const png = fs.readFileSync(target);
if (!job.file.endsWith('.jpg') && (png.readUInt32BE(16) !== w * frames || png.readUInt32BE(20) !== h)) throw new Error('Unexpected output dimensions.');
const manifestFile = path.join(root, 'assets/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile));
manifest[key] = { ...manifest[key], file:job.file, w,h,frames,
  ...(job.frames?{fps:job.fps,ax:0.5,ay:0.5}:{}),
  ...(job.cells?{cells:job.cells}:{}), ...(job.slice?{slice:job.slice}:{}), ...(job.border?{border:job.border}:{}) };
saveJSON(manifestFile, manifest, 1);
writeSpriteList(root, manifest);
const ledgerFile = path.join(root, 'art/generated.json');
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile)) : {};
ledger[key] = { file:'assets/'+job.file, w,h, ...(job.frames?{frames,fps:job.fps,baseKey:job.baseKey,baseSha256:ledger[job.baseKey]?.sha256}:{}), sha256:crypto.createHash('sha256').update(png).digest('hex'), source, provider:'built-in image_gen', update:UPDATE_ID, prompt:actualPrompt };
saveJSON(ledgerFile, ledger, 2);
console.log(`${key}: installed ${w*frames}x${h}, ${frames} frame(s)`);
