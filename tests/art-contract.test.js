import test from 'node:test';
import assert from 'node:assert/strict';
import {jobs} from '../tools/art-prompts.mjs';
import {animationJobs} from '../tools/animation-prompts.mjs';
const byKey=new Map(jobs.map(j=>[j.key,j]));
test('delivery jobs cover all six biomes and preserve terrain prop widths',()=>{
  for(const map of ['FA','BR','TM','AL','DS','VO']) for(const [name,count,size,cells] of [
    ['tree',6,[256,448],1.4],['rock',6,[320,384],1.6],['stone',3,[192,160],1.2],['iron',3,[192,160],1.2],['gold',3,[192,160],1.2]]) {
    const variants=jobs.filter(j=>j.key.startsWith(`prop/${map}/${name}_`));
    assert.equal(variants.length,count);
    for(let i=0;i<count;i++) {const j=byKey.get(`prop/${map}/${name}_${i}`);assert.deepEqual([j.w,j.h],size);assert.equal(j.cells,cells);}
  }
});
test('character states share 256px frames with the brief animation timing',()=>{
  const bases=jobs.filter(j=>/^(unit|infected)\//.test(j.key));
  assert.equal(bases.length,18);assert.equal(animationJobs.length,36);
  for(const base of bases) {
    assert.deepEqual([base.w,base.h],[256,256]);
    for(const state of ['walk','attack']) {
      const j=animationJobs.find(j=>j.key===`${base.key}_${state}`);
      assert.deepEqual([j.w,j.h],[base.w,base.h]);
      assert.equal(j.frames,state==='walk'?6:4);assert.equal(j.fps,state==='walk'?10:12);
    }
  }
});
test('building canvases provide the specified volume and gate orientation',()=>{
  for(const [id,size] of Object.entries({cc:[640,896],tent:[256,384],woodwall:[128,192],tesla:[128,256],woodgate:[384,192],woodgate_v:[128,448],powerplant:[384,576],warehouse:[512,704],crystalpalace:[768,1024]})) {
    const j=byKey.get('building/'+id);assert.deepEqual([j.w,j.h],size);
  }
  assert.equal(new Set([...jobs,...animationJobs].map(j=>j.key)).size,jobs.length+animationJobs.length);
});
