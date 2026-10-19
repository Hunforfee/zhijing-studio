import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';
import {createShareServer} from './share-server.mjs';
import {normalizeSceneRequest,sceneCreationPrompt} from './scene-creation.mjs';

const key='synthetic-scene-provider-key';
function picture(width=20,height=16){const image=new PNG({width,height});image.data.fill(180);for(let at=3;at<image.data.length;at+=4)image.data[at]=255;return PNG.sync.write(image);}
const bytes=picture(),image='data:image/png;base64,'+bytes.toString('base64');
const input={name:'晨光原木',brief:'窗边有克制的植物，床边留有拍摄空间，远处木柜形成层次。',style:'natural',lighting:'morning',ratio:'3:4'};
const delay=()=>new Promise(resolve=>setTimeout(resolve,10));
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};

async function fixture(t,settings={}){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-scene-test-')),calls=[];
  const options={outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:key,baseUrl:'https://scene.example/v1',model:'gpt-image-2.5-flare'},videoOptions:{loadConfig:async()=>null},fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json({data:[{b64_json:bytes.toString('base64')}]});},...settings};
  let server,base;
  async function start(){server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
  await start();
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});});
  async function api(route,data,headers={}){const result=await fetch(base+route,data===undefined?{headers}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});return {status:result.status,data:await result.json()};}
  async function finish(id){for(let i=0;i<200;i++){const result=await api('/api/scenes/jobs/'+id);if(!['queued','running'].includes(result.data.job.status))return result.data.job;await delay();}throw Error('Scene mock job did not finish');}
  return {api,finish,calls,outputDir,get base(){return base;},restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();}};
}

test('scene input and prompt separate environment from original A/B product patterns',()=>{
  const normalized=normalizeSceneRequest(input),prompt=sceneCreationPrompt(normalized);assert.equal(normalized.style,'natural');assert.match(prompt,/plain solid-color neutral bedding/);assert.match(prompt,/future uploaded product fabric A\/B/);assert.match(prompt,/do not claim to have seen an uploaded/);
  assert.match(sceneCreationPrompt(normalizeSceneRequest({...input,style:'childbed',referenceImage:image})),/exactly one plain sleeping pillow/);
  for(const patch of [{brief:''},{brief:'x'.repeat(2001)},{style:'__proto__'},{lighting:'invalid'},{ratio:'16:9'},{name:'x'.repeat(81)},{referenceImage:'data:image/png;base64,eA=='},{unexpected:'x'}])assert.throws(()=>normalizeSceneRequest({...input,...patch}));
});

test('text scene generation creates only a candidate, confirmation is idempotent, library survives restart and removal',async t=>{
  const f=await fixture(t);assert.deepEqual((await f.api('/api/scenes')).data.scenes,[]);assert.equal(f.calls.length,0);
  const created=await f.api('/api/scenes/jobs',input);assert.equal(created.status,202);const done=await f.finish(created.data.job.id);assert.equal(done.status,'done');assert.equal(f.calls.length,1);
  const request=f.calls[0];assert.equal(request.url,'https://scene.example/v1/images/generations');const payload=JSON.parse(request.init.body);assert.equal(payload.model,'gpt-image-2.5-sunburst');assert.equal(payload.size,'1008x1344');assert.equal(payload.n,1);assert.equal(payload.output_format,'png');
  assert.deepEqual(Buffer.from(await(await fetch(f.base+done.imageUrl)).arrayBuffer()),bytes);assert.deepEqual((await f.api('/api/scenes')).data.scenes,[]);
  const saved=await f.api('/api/scenes',{jobId:done.id,name:'已确认晨光',description:'木色与晨光的房间参考'});assert.equal(saved.status,200);const scene=saved.data.scene;assert.equal(scene.name,'已确认晨光');assert.equal(scene.jobId,done.id);assert.equal(scene.imageUrl,'/api/scenes/'+scene.id+'/image');
  const repeated=await f.api('/api/scenes',{jobId:done.id,name:'不创建第二条'});assert.equal(repeated.data.scene.id,scene.id);assert.equal(repeated.data.scene.name,scene.name);assert.equal((await f.api('/api/scenes')).data.scenes.length,1);
  const json=await readFile(path.join(f.outputDir,'scene-creation',done.id,'job.json'),'utf8');assert.equal(json.includes(key),false);assert.equal(json.includes('data:image/'),false);assert.equal(JSON.stringify(done).includes(key),false);
  await f.restart();assert.equal(f.calls.length,1);assert.equal((await f.api('/api/scenes')).data.scenes[0].id,scene.id);assert.equal((await f.api('/api/scenes/jobs/'+done.id)).data.job.status,'done');assert.deepEqual(Buffer.from(await(await fetch(f.base+scene.imageUrl)).arrayBuffer()),bytes);
  assert.equal((await f.api('/api/scenes/'+scene.id+'/delete',{})).data.deleted,true);assert.equal((await f.api('/api/scenes')).data.scenes.length,0);assert.equal((await fetch(f.base+scene.imageUrl)).status,404);
  await f.restart();assert.equal((await f.api('/api/scenes')).data.scenes.length,0);assert.equal(f.calls.length,1);
});

