import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';
import {normalizeFreeEdit,buildFreeEditPrompt} from './dist/free-creation-policy.js';
import {decodeFreePng,freeImageData,preserveOutsideRegion} from './free-creation-images.mjs';

const key='synthetic-free-creation-secret';
function picture(width=32,height=24,color=[180,140,100,255]){const png=new PNG({width,height});for(let i=0;i<png.data.length;i+=4)png.data.set(color,i);return PNG.sync.write(png);}
const original=picture(),generated=picture(16,16,[30,150,200,255]),image=bytes=>'data:image/png;base64,'+bytes.toString('base64');
const edit={sourceVersion:'original',mode:'scene',prompt:'换成原木卧室，保留花型、宽边和原色',ratio:'3:4',lockPattern:true,lockCraft:true};
async function fixture(t,settings={}){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-free-test-'));let calls=0;
  const requests=[];const options={outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:key,baseUrl:'https://free.example/v1',model:'gpt-image-2.5-flare'},videoOptions:{loadConfig:async()=>null},fetchImpl:async(url,init)=>{calls++;requests.push({url,init});return Response.json({data:[{b64_json:generated.toString('base64')}]});},...settings};
  let server,base;
  async function start(){server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
  await start();
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));if(!path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-free-test-'))throw Error('Unexpected temporary path');await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
  const api=async(route,data)=>{const response=await fetch(base+route,data===undefined?{}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};};
  const upload=async()=>{const result=await api('/api/free/documents',{image:image(original),title:'测试床品'});assert.equal(result.status,201);return result.data.document;};
  async function finish(id){for(let i=0;i<120;i++){const {data}=await api('/api/free/documents/'+id);if(!data.document.operations.some(op=>['queued','running'].includes(op.status)))return data.document;await new Promise(resolve=>setTimeout(resolve,15));}throw Error('free task did not finish');}
  return {api,upload,finish,requests,outputDir,get calls(){return calls;},get base(){return base;},restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();}};
}

