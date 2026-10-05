// Compare the delivery brief with installed art. Old generated art is not counted.
import fs from 'node:fs';
import { jobs } from './art-prompts.mjs';
import { animationJobs } from './animation-prompts.mjs';
import { UPDATE_ID } from './asset-update-spec.mjs';
const required = [...jobs.filter(j=>/^(building|nest|unit|infected|prop|ui)\//.test(j.key)||/^terrain\/[^/]+\/(grass|mud)_/.test(j.key)),...animationJobs];
const ledger=JSON.parse(fs.readFileSync(new URL('../art/generated.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/manifest.json',import.meta.url)));
const delivered=j=>ledger[j.key]?.update===UPDATE_ID && manifest[j.key]?.w===j.w && manifest[j.key]?.h===j.h && (manifest[j.key]?.frames||1)===(j.frames||1) && (!j.fps || manifest[j.key]?.fps===j.fps) && (!j.baseKey || ledger[j.key].baseSha256===ledger[j.baseKey]?.sha256) && (!j.cells || manifest[j.key]?.cells===j.cells) && (!j.slice || JSON.stringify(manifest[j.key]?.slice)===JSON.stringify(j.slice));
const missing=required.filter(j=>!delivered(j));
const report={update:UPDATE_ID,total:required.length,installed:required.length-missing.length,
  font:!!manifest['ui/font']?.file && fs.existsSync(new URL('../assets/'+manifest['ui/font'].file,import.meta.url)) && fs.existsSync(new URL('../assets/ui/OFL.txt',import.meta.url)),
  colours:Object.entries({'--accent':'#d9b45a','--text':'#f3ead6','--muted':'#b4a588'}).every(([key,value])=>manifest['ui/vars']?.[key]===value),
  categories:Object.fromEntries(['building','nest','unit','infected','prop','terrain','ui'].map(group=>{
    const all=required.filter(j=>j.key.startsWith(group+'/'));
    return [group,{installed:all.filter(delivered).length,total:all.length}];
  })),pending:missing.map(j=>j.key)};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-complete')&&(missing.length||!report.font||!report.colours))process.exitCode=1;