test('explicitly saving a removed candidate restores the original scene and edited details without AI regeneration',async t=>{
  const f=await fixture(t),created=await f.api('/api/scenes/jobs',input),job=await f.finish(created.data.job.id);
  const original=(await f.api('/api/scenes',{jobId:job.id,name:'初次确认',description:'初次场景说明'})).data.scene;
  await f.api('/api/scenes/'+original.id+'/delete',{});await f.restart();
  assert.equal((await f.api('/api/scenes')).data.scenes.length,0);assert.equal((await fetch(f.base+original.imageUrl)).status,404);assert.equal(f.calls.length,1);
  const restored=await f.api('/api/scenes',{jobId:job.id,name:'再次选用晨光',description:'保留候选图片，更新用途说明'});
  assert.equal(restored.status,200);assert.equal(restored.data.scene.id,original.id);assert.equal(restored.data.scene.imageUrl,original.imageUrl);assert.equal(restored.data.scene.name,'再次选用晨光');assert.equal(restored.data.scene.description,'保留候选图片，更新用途说明');assert.equal(restored.data.scene.deletedAt,undefined);assert.equal(f.calls.length,1);
  assert.equal((await f.api('/api/scenes')).data.scenes.length,1);assert.equal((await fetch(f.base+original.imageUrl)).status,200);
  await f.restart();const saved=(await f.api('/api/scenes')).data.scenes;assert.equal(saved.length,1);assert.equal(saved[0].id,original.id);assert.equal(saved[0].name,'再次选用晨光');assert.equal(f.calls.length,1);
});

test('reference scene generation uses native image edits with only the environment reference',async t=>{
  const f=await fixture(t);const created=await f.api('/api/scenes/jobs',{...input,ratio:'4:3',referenceImage:image});const done=await f.finish(created.data.job.id);assert.equal(done.status,'done');assert.equal(f.calls.length,1);
  const call=f.calls[0];assert.equal(call.url,'https://scene.example/v1/images/edits');assert.equal(call.init.headers['Content-Type'],undefined);assert.equal(call.init.body.get('model'),'gpt-image-2.5-sunburst');assert.equal(call.init.body.get('size'),'1344x1008');assert.equal(call.init.body.getAll('image[]').length,1);assert.deepEqual(Buffer.from(await call.init.body.get('image[]').arrayBuffer()),bytes);assert.match(call.init.body.get('prompt'),/ENVIRONMENT inspiration/);
});

