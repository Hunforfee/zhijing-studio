import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrompt,validateInput,createServer} from './server.mjs';
import {buildZhipuPrompt,zhipuImageRequest} from './zhipu-prompts.mjs';
import {otherProductStructures,otherProductRule,otherProductPlacement} from './other-product-prompts.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
import {createRecommendationPlan} from './shooting-recommendation.mjs';
import {reviewFirstImage} from './first-image-review.mjs';
import {blanketProductPrompt,blanketSurface} from './dist/blanket-contract.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const summary=JSON.stringify({fabricA:'A蓝底花卉',fabricB:'B米白圆点',sourceTexture:'真实短绒或织纹',productDetails:'用户可见缝线',referenceAngle:'侧视中景',referenceScene:'浅木卧室'});
const variants=Object.keys(otherProductStructures).filter(k=>!k.startsWith('pillow:'));
function input(key,hasB=true,reference=false){const [product,variant]=key.split(':');return validateInput({product,fabric:product==='mat'?variant:'cotton',fabricMode:'auto',size:'按所选款式常规比例',scenes:['warm'],angles:['front'],scale:100,direction:0,repeat:'tile',ratio:'1:1',plainSheet:false,notes:'',image,imageB:hasB?image:null,referenceImage:reference?image:null,referenceScene:reference,referenceAngle:reference,...(product==='quilt'?{quiltSeason:variant}:product==='sheet'?{sheetVariant:variant}:product==='mattress'?{mattressVariant:variant}:product==='blanket'?{blanketVariant:variant}:product==='sleepbag'?{sleepbagVariant:variant}:{})});}
test('all 16 active variants preserve selected topology and actual A/B allocation in normal/reference/compact prompts',()=>{
 let combinations=0;
 for(const key of variants)for(const hasB of [false,true])for(const reference of [false,true])for(const angle of ['front','detail','reverse','pillowclose']){
  const v=input(key,hasB,reference),full=buildPrompt(v,'warm',angle,false,0,false,false),compact=buildZhipuPrompt(v,'warm',angle,summary);
  for(const prompt of [full,compact]){assert.ok(prompt.includes(otherProductRule(v,true).split('【布面归属】')[0]),key);assert.ok(prompt.includes(otherProductPlacement(v)),key);assert.doesNotMatch(prompt,/床单B；枕套正面A/);}
  zhipuImageRequest({model:'glm-image'},v,compact);combinations++;
 }
 assert.equal(combinations,256);
});
test('smart plans and admin full replacements cannot erase the selected product contract',()=>{
 for(const key of variants){const v={...input(key),recommendAngle:true,recommendScene:false,recommendCount:3,recommendCategories:{main:3}};const plan=createRecommendationPlan(v,()=>0.4);assert.ok(plan.length>0);
  for(const prompt of [enforceBeddingFidelity('用户自定义完整提示词',v),enforceBeddingFidelity('用户自定义完整提示词',v,{compact:true,final:true})])assert.ok(prompt.includes(otherProductPlacement(v)),key);
 }
 const set={product:'set',size:'普通平床单：自然外垂'};assert.equal(otherProductRule(set),'');assert.doesNotMatch(enforceBeddingFidelity('set',set),/单品分层规则/);
 assert.doesNotMatch(enforceBeddingFidelity('调整颜色',input('blanket:gauze'),{edit:true}),/单品分层规则/);
});
test('review receives the same product allocation instead of four-piece defaults',async()=>{
 for(const key of variants){const v=input(key);let actual;
  await reviewFirstImage({bytes:v.imageBytes,v,angle:'front',config:{apiKey:'fake',baseUrl:'https://example.test',visionModel:'fake'},fetchImpl:async(url,init)=>{actual=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify({checks:Object.fromEntries(['panelAssignment','seamBoundary','componentStructure'].map(k=>[k,{status:'pass',evidence:'fixture visible cloth'}]))})}}]});}});
  assert.ok(actual.messages[1].content[0].text.includes(otherProductPlacement(v)),key);
 }
});
test('milk fleece does not invent jacquard checks and gauze remains pile-free',()=>{
 assert.doesNotMatch(blanketSurface({blanketVariant:'milk'}).surface,/raised jacquard check relief woven/);
 assert.match(blanketProductPrompt({blanketVariant:'milk'}),/never invent a check motif/);
 assert.match(blanketProductPrompt({blanketVariant:'gauze'}),/keep gauze woven without pile/);
});
for(const provider of ['sub2api','zhipu'])test(provider+' final provider payloads use all 16 selected variants and original references',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'zhijing-product-rules-')),requests=[],png=Buffer.from(image.split(',')[1],'base64');
 const server=createServer({outputDir:dir,stylingReferencePaths:[],firstImageReview:false,service:{provider,apiKey:'fake',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'fixture',visionModel:'fixture'},fetchImpl:async(url,init)=>{
  if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:summary}}]});
  requests.push(provider==='zhipu'?JSON.parse(init.body):init.body);return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 try{for(const key of variants){const v=input(key),body={...v,image,imageB:image,autoReview:false};const response=await fetch(root+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const created=await response.json();assert.equal(response.status,202,JSON.stringify(created));let job;
  for(let n=0;n<300;n++){job=await(await fetch(root+'/api/jobs/'+created.id)).json();if(['done','error','cancelled'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(job.status,'done',job.error);const request=requests.at(-1),prompt=provider==='zhipu'?request.prompt:request.get('prompt');assert.ok(prompt.includes(otherProductPlacement(v)),key);assert.ok(prompt.includes('单品分层规则'),key);if(provider==='zhipu')assert.ok(Array.from(prompt).length<=3500);else assert.ok(!request.getAll('image[]').some(i=>/first-product|repair/.test(i.name)));
 }assert.equal(requests.length,16);}finally{await new Promise(r=>server.close(r));assert.ok(dir.startsWith(path.join(tmpdir(),'zhijing-product-rules-')));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
