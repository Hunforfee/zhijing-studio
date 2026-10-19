import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';
import {createShareServer} from './share-server.mjs';
const picture=new PNG({width:80,height:60});picture.data.fill(255);const png=PNG.sync.write(picture),image='data:image/png;base64,'+png.toString('base64');
const listen=async server=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;};
const close=server=>new Promise(resolve=>server.close(resolve));
test('library is available in website routes while two invitations isolate saved originals and idempotency',async()=>{
 const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-library-integration-'));let modelCalls=0;
 const server=createServer({outputDir,service:{provider:'sub2api',apiKey:'synthetic-library-only',baseUrl:'https://no-model.example/v1',model:'test-only'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async()=>{modelCalls++;throw Error('No model calls allowed');}}),base=await listen(server);
 const tokens=['library-invitation-A-'.repeat(3),'library-invitation-B-'.repeat(3)],gateways=tokens.map(token=>createShareServer({token,backend:base})),urls=[];for(const gateway of gateways)urls.push(await listen(gateway));
 const post=(url,route,data,cookie)=>fetch(url+route,{method:'POST',headers:{Origin:url,'Content-Type':'application/json',...(cookie?{Cookie:'zhijing_invite='+cookie}:{})},body:JSON.stringify(data)});
 const get=(index,route,method='GET')=>fetch(urls[index]+route,{method,headers:{Cookie:'zhijing_invite='+tokens[index]}});
 try {
  for(const route of ['/library','/library/','/asset-library.html','/library-client.js','/library-actions.js','/workspace-library.js'])assert.equal((await fetch(base+route)).status,200,route);
  assert.equal((await get(0,'/library')).status,200);assert.equal((await fetch(urls[0]+'/library')).status,403);
  const input={requestId:randomUUID(),name:'窗边花型',kind:'product',code:'SKU-001',collection:'春日',image,imageB:image,recipe:{product:'set',fabric:'cotton',fabricMode:'selected',duvetCraft:'wide-flange',sheetStyle:'standard',pillowCraft:'pillow-wide-flange'}};
  const saved=await post(urls[0],'/api/library/assets',input,tokens[0]);assert.equal(saved.status,201);const {asset}=await saved.json();assert.ok(asset.id);assert.equal(asset.hasB,true);
  const repeat=await post(urls[0],'/api/library/assets',input,tokens[0]);assert.equal(repeat.status,200);assert.equal((await repeat.json()).asset.id,asset.id);
  const crossRetry=await post(urls[1],'/api/library/assets',input,tokens[1]);assert.equal(crossRetry.status,404);assert.doesNotMatch(await crossRetry.text(),/SKU-001|窗边花型/);
  for(const suffix of ['', '/image','/imageB','/thumbnail','/update','/delete']){const response=suffix==='/update'||suffix==='/delete'?await post(urls[1],'/api/library/assets/'+asset.id+suffix,{},tokens[1]):await get(1,'/api/library/assets/'+asset.id+suffix);assert.equal(response.status,404,suffix);}
  for(const suffix of ['/image','/imageB']){const response=await get(0,'/api/library/assets/'+asset.id+suffix);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);assert.equal((await get(0,'/api/library/assets/'+asset.id+suffix,'HEAD')).status,200);}
  assert.equal((await get(0,'/api/library/assets/'+asset.id+'/thumbnail')).status,200);
  assert.equal((await(await get(0,'/api/library/assets')).json()).assets.length,1);assert.deepEqual((await(await get(1,'/api/library/assets')).json()).assets,[]);
  const update=await post(urls[0],'/api/library/assets/'+asset.id+'/update',{name:'已确认商品'},tokens[0]);assert.equal(update.status,200);
  const foreign=await fetch(urls[0]+'/api/library/assets',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json',Cookie:'zhijing_invite='+tokens[0]},body:JSON.stringify({...input,requestId:randomUUID()})});assert.equal(foreign.status,403);
  const deleted=await post(urls[0],'/api/library/assets/'+asset.id+'/delete',{},tokens[0]);assert.equal(deleted.status,200);assert.equal((await get(0,'/api/library/assets/'+asset.id+'/image')).status,404);assert.deepEqual((await(await get(0,'/api/library/assets')).json()).assets,[]);assert.equal(modelCalls,0);
 } finally {for(const gateway of gateways)await close(gateway);await close(server);assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-library-integration-'));await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
});
