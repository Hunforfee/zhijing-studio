import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm,readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {PNG} from 'pngjs';
import {createRequestSourcePolicy} from './request-source.mjs';
import {ASSET_LIBRARY_BODY_LIMIT,ASSET_LIBRARY_IMAGE_LIMIT,createAssetLibrary,decodeAssetPng,normalizeAssetMetadata} from './asset-library.mjs';

function picture(width=24,height=18,color=190){
  const png=new PNG({width,height});for(let i=0;i<png.data.length;i+=4){png.data[i]=color;png.data[i+1]=i%251;png.data[i+2]=211;png.data[i+3]=255;}return PNG.sync.write(png);
}
const dataURL=bytes=>'data:image/png;base64,'+bytes.toString('base64');
const bytes=picture(),image=dataURL(bytes),baseInput={name:'春日小花',kind:'pattern',image};
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function withDensity(bytes,dpi=300){
  const chunk=Buffer.alloc(21);chunk.writeUInt32BE(9,0);chunk.write('pHYs',4);chunk.writeUInt32BE(Math.round(dpi/0.0254),8);chunk.writeUInt32BE(Math.round(dpi/0.0254),12);chunk[16]=1;chunk.writeUInt32BE(crc32(chunk.subarray(4,17)),17);return Buffer.concat([bytes.subarray(0,33),chunk,bytes.subarray(33)]);
}

async function fixture(t){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-asset-test-')),limits=[],sourceAllowed=createRequestSourcePolicy();let server,base,modelCalls=0;
  async function start(){
    const library=createAssetLibrary({outputDir,getConfig:()=>{modelCalls++;throw Error('Asset saving must never use AI');},fetchImpl:()=>{modelCalls++;throw Error('Asset saving must never use an upstream service');}});
    const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    const body=async(req,max)=>{limits.push(max);const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>max)throw Object.assign(Error('Too large'),{status:413});chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));};
    server=http.createServer(async(req,res)=>{
      if(req.method==='POST'&&!sourceAllowed(req)){req.resume();json(res,403,{error:'访问来源不允许'});return;}
      if(!await library.handle(req,res,new URL(req.url,'http://localhost').pathname,body,json))json(res,404,{error:'not found'});
    });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  }
  await start();
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));assert.equal(modelCalls,0);await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});});
  async function api(route,data,headers={}){
    const response=await fetch(base+route,data===undefined?{headers}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};
  }
  return {api,outputDir,limits,get base(){return base;},restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();}};
}

test('asset metadata keeps editable print data and restricts names, sources, tags and recipe fields',()=>{
  const print={widthCm:32.5,heightCm:48,dpi:300},recipe={product:'set',fabric:'cotton',fabricMode:'selected',duvetCraft:'wide-flange',sheetStyle:'fitted',pillowCraft:'pillow-wide-flange',productVariantChoices:{set:true,mat:false}};
  const normalized=normalizeAssetMetadata({name:' 春日系列 ',kind:'product',tags:['小花','小花','清新'],print,recipe,source:'花型设计室'});
  assert.equal(normalized.name,'春日系列');assert.deepEqual(normalized.tags,['小花','清新']);assert.deepEqual(normalized.print,print);assert.deepEqual(normalized.recipe,recipe);assert.equal(normalized.code,'');
  for(const patch of [{name:''},{name:'x'.repeat(81)},{kind:'unknown'},{name:'<img src=x>'},{description:'x'.repeat(2001)},{code:'x'.repeat(81)},{collection:1},{tags:Array(21).fill('tag')},{tags:['']},{tags:['x'.repeat(41)]},{source:'C:\\Users\\person\\secret.png'},{source:'file:///C:/Users/picture.png'},{source:'/home/person/private.png'},{source:'x'.repeat(241)},{name:'bad\u0000name'},{print:{widthCm:20,heightCm:30}},{print:{widthCm:0,heightCm:30,dpi:300}},{print:{widthCm:20,heightCm:30,dpi:3000}},{print:{widthCm:20,heightCm:30,dpi:300,secret:'value'}},{apiKey:'never'}])assert.throws(()=>normalizeAssetMetadata({name:'valid',kind:'pattern',...patch}),undefined,JSON.stringify(patch));
  for(const invalid of [{product:'unknown'},{model:'hidden'},{fabric:'https://outside.example'},{fabricMode:'auto-selected'},{duvetCraft:'x'.repeat(81)},{productVariantChoices:{set:'true'}},{productVariantChoices:{unknown:true}},{productVariantChoices:{set:true,apiKey:true}},{fabric:{nested:'cotton'}}])assert.throws(()=>normalizeAssetMetadata({name:'商品',kind:'product',recipe:invalid}));
  assert.throws(()=>normalizeAssetMetadata({name:'花型',kind:'pattern',recipe}));
  const cleared=normalizeAssetMetadata({kind:'pattern',recipe:null,print:null},normalized);assert.equal(cleared.recipe,undefined);assert.equal(cleared.print,undefined);
});

