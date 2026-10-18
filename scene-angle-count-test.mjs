import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createServer,validateInput,buildPrompt} from './server.mjs';
import {createRecommendationPlan} from './shooting-recommendation.mjs';
import {shootingPairs} from './shooting-plan.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const image='data:image/png;base64,'+png.toString('base64');
const input={product:'set',fabric:'cotton',scenes:['natural','hotel','studio'],angles:['front'],size:'所选工艺',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,smartAngles:true,setCounts:{main:10,pillow:2,duvet:0,sheet:0,detail:0}};
test('each scene has a complete category set, independent random geometry and stable retries',()=>{
 const v=validateInput(input),pairs=shootingPairs(v),plan=createRecommendationPlan(v);assert.equal(pairs.length,36);assert.equal(plan.length,36);
 for(let s=0;s<3;s++){assert.ok(pairs.slice(s*12,s*12+12).every(p=>p.scene===input.scenes[s]));const shots=plan.slice(s*12,s*12+12);assert.deepEqual(shots.map(p=>p.shotKind),[...Array(10).fill('main'),'pillow','pillow']);for(const axis of ['left','right','front','overhead','head','low'])assert.ok(shots.some(p=>p.cameraAxis===axis));}
 assert.notDeepEqual(plan.slice(0,12),plan.slice(12,24));
 const last={...v,recommendationPlan:plan,recommendIndex:35};const prompt=buildPrompt(last,'studio','front');assert.match(prompt,/photograph 36 of 36/);assert.equal(prompt,buildPrompt(last,'studio','front'));
 const large=validateInput({...input,setCounts:{main:100,pillow:0,duvet:0,sheet:0,detail:0}});assert.equal(shootingPairs(large).length,300);assert.equal(createRecommendationPlan(large).length,300);
});
test('reference scene is one effective scene; reference angle and manual angles keep scene multiplication',()=>{
 const ref=validateInput({...input,referenceImages:[image],referenceScene:true,referenceAngle:false});assert.equal(shootingPairs(ref).length,12);assert.equal(createRecommendationPlan(ref).length,12);
 const refAngle=validateInput({...input,smartAngles:false,setCounts:undefined,referenceImages:[image],referenceScene:false,referenceAngle:true});assert.equal(shootingPairs(refAngle).length,3);
 const manual=validateInput({...input,smartAngles:false,setCounts:undefined,angles:['front','side']});assert.equal(shootingPairs(manual).length,6);
});
test('front page total and multiplication hint reflect complete angles per scene',async()=>{
 const source=await readFile('dist/app.js','utf8'),nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}}});return nodes.get(id)};
 const context=vm.createContext({$:node,state:{busy:false,ready:true,mode:'ai',textureSource:'library'},options:()=>({...input,recommendAngle:true,recommendCount:12}),refreshLastPatternButton(){},refreshPatternProof(){},document:{querySelectorAll:()=>[]},globalThis:{}});
 vm.runInContext(source.match(/function updateCount\(\)\{[\s\S]*?\n\}/)[0],context);context.updateCount();assert.equal(node('count').textContent,36);assert.equal(node('modeHint').textContent,'3 个场景 × 每场景 12 张');
});
for(const provider of ['sub2api','zhipu'])test(provider+' requests full categories for every scene and saves all results',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-scene-angle-')),prompts=[];
 const server=createServer({outputDir:dir,firstImageReview:false,service:{provider,apiKey:'synthetic-scene-angle-test',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{
 if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'{"fabricA":"small blue flowers"}'}}]});
 prompts.push(provider==='sub2api'?init.body.get('prompt'):JSON.parse(init.body).prompt);return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 try{const response=await fetch(root+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,setCounts:{main:2,pillow:1,duvet:0,sheet:0,detail:0}})});assert.equal(response.status,202);const {id}=await response.json();let job;for(let n=0;n<200;n++){job=await(await fetch(root+'/api/jobs/'+id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}assert.equal(job.status,'done',job.error);assert.equal(prompts.length,9);assert.equal(job.results.length,9);for(let s=0;s<3;s++){const group=job.results.slice(s*3,s*3+3);assert.ok(group.every(r=>r.scene===input.scenes[s]));assert.deepEqual(group.map(r=>r.shotKind),['main','main','pillow']);}assert.match(prompts.at(-1),/photograph 9 of 9/);}finally{await new Promise(r=>server.close(r));assert.ok(dir.startsWith(path.join(os.tmpdir(),'zhijing-scene-angle-')));await rm(dir,{recursive:true,force:true});}
});
