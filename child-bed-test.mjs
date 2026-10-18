import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {createRecommendationPlan,recommendationSections} from './shooting-recommendation.mjs';
import {childSettings,childProps,applyChildBedDisplay,createChildScenePlan} from './child-bed.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const input={product:'set',fabric:'cotton',scenes:['childbed'],angles:['side'],size:'成人双人床 1.8m，所选工艺',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:'data:image/png;base64,'+png.toString('base64')};

test('manual child scenes stay identical within a group and may vary between groups',()=>{
  const a=createChildScenePlan(43,()=>0),b=createChildScenePlan(43,()=>0.99);
  assert.equal(a.length,43);assert.equal(new Set(a.map(s=>s[0])).size,1);assert.equal(new Set(b.map(s=>s[0])).size,1);assert.notDeepEqual(a,b);
  const p=applyChildBedDisplay('two pillows, 不塞床底', {...input,childScenePlan:a,recommendIndex:1});
  assert.ok(p.includes(a[1][0]));assert.doesNotMatch(p,/two pillows|不塞床底/);
});

test('child-bed intent covers every product, manual angles, both builders and adult recommendation placeholders',()=>{
  for(const product of ['set','mat','quilt','sheet','mattress','blanket','sleepbag']){
    const v=validateInput({...input,product,fabric:product==='mat'?'ice':product==='blanket'?'velvet':'cotton'});
    assert.equal(v.childBed,true);
    for(const p of [buildPrompt(v,'childbed','side'),buildZhipuPrompt(v,'childbed','side','floral fabric')]){
      assert.match(p,/【儿童床展示】/);assert.match(p,/80–100cm/);assert.match(p,/只陈列一只睡枕/);assert.match(p,/同组所有图片保持同一个房间/);assert.match(p,/床单四边及床尾全部压入床垫下方/);if(product==='set')assert.match(p,/规格固定150×200cm/);assert.match(p,/原A\/B花色/);
    }
  }
  assert.equal(validateInput({...input,childBed:false}).childBed,true);
  assert.equal(validateInput({...input,scenes:['warm'],childBed:true,recommendScene:true,recommendCount:1}).childBed,true);
  assert.throws(()=>validateInput({...input,childBed:'yes'}),/儿童床/);
  const adult=validateInput({...input,scenes:['warm']});assert.doesNotMatch(buildPrompt(adult,'warm','side'),/【儿童床展示】/);
  const rule=applyChildBedDisplay('full-sized wooden bed',input);assert.equal(applyChildBedDisplay(rule,input),rule);
});

test('random child recommendations stay within child rooms and props, including coordinated suites',()=>{
  const v=validateInput({...input,scenes:['warm'],childBed:true,recommendScene:true,recommendAngle:true,recommendCount:20});
  const plan=createRecommendationPlan(v);
  assert.equal(new Set(plan.map(s=>s.scene[0])).size,1);assert.equal(new Set(plan.map(s=>s.camera[0])).size,20);
  assert.ok(plan.every(s=>childSettings.some(c=>c[0]===s.scene[0])&&childProps.includes(s.styling.props)&&s.camera[1].includes('CHILD BED')));
  assert.notDeepEqual(plan,createRecommendationPlan(v));assert.ok(plan.every(x=>x.styling.pillowCount===1));
  const suite=createRecommendationPlan({...v,generateSet:true});
  assert.equal(suite.length,15);assert.equal(new Set(suite.map(s=>s.scene[0])).size,1);assert.ok(suite.every(s=>s.childBed&&childProps.includes(s.styling.props)));
  for(let i=0;i<20;i++){const shot=recommendationSections({...v,recommendationPlan:plan,recommendIndex:i});assert.match(buildZhipuPrompt(shot,'warm','front','floral fabric'),/【儿童床展示】/);}
});

test('child mode skips adult-size camera photos and angle controls use an inline menu',async()=>{
  const ui=vm.createContext({});vm.runInContext(await readFile('dist/camera-input.js','utf8'),ui);
  assert.equal(await ui.prepareCameraReferences({childBed:true,product:'blanket'}),undefined);
  const html=await readFile('dist/index.html','utf8');
  const main=html.slice(html.indexOf('id="shootingChoices"'),html.indexOf('class="shooting-reference-upload"'));
  assert.match(main,/id="angles"/);assert.match(main,/id="openAnglePicker"/);
  assert.match(html,/<section hidden id="anglePickerDialog"[\s\S]*?id="angles"[\s\S]*?<\/section>/);
});

for(const provider of ['sub2api','zhipu'])test(provider+' final provider payload and history retain child bed after scene recommendation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-child-test-')),prompts=[];
  const service={provider,apiKey:'test-local',baseUrl:provider==='zhipu'?'https://open.bigmodel.cn/api/paas/v4':'https://relay.example/v1',model:provider==='zhipu'?'glm-image':'gpt-image-2'};
  const server=createServer({outputDir:dir,service,firstImageReview:false,stylingReferencePaths:[],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'small floral print',sourceTexture:'cotton'})}}]});
    prompts.push(provider==='sub2api'?init.body.get('prompt'):JSON.parse(init.body).prompt);
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({...input,scenes:['warm'],angles:['front'],childBed:true,recommendScene:true,recommendAngle:true,recommendCount:3})});
    const created=await response.json();assert.equal(response.status,202,JSON.stringify(created));
    let job;for(let i=0;i<200;i++){job=await(await fetch(base+'/api/jobs/'+created.id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'done',job.error);assert.equal(prompts.length,3);assert.ok(job.results.every(r=>r.childBed));
    assert.equal(new Set(job.results.map(r=>r.recommendSceneName)).size,1);
    for(const p of prompts){assert.match(p,/【儿童床展示】/);assert.match(p,/CHILD BED/);assert.match(p,/规格固定150×200cm/);assert.match(p,/只陈列一只睡枕/);assert.match(p,/同组所有图片保持同一个房间/);assert.match(p,/床单四边及床尾全部压入床垫下方/);assert.doesNotMatch(p,/本图(?:陈列)?[2-4]只|不塞床底|床腿外侧自然下垂/);assert.doesNotMatch(p,/道具：[^；]*(?:香薰|陶杯|果实)/);}
    prompts.length=0;
    const manualResponse=await fetch(base+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({...input,angles:['front','side','top']})});
    const manualCreated=await manualResponse.json();assert.equal(manualResponse.status,202,JSON.stringify(manualCreated));
    for(let i=0;i<200;i++){job=await(await fetch(base+'/api/jobs/'+manualCreated.id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'done',job.error);assert.equal(prompts.length,3);assert.equal(new Set(job.results.map(r=>r.childSceneName)).size,1);
    for(let i=0;i<3;i++){assert.equal(job.results[i].displayPillowCount,1);assert.equal(job.results[i].childDuvetSize,'150×200cm');assert.equal(job.results[i].childSheetTucked,true);assert.ok(prompts[i].includes(job.results[i].childSceneName));assert.match(prompts[i],/床单四边及床尾全部压入床垫下方/);}
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
