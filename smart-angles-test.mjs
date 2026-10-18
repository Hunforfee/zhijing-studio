import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer,validateInput} from './server.mjs';
import {createRecommendationPlan} from './shooting-recommendation.mjs';
import {shootingPairs} from './shooting-plan.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const input={product:'set',fabric:'cotton',scenes:['natural'],angles:['front'],size:'所选工艺',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:'data:image/png;base64,'+png.toString('base64'),smartAngles:true,setCounts:{main:10,duvet:0,sheet:0,pillow:0,detail:0}};
test('smart angles with ten requested full views, use selected scenes and preserve random child/product constraints',()=>{
  for(const product of ['set','mat','quilt','sheet','mattress','blanket','sleepbag']){
    const v=validateInput({...input,product,fabric:product==='mat'?'ice':product==='blanket'?'velvet':'cotton'});
    assert.equal(v.recommendCount,10);assert.equal(v.recommendAngle,true);assert.equal(v.recommendScene,false);
    assert.ok(shootingPairs(v).every(p=>p.scene==='natural'));
    const plan=createRecommendationPlan(v);assert.equal(plan.length,10);assert.ok(plan.every(p=>p.shotKind==='main'&&p.camera[1].includes(product+' product')));
    assert.equal(new Set(plan.map(p=>p.camera[0])).size,10);assert.ok(plan.filter(p=>p.mainFraming==='lifestyle').length>=3);
    for(const family of ['catalog','context','lifestyle'])assert.ok(plan.filter(p=>p.mainFraming===family).length>=2);
    assert.ok(plan.some(p=>p.camera[1].includes('headboard may')||p.camera[1].includes('headboard outside')));
    assert.ok(plan.some(p=>p.fullProductOverview&&p.camera[1].includes('40-50%')));assert.notDeepEqual(plan,createRecommendationPlan(v));
  }
  const v=validateInput({...input,scenes:['childbed'],setCounts:{main:3,pillow:2,duvet:1,sheet:1,detail:0},recommendScene:true});
  assert.equal(v.recommendCount,7);assert.equal(v.childBed,true);assert.equal(v.recommendScene,false);
  assert.deepEqual(createRecommendationPlan(v).map(s=>s.shotKind),['main','main','main','duvet','sheet','pillow','pillow']);
  for(const patch of [{smartAngles:'yes'},{setCounts:{main:0,pillow:0,duvet:0,sheet:0,detail:0}},{setCounts:{main:101}},{setCounts:{main:1.5}}])assert.throws(()=>validateInput({...input,...patch}));
});
for(const provider of ['sub2api','zhipu'])test(provider+' smart-angle job sends customized categories and preserves selected scene',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-smart-test-')),prompts=[],imageNames=[];
  const service={provider,apiKey:'test-local',baseUrl:provider==='zhipu'?'https://open.bigmodel.cn/api/paas/v4':'https://relay.example/v1',model:provider==='zhipu'?'glm-image':'gpt-image-2'};
  const server=createServer({outputDir:dir,service,firstImageReview:false,stylingReferencePaths:[],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'{"fabricA":"small floral print","sourceTexture":"cotton"}'}}]});
    if(provider==='sub2api')imageNames.push(init.body.getAll('image[]').map(f=>f.name));
    prompts.push(provider==='sub2api'?init.body.get('prompt'):JSON.parse(init.body).prompt);
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({...input,setCounts:{main:2,pillow:1,duvet:0,sheet:0,detail:1}})});
    const created=await response.json();assert.equal(response.status,202,JSON.stringify(created));
    let job;for(let i=0;i<200;i++){job=await(await fetch(base+'/api/jobs/'+created.id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'done',job.error);assert.equal(job.results.length,4);assert.ok(job.results.every(r=>r.smartAngles&&r.scene==='natural'&&!r.recommendScene&&!r.generateSet));
    assert.deepEqual(job.results.map(r=>r.shotKind),['main','main','pillow','detail']);assert.ok(prompts.every(p=>p.includes('推荐随机拍摄')));assert.ok(prompts.every(p=>!p.includes('AI RECOMMENDED SETTING')));
    assert.ok(imageNames.every(names=>!names.includes('first-product-photo.png')));assert.ok(prompts.slice(0,2).every(p=>p.includes('GEOMETRY CONTRACT')));
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});

test('smart plans up to one hundred preserve counts, randomized pool refills and category order',()=>{
 const v=validateInput({...input,setCounts:{main:80,duvet:6,sheet:5,pillow:5,detail:4}});
 const plan=createRecommendationPlan(v);assert.equal(v.recommendCount,100);assert.equal(plan.length,100);assert.ok(plan.every(s=>s.scene&&s.camera));assert.equal(plan[79].shotKind,'main');assert.equal(plan[80].shotKind,'duvet');assert.equal(plan[99].shotKind,'detail');
 assert.throws(()=>validateInput({...input,setCounts:{main:100,pillow:1}}));
});

test('random smart batches cover both sides, front, overhead, head and low viewpoints across seeds',()=>{
 for(let seed=1;seed<=80;seed++){let n=seed;const rng=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);const plan=createRecommendationPlan(validateInput(input),rng);for(const axis of ['left','right','front','overhead','head','low'])assert.ok(plan.some(s=>s.cameraAxis===axis),axis+' seed '+seed);assert.equal(new Set(plan.map(s=>s.camera[0])).size,10);}
});

test('smart main props are visible in eighty percent, scene-coordinated and stable on retry',async()=>{
 const {propsForScene}=await import('./recommendation-styling.mjs');
 const {buildPrompt}=await import('./server.mjs');const {buildZhipuPrompt}=await import('./zhipu-prompts.mjs');
 const v=validateInput({...input,scenes:['hotel','studio'],setCounts:{main:10,duvet:1,sheet:0,pillow:0,detail:0}}),plan=createRecommendationPlan(v);
 assert.equal(plan.length,22);assert.equal(plan.filter(s=>s.styling.propsVisible).length,16);assert.equal(plan[10].styling.propsVisible,false);assert.equal(plan[21].styling.propsVisible,false);
 for(let i=0;i<plan.length;i++)assert.ok(propsForScene(v.scenes[Math.floor(i/11)]).includes(plan[i].styling.props));
 for(const build of [x=>buildPrompt(x,'hotel','front'),x=>buildZhipuPrompt(x,'hotel','front','{"fabricA":"blue flowers"}')]){
  const i=plan.findIndex(s=>s.styling.propsVisible),p=build({...v,recommendationPlan:plan,recommendIndex:i});
  assert.match(p,/本图必须在构图内清晰可见1至3件/);assert.match(p,/繁密花型配素净道具/);assert.equal(p,build({...v,recommendationPlan:plan,recommendIndex:i}));
 }
});
