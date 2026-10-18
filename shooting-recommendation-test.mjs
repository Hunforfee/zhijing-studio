import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {shootingPairs} from './shooting-plan.mjs';
import {recommendationSections,recommendationShot,createRecommendationPlan} from './shooting-recommendation.mjs';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {applyRecommendationStyling} from './recommendation-styling.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const input={product:'set',fabric:'cotton',scenes:['hotel','studio'],angles:['side','detail'],size:'常规四件套',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:'data:image/png;base64,'+png.toString('base64'),recommendScene:true,recommendCount:3};
test('recommendation count is exact and untouched dimensions cycle through user selections',()=>{
  assert.deepEqual(shootingPairs(input),[{scene:'warm',angle:'side'},{scene:'warm',angle:'detail'},{scene:'warm',angle:'side'}]);
  assert.deepEqual(shootingPairs({...input,recommendScene:false,recommendAngle:true}),[{scene:'hotel',angle:'front'},{scene:'studio',angle:'front'},{scene:'hotel',angle:'front'}]);
  assert.equal(shootingPairs({...input,recommendScene:false,recommendAngle:false}).length,4);
  const v=validateInput(input);assert.equal(v.recommendCount,3);
  for(const count of [0,21,1.5,'3'])assert.throws(()=>validateInput({...input,recommendCount:count}),/数量/);
  assert.throws(()=>validateInput({...input,recommendScene:'true'}),/推荐/);
  assert.throws(()=>validateInput({...input,referenceImage:input.image}),/择一/);
});
test('AI recommendation prompts preserve manual dimensions and assign distinct shots',()=>{
  const v=validateInput(input),s=recommendationSections({...v,promptSections:{camera:'MANUAL CAMERA'}});
  assert.equal(s.promptSections.camera,'MANUAL CAMERA');
  assert.match(buildPrompt(v,'warm','side'),/AI RECOMMENDED SETTING/);
  const a=recommendationSections({...v,recommendScene:false,recommendAngle:true,recommendIndex:1,promptSections:{scene:'MANUAL ROOM'}});
  assert.equal(a.promptSections.scene,'MANUAL ROOM');assert.match(a.promptSections.camera,/photograph 2 of 3/);
  assert.match(buildPrompt({...v,recommendAngle:true},'warm','front'),/AI RECOMMENDED CAMERA/);
});
function seededRandom(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('creative display varies count, placement, props and reverse while keeping retry choices stable',()=>{
  const plan=createRecommendationPlan({...input,recommendCount:20,imageB:'supplied'},seededRandom(42));
  assert.deepEqual([...new Set(plan.map(s=>s.styling.pillowCount))].sort(),[2,3,4]);
  assert.equal(new Set(plan.slice(0,8).map(s=>s.styling.layout)).size,8);
  assert.equal(new Set(plan.slice(0,8).map(s=>s.styling.props)).size,8);
  assert.deepEqual(new Set(plan.map(s=>s.styling.reverse)),new Set([true,false]));
  assert.ok(createRecommendationPlan({...input,recommendCount:20},seededRandom(42)).every(s=>!s.styling.reverse));
});
test('creative provider prompts remove old display limits, preserve crafts and keep manual generation unchanged',()=>{
  for(const flags of [{recommendScene:true},{recommendAngle:true}]){
    const v=recommendationSections({...input,recommendScene:false,...flags,imageB:'supplied',size:'被套简约细缝边；普通平床单：自然垂落；两只枕套简约细缝边'});
    v.recommendStyling={pillowCount:4,layout:'床头侧靠与床尾单只呼应',reverse:true,props:'小陶瓶与一枝花',light:'柔和侧窗光'};
    v.recommendationPlan[0].styling=v.recommendStyling;
    const prompts=[buildPrompt(v,'warm','front',true,0,false,true),buildZhipuPrompt(v,'warm','front',JSON.stringify({fabricA:'flowers',fabricB:'leaves'}))];
    for(const p of prompts){
      assert.match(p,/本图陈列4只/);assert.match(p,/床尾单只/);assert.match(p,/反面朝镜头/);assert.match(p,/小陶瓶与一枝花/);
      assert.match(p,/道具1至3件/);assert.match(p,/避免整齐床头排队/);assert.match(p,/正面严格使用A、反面严格使用B/);assert.match(p,/独立薄型平床单/);assert.match(p,/细窄平顺接缝/);
      assert.doesNotMatch(p,/exactly (?:two|TWO)|两只(?:睡眠)?枕套|two head pillows|Pillow pair stays at the head|Keep exactly two|额外抱枕|Preserve product craft and count/);
    }
    assert.ok(Array.from(prompts[1]).length<=3500);
    assert.equal(applyRecommendationStyling(prompts[0],v),prompts[0]);
  }
  const manual=buildPrompt({...input,recommendScene:false,recommendAngle:false},'warm','front');
  assert.match(manual,/最多4只/);assert.doesNotMatch(manual,/系统推荐创意陈列/);
  const wide={...input,recommendAngle:true,recommendCount:20,imageB:'supplied',size:'三组同时满足：被套外缘4至6厘米无填充宽边；普通平床单：自然垂落；两只枕套外缘4至6厘米无填充宽边'};
  const recommendationPlan=createRecommendationPlan(wide,seededRandom(42));
  for(let recommendIndex=0;recommendIndex<20;recommendIndex++){
    const p=buildZhipuPrompt({...wide,recommendationPlan,recommendIndex},'warm','front',JSON.stringify({fabricA:'flowers',fabricB:'leaves'}));
    assert.ok(Array.from(p).length<=3500);assert.match(p,/系统推荐创意陈列/);assert.match(p,/宽边/);
  }
});
test('random plans vary across requests, balance camera families and preserve retry assignments',()=>{
  const starts=new Set(),singleScenes=new Set(),singleAngles=new Set();
  for(let seed=1;seed<=100;seed++){
    const plan=createRecommendationPlan({recommendCount:20},seededRandom(seed));
    assert.equal(new Set(plan.map(s=>s.scene[0])).size,20);
    assert.equal(new Set(plan.map(s=>s.camera[0])).size,20);
    assert.equal(new Set(plan.slice(0,6).map(s=>s.cameraFamily)).size,6);
    starts.add(plan.slice(0,6).map(s=>s.camera[0]).join(','));
    const single=createRecommendationPlan({recommendCount:1},seededRandom(seed));
    assert.equal(single.length,1);singleScenes.add(single[0].scene[0]);singleAngles.add(single[0].camera[0]);
    for(let recommendIndex=0;recommendIndex<20;recommendIndex++){
      const v={...input,recommendAngle:true,recommendCount:20,recommendIndex,recommendationPlan:plan};
      const first=recommendationSections(v),retry=recommendationSections(first);
      assert.deepEqual(retry.promptSections,first.promptSections);
      assert.equal(recommendationShot(first),plan[recommendIndex]);
    }
  }
  assert.ok(starts.size>90);assert.ok(singleScenes.size>10);assert.ok(singleAngles.size>10);
});
test('all twenty recommendations assign distinct settings and camera briefs without overriding manual dimensions',()=>{
  const recommendationPlan=createRecommendationPlan({recommendCount:20},seededRandom(42));
  const shots=Array.from({length:20},(_,recommendIndex)=>recommendationShot({recommendIndex,recommendationPlan}));
  assert.equal(new Set(shots.map(s=>s.scene[1])).size,20);
  assert.equal(new Set(shots.map(s=>s.camera[1])).size,20);
  assert.match(shots.find(s=>s.camera[0]==='垂直俯视').camera[1],/90 degrees/);
  assert.match(shots.find(s=>s.camera[0]==='面料特写').camera[1],/NO entire bed/);
  for(let recommendIndex=0;recommendIndex<20;recommendIndex++){
    const sceneOnly=recommendationSections({...input,recommendIndex,recommendationPlan,promptSections:{camera:'KEEP USER CAMERA'}});
    assert.equal(sceneOnly.promptSections.camera,'KEEP USER CAMERA');
    const angleOnly=recommendationSections({...input,recommendScene:false,recommendAngle:true,recommendIndex,recommendationPlan,promptSections:{scene:'KEEP USER ROOM'}});
    assert.equal(angleOnly.promptSections.scene,'KEEP USER ROOM');
    assert.match(sceneOnly.promptSections.scene,/merely changing a cushion, lamp or exposure is insufficient/);
    assert.match(angleOnly.promptSections.camera,/micro-crops, mirroring and tiny pose shifts are insufficient/);
  }
});
test('camera guides are omitted for AI angles, frontend state restores and input rejects invalid counts',async()=>{
  const camera=await readFile('dist/camera-input.js','utf8');
  const context=vm.createContext({});vm.runInContext(camera,context);
  assert.equal(await context.prepareCameraReferences({recommendAngle:true}),undefined);
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:1,setAttribute(){}});return nodes.get(id);};
  const state={product:'set',scenes:['warm'],referenceUpload:true};const box={classList:{toggle(){}}};
  const ui=vm.createContext({state,$:node,document:{querySelector:()=>box},renderSelections(){ui.syncRecommendationControls();},updateCount(){},toast(){}});
  vm.runInContext(await readFile('dist/shooting-recommendation.js','utf8'),ui);
  assert.equal(box.hidden,true);state.referenceUpload=null;ui.syncRecommendationControls();assert.equal(box.hidden,false);
  node('chooseSmartAngles').onclick();assert.equal(state.recommendCount,10);assert.equal(state.mode,'ai');assert.equal(state.recommendAngle,true);
  state.busy=true;node('chooseCustomAngles').onclick();assert.equal(state.recommendAngle,true);assert.equal(node('chooseSmartAngles').disabled,false);ui.syncRecommendationControls();assert.equal(node('chooseSmartAngles').disabled,true);
});
for(const provider of ['sub2api','zhipu'])test(provider+' generates exact recommended count, preserves metadata and sends recommendation to AI',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-recommend-test-')),prompts=[];
  const service=provider==='sub2api'?{provider,apiKey:'test-local',baseUrl:'https://relay.example/v1',model:'gpt-image-2'}:{provider,apiKey:'test-local',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'};
  const server=createServer({outputDir:dir,service,firstImageReview:false,stylingReferencePaths:[],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'small floral print',fabricB:'',sourceTexture:'cotton'})}}]});
    const prompt=provider==='sub2api'?init.body.get('prompt'):JSON.parse(init.body).prompt;prompts.push(prompt);
    return Response.json({data:[{b64_json:png.toString('base64')} ]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({...input,recommendAngle:true,scenes:['warm'],angles:['front'],recommendationPlan:[{scene:['CLIENT FIXED','CLIENT FIXED'],camera:['CLIENT FIXED','CLIENT FIXED']}]})});
    const created=await response.json();assert.equal(response.status,202,JSON.stringify(created));
    let job;for(let i=0;i<200;i++){job=await(await fetch(base+'/api/jobs/'+created.id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'done',job.error);assert.equal(job.results.length,3);assert.equal(prompts.length,3);
    assert.ok(job.results.every(r=>r.recommendScene&&r.recommendAngle));
    assert.equal(new Set(job.results.map(r=>r.recommendSceneName)).size,3);
    assert.equal(new Set(job.results.map(r=>r.recommendAngleName)).size,3);
    for(let i=0;i<3;i++){assert.match(prompts[i],/AI RECOMMENDED SETTING/);assert.match(prompts[i],/AI RECOMMENDED CAMERA/);assert.match(prompts[i],new RegExp('photograph '+(i+1)+' of 3'));assert.doesNotMatch(prompts[i],/Camera: \[front:|拍摄角度 \[front\]/);}
    assert.ok(prompts.every(p=>!p.includes('CLIENT FIXED')));
    assert.ok(prompts.every(p=>p.includes('系统推荐创意陈列')));
    for(let i=0;i<3;i++)assert.ok(prompts[i].includes(job.results[i].recommendAngleName));
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
