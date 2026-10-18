import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createServer,buildPrompt,validateInput} from './server.mjs';
import {buildZhipuPrompt,zhipuImageRequest} from './zhipu-prompts.mjs';
import {setPromptData,layeredSetDetails,layeredSetStructure,layeredSetSpecification,layeredSetGroupPrompt,pillowThreeEdges} from './set-layered-prompts.mjs';
import {craftReferenceInstruction} from './craft-references.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
import {enforceSetPanelBoundaries} from './set-surface-prompts.mjs';
import {enforceReferenceEdit} from './reference-prompts.mjs';
import {sectionScope,createPromptSectionEdits} from './prompt-section-edits.mjs';
import {createRecommendationPlan,recommendationSections} from './shooting-recommendation.mjs';
import {setCameraDirections} from './dist/camera-contract.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'set',fabric:'cotton',fabricMode:'auto',scenes:['warm'],angles:['side'],size:'',scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image};
const source=await readFile('dist/set-variants.js','utf8'),ctx=vm.createContext({});vm.runInContext(source.split('const variantPanel=')[0],ctx);const variants=vm.runInContext('setVariants',ctx);
const groups=['被套工艺','床单款式','枕套工艺'];
const combinations=variants.filter(v=>v.group===groups[0]).flatMap(a=>variants.filter(v=>v.group===groups[1]).flatMap(b=>variants.filter(v=>v.group===groups[2]).map(c=>({parts:[a,b,c],size:'三组同时满足：'+[a,b,c].map(p=>p.spec).join('；')}))));
const summary=JSON.stringify({fabricA:'green print',fabricB:'ivory flowers',sourceTexture:'matte fine weave',referenceScene:'a room with distinctive red wall',referenceAngle:'front-centered view',productDetails:'closed seams'});
function structure(p){return p.match(/ Product: ([\s\S]*?)\. Size specification: /)?.[1];}
function count(p,s){return p.split(s).length-1;}
test('pillow three-side requests are scoped to pillows, respect negation and later corrections',()=>{
  for(const notes of ['枕套只有三边','枕头也只有3边','枕套只加三条边','枕套不要四边，只做三边','被套三边，枕套也三边','枕套三边、被套四边','枕套和被套都三边'])assert.equal(pillowThreeEdges({notes}),true,notes);
  for(const notes of ['', '被套只有三边','被套三边，枕套四边','枕套不要三边','不要给枕套做三边','枕套不是三边而是四边','枕套三边改为四边','枕套四边、被套三边'])assert.equal(pillowThreeEdges({notes}),false,notes);
});
test('every duvet exterior craft adds outside the unchanged body on three sides, pillow sides adapt independently',()=>{
  for(const craft of variants.filter(v=>v.group==='被套工艺'))for(const pillow of variants.filter(v=>v.group==='枕套工艺'))for(const notes of ['', '枕套也只有三边']){
    const size='三组同时满足：'+[craft.spec,variants.find(v=>v.id==='standard').spec,pillow.spec].join('；');
    const v=validateInput({...base,size,imageB:image,notes,referenceImage:image,referenceScene:true,referenceAngle:true});
    for(const prompt of [buildPrompt(v,'warm','reverse'),buildZhipuPrompt(v,'warm','reverse',summary)]){
      assert.equal(count(prompt,setPromptData.base.duvetEdge),craft.id==='plain'?0:1,craft.id);
      assert.equal(count(prompt,setPromptData.base.pillowFour),pillow.id==='pillow-plain'||notes?0:1,pillow.id);
      assert.equal(count(prompt,setPromptData.base.pillowThree),pillow.id==='pillow-plain'||!notes?0:1,pillow.id);
      if(notes)assert.doesNotMatch(prompt,/枕套[^。]*四周|枕套[^。]*四边/);
      assert.equal(enforceBeddingFidelity(enforceSetPanelBoundaries(prompt,v),v),prompt);
    }
    const refs=craftReferenceInstruction(v,4);
    if(craft.id!=='plain'||pillow.id!=='pillow-plain')assert.match(refs,/Edge coverage and added outer dimensions follow Size specification/);
  }
});
test('saved craft cards preserve custom widths and resolve coverage once when pillow notes change',()=>{
  const size=combinations.find(c=>c.parts.map(p=>p.id).join(',')==='wide-flange,fitted,pillow-wide-flange').size;
  const original=validateInput({...base,size,imageB:image});
  const saved=Object.fromEntries(layeredSetDetails(original).filter(r=>r.group!=='床单款式').map(r=>[r.group==='被套工艺'?'duvet':'pillow',layeredSetGroupPrompt(original,r)]));
  saved.duvet=saved.duvet.replace('4～6厘米','10厘米');
  saved.pillow=saved.pillow.replace('4～6厘米','8厘米');
  const v={...original,notes:'枕套只有三边',promptSections:saved};
  for(const prompt of [buildPrompt(v,'warm','side'),buildZhipuPrompt(v,'warm','side',summary)]){
    assert.equal(count(prompt,setPromptData.base.duvetEdge),1);assert.equal(count(prompt,setPromptData.base.pillowThree),1);
    assert.equal(count(prompt,setPromptData.base.pillowFour),0);assert.match(prompt,/10厘米/);assert.match(prompt,/8厘米/);
    assert.match(prompt,/承托的一边仅保留简约细缝/);assert.match(prompt,/不固定为画面下边/);
  }
});
test('all 384 combinations and 20 camera views send one structure with only selected component rules',()=>{
  assert.equal(combinations.length,384);
  for(const {parts,size}of combinations)for(const id of Object.keys(setCameraDirections)){
    const v=validateInput({...base,size,imageB:image});
    assert.deepEqual(layeredSetDetails(v).map(r=>r.id),parts.map(p=>p.id));
    for(const p of [buildPrompt(v,'warm',id),buildZhipuPrompt(v,'warm',id,summary)]){
      assert.ok(structure(p).includes('反面严格使用B'));
      assert.equal(count(p,setPromptData.base.panelIdentity),1);
      assert.equal(count(p,'最多4只'),1);
      const selected=layeredSetDetails(v);for(const rule of selected)assert.ok(p.includes(rule.detail),rule.id);
      for(const g of setPromptData.groups)for(const o of g.options)if(!selected.some(r=>r.id===o.id))assert.ok(!p.includes(o.prompt),o.id);
      assert.ok(!/exactly TWO|exactly two|两只枕套|两只枕头|pillow pair stays at the head|FOUR-PIECE CONSTRUCTION IN THIS VIEW/.test(p),id+' '+p.match(/.{0,20}(?:exactly TWO|exactly two|两只枕套|两只枕头).{0,40}/)?.[0]);
      assert.ok(!p.includes('SEWN PANEL MAP'));
    }
  }
});
test('A-only, all reference scopes and texture choices preserve structure without panel duplicates',()=>{
  for(const hasB of [false,true])for(const ref of ['none','both','scene','angle'])for(const material of ['auto','selected','upload']){
    const v=validateInput({...base,imageB:hasB?image:null,referenceImage:ref==='none'?null:image,referenceScene:ref==='both'||ref==='scene',referenceAngle:ref==='both'||ref==='angle',fabricMode:material==='selected'?'selected':'auto',textureReferenceImage:material==='upload'?image:null});
    for(const p of [buildPrompt(v,'hotel','reverse',false,0,material!=='auto'),buildZhipuPrompt(v,'hotel','reverse',summary)]){
      assert.equal(count(p,setPromptData.base.panelIdentity),1);
      assert.equal(structure(p).includes('反面严格使用B'),hasB);
      if(!hasB)assert.ok(!structure(p).includes('反面严格使用B'));
      assert.equal(enforceBeddingFidelity(enforceSetPanelBoundaries(p,v),v),p);
    }
  }
});
test('smart plans retain random camera/styling and maximum four pillows; guards are idempotent',()=>{
  const v=validateInput({...base,imageB:image,smartAngles:true,setCounts:{main:10,duvet:0,sheet:0,pillow:0}});
  v.recommendationPlan=createRecommendationPlan(v);
  for(let i=0;i<10;i++){
    const shot=recommendationSections({...v,recommendIndex:i});
    const p=buildPrompt(shot,'warm','front');
    assert.ok(p.includes(v.recommendationPlan[i].camera[1]));
    assert.equal(count(p,setPromptData.base.panelIdentity),1);
    assert.doesNotMatch(p,/exactly TWO|exactly two|两只枕套/);
    assert.ok(enforceBeddingFidelity(p,shot)===p,'smart guard changed on repeated enforcement');
  }
});
test('each selected craft has an independent edit scope and full replacements retain structure',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'layered-sections-'));
  try{
    const v=validateInput({...base,size:combinations[0].size,imageB:image}),store=createPromptSectionEdits(path.join(dir,'sections.json'));
    await store.save({scope:sectionScope(v,'warm','side','pillow'),prompt:'每只枕套细窄平顺接缝，指定缝线色为浅绿。',version:null});
    const sections=await store.resolve({...v,size:combinations[8].size},'hotel','front');
    assert.ok(sections.pillow);assert.ok(!sections.duvet);
    const p=enforceBeddingFidelity('manual text',{...v,promptSections:sections});
    assert.ok(p.includes('浅绿'));assert.ok(structure(p).includes('反面严格使用B'));assert.match(p,/最多4只/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('actual final multipart request and admin sections use the approved rules',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'layered-request-')),sent=[];
  const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'synthetic-test-key',baseUrl:'https://synthetic.invalid/v1',model:'gpt-image-2.5-flare',verified:true},fetchImpl:async(url,options)=>{sent.push(options.body.get('prompt'));return new Response(JSON.stringify({data:[{b64_json:image.split(',')[1]}]}),{status:200,headers:{'Content-Type':'application/json'}});}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{
    const preview=await (await fetch(url+'/api/admin/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'set',hasB:true,scene:'warm',angle:'side',setCraft:'wide-flange',setSheet:'fitted',setPillow:'pillow-piping'})})).json();
    assert.ok(preview.sections,JSON.stringify(preview));
    assert.deepEqual(preview.sections.slice(0,4).map(s=>s.id),['product','duvet','surface','pillow']);
    assert.ok(preview.sections[0].prompt.includes('反面严格使用B'));
    const threePreview=await (await fetch(url+'/api/admin/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'set',hasB:true,scene:'warm',angle:'side',setCraft:'piping',setSheet:'fitted',setPillow:'pillow-wide-flange',notes:'枕套只有三边'})})).json();
    for(const prompt of Object.values(threePreview.prompts)){assert.equal(count(prompt,setPromptData.base.pillowThree),1);assert.equal(count(prompt,setPromptData.base.pillowFour),0);assert.equal(count(prompt,setPromptData.base.duvetEdge),1);}
    const input={...base,size:combinations.find(c=>c.parts.map(p=>p.id).join(',')==='wide-flange,fitted,pillow-piping').size,imageB:image,cameraReferences:{side:image},notes:'枕套也只有三边'};
    const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const job=await response.json();assert.equal(response.status,202,JSON.stringify(job));
    for(let i=0;i<100;i++){const status=await(await fetch(url+'/api/jobs/'+job.id)).json();if(status.status==='done')break;if(status.status==='error')throw Error(status.message);await new Promise(r=>setTimeout(r,10));}
    assert.equal(sent.length,1);assert.equal(count(sent[0],setPromptData.base.panelIdentity),1);assert.ok(sent[0].includes('单层床笠'));assert.match(sent[0],/最多4只/);assert.doesNotMatch(sent[0],/exactly TWO|两只枕套/);
    assert.equal(count(sent[0],setPromptData.base.duvetEdge),1);assert.equal(count(sent[0],setPromptData.base.pillowThree),1);assert.equal(count(sent[0],setPromptData.base.pillowFour),0);
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('long recognition and notes fit Zhipu without deleting construction',()=>{
  const v=validateInput({...base,imageB:image,size:combinations.find(c=>c.parts.every(p=>p.id.includes('flange')||p.id==='pleated-skirt')).size,notes:'要求'.repeat(240),referenceImage:image,referenceScene:true,referenceAngle:true,textureReferenceImage:image});
  const long=JSON.stringify({fabricA:'A'.repeat(320),fabricB:'B'.repeat(320),sourceTexture:'S'.repeat(150),referenceScene:'R'.repeat(160),referenceAngle:'V'.repeat(160),productDetails:'D'.repeat(140),userTexture:'T'.repeat(150),craftDetails:'C'.repeat(500)});
  const p=buildZhipuPrompt(v,'warm','reverse',long);assert.doesNotThrow(()=>zhipuImageRequest({model:'glm-image'},v,p));assert.ok(structure(p).includes('反面严格使用B'));
});
