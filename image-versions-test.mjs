import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPhotoVersions} from './dist/image-versions.js';
const photo=(number,parentNumber)=>({number,...(parentNumber?{parentNumber}:{})});
test('single and repeated edits replace the original slot without moving untouched photos',()=>{
 const items=[photo(1),photo(2),photo(3),photo(4,2),photo(5,4)];
 const snapshot=JSON.stringify(items),result=splitPhotoVersions(items);
 assert.deepEqual(result.current.map(x=>x.number),[1,5,3]);
 assert.deepEqual(result.replaced.map(x=>x.number),[4,2]);
 assert.equal(JSON.stringify(items),snapshot);
});
test('editing an old revision still replaces that photo in the same slot',()=>{
 const result=splitPhotoVersions([photo(1),photo(2),photo(3,1),photo(4,1)]);
 assert.deepEqual(result.current.map(x=>x.number),[4,2]);
 assert.deepEqual(result.replaced.map(x=>x.number),[3,1]);
});
test('batch edits, deleted newest revisions and orphaned sources stay separate',()=>{
 const result=splitPhotoVersions([photo(1),photo(2),photo(3,1),photo(4,2),{...photo(5,3),deletedAt:'today'},photo(6,99)]);
 assert.deepEqual(result.current.map(x=>x.number),[3,4,6]);
 assert.deepEqual(result.replaced.map(x=>x.number),[2,1]);
});
