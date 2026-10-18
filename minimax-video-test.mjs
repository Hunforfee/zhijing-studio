import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from './server.mjs';
import {MINIMAX_VIDEO_BASE,minimaxVideoRequest,videoConfigProfiles} from './video-providers.mjs';
import {draftStoryboard} from './dist/video-storyboard.js';
const key='synthetic-minimax-video-secret';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const frame=Buffer.concat([png,Buffer.from('new-frame')]);
const mp4=Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]);
const creative={topic:'daily',product:'set',duration:15,people:'none',brief:'展示床品花色',facts:''};
const storyboard=draftStoryboard(creative);
storyboard.productReference={description:'保留蓝白花型',swatches:[{sourceIndex:0,x:.2,y:.2,width:.4,height:.4,side:'A'}]};
const input={motionMode:'ai',images:['data:image/png;base64,'+png.toString('base64')],creative,storyboard,quality:'quality',ratio:'9:16',audio:false};
async function fixture(t,options={}){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-minimax-'));
  let saved;
  const server=createServer({outputDir,fetchImpl:options.fetchImpl||(()=>{throw Error('Unexpected external call');}),videoOptions:{loadConfig:async()=>({provider:'minimax',model:'MiniMax-Hailuo-2.3',apiKey:key}),saveConfig:async c=>{saved=c;},getKeyframeConfig:()=>({provider:'compatible',model:'mock-image',apiKey:'synthetic-image-secret'}),cropPatterns:async()=>[{bytes:png,mime:'image/png',side:'A'}],generateKeyframe:async()=>frame,checkComposer:async()=>true,composeVideo:async({directory})=>writeFile(path.join(directory,'video.mp4'),mp4),downloadVideo:async()=>mp4,pollMs:1,...options.videoOptions}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-minimax-'));await rm(outputDir,{recursive:true,force:true});});
  const request=async(route,data)=>{const response=await fetch(origin+route,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};};
  const wait=async(id,states)=>{for(let i=0;i<400;i++){const {data}=await request('/api/video/jobs/'+id);if(states.includes(data.status))return data;await delay(5);}throw Error('Mock task timed out');};
  return {request,wait,outputDir,origin,saved:()=>saved};
}
test('MiniMax preserves independent encrypted-config profiles and restores legacy Zhipu metadata',async t=>{
  const f=await fixture(t,{videoOptions:{loadConfig:async()=>({apiKey:'synthetic-zhipu-secret'})}});
  assert.equal((await f.request('/api/video/status')).data.provider,'zhipu');
  assert.equal((await f.request('/api/service/video',{provider:'minimax',apiKey:'',model:'MiniMax-Hailuo-2.3'})).status,400);
  const changed=await f.request('/api/service/video',{provider:'minimax',apiKey:key,model:'MiniMax-Hailuo-2.3-Fast'});
  assert.equal(changed.status,200);assert.equal(changed.data.provider,'minimax');assert.equal(changed.data.supportsAudio,false);
  assert.equal(changed.data.profiles.zhipu.configured,true);assert.ok(!JSON.stringify(changed.data).includes(key));
  assert.equal((await f.request('/api/service/video',{provider:'zhipu',apiKey:''})).status,200);
  assert.equal((await f.request('/api/service/video',{provider:'minimax',apiKey:''})).data.model,'MiniMax-Hailuo-2.3-Fast');
  assert.equal(videoConfigProfiles(f.saved()).config.apiKey,key);
  assert.equal(videoConfigProfiles(f.saved()).profiles.zhipu.apiKey,'synthetic-zhipu-secret');
  assert.equal((await f.request('/api/service/video',{provider:'minimax',model:'unknown',apiKey:''})).status,400);
});
test('MiniMax renders generated frames, polls states, retrieves files and saves a playable endpoint without resubmitting',async t=>{
  let creates=0,queries=0,files=0,downloads=0;
  const payloads=[];
  const f=await fixture(t,{videoOptions:{downloadVideo:async url=>{assert.equal(url,'https://fixture.test/clip.mp4');if(++downloads===1)throw Error('Interrupted download');return mp4;}},fetchImpl:async(url,init)=>{
    assert.ok(url.startsWith(MINIMAX_VIDEO_BASE));assert.equal(init.headers.Authorization,'Bearer '+key);assert.equal(init.redirect,'error');
    if(url.endsWith('/video_generation')&&init.method==='POST'){payloads.push(JSON.parse(init.body));return Response.json({task_id:'task-'+(++creates),base_resp:{status_code:0}});}
    if(url.includes('/query/video_generation?')){queries++;return Response.json({status:queries===1?'Queueing':queries===2?'Preparing':queries===3?'Processing':'Success',file_id:'12345',base_resp:{status_code:0}});}
    assert.ok(url.endsWith('/files/retrieve?file_id=12345'));files++;return Response.json({file:{download_url:'https://fixture.test/clip.mp4'},base_resp:{status_code:0}});
  }});
  const created=await f.request('/api/video/jobs',input);assert.equal(created.status,202);
  await f.wait(created.data.id,['frames_ready']);assert.equal(creates,0);
  await f.request('/api/video/jobs/'+created.data.id+'/render',{});
  const failed=await f.wait(created.data.id,['failed']);assert.equal(failed.canResume,true);assert.equal(creates,1);
  assert.equal((await f.request('/api/video/jobs/'+created.data.id+'/resume',{})).status,202);
  const done=await f.wait(created.data.id,['completed','failed']);assert.equal(done.status,'completed',done.message);assert.equal(creates,3);assert.equal(files,4);
  assert.ok(payloads.every(p=>p.first_frame_image==='data:image/png;base64,'+frame.toString('base64')&&p.duration===6&&p.resolution==='1080P'&&p.prompt_optimizer===false));
  assert.ok(payloads.every(p=>!('with_audio' in p)&&!('size' in p)&&!('image_url' in p)));assert.equal(done.duration,15);
  const response=await fetch(f.origin+done.url,{headers:{Range:'bytes=4-7'}});assert.equal(response.status,206);assert.equal(await response.text(),'ftyp');
  const record=await readFile(path.join(f.outputDir,'videos',done.id,'job.json'),'utf8');assert.ok(!record.includes(key));
});
test('MiniMax rejects unsupported audio before generating keyframes and reports API-envelope failures without secrets or retries',async t=>{
  let calls=0,frames=0;
  const f=await fixture(t,{videoOptions:{generateKeyframe:async()=>{frames++;return frame;}},fetchImpl:async()=>{calls++;return Response.json({base_resp:{status_code:1004,status_msg:'invalid '+key}});}});
  const rejected=await f.request('/api/video/jobs',{...input,audio:true});assert.equal(rejected.status,400);assert.equal(frames,0);assert.equal(calls,0);
  const created=await f.request('/api/video/jobs',input);await f.wait(created.data.id,['frames_ready']);await f.request('/api/video/jobs/'+created.data.id+'/render',{});
  const failed=await f.wait(created.data.id,['failed']);assert.equal(calls,1);assert.ok(!failed.message.includes(key));assert.equal(failed.canResume,false);
});
test('MiniMax request uses legal duration and resolution, and rejects overlong prompts instead of dropping constraints',async()=>{
  const call=async(duration,quality)=>{let payload;await minimaxVideoRequest('/videos/generations',{model:'MiniMax-Hailuo-2.3-Fast'},{body:JSON.stringify({duration,quality,prompt:'keep bedding pattern',image_url:'data:image/png;base64,fixture'})},async(url,init)=>{payload=JSON.parse(init.body);return {task_id:'task'};});return payload;};
  assert.equal((await call(5,'speed')).resolution,'768P');assert.equal((await call(10,'quality')).resolution,'768P');assert.equal((await call(8,'quality')).duration,10);
  await assert.rejects(minimaxVideoRequest('/videos/generations',{}, {body:JSON.stringify({duration:5,prompt:'x'.repeat(2001)})},()=>{throw Error('must not submit');}),/2000/);
});
