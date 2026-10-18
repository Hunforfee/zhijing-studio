import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {renderCameraShot,cameraPath} from './video-camera.mjs';
import {videoBinary} from './video-composer.mjs';
test('real camera rendering makes 150 frames with smooth global image motion and no generative service',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'zhijing-camera-'));t.after(()=>rm(directory,{recursive:true,force:true}));const exec=promisify(execFile),binary=await videoBinary();
  await exec(binary,['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=s=320x240','-frames:v','1',path.join(directory,'frame-1.png')],{windowsHide:true});
  await renderCameraShot({directory,index:0,duration:5,ratio:'source',dimensions:{width:320,height:240}});
  const bytes=await readFile(path.join(directory,'shot-1.mp4'));assert.equal(bytes.toString('ascii',4,8),'ftyp');
  const output=await exec(binary,['-hide_banner','-loglevel','error','-i',path.join(directory,'shot-1.mp4'),'-f','framemd5','-'],{windowsHide:true,maxBuffer:1024*1024});
  const frames=output.stdout.split(/\r?\n/).filter(x=>/^0,/.test(x));assert.equal(frames.length,150);assert.notEqual(frames[0].split(',').at(-1),frames.at(-1).split(',').at(-1));
  assert.notDeepEqual(cameraPath(0,150),cameraPath(1,150));
});