test('bad input, unsupported service and foreign origin create no paid scene work',async t=>{
  const f=await fixture(t);
  for(const patch of [{ratio:'9:16'},{brief:''},{referenceImage:'bad'},{style:'unsafe'}])assert.equal((await f.api('/api/scenes/jobs',{...input,...patch})).status,400);
  assert.equal((await f.api('/api/scenes/jobs',input,{Origin:'https://evil.example'})).status,403);assert.equal((await f.api('/api/scenes',{jobId:'../../private'})).status,400);assert.equal(f.calls.length,0);assert.equal((await f.api('/api/scenes/jobs')).data.jobs.length,0);
  const unsupported=await fixture(t,{service:{provider:'zhipu',apiKey:key,baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'}});assert.equal((await unsupported.api('/api/scenes/jobs',input)).status,409);assert.equal(unsupported.calls.length,0);
});

test('scene provider failure is explicit, credentials are hidden, and no local sample or paid retry substitutes a result',async t=>{
  for(const mode of ['network','provider','bad-png','bad-json']){
    let calls=0;const f=await fixture(t,{fetchImpl:async()=>{calls++;if(mode==='network')throw Error('Bearer '+key);if(mode==='provider')return Response.json({error:{message:key}},{status:403});if(mode==='bad-png')return Response.json({data:[{b64_json:Buffer.from('invalid image').toString('base64')}]});return new Response('not json');}});
    const created=await f.api('/api/scenes/jobs',input),failed=await f.finish(created.data.job.id);assert.equal(failed.status,'error',mode);assert.equal(failed.imageUrl,undefined);assert.equal(JSON.stringify(failed).includes(key),false);assert.equal(calls,1);assert.equal((await f.api('/api/scenes',{jobId:failed.id})).status,409);assert.equal((await fetch(f.base+'/api/scenes/jobs/'+failed.id+'/image')).status,404);
  }
});

test('scenes share the original photo FIFO and queued cancellation never contacts a provider',async t=>{
  const gate=deferred();let calls=0;
  const f=await fixture(t,{fetchImpl:async()=>{calls++;if(calls===1)await gate.promise;return Response.json({data:[{b64_json:bytes.toString('base64')}]});}});
  const photo=await f.api('/api/jobs',{product:'set',fabric:'cotton',scenes:['warm'],angles:['front'],size:'标准',scale:100,direction:0,repeat:'tile',ratio:'3:4',plainSheet:false,notes:'',image});assert.equal(photo.status,202);
  const queued=await f.api('/api/scenes/jobs',input);assert.equal(queued.data.job.status,'queued');assert.equal(calls,1);assert.equal((await f.api('/api/scenes',{jobId:queued.data.job.id})).status,409);
  assert.equal((await f.api('/api/scenes/jobs/'+queued.data.job.id+'/cancel',{})).data.job.status,'cancelled');gate.resolve();for(let i=0;i<200;i++){const current=await f.api('/api/jobs/'+photo.data.id);if(current.data.status==='done')break;await delay();}
  assert.equal(calls,1);const next=await f.api('/api/scenes/jobs',input);assert.equal((await f.finish(next.data.job.id)).status,'done');assert.equal(calls,2);
});

test('scene and free-image editing use the same FIFO and scenes are absent from photo task restoration',async t=>{
  const gate=deferred();let calls=0;
  const f=await fixture(t,{fetchImpl:async()=>{calls++;if(calls===1)await gate.promise;return Response.json({data:[{b64_json:bytes.toString('base64')}]});}});
  const first=await f.api('/api/scenes/jobs',input);assert.equal((await f.api('/api/jobs/active')).data,null);
  const uploaded=await f.api('/api/free/documents',{image,title:'共享队列验证'});assert.equal(uploaded.status,201);
  const edit=await f.api('/api/free/documents/'+uploaded.data.document.id+'/edit',{sourceVersion:'original',mode:'custom',prompt:'只调整环境光',ratio:'source',lockPattern:true,lockCraft:true});assert.equal(edit.status,202);assert.equal(edit.data.document.operations[0].status,'queued');assert.equal(calls,1);
  gate.resolve();assert.equal((await f.finish(first.data.job.id)).status,'done');for(let i=0;i<200;i++){const doc=(await f.api('/api/free/documents/'+uploaded.data.document.id)).data.document;if(doc.operations[0].status==='done')break;await delay();}assert.equal(calls,2);
});

test('cancel during a running provider call never publishes or saves its late result',async t=>{
  const gate=deferred();let calls=0;
  const f=await fixture(t,{fetchImpl:async()=>{calls++;await gate.promise;return Response.json({data:[{b64_json:bytes.toString('base64')}]});}});
  const created=await f.api('/api/scenes/jobs',input),id=created.data.job.id;await f.api('/api/scenes/jobs/'+id+'/cancel',{});gate.resolve();for(let i=0;i<10;i++)await delay();
  const cancelled=(await f.api('/api/scenes/jobs/'+id)).data.job;assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.imageUrl,undefined);assert.equal((await f.api('/api/scenes',{jobId:id})).status,409);assert.equal((await fetch(f.base+'/api/scenes/jobs/'+id+'/image')).status,404);await assert.rejects(readFile(path.join(f.outputDir,'scene-creation',id,'candidate.png')),error=>error.code==='ENOENT');assert.equal(calls,1);
});

test('restart recovers already-written PNG and interrupted jobs without automatic paid submissions',async t=>{
  const f=await fixture(t),readyId='11111111-1111-4111-8111-111111111111',lostId='22222222-2222-4222-8222-222222222222';
  await f.api('/api/scenes/jobs');
  for(const id of [readyId,lostId]){const folder=path.join(f.outputDir,'scene-creation',id);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'job.json'),JSON.stringify({version:1,id,...input,created:Date.now(),status:'running',message:'生成中'}));if(id===readyId)await writeFile(path.join(folder,'candidate.png'),bytes);}
  await f.restart();assert.equal((await f.api('/api/scenes/jobs/'+readyId)).data.job.status,'done');assert.equal((await f.api('/api/scenes/jobs/'+lostId)).data.job.status,'error');assert.equal(f.calls.length,0);assert.equal((await f.api('/api/scenes',{jobId:readyId})).status,200);assert.equal((await f.api('/api/scenes',{jobId:lostId})).status,409);
});

