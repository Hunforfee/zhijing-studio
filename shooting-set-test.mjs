import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createServer,validateInput} from './server.mjs';
import {createRecommendationPlan,recommendationSections} from './shooting-recommendation.mjs';
import {applyRecommendationVariation} from './recommendation-policy.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
import {shootingPairs} from './shooting-plan.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const input={product:'set',fabric:'cotton',scenes:['warm'],angles:['front'],size:'常规四件套',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:'data:image/png;base64,'+png.toString('base64'),generateSet:true};
test('suite defaults and custom counts produce exact categories and full-view cameras',()=>{
  const v=validateInput(input),plan=createRecommendationPlan(v);
  assert.equal(v.recommendCount,15);assert.equal(v.recommendAngle,true);assert.equal(shootingPairs(v).length,15);
  assert.deepEqual(plan.reduce((out,s)=>(out[s.shotKind]=(out[s.shotKind]||0)+1,out),{}),{main:10,pillow:2,duvet:1,sheet:1,detail:1});
  assert.ok(plan.slice(0,10).every(s=>s.camera[1].includes('FULL BEDDING VIEW')));
  assert.equal(new Set(plan.slice(0,10).map(s=>s.camera[0])).size,10);
  assert.ok(plan.slice(10).every(s=>s.camera[1].includes('COMPONENT DETAIL')));
  assert.equal(new Set(plan.map(s=>s.scene[0])).size,15);assert.ok(plan.every(s=>s.styling!==plan[0].styling||s===plan[0]));
  const custom=validateInput({...input,setCounts:{main:3,pillow:0,duvet:2,sheet:1,detail:0},recommendCount:19});
  assert.equal(custom.recommendCount,6);assert.deepEqual(createRecommendationPlan(custom).map(s=>s.shotKind),['main','main','main','duvet','duvet','sheet']);
  for(const patch of [{generateSet:'true'},{product:'blanket'},{setCounts:{main:-1}},{setCounts:{main:1.5}},{setCounts:{main:20}},{setCounts:{main:0,pillow:0,duvet:0,sheet:0,detail:0}},{referenceImage:input.image}])assert.throws(()=>validateInput({...input,...patch}));
});
test('suite randomizes fresh requests, detailed geometry and styling while retries preserve their assigned shot',()=>{
  const seeded=seed=>()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const v=validateInput({...input,recommendScene:true,imageB:input.image});
  const first=createRecommendationPlan(v,seeded(17)),second=createRecommendationPlan(v,seeded(42));
  assert.notDeepEqual(first,second);assert.equal(new Set(first.map(s=>s.scene[0])).size,15);
  assert.ok(new Set(first.map(s=>s.styling.pillowCount)).size>1);
  assert.ok(new Set(first.map(s=>s.styling.layout)).size>1);assert.ok(new Set(first.map(s=>s.styling.props)).size>1);
  assert.ok(new Set(first.map(s=>s.styling.light)).size>1);assert.ok(first.some(s=>s.styling.reverse));
  const details=createRecommendationPlan(validateInput({...input,setCounts:{main:0,pillow:20,duvet:0,sheet:0,detail:0}}),seeded(29));
  assert.equal(new Set(details.map(s=>s.camera[1])).size,20);
  assert.notDeepEqual(details,createRecommendationPlan(validateInput({...input,setCounts:{main:0,pillow:20,duvet:0,sheet:0,detail:0}}),seeded(31)));
  const shot={...v,recommendationPlan:first,recommendIndex:4};
  assert.deepEqual(recommendationSections(shot),recommendationSections(shot));
  const final=enforceBeddingFidelity('FULL CUSTOM TEMPLATE',recommendationSections(shot));
  assert.ok(final.includes(first[4].camera[1]));assert.ok(final.includes(first[4].scene[1]));
  assert.match(final,/推荐随机拍摄/);assert.equal(applyRecommendationVariation(final,shot),final);
  assert.equal(applyRecommendationVariation('MANUAL',{product:'set'}),'MANUAL');
});

