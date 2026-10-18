import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer,validateInput,buildPrompt} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {pillowcoreVariants,pillowcoreGuard} from './dist/pillowcore-contract.js';
import {cameraAngleIds,cameraAtlasFor,singleProductAngleName} from './dist/camera-contract.js';
import {createRecommendationPlan,recommendationSections} from './shooting-recommendation.mjs';
import {detailCatalog,detailCategoryFromImage} from './dist/detail-page-policy.js';
import {sizeParts} from './dist/detail-size-policy.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'pillowcore',pillowcoreVariant:'fiber',fabric:'cotton',fabricMode:'auto',size:'仅1只枕芯',scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,scenes:['warm'],angles:['side'],image,autoReview:false};
test('nine pillow inserts preserve their core and A/B rules across providers, references and 12 camera views',()=>{
 let checked=0;for(const variant of pillowcoreVariants)for(const hasB of [false,true])for(const reference of [false,true])for(const angle of cameraAngleIds){
  const v=validateInput({...base,pillowcoreVariant:variant.id,imageB:hasB?image:null,angles:[angle],...(reference?{referenceImage:image,referenceScene:true,referenceAngle:true}:{})});
  const p=buildPrompt(v,'warm',angle,false,0,false,false),z=buildZhipuPrompt(v,'warm',angle,JSON.stringify({fabricA:'green botanical',fabricB:'blue checks',sourceTexture:'fine cloth'}));
  assert.ok(p.includes(variant.en),variant.id);assert.ok(p.includes(pillowcoreGuard(v)));assert.ok(z.includes(variant.zh));assert.ok(z.length<3500);assert.match(p,hasB?/shell FRONT uses original A, actual BACK uses original B/:/ALL pillow-insert shell faces/);assert.ok(!p.includes('REQUIRED MATCHING PILLOW PAIR'));
  assert.ok(cameraAtlasFor(v).file.includes(variant.id));assert.notEqual(singleProductAngleName('pillowcore',angle,'',v),'');checked++;
 }assert.equal(checked,432);assert.throws(()=>validateInput({...base,pillowcoreVariant:'invalid'}),/枕芯/);
});
test('smart pillow plans retain random camera diversity, retry stability and one-pillow construction',()=>{
 const v=validateInput({...base,smartAngles:true,setCounts:{main:15,pillow:2,duvet:0,sheet:0,detail:0}});const plan=createRecommendationPlan(v);assert.equal(plan.length,17);assert.ok(new Set(plan.map(x=>x.camera[1])).size>=6);
 for(let i=0;i<17;i++){const shot={...v,recommendationPlan:plan,recommendIndex:i};const p=buildPrompt(shot,'warm','front',false,0);assert.ok(p.includes('Exactly ONE finished PILLOW INSERT'));assert.equal(buildPrompt(shot,'warm','front',false,0),p);assert.ok(recommendationSections(shot).promptSections.camera);}
});
for(const provider of ['sub2api','zhipu'])test(provider+' sends selected pillow variant and archives metadata; admin previews all nine',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'zhijing-pillow-test-'));let calls=0;
 const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider,apiKey:'synthetic-test',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{
  if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'green',fabricB:'blue',sourceTexture:'cloth'})}}]});
  const prompt=provider==='zhipu'?JSON.parse(init.body).prompt:init.body.get('prompt');assert.match(prompt,provider==='zhipu'?/记忆棉一体高低波浪枕/:/MEMORY-FOAM molded contour/);calls++;return Response.json({data:[{b64_json:image.split(',')[1]}]});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const catalog=await(await fetch(url+'/api/admin/catalog')).json();assert.equal(catalog.variants.pillowcore.length,9);
  for(const variant of pillowcoreVariants){const r=await fetch(url+'/api/admin/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'pillowcore',variant:variant.id,angle:'pillowclose',hasB:true})});assert.equal(r.status,200,await r.clone().text());const p=await r.json();assert.equal(p.settings.variantLabel,variant.name);assert.match(p.prompts.normal||JSON.stringify(p.prompts),new RegExp(variant.en.slice(0,10).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
  const r=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,pillowcoreVariant:'memory'})});assert.equal(r.status,202,await r.clone().text());const {id}=await r.json();let job;
  for(let i=0;i<200;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running'&&job.status!=='queued')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(job.status,'done',job.error);assert.equal(calls,1);assert.equal(job.results[0].pillowcoreVariant,'memory');
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('more-products menu exposes all original sheet variants and no top-level sheet card',async()=>{const app=await readFile('dist/app.js','utf8'),more=await readFile('dist/sleepbag-variants.js','utf8');assert.match(app,/products.filter\(p=>p.id!=='sheet'\)/);assert.match(more,/for\(const item of sheetProductVariants\)/);assert.match(more,/state.product='sheet';.*state.lastMoreProduct='sheet'/);assert.match(more,/selectSheetProductVariant\(item.id\)/);assert.match(more,/state.setCounts=\{\.\.\.state.moreEntryCounts\}/);});
test('detail recognition keeps a generic unknown-fill pillow and all confirmed variants with unselected size presets',()=>{assert.ok(detailCatalog.some(x=>x.id==='pillowcore'));assert.equal(detailCategoryFromImage({product:'pillowcore'}),'pillowcore');for(const v of pillowcoreVariants)assert.equal(detailCategoryFromImage({product:'pillowcore',pillowcoreVariant:v.id}),'pillowcore:'+v.id);assert.equal(sizeParts('pillowcore:memory')[0].name,'枕芯');assert.deepEqual(sizeParts('pillowcore')[0].presets,[[48,74],[40,60],[30,50]]);});
