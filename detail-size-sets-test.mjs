import test from 'node:test';
import assert from 'node:assert/strict';
import {presetSizeSets,confirmedSizeSets} from './dist/detail-size-sets.js';
test('selected sets retain matching parts, including shared pillow dimensions',()=>{
 const sets=presetSizeSets();assert.deepEqual(sets[0].dimensions,[[200,230],[245,250],[48,74]]);assert.deepEqual(confirmedSizeSets(sets),[]);
 sets[0].selected=sets[1].selected=true;sets[0].dimensions[1]=[245,260];
 const sizes=confirmedSizeSets(sets);assert.equal(sizes.length,6);assert.deepEqual(sizes[1],{part:'方案1 · 床单',dimensions:[245,260]});assert.equal(sizes[5].part,'方案2 · 枕套');
});
test('custom sets require all three complete dimensions and ignore unselected drafts',()=>{
 const custom={name:'自定义1',selected:true,dimensions:[['200','230'],['245','250'],['48','74']]};assert.equal(confirmedSizeSets([custom]).length,3);
 custom.dimensions[1][0]='';assert.throws(()=>confirmedSizeSets([custom]));custom.selected=false;assert.deepEqual(confirmedSizeSets([custom]),[]);
});