test('PNG validation rejects URLs, malformed encoding, invalid CRC and decompression dimensions before saving',()=>{
  assert.deepEqual(decodeAssetPng(image).bytes,bytes);
  for(const invalid of ['https://outside.example/pattern.png','file:///private.png','data:image/jpeg;base64,'+bytes.toString('base64'),'data:image/png;base64,eA==',image+'\n',image.slice(0,-1)])assert.throws(()=>decodeAssetPng(invalid));
  const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;assert.throws(()=>decodeAssetPng(dataURL(corrupt)));
  for(const [width,height] of [[16001,1],[8001,8000],[0,20]]){const header=Buffer.from(bytes);header.writeUInt32BE(width,16);header.writeUInt32BE(height,20);assert.throws(()=>decodeAssetPng(dataURL(header)),error=>error.code==='ASSET_IMAGE_DIMENSIONS');}
  const tooLarge='data:image/png;base64,'+'A'.repeat(Math.ceil(ASSET_LIBRARY_IMAGE_LIMIT/3)*4+4);assert.throws(()=>decodeAssetPng(tooLarge),error=>error.status===413);
});

test('saving A/B retains original PNG bytes, pixel dimensions and pHYs while previews stay independently small',async t=>{
  const f=await fixture(t),original=withDensity(picture(2570,96),300),originalB=withDensity(picture(93,117,111),150);
  assert.deepEqual((await f.api('/api/library/assets')).data.assets,[]);
  const saved=await f.api('/api/library/assets',{...baseInput,kind:'product',image:dataURL(original),imageB:dataURL(originalB),print:{widthCm:21.7593,heightCm:.8128,dpi:300},recipe:{product:'set',duvetCraft:'wide-flange'},code:'S-01',collection:'春日',source:'花型设计室',tags:['花卉']});
  assert.equal(saved.status,201);const asset=saved.data.asset;
  assert.equal(asset.width,2570);assert.equal(asset.height,96);assert.equal(asset.hasB,true);assert.equal(asset.widthB,93);assert.equal(asset.heightB,117);assert.equal(asset.imageUrl,'/api/library/assets/'+asset.id+'/image');assert.equal(asset.imageBUrl,'/api/library/assets/'+asset.id+'/imageB');assert.equal(asset.thumbnailUrl,'/api/library/assets/'+asset.id+'/thumbnail');assert.equal(f.limits[0],ASSET_LIBRARY_BODY_LIMIT);
  assert.deepEqual((await f.api('/api/library/assets/'+asset.id)).data.asset,asset);
  for(const [url,expected] of [[asset.imageUrl,original],[asset.imageBUrl,originalB]]){
    const response=await fetch(f.base+url);assert.equal(response.headers.get('content-type'),'image/png');assert.match(response.headers.get('cache-control'),/private/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);
    const head=await fetch(f.base+url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),expected.length);assert.equal((await head.arrayBuffer()).byteLength,0);
  }
  const previewResponse=await fetch(f.base+asset.thumbnailUrl),preview=PNG.sync.read(Buffer.from(await previewResponse.arrayBuffer()));assert.equal(preview.width,384);assert.equal(preview.height,14);
  assert.deepEqual(await readFile(path.join(f.outputDir,'asset-library',asset.id,'original.png')),original);assert.deepEqual(await readFile(path.join(f.outputDir,'asset-library',asset.id,'originalB.png')),originalB);
  const metadata=JSON.parse(await readFile(path.join(f.outputDir,'asset-library',asset.id,'asset.json'),'utf8'));assert.equal(metadata.image,undefined);assert.equal(JSON.stringify(asset).includes(f.outputDir),false);assert.equal(asset.path,undefined);assert.equal(asset.requestDigest,undefined);assert.equal((await f.api('/api/library/assets')).data.assets.length,1);
});

