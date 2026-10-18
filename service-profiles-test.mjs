import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createServer} from './server.mjs';
import {serviceProfiles,savedServiceProfiles} from './service-profiles.mjs';
import {saveServiceConfig,loadServiceConfig} from './secure-service-store.mjs';
import {zhipuImage,zhipuJson} from './zhipu-response.mjs';
import {buildZhipuPrompt,zhipuImageRequest,zhipuModels} from './zhipu-prompts.mjs';
import {sceneDirections,angleDirections} from './photography-prompts.mjs';
import {validateService} from './server.mjs';
const relay={provider:'sub2api',apiKey:'synthetic-relay-credential',baseUrl:'https://relay.example/v1',model:'custom-image-model'};
const zhipu={provider:'zhipu',apiKey:'synthetic-zhipu-credential',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const input={product:'set',fabric:'cotton',scenes:['warm'],angles:['front'],size:'标准',scale:100,direction:0,repeat:'tile',ratio:'1:1',plainSheet:false,notes:'',image:'data:image/png;base64,'+png.toString('base64')};
async function fixture(fn,options={}){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-profiles-')),server=createServer({service:relay,outputDir,...options});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const post=(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data||{})});
  try{await fn({base,post})}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-profiles-'));await rm(outputDir,{recursive:true,force:true})}
}
async function job(base,id){for(let n=0;n<100;n++){const s=await(await fetch(base+'/api/jobs/'+id)).json();if(s.status!=='running')return s;await new Promise(r=>setTimeout(r,15))}throw Error('模拟任务未结束')}
test('legacy service migration and encrypted multi-provider restart preserve independent credentials',async()=>{
  const old=serviceProfiles(relay);assert.equal(old.profiles.sub2api.apiKey,relay.apiKey);assert.equal(old.activeProvider,'sub2api');
  const bundle=savedServiceProfiles({...old.profiles,zhipu},'zhipu');assert.equal(serviceProfiles(bundle).profiles.sub2api.model,relay.model);
  if(process.platform!=='win32')return;
  const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-profiles-')),file=path.join(dir,'service.dpapi');
  try{
    await saveServiceConfig(relay,file);assert.equal(serviceProfiles(await loadServiceConfig(file)).profiles.sub2api.apiKey,relay.apiKey);
    await saveServiceConfig(bundle,file);const bytes=await readFile(file);assert.ok(!bytes.includes(Buffer.from(relay.apiKey)));assert.ok(!bytes.includes(Buffer.from(zhipu.apiKey)));
    const restored=serviceProfiles(await loadServiceConfig(file));assert.equal(restored.activeProvider,'zhipu');assert.equal(restored.profiles.sub2api.apiKey,relay.apiKey);assert.equal(restored.profiles.zhipu.apiKey,zhipu.apiKey);
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-profiles-'));await rm(dir,{recursive:true,force:true})}
});
test('switching saved services reuses only the matching key and exposes metadata only',async()=>{
  let persisted;
  await fixture(async({base,post})=>{
    assert.equal((await post('/api/service',{...zhipu,apiKey:''})).status,400);
    assert.equal((await post('/api/service',zhipu)).status,200);
    const restored=await(await post('/api/service',{...relay,apiKey:''})).json();assert.equal(restored.provider,'sub2api');assert.equal(restored.model,relay.model);
    assert.equal(persisted.profiles.sub2api.apiKey,relay.apiKey);assert.equal(persisted.profiles.zhipu.apiKey,zhipu.apiKey);assert.equal(persisted.activeProvider,'sub2api');
    const metadata=await(await fetch(base+'/api/service/profiles')).json();assert.equal(metadata.profiles.zhipu.configured,true);assert.equal(metadata.profiles.sub2api.configured,true);
    assert.ok(!JSON.stringify(metadata).includes(relay.apiKey));assert.ok(!JSON.stringify(metadata).includes(zhipu.apiKey));
  },{persistService:async data=>persisted=structuredClone(data)});
  await fixture(async({base})=>{const status=await(await fetch(base+'/api/status')).json();assert.equal(status.provider,'sub2api');assert.equal(status.model,relay.model)},{service:persisted});
});
test('failed persistence keeps the previous active service and credentials',async()=>fixture(async({base,post})=>{
  assert.equal((await post('/api/service',zhipu)).status,400);const status=await(await fetch(base+'/api/status')).json();assert.equal(status.provider,'sub2api');
  const metadata=await(await fetch(base+'/api/service/profiles')).json();assert.equal(metadata.profiles.zhipu,undefined);
},{persistService:async()=>{throw Error('模拟写入失败')}}));
test('Zhipu encoded images are saved without attempting URL download',async()=>fixture(async({base,post})=>{
  await post('/api/service',zhipu);const response=await post('/api/jobs',input);assert.equal(response.status,202);const{id}=await response.json(),result=await job(base,id);assert.equal(result.status,'done');
  assert.deepEqual(Buffer.from(await(await fetch(base+result.results[0].url)).arrayBuffer()),png);
},{fetchImpl:async(url,init)=>{
  assert.equal(init.headers.Authorization,'Bearer '+zhipu.apiKey);
  if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'Ivory fabric with green leaves.'}}]});
  assert.ok(url.endsWith('/images/generations'));assert.equal(JSON.parse(init.body).model,'glm-image');assert.equal(init.redirect,'error');return Response.json({data:[{b64_json:png.toString('base64')}]});
}}));
test('Zhipu error envelopes, invalid JSON, filtered and empty results explain failure without leaking credentials',async()=>{
  await assert.rejects(zhipuJson(Response.json({error:{code:'1113',message:'余额不足 '+zhipu.apiKey+' Bearer other-secret'}}),zhipu),e=>/余额不足|1113/.test(e.message)&&!e.message.includes(zhipu.apiKey)&&!e.message.includes('other-secret'));
  await assert.rejects(zhipuJson(new Response('not-json',{status:502}),zhipu),/有效 JSON/);
  await assert.rejects(zhipuJson(Response.json({},{status:403}),zhipu,'智谱花型识别'),/花型识别.*权限/);
  assert.throws(()=>zhipuImage({data:[]},zhipu),/缺少 url 或 b64_json/);
  assert.throws(()=>zhipuImage({data:[],content_filter:[{level:1}]},zhipu),/审核/);
  assert.throws(()=>zhipuImage({task_id:'opaque',task_status:'PROCESSING'},zhipu),/异步任务/);
  assert.throws(()=>zhipuImage({data:[{b64_json:'not$base64'}]},zhipu),/编码无效/);
  assert.deepEqual(zhipuImage({data:[{}, {url:' https://cdn.example/photo.png '}]},zhipu),{url:'https://cdn.example/photo.png'});
});
test('Zhipu compact prompts retain both fabrics, product structures, material authority and reference scopes across 108 pairs',()=>{
  const description=JSON.stringify({fabricA:'A ivory green leaf pattern',fabricB:'B blue checks',sourceTexture:'fine matte weave',referenceScene:'reference oak bedroom',referenceAngle:'reference low side viewpoint',productDetails:'narrow piping',userTexture:'dense short raised nap'});
  for(const scene of Object.keys(sceneDirections))for(const angle of Object.keys(angleDirections))for(const product of ['set','mat','quilt','sheet','pillow','blanket']){
    const v={...input,product,imageB:input.image,fabricMode:'selected',fabric:product==='mat'?'bamboo':'brushed',size:'普通平床单自然下垂；被套枕套双埋绳',notes:'n'.repeat(500)},prompt=buildZhipuPrompt(v,scene,angle,description);
    assert.ok(prompt.length<3500);assert.match(prompt,/A ivory green leaf pattern/);assert.match(prompt,/B blue checks/);assert.match(prompt,/质感优先使用选定特征/);assert.match(prompt,new RegExp('场景 \\['+scene+'\\]'));assert.match(prompt,new RegExp('拍摄角度 \\['+angle+'\\]'));assert.doesNotMatch(prompt,/Image [1-9]|undefined|images\/edits/);
    if(product==='set')assert.match(prompt,/一件被套、一件床单或所选替代床面部件、两只枕套/);
    if(product==='mat')assert.match(prompt,/硬挺竹片席/);
    if(product==='quilt')assert.match(prompt,/厚而柔软蓬松/);
    if(product==='sheet')assert.match(prompt,/自然自由下垂/);
  }
  for(const [referenceScene,referenceAngle]of [[true,true],[true,false],[false,true]]){
    const prompt=buildZhipuPrompt({...input,imageB:input.image,referenceImage:input.image,referenceScene,referenceAngle,textureReferenceImage:input.image},'hotel','top',description);
    assert.match(prompt,/dense short raised nap/);
    if(referenceScene){assert.match(prompt,/reference oak bedroom/);assert.doesNotMatch(prompt,/场景 \[hotel\]/)}else{assert.match(prompt,/场景 \[hotel\]/);assert.doesNotMatch(prompt,/reference oak bedroom/)}
    if(referenceAngle){assert.match(prompt,/reference low side viewpoint/);assert.doesNotMatch(prompt,/拍摄角度 \[top\]/)}else{assert.match(prompt,/拍摄角度 \[top\]/);assert.doesNotMatch(prompt,/reference low side viewpoint/)}
    assert.match(prompt,/narrow piping/);
  }
  assert.match(buildZhipuPrompt({...input,fabricMode:'auto'},'warm','front',description),/质感优先参考原花型图/);
  assert.match(buildZhipuPrompt({...input,product:'quilt',quiltSeason:'summer'},'warm','reverse',description),/夏凉被.*薄型低蓬松/);
  assert.match(buildZhipuPrompt({...input,product:'sheet',sheetVariant:'quilted'},'warm','reverse',description),/夹棉床笠.*细浅菱格/);
});
test('explicit alternative Zhipu models use model-appropriate parameters and internal server errors stop without retry',async()=>{
  for(const model of zhipuModels){assert.equal(validateService({...zhipu,model},zhipu).model,model);const request=zhipuImageRequest({...zhipu,model},input,'商品实拍');assert.equal(request.quality,model==='glm-image'?'hd':'standard');assert.equal(request.watermark_enabled,true);assert.equal(request.size,model==='glm-image'?'1280x1280':'1024x1024')}
  let calls=0;
  await fixture(async({base,post})=>{
    await post('/api/service',zhipu);const{id}=await(await post('/api/jobs',{...input,angles:['front','side']})).json(),result=await job(base,id);
    assert.equal(result.status,'error');assert.match(result.error,/智谱服务内部异常.*500.*StackOverflowError/);assert.match(result.error,/无需重新填写密钥/);assert.equal(calls,1);
  },{fetchImpl:async url=>{if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'Ivory green leaves'}}]});calls++;return Response.json({error:{code:500,message:'Handler dispatch failed; nested exception is java.lang.StackOverflowError'}},{status:500})}});
});
test('settings restores each saved profile and allows blank saved keys after switching',async()=>{
  const app=await readFile('dist/app.js','utf8'),nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',required:false,textContent:'',options:['sub2api','zhipu','openai','compatible'].map(value=>({value})),replaceChildren(){},append(){}});return nodes.get(id)};
  const context=vm.createContext({state:{service:relay,ready:true},$:node,status:async()=>{},toast:assert.fail,modal(){},document:{createElement:()=>({})},fetch:async()=>Response.json({activeProvider:'sub2api',profiles:{sub2api:{...relay,apiKey:undefined,configured:true},zhipu:{...zhipu,apiKey:undefined,configured:true}}})});
  vm.runInContext(app.slice(app.indexOf('async function settings(){'),app.indexOf('async function status(){')),context);await context.settings();
  assert.equal(node('serviceBase').value,relay.baseUrl);assert.equal(node('serviceModel').value,relay.model);assert.equal(node('serviceKey').required,false);
  node('servicePreset').value='zhipu';node('servicePreset').onchange();assert.equal(node('serviceBase').value,zhipu.baseUrl);assert.equal(node('serviceModel').value,'glm-image');assert.equal(node('serviceKey').required,false);
  node('servicePreset').value='compatible';node('servicePreset').onchange();assert.equal(node('serviceKey').required,true);
  node('servicePreset').value='sub2api';node('servicePreset').onchange();assert.equal(node('serviceModel').value,relay.model);assert.equal(node('serviceKey').value,'');assert.equal(node('serviceKey').required,false);
});