test('smart-angle UI starts with ten full views, edits counts and switches to manual dialog',async()=>{
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:1,setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},focus(){}});return nodes.get(id);};
  const state={product:'set',scenes:['warm'],recommendAngle:false},box={classList:{toggle(){}}};let updates=0;
  const cache=new Map();
  const ui=vm.createContext({localStorage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)},state,$:node,document:{querySelector:()=>box},renderSelections(){ui.syncRecommendationControls();updates++;},updateCount(){updates++;},toast(){}});
  vm.runInContext(await readFile('dist/shooting-recommendation.js','utf8'),ui);
  assert.equal(node('shootingSetOptions').hidden,true);
  node('chooseSmartAngles').onclick();assert.equal(state.recommendCount,10);assert.equal(state.recommendAngle,true);assert.equal(state.recommendScene,false);assert.equal(state.generateSet,false);
  assert.equal(node('setCount_main').value,10);assert.equal(node('setCount_pillow').value,0);assert.equal(node('shootingSetOptions').hidden,false);
  node('setCount_pillow').value='2';node('setCount_pillow').onchange();assert.equal(state.recommendCount,12);
  ui.rememberSmartAngleCounts();
  node('setCount_pillow').value='0';node('setCount_pillow').onchange();
  node('applyLastAngleCounts').onclick();assert.equal(state.setCounts.pillow,2);assert.equal(state.recommendCount,12);assert.deepEqual(state.scenes,['warm']);
  node('setCount_main').value='100';node('setCount_main').onchange();assert.equal(node('setCount_main').value,10);
  node('chooseCustomAngles').onclick();assert.equal(state.recommendAngle,false);assert.equal(node('anglePickerDialog').hidden,false);assert.equal(node('shootingSetOptions').hidden,true);
  node('chooseSmartAngles').onclick();assert.equal(state.recommendCount,12);
  state.product='blanket';ui.syncRecommendationControls();assert.equal(node('setCount_pillow').disabled,true);assert.equal(node('setCount_pillow').value,0);assert.equal(state.recommendCount,10);assert.ok(updates>0);
});
for(const provider of ['sub2api','zhipu'])test(provider+' sends exactly 15 suite shots and respects custom category counts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-suite-test-')),prompts=[];
  const service=provider==='sub2api'?{provider,apiKey:'test-local',baseUrl:'https://relay.example/v1',model:'gpt-image-2'}:{provider,apiKey:'test-local',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'};
  const server=createServer({outputDir:dir,service,firstImageReview:false,stylingReferencePaths:[],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'small flowers'})}}]});
    prompts.push(provider==='sub2api'?init.body.get('prompt'):JSON.parse(init.body).prompt);
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const counts of [undefined,{main:2,pillow:1,duvet:1,sheet:1,detail:1}]){
      prompts.length=0;const response=await fetch(base+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({...input,recommendScene:true,setCounts:counts})});
      const created=await response.json();assert.equal(response.status,202,JSON.stringify(created));
      let job;for(let i=0;i<300;i++){job=await(await fetch(base+'/api/jobs/'+created.id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
      assert.equal(job.status,'done',job.error);assert.equal(job.results.length,counts?6:15);assert.equal(prompts.length,job.results.length);
      assert.equal(job.results.filter(r=>r.shotKind==='main').length,counts?2:10);assert.equal(job.results.filter(r=>r.shotKind==='pillow').length,counts?1:2);
      assert.ok(job.results.every(r=>r.generateSet&&r.recommendAngle));assert.equal(new Set(job.results.map(r=>r.recommendSceneName)).size,job.results.length);
      assert.ok(prompts.slice(0,counts?2:10).every(p=>p.includes('FULL BEDDING VIEW')));assert.ok(prompts.slice(counts?2:10).every(p=>p.includes('COMPONENT DETAIL')));
      assert.ok(prompts.every(p=>p.includes('推荐随机拍摄')));assert.ok(prompts.every(p=>!p.includes('retain the room, furniture')&&!p.includes('同组保持场景与陈列风格')));assert.ok(prompts.some(p=>p.includes('Each assigned setting must visibly differ')||p.includes('不同图改变房间与家具布局')));
    }
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