test('metadata-only edits preserve images and clear optional print/recipe without retaining removed fields',async t=>{
  const f=await fixture(t),saved=await f.api('/api/library/assets',{...baseInput,kind:'product',print:{widthCm:32,heightCm:32,dpi:300},source:'设计室',recipe:{product:'set',fabric:'cotton'}}),asset=saved.data.asset;
  const edited=await f.api('/api/library/assets/'+asset.id+'/update',{name:'更新名称',code:'S-02',collection:'秋日',description:'棉布花型参考',tags:['细花','浅色'],print:{widthCm:64,heightCm:64,dpi:150},source:'换色工具'});
  assert.equal(edited.status,200);assert.equal(edited.data.asset.id,asset.id);assert.equal(edited.data.asset.name,'更新名称');assert.equal(edited.data.asset.code,'S-02');assert.equal(edited.data.asset.collection,'秋日');assert.equal(edited.data.asset.print.dpi,150);assert.deepEqual(edited.data.asset.recipe,asset.recipe);assert.equal(edited.data.asset.created,asset.created);assert.ok(edited.data.asset.updated>=asset.updated);
  assert.equal((await f.api('/api/library/assets/'+asset.id+'/update',{image:'https://outside.example/other.png'})).status,400);
  assert.equal((await f.api('/api/library/assets/'+asset.id+'/update',{kind:'pattern'})).status,400);
  const cleared=await f.api('/api/library/assets/'+asset.id+'/update',{kind:'pattern',recipe:null,print:null,source:null,tags:[]});assert.equal(cleared.status,200);assert.equal(cleared.data.asset.recipe,undefined);assert.equal(cleared.data.asset.print,undefined);assert.equal(cleared.data.asset.source,undefined);
  assert.deepEqual(Buffer.from(await(await fetch(f.base+asset.imageUrl)).arrayBuffer()),bytes);assert.equal((await fetch(f.base+'/api/library/assets/'+asset.id+'/imageB')).status,404);
  await f.restart();const restored=(await f.api('/api/library/assets/'+asset.id)).data.asset;assert.equal(restored.name,'更新名称');assert.equal(restored.recipe,undefined);assert.equal(restored.print,undefined);assert.deepEqual(restored.tags,[]);
});

test('requestId deduplicates concurrent saves and restart retries, and conflicting images or recipes cannot claim old records',async t=>{
  const f=await fixture(t),requestId=randomUUID(),input={...baseInput,requestId,kind:'product',recipe:{product:'set',duvetCraft:'plain'}};
  const responses=await Promise.all([f.api('/api/library/assets',input),f.api('/api/library/assets',input)]);assert.deepEqual(responses.map(result=>result.status).sort(),[200,201]);const asset=responses[0].data.asset;assert.equal(responses[1].data.asset.id,asset.id);assert.equal((await f.api('/api/library/assets')).data.assets.length,1);assert.equal(asset.requestId,undefined);assert.equal(asset.requestDigest,undefined);
  for(const patch of [{name:'另一个名字'},{image:dataURL(picture(24,18,22))},{recipe:{product:'set',duvetCraft:'wide-flange'}},{imageB:image}]){
    const conflicting=await f.api('/api/library/assets',{...input,...patch});assert.equal(conflicting.status,409);assert.equal(conflicting.data.code,'ASSET_REQUEST_CONFLICT');
  }
  await f.restart();const repeated=await f.api('/api/library/assets',input);assert.equal(repeated.status,200);assert.equal(repeated.data.asset.id,asset.id);assert.equal((await f.api('/api/library/assets')).data.assets.length,1);
  await f.api('/api/library/assets/'+asset.id+'/update',{description:'稍后补充的说明'});assert.equal((await f.api('/api/library/assets',input)).data.asset.description,'稍后补充的说明');
});

