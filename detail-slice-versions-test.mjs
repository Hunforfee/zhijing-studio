import test from 'node:test';
import assert from 'node:assert/strict';
import {splitDetailVersions} from './dist/detail-slice-versions.js';
const slice=(number,index,group='a',extra={})=>({number,detailSliceIndex:index,detailGroupId:group,...extra});
test('repeated edits occupy their original slot and preserve all replaced versions separately',()=>{
 const items=[slice(1,0),slice(2,1),slice(3,2),slice(4,1,'a',{parentNumber:2}),slice(5,1,'a',{parentNumber:4})];
 const result=splitDetailVersions(items);assert.deepEqual(result.current.map(x=>x.number),[1,5,3]);assert.deepEqual(result.replaced.map(x=>x.number),[4,2]);assert.equal(items.length,5);
});
test('batch edits and independent detail groups retain their own versions',()=>{
 const result=splitDetailVersions([slice(1,0),slice(2,1),slice(3,0,'b'),slice(4,0),slice(5,1)]);
 assert.deepEqual(new Set(result.current.map(x=>x.number)),new Set([3,4,5]));assert.deepEqual(result.replaced.map(x=>x.number),[2,1]);
});
test('deleted revisions are excluded, restoring the remaining version to its slot',()=>{
 const result=splitDetailVersions([slice(1,0),slice(2,0,'a',{deletedAt:'today'})]);assert.deepEqual(result.current.map(x=>x.number),[1]);assert.deepEqual(result.replaced,[]);
});