test('separate invitations isolate scene jobs, saved scenes and all media, including save-by-foreign-job attempts',async t=>{
  const f=await fixture(t),gateways=[];
  t.after(async()=>{for(const gateway of gateways)await new Promise(resolve=>gateway.close(resolve));});
  async function gateway(name){const token='synthetic-scene-invite-'+name+'-012345678901234567890',origin='https://'+name+'.example',server=createShareServer({token,backend:f.base,getPublicOrigin:async()=>origin});gateways.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,headers={Cookie:'zhijing_invite='+token,Origin:origin,'Content-Type':'application/json'};return {base,headers,api:async(route,data)=>{const response=await fetch(base+route,data===undefined?{headers}:{method:'POST',headers,body:JSON.stringify(data)});return {status:response.status,data:await response.json()};}};}
  const a=await gateway('first'),b=await gateway('second'),local=await f.api('/api/scenes/jobs',input);await f.finish(local.data.job.id);
  assert.equal((await a.api('/api/scenes/jobs')).data.jobs.length,0);assert.equal((await a.api('/api/scenes',{jobId:local.data.job.id})).status,404);
  const created=await a.api('/api/scenes/jobs',input);assert.equal(created.status,202);const id=created.data.job.id;await f.finish(id);
  assert.equal((await a.api('/api/scenes/jobs')).data.jobs.length,1);assert.equal((await b.api('/api/scenes/jobs')).data.jobs.length,0);assert.equal((await b.api('/api/scenes/jobs/'+id)).status,404);assert.equal((await b.api('/api/scenes',{jobId:id})).status,404);
  assert.equal((await fetch(b.base+'/api/scenes/jobs/'+id+'/image',{headers:b.headers})).status,404);const saved=await a.api('/api/scenes',{jobId:id});assert.equal(saved.status,200);const scene=saved.data.scene;
  assert.equal((await a.api('/api/scenes')).data.scenes.length,1);assert.equal((await b.api('/api/scenes')).data.scenes.length,0);assert.equal((await fetch(a.base+scene.imageUrl,{headers:a.headers})).status,200);assert.equal((await fetch(b.base+scene.imageUrl,{headers:b.headers})).status,404);assert.equal((await b.api('/api/scenes/'+scene.id+'/delete',{})).status,404);
  assert.equal((await fetch(a.base+'/api/scenes/jobs',{method:'POST',headers:{...a.headers,Origin:'https://evil.example'},body:JSON.stringify(input)})).status,403);assert.equal((await fetch(a.base+'/api/scenes')).status,403);
  assert.equal((await a.api('/api/scenes/'+scene.id+'/delete',{})).status,200);assert.equal((await a.api('/api/scenes')).data.scenes.length,0);assert.equal((await fetch(a.base+scene.imageUrl,{headers:a.headers})).status,404);
  const restored=await a.api('/api/scenes',{jobId:id,name:'邀请内恢复'});assert.equal(restored.status,200);assert.equal(restored.data.scene.id,scene.id);assert.equal((await a.api('/api/scenes')).data.scenes.length,1);assert.equal((await fetch(a.base+scene.imageUrl,{headers:a.headers})).status,200);assert.equal((await b.api('/api/scenes',{jobId:id})).status,404);assert.equal((await b.api('/api/scenes')).data.scenes.length,0);assert.equal((await fetch(b.base+scene.imageUrl,{headers:b.headers})).status,404);
});