test('free edit policy honors explicit changes without imposing bedding and rejects invalid regions',()=>{
  const value=normalizeFreeEdit({...edit,region:{x:.25,y:.25,width:.5,height:.5}});assert.equal(value.ratio,'source');
  const prompt=buildFreeEditPrompt(value,{reference:true});assert.match(prompt,/not a fabric-only swatch/);assert.match(prompt,/Explicit user-requested/);assert.match(prompt,/Image 2/);assert.match(prompt,/normalized rectangle/);
  for(const patch of [{mode:'unsupported'},{prompt:''},{ratio:'16:9'},{lockPattern:'false'},{region:{x:-.1,y:0,width:.5,height:.5}},{mode:'extend',region:{x:0,y:0,width:.5,height:.5}}])assert.throws(()=>normalizeFreeEdit({...edit,...patch}));
});
test('PNG safety checks reject invalid content and oversized dimensions before decoding',()=>{
  assert.deepEqual(freeImageData(image(original)).bytes,original);assert.throws(()=>freeImageData('data:image/png;base64,eA=='));
  const bomb=Buffer.from(original);bomb.writeUInt32BE(8000,16);bomb.writeUInt32BE(8000,20);assert.throws(()=>decodeFreePng(bomb),/尺寸过大/);
  const corrupt=Buffer.from(original);corrupt[corrupt.length-8]^=255;assert.throws(()=>decodeFreePng(corrupt));
});
test('local editing preserves every pixel outside the rectangle even when provider dimensions differ',()=>{
  const region={x:.25,y:.25,width:.5,height:.5},result=decodeFreePng(preserveOutsideRegion(original,generated,region)),source=decodeFreePng(original);
  assert.equal(result.width,32);assert.equal(result.height,24);let changed=0;
  for(let y=0;y<24;y++)for(let x=0;x<32;x++){const at=(y*32+x)*4;if(x<8||x>=24||y<6||y>=18)assert.deepEqual(result.data.subarray(at,at+4),source.data.subarray(at,at+4));else if(!result.data.subarray(at,at+4).equals(source.data.subarray(at,at+4)))changed++;}
  assert.ok(changed>100);
});
test('upload, native edits, original comparison and branching survive restart without exposing keys',async t=>{
  const f=await fixture(t),doc=await f.upload(),route='/api/free/documents/'+doc.id;
  assert.equal(f.calls,0);assert.deepEqual(Buffer.from(await(await fetch(f.base+doc.versions[0].url)).arrayBuffer()),original);
  const submitted=await f.api(route+'/edit',{...edit,referenceImage:image(generated)});assert.equal(submitted.status,202);
  const done=await f.finish(doc.id);assert.equal(done.versions.length,2);assert.equal(done.operations[0].status,'done');assert.equal(f.calls,1);
  const form=f.requests[0].init.body;assert.equal(form.get('model'),'gpt-image-2.5-sunburst');assert.equal(form.get('size'),'1008x1344');assert.equal(form.getAll('image[]').length,2);assert.match(form.get('prompt'),/原木卧室/);
  assert.deepEqual(Buffer.from(await form.getAll('image[]')[0].arrayBuffer()),original);
  assert.equal((await f.api(route+'/edit',{...edit,prompt:'只调整光线',sourceVersion:'original',mode:'light'})).status,202);
  const branch=await f.finish(doc.id);assert.equal(branch.versions.length,3);assert.equal(branch.versions[2].parent,'original');assert.equal(branch.versions[1].parent,'original');
  const disk=await readFile(path.join(f.outputDir,'free-creation',doc.id,'document.json'),'utf8');assert.ok(!disk.includes(key));assert.ok(!disk.includes('data:image/'));
  await f.restart();const restored=(await f.api(route)).data.document;assert.equal(restored.versions.length,3);assert.equal(f.calls,2);assert.ok(!JSON.stringify(restored).includes(key));
  assert.equal((await fetch(f.base+route+'/images/22222222-2222-4222-8222-222222222222')).status,404);
});
test('region edits return source-sized results while the original remains intact',async t=>{
  const f=await fixture(t),doc=await f.upload(),region={x:.25,y:.25,width:.5,height:.5};
  assert.equal((await f.api('/api/free/documents/'+doc.id+'/edit',{...edit,region})).status,202);const done=await f.finish(doc.id);
  const returned=Buffer.from(await(await fetch(f.base+done.versions[1].url)).arrayBuffer());assert.deepEqual(returned,preserveOutsideRegion(original,generated,region));
  assert.deepEqual(Buffer.from(await(await fetch(f.base+done.versions[0].url)).arrayBuffer()),original);assert.equal(f.requests[0].init.body.get('size'),'auto');
});
test('bad edits and foreign origins create no paid work',async t=>{
  const f=await fixture(t),doc=await f.upload(),route='/api/free/documents/'+doc.id;
  for(const patch of [{sourceVersion:'../../private'},{prompt:''},{region:{x:0,y:0,width:2,height:1}}])assert.notEqual((await f.api(route+'/edit',{...edit,...patch})).status,202);
  const blocked=await fetch(f.base+route+'/edit',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(edit)});assert.equal(blocked.status,403);assert.equal(f.calls,0);
});
test('free creation uses the shared FIFO; cancelling queued work never calls the provider',async t=>{
  let release;const barrier=new Promise(resolve=>{release=resolve;});let calls=0;
  const f=await fixture(t,{fetchImpl:async()=>{calls++;await barrier;return Response.json({data:[{b64_json:generated.toString('base64')}]});}}),first=await f.upload(),second=await f.upload();
  await f.api('/api/free/documents/'+first.id+'/edit',edit);await f.api('/api/free/documents/'+second.id+'/edit',edit);
  const queued=(await f.api('/api/free/documents/'+second.id)).data.document;assert.equal(queued.operations[0].status,'queued');assert.equal((await f.api('/api/jobs/active')).data,null);
  assert.equal((await f.api('/api/free/documents/'+second.id+'/cancel',{})).status,200);release();await f.finish(first.id);
  assert.equal(calls,1);assert.equal((await f.api('/api/free/documents/'+second.id)).data.document.versions.length,1);
});
test('failed provider errors redact keys, preserve the source and never retry automatically',async t=>{
  let calls=0;const f=await fixture(t,{fetchImpl:async()=>{calls++;throw Error('connection failed '+key);}}),doc=await f.upload();
  await f.api('/api/free/documents/'+doc.id+'/edit',edit);const failed=await f.finish(doc.id);assert.equal(failed.operations[0].status,'error');assert.ok(!JSON.stringify(failed).includes(key));assert.equal(failed.versions.length,1);assert.equal(calls,1);
});
test('unsupported redraw-only services are rejected before editing',async t=>{
  const f=await fixture(t,{service:{provider:'zhipu',apiKey:key,baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'}}),doc=await f.upload();
  assert.equal((await f.api('/api/free/documents/'+doc.id+'/edit',edit)).status,409);assert.equal(f.calls,0);
});

test('free edits wait for existing image photography in the same FIFO queue',async t=>{
  let release,calls=0;const barrier=new Promise(resolve=>{release=resolve;});
  const f=await fixture(t,{firstImageReview:false,fetchImpl:async()=>{calls++;if(calls===1)await barrier;return Response.json({data:[{b64_json:generated.toString('base64')}]});}});
  const photograph=await f.api('/api/jobs',{product:'set',fabric:'cotton',scenes:['warm'],angles:['front'],size:'1.8m 床',scale:100,direction:0,repeat:'tile',ratio:'3:4',notes:'',plainSheet:false,image:image(original)});assert.equal(photograph.status,202,JSON.stringify(photograph.data));
  const doc=await f.upload();await f.api('/api/free/documents/'+doc.id+'/edit',edit);
  assert.equal((await f.api('/api/free/documents/'+doc.id)).data.document.operations[0].status,'queued');
  release();const done=await f.finish(doc.id);assert.equal(done.versions.length,2);assert.equal(calls,2);
  assert.equal((await f.api('/api/jobs/'+photograph.data.id)).data.status,'done');
});
test('stopping a running edit preserves the original and creates no output version',async t=>{
  let calls=0;const f=await fixture(t,{fetchImpl:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}),doc=await f.upload();
  await f.api('/api/free/documents/'+doc.id+'/edit',edit);
  await f.api('/api/free/documents/'+doc.id+'/cancel',{});const cancelled=await f.finish(doc.id);
  assert.equal(cancelled.versions.length,1);assert.equal(cancelled.operations[0].status,'cancelled');assert.equal(calls,1);
});
test('restart recovers already-written results and reports interrupted work without paid retries',async t=>{
  const f=await fixture(t),doc=await f.upload(),completeId='11111111-1111-4111-8111-111111111111',interruptedId='22222222-2222-4222-8222-222222222222';
  doc.operations=[completeId,interruptedId].map(id=>({id,...edit,created:Date.now(),status:'running',message:'编辑中'}));
  const directory=path.join(f.outputDir,'free-creation',doc.id);await writeFile(path.join(directory,completeId+'.png'),generated);await writeFile(path.join(directory,'document.json'),JSON.stringify(doc));
  await f.restart();const restored=(await f.api('/api/free/documents/'+doc.id)).data.document;
  assert.equal(restored.versions.length,2);assert.equal(restored.operations[0].status,'done');assert.equal(restored.operations[1].status,'error');assert.equal(f.calls,0);
});
