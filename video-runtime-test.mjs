import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveVideoBinary} from './video-runtime.mjs';

function fixture(available,options={}){
  const calls=[];
  const defaults={env:{},platform:'linux',root:'/application',checkAccess:async()=>{},readDirectory:async()=>{throw Error('no legacy installation');},staticBinary:async()=>'/application/node_modules/ffmpeg-static/ffmpeg',probe:async(binary,args)=>{
    calls.push({binary,args});
    if(!available.includes(binary))throw Error('not executable');
    return args.includes('-version')?'ffmpeg version 7.1':args.includes('-encoders')?'V..... libx264\nA..... aac':'... ass\n... zoompan';
  }};
  return {calls,resolve:()=>resolveVideoBinary({...defaults,...options})};
}
test('Linux detects an installed system FFmpeg and does not inspect Windows files',async()=>{
  const f=fixture(['ffmpeg'],{readDirectory:async()=>{assert.fail('Linux must not require a Windows exe');}});
  assert.equal(await f.resolve(),'ffmpeg');assert.equal(f.calls.length,3);
});
test('Node hosting falls back to its npm platform binary when PATH lacks FFmpeg',async()=>{
  const f=fixture(['/application/node_modules/ffmpeg-static/ffmpeg']);
  assert.equal(await f.resolve(),'/application/node_modules/ffmpeg-static/ffmpeg');
});
test('existing Windows bundled installation remains usable',async()=>{
  const binary='ffmpeg-win-x86_64-v7.1.exe';
  const f=fixture([],{platform:'win32',readDirectory:async()=>[binary],probe:async(file,args)=>{
    assert.ok(file.endsWith(binary));return args.includes('-version')?'ffmpeg version 7.1':args.includes('-encoders')?'libx264 aac':'ass zoompan';
  }});
  assert.ok((await f.resolve()).endsWith(binary));
});
test('an explicit server path is honored and an invalid override is reported without silently switching',async()=>{
  const f=fixture(['/opt/video/ffmpeg'],{env:{FFMPEG_PATH:'/opt/video/ffmpeg'}});
  assert.equal(await f.resolve(),'/opt/video/ffmpeg');
  const bad=fixture(['ffmpeg'],{env:{FFMPEG_PATH:'/missing/ffmpeg'}});
  await assert.rejects(bad.resolve(),/FFMPEG_PATH/);assert.ok(bad.calls.every(call=>call.binary==='/missing/ffmpeg'));
});
test('unexecutable or incomplete builds are rejected before paid frame generation',async()=>{
  await assert.rejects(fixture([]).resolve(),/npm ci/);
  const bad=fixture(['ffmpeg'],{probe:async(binary,args)=>args.includes('-version')?'ffmpeg version 7.1':args.includes('-encoders')?'mpeg4 aac':'ass zoompan'});
  await assert.rejects(bad.resolve(),/H.264/);
});
