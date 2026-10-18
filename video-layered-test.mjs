import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {normalizeVideoLayers,renderLayeredShot} from './video-layered.mjs';
import {videoBinary} from './video-composer.mjs';
const layers={subject:[[0,.4],[1,.4],[1,1],[0,1]],ambient:[[0,0],[.25,0],[.25,.3],[0,.3]]};
test('layer definitions reject missing product, degenerate polygons and out-of-frame coordinates',()=>{
  assert.throws(()=>normalizeVideoLayers({}));
  assert.throws(()=>normalizeVideoLayers({subject:[[0,0],[1,1],[0,0]]}));
  assert.throws(()=>normalizeVideoLayers({subject:[[0,0],[1,0],[1,2]]}));
  assert.deepEqual(normalizeVideoLayers(layers).subject,layers.subject);
});
test('local layer renderer encodes a 5 second moving video and saves product mask and edge-fill evidence',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zhijing-layered-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const exec=promisify(execFile),binary=await videoBinary();
  await exec(binary,['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=s=320x240','-frames:v','1',path.join(directory,'frame-1.png')],{windowsHide:true});
  await renderLayeredShot({directory,index:0,duration:5,ratio:'source',dimensions:{width:320,height:240},layers});
  const video=await readFile(path.join(directory,'shot-1.mp4'));assert.equal(video.toString('ascii',4,8),'ftyp');
  const info=await exec(binary,['-hide_banner','-loglevel','error','-i',path.join(directory,'shot-1.mp4'),'-f','framemd5','-'],{windowsHide:true,maxBuffer:1024*1024});
  const frames=info.stdout.split(/\r?\n/).filter(x=>/^0,/.test(x));assert.equal(frames.length,150);
  assert.notEqual(frames[0].split(',').at(-1),frames.at(-1).split(',').at(-1));
  assert.ok((await readFile(path.join(directory,'layer-1-subject.png'))).length>24);
  assert.ok((await readFile(path.join(directory,'layer-1-background.png'))).length>24);
});
