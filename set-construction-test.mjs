import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,buildPrompt} from './server.mjs';
import {buildZhipuPrompt,zhipuImageRequest} from './zhipu-prompts.mjs';
import {setDetailRules,selectedSetDetails,setSpecificationPrompt,setCraftConstraint} from './set-product-prompts.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
import {angleDirections,sceneDirections} from './photography-prompts.mjs';
import {setStructurePrompt,setSurfacePlacement,setPanelBoundaryRule,enforceSetPanelBoundaries} from './set-surface-prompts.mjs';
import {sectionScope,createPromptSectionEdits} from './prompt-section-edits.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const context=vm.createContext({});vm.runInContext((await readFile('dist/set-variants.js','utf8')).split('const variantPanel=')[0],context);
const variants=vm.runInContext('setVariants',context),groups=['被套工艺','床单款式','枕套工艺'];
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'set',fabric:'washed',fabricMode:'selected',scenes:['warm'],angles:['front'],size:'',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image};
test('selected duvet flange survives full replacement and keeps administrator width independently of pillow craft',()=>{
  const v={...base,size:'三组同时满足：被套外缘4至6厘米平整单层宽边；普通平床单：自然外垂；两只枕套简约细缝边',promptSections:{size:'被套外缘10厘米平整宽边；普通平床单：自然外垂；两只枕套简约细缝边'}};
  for(const compact of [false,true]){
    const guard=setCraftConstraint(v,compact),sent=enforceBeddingFidelity('custom full replacement',v,{compact,final:true});
    assert.match(sent,/被套必须有宽边（目标10厘米/);assert.doesNotMatch(sent,/两只枕套必须有宽边/);assert.ok(sent.includes('custom full replacement'));
    assert.equal(enforceBeddingFidelity(sent,v,{compact,final:true}),sent);
    assert.ok(guard.includes('无填充'));
  }
});
test('approved structure preserves real panel boundaries, same-panel folds and A-only overrides for every view and reference scope',()=>{
  assert.ok(Array.from(setStructurePrompt).length<650);
  assert.match(setStructurePrompt,/真实外缘接合，并保留实际开口/);
  assert.match(setStructurePrompt,/不用于普通压线、折边缝线或造型折痕/);
  assert.match(setStructurePrompt,/接合线两侧分别属于A正面与B反面/);
  assert.match(setStructurePrompt,/同一裁片内部的花型保持连续/);
  assert.match(setStructurePrompt,/不是一只枕套A、另一只B/);
  assert.match(setStructurePrompt,/隆起、凹谷、堆褶和压折不等于翻面/);
  assert.match(setStructurePrompt,/枕套不自动增加拉链/);
  for(const hasB of [false,true])for(const reference of ['none','both','scene','angle'])for(const angle of Object.keys(angleDirections)){
    const v=validateInput({...base,imageB:hasB?image:null,referenceImage:reference==='none'?null:image,referenceScene:reference==='both'||reference==='scene',referenceAngle:reference==='both'||reference==='angle'});
    const normal=buildPrompt(v,'warm',angle),zhipu=buildZhipuPrompt(v,'warm',angle,'A green flowers B blue checks');
    assert.ok(normal.includes(setStructurePrompt));assert.ok(normal.includes(setSurfacePlacement(v)));assert.ok(zhipu.includes(setSurfacePlacement(v,true)));
    if(hasB){assert.match(normal,/two sides of a crease still on the front panel both remain A/);assert.match(zhipu,/禁止同一布面内任意混色/);}
    else{assert.match(normal,/Conditional B instructions in the general structure do not apply/);assert.match(zhipu,/通用结构中的B分配不生效/);}
  }
});
function combinations(){return variants.filter(v=>v.group===groups[0]).flatMap(a=>variants.filter(v=>v.group===groups[1]).flatMap(b=>variants.filter(v=>v.group===groups[2]).map(c=>({parts:[a,b,c],size:'三组同时满足：'+a.spec+'；'+b.spec+'；'+c.spec+'。各工艺仅作用所属部件，互不沿用。'}))));}
test('panel identity correction survives manual prompt replacement without affecting A-only or other products',()=>{
  const v={...base,imageB:image};
  for(const chinese of [false,true]){
    const rule=setPanelBoundaryRule(v,chinese);
    const custom='Manual replacement that omits panel identity.';
    const guarded=enforceSetPanelBoundaries(custom,v,chinese);
    assert.ok(guarded.includes(custom));assert.ok(guarded.includes(rule));
    assert.equal(enforceSetPanelBoundaries(guarded,v,chinese),guarded);
    assert.equal(enforceSetPanelBoundaries(custom+' '+rule,v,chinese),guarded);
    assert.ok((chinese?buildZhipuPrompt(v,'warm','reverse','A green B blue'):buildPrompt(v,'warm','reverse',true)).includes(rule));
  }
  assert.equal(enforceSetPanelBoundaries('unchanged',base),'unchanged');
  assert.equal(enforceSetPanelBoundaries('unchanged',{...v,product:'sheet'}),'unchanged');
});
test('all 22 choices resolve only their own construction details across all 384 combinations and 12 views',()=>{
  assert.equal(setDetailRules.length,variants.length);
  for(const {parts,size}of combinations()){
    const v=validateInput({...base,size,imageB:image});
    assert.deepEqual(selectedSetDetails(v).map(r=>r.id).sort(),parts.map(p=>p.id).sort());
    for(const angle of Object.keys(angleDirections)){
      const normal=buildPrompt(v,'warm',angle),zhipu=buildZhipuPrompt(v,'warm',angle,'A green print B blue print');
      for(const rule of selectedSetDetails(v)){assert.ok(normal.includes(rule.detail));assert.ok(zhipu.includes(rule.detail));}
      for(const rule of setDetailRules.filter(r=>!selectedSetDetails(v).includes(r))){assert.ok(!normal.includes(rule.detail));assert.ok(!zhipu.includes(rule.detail));}
      assert.match(normal,/一件被套、一件床单或所选替代床面部件、两只枕套/);assert.match(zhipu,/一件被套、一件床单或所选替代床面部件、两只枕套/);
      assert.match(normal,/FOUR-PIECE CONSTRUCTION IN THIS VIEW/);assert.match(zhipu,/四件套机位细节/);
    }
  }
});
test('reference scene and camera locks preserve all three selected construction rules and both fabric assignments',()=>{
  for(const [referenceScene,referenceAngle]of [[true,true],[true,false],[false,true]]){
    const {size}=combinations().find(x=>x.parts.map(p=>p.id).join(',')==='piping,fitted,pillow-wide-flange');
    const v=validateInput({...base,size,imageB:image,referenceImage:image,referenceScene,referenceAngle});
    const prompt=buildPrompt(v,'hotel','pillowclose'),zhipu=buildZhipuPrompt(v,'hotel','pillowclose','A ivory B blue');
    for(const rule of selectedSetDetails(v)){assert.ok(prompt.includes(rule.detail));assert.ok(zhipu.includes(rule.detail));}
    assert.match(prompt,/take precedence over conflicting reference craft/);
    assert.match(zhipu,/三组各自生效，不互相沿用/);
    assert.match(prompt,/pillowcase FRONTS use A and their REVERSES use B/);
    assert.equal(prompt.includes('MENU CAMERA [pillowclose:'),!referenceAngle);
    assert.equal(prompt.includes('MENU SCENE [hotel]'),!referenceScene);
  }
});
test('longest selected craft combination retains pillow detail without truncation under Zhipu 3500-character limit',()=>{
  const longest=combinations().sort((a,b)=>setSpecificationPrompt({...base,size:b.size}).length-setSpecificationPrompt({...base,size:a.size}).length)[0];
  const description=JSON.stringify({fabricA:'A'.repeat(320),fabricB:'B'.repeat(320),sourceTexture:'S'.repeat(150),referenceScene:'R'.repeat(160),referenceAngle:'V'.repeat(160),productDetails:'D'.repeat(140),userTexture:'T'.repeat(150)});
  for(const reference of ['none','both','scene','angle']){
  const v=validateInput({...base,size:longest.size,notes:'N'.repeat(500),imageB:image,referenceImage:reference==='none'?null:image,referenceScene:reference==='both'||reference==='scene',referenceAngle:reference==='both'||reference==='angle',textureSource:'upload',textureReferenceImage:image});
  for(const scene of Object.keys(sceneDirections))for(const angle of Object.keys(angleDirections)){
    const prompt=buildZhipuPrompt(v,scene,angle,description);
    assert.ok(prompt.includes(selectedSetDetails(v).find(r=>r.group==='枕套工艺').detail));
    assert.ok(prompt.includes(setSurfacePlacement(v,true)));
    assert.doesNotThrow(()=>zhipuImageRequest({model:'glm-image'},v,prompt));
    const correction='自动修正：'+ '检查观察'.repeat(60);
    assert.doesNotThrow(()=>zhipuImageRequest({model:'glm-image'},v,correction+buildZhipuPrompt(v,scene,angle,description,correction.length)));
  }
  }
});
test('new built-in details preserve previously saved combination scopes and explicit custom section replacement',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-set-rules-'));
  try{
    const v={...base,size:combinations()[0].size},scope=sectionScope(v,'warm','front','size');
    const store=createPromptSectionEdits(path.join(dir,'sections.json'));
    await store.save({scope,prompt:'自定义被套细节与独立床单枕套',version:null});
    const sections=await store.resolve(v,'hotel','top');
    assert.equal(sectionScope(v,'hotel','top','size'),scope);
    assert.equal(setSpecificationPrompt({...v,promptSections:sections}),sections.size);
    assert.ok(buildPrompt({...v,promptSections:sections},'hotel','top').includes(sections.size));
    assert.equal(selectedSetDetails({...base,product:'sheet',size:v.size}).length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