test('soft deletion hides records and media, survives restart and is not undone by an old save retry',async t=>{
  const f=await fixture(t),input={...baseInput,requestId:randomUUID()},asset=(await f.api('/api/library/assets',input)).data.asset;
  assert.equal((await f.api('/api/library/assets/'+asset.id+'/delete',{})).data.deleted,true);assert.equal((await f.api('/api/library/assets/'+asset.id+'/delete',{})).status,200);
  assert.deepEqual((await f.api('/api/library/assets')).data.assets,[]);assert.equal((await f.api('/api/library/assets/'+asset.id)).status,404);assert.equal((await fetch(f.base+asset.imageUrl)).status,404);assert.equal((await fetch(f.base+asset.thumbnailUrl)).status,404);assert.equal((await f.api('/api/library/assets/'+asset.id+'/update',{name:'不能复活'})).status,404);
  assert.deepEqual(await readFile(path.join(f.outputDir,'asset-library',asset.id,'original.png')),bytes);await f.restart();assert.deepEqual((await f.api('/api/library/assets')).data.assets,[]);
  const oldRetry=await f.api('/api/library/assets',input);assert.equal(oldRetry.status,409);assert.equal(oldRetry.data.code,'ASSET_REMOVED');const explicitNew=await f.api('/api/library/assets',{...input,requestId:randomUUID()});assert.equal(explicitNew.status,201);assert.notEqual(explicitNew.data.asset.id,asset.id);
});

test('invalid bodies, unknown fields and foreign origin reject before any persistence or model call',async t=>{
  const f=await fixture(t);
  const foreign=await f.api('/api/library/assets',baseInput,{Origin:'https://outside.example'});assert.equal(foreign.status,403);assert.equal(f.limits.length,0);
  for(const invalid of [{...baseInput,image:'https://outside.example/fabric.png'},{...baseInput,imageB:'data:image/png;base64,bm90IHBpY3R1cmU='},{...baseInput,requestId:'bad'},{...baseInput,apiKey:'never'},{...baseInput,name:''},{...baseInput,kind:'product',recipe:{apiKey:'never'}},[],null])assert.equal((await f.api('/api/library/assets',invalid)).status,400);
  const malformed=await fetch(f.base+'/api/library/assets',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:'{bad JSON'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).code,'ASSET_INVALID_INPUT');
  assert.deepEqual((await f.api('/api/library/assets')).data.assets,[]);assert.deepEqual(await readdir(path.join(f.outputDir,'asset-library')),[]);
  assert.equal((await f.api('/api/library/assets/../../outside')).status,404);assert.equal((await f.api('/api/library/assets/not-a-uuid')).status,404);
  const unsupported=await fetch(f.base+'/api/library/assets/'+randomUUID()+'/update',{method:'PUT'});assert.equal(unsupported.status,405);
});

test('restart ignores uncommitted folders and reports incomplete storage without leaking private paths',async t=>{
  const f=await fixture(t);await f.api('/api/library/assets');const orphan=randomUUID(),orphanFolder=path.join(f.outputDir,'asset-library',orphan);await mkdir(orphanFolder);await writeFile(path.join(orphanFolder,'original.png'),bytes);await f.restart();assert.deepEqual((await f.api('/api/library/assets')).data.assets,[]);
  const created=(await f.api('/api/library/assets',baseInput)).data.asset;await rm(path.join(f.outputDir,'asset-library',created.id,'original.png'));await f.restart();const failed=await f.api('/api/library/assets');assert.equal(failed.status,503);assert.equal(failed.data.code,'ASSET_STORAGE_UNAVAILABLE');assert.equal(JSON.stringify(failed).includes(f.outputDir),false);assert.equal(JSON.stringify(failed).includes('original.png'),false);
});
