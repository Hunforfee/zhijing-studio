import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {validateInput,buildPrompt} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
const source=await readFile('dist/set-variants.js','utf8');
const context=vm.createContext({});vm.runInContext(source.split('const variantPanel=')[0],context);
const variants=vm.runInContext('setVariants',context);
const app=await readFile('dist/app.js','utf8');
const optionsFunction=app.match(/function options\(\)\{[^\n]+/)[0];
const base={product:'set',fabric:'cotton',fabricMode:'auto',scenes:['warm'],angles:['front'],size:'',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='};
assert.equal(variants.length,22);assert.deepEqual([...new Set(variants.map(v=>v.group))],['床单款式','被套工艺','枕套工艺']);
for(const v of variants.filter(v=>v.group==='被套工艺'))assert.ok(!v.spec.includes('枕套'));
for(const v of variants.filter(v=>v.group==='枕套工艺'))assert.ok(!v.spec.includes('被套'));
assert.match(vm.runInContext('setVariantSpecification()',context),/床侧、床尾自然下垂/);
assert.equal(vm.runInContext('currentSetVariant().name',context),'普通四件套');
context.state={...base,fabricMode:'selected'};context.fabrics={cotton:['细密哑光']};context.$=id=>({value:{scale:'100',direction:'0',repeat:'tile',ratio:'1:1',notes:'测'.repeat(250)}[id]});vm.runInContext(optionsFunction,context);
let count=0;
for(const sheet of variants.filter(v=>v.group==='床单款式'))for(const craft of variants.filter(v=>v.group==='被套工艺'))for(const pillow of variants.filter(v=>v.group==='枕套工艺')){
  context.sheetId=sheet.id;context.craftId=craft.id;context.pillowId=pillow.id;vm.runInContext('chosenSheetVariant=sheetId;chosenDuvetVariant=craftId;chosenPillowVariant=pillowId',context);
  const request=vm.runInContext('options()',context);
  assert.ok(request.size.length<=240,request.size);assert.ok(request.notes.length<=500);
  assert.ok(request.size.includes(sheet.spec));assert.ok(request.size.includes(craft.spec));assert.ok(request.size.includes(pillow.spec));
  for(const imageB of [undefined,base.image]){const valid=validateInput({...base,...request,imageB});for(const angle of ['front','top','detail','reverse']){const prompt=buildPrompt(valid,'warm',angle),zhipu=buildZhipuPrompt(valid,'warm',angle,'');for(const spec of [sheet.spec,craft.spec,pillow.spec]){assert.ok(prompt.includes(spec));assert.ok(zhipu.includes(spec));}assert.match(prompt,/互不替代/);assert.ok(zhipu.length<=3500);}}
  context.state.referenceUpload={};const guided=vm.runInContext('options()',context);assert.ok(guided.size.startsWith('参考图优先'));for(const spec of [sheet.spec,craft.spec,pillow.spec])assert.ok(guided.size.includes(spec));assert.ok(guided.size.length<=240);assert.ok(guided.notes.length<=500);validateInput({...base,...guided,referenceImage:base.image});context.state.referenceUpload=null;
  count++;
}
const uiButtons=variants.map(item=>({dataset:{setVariant:item.id},setAttribute(key,value){this[key]=value}}));
const label={textContent:''};context.variantPanel={hidden:false,querySelectorAll:()=>uiButtons,querySelector:()=>label};context.document={querySelector:()=>null};context.$=()=>({textContent:''});
vm.runInContext(source.match(/function renderSetVariantControl\(\)\{[^\n]+/)[0],context);
vm.runInContext(source.match(/function selectSetVariant\(id\)\{[^\n]+/)[0],context);
for(const craft of variants.filter(v=>v.group==='被套工艺')){
  context.craftId=craft.id;vm.runInContext('selectSetVariant(craftId)',context);
  assert.equal(vm.runInContext('chosenPillowVariant',context),'pillow-'+craft.id);
}
vm.runInContext("selectSetVariant('pillow-plain');selectSetVariant('ruffle')",context);
assert.equal(vm.runInContext('chosenPillowVariant',context),'pillow-plain');
vm.runInContext("pillowCraftManuallySelected=false;selectSetVariant('plain')",context);
vm.runInContext("selectSetVariant('fitted');selectSetVariant('piping')",context);
assert.equal(vm.runInContext('chosenSheetVariant',context),'fitted');assert.equal(vm.runInContext('chosenDuvetVariant',context),'piping');assert.equal(context.variantPanel.hidden,false);assert.equal(uiButtons.filter(b=>b['aria-pressed']==='true').length,3);
assert.equal(vm.runInContext('chosenPillowVariant',context),'pillow-piping');
vm.runInContext("selectSetVariant('pillow-wide-flange');selectSetVariant('wide-flange')",context);assert.equal(vm.runInContext('chosenSheetVariant',context),'fitted');assert.equal(vm.runInContext('chosenPillowVariant',context),'pillow-wide-flange');
vm.runInContext("selectSetVariant('standard')",context);assert.equal(vm.runInContext('chosenDuvetVariant',context),'wide-flange');
vm.runInContext("selectSetVariant('lace')",context);assert.equal(vm.runInContext('chosenPillowVariant',context),'pillow-wide-flange');
vm.runInContext("selectSetVariant('wide-flange')",context);
context.state.busy=true;vm.runInContext("selectSetVariant('lace')",context);assert.equal(vm.runInContext('chosenDuvetVariant',context),'wide-flange');
vm.runInContext("selectSetVariant('pillow-lace')",context);assert.equal(vm.runInContext('chosenPillowVariant',context),'pillow-wide-flange');
const content={children:[],replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}};
context.state.busy=false;context.placeSetVariants=()=>{};context.variantPanel.querySelector=s=>s==='.set-variant-options'?content:label;
context.document.createElement=tag=>({tag,children:[],dataset:{},setAttribute(){},addEventListener(){},append(...nodes){this.children.push(...nodes)}});
vm.runInContext(source.match(/function openSetVariants\(\)\{[^\n]+/)[0]+';openSetVariants()',context);
assert.deepEqual(content.children.map(x=>x.children[0].children[0].children[0].textContent),['被套工艺','床单款式','枕套工艺']);
assert.deepEqual(content.children.map(x=>x.children[1].children.length),[8,6,8]);
const matSource=await readFile('dist/mat-variants.js','utf8');const matContext=vm.createContext({state:{product:'mat',fabric:'ice',fabricMode:'auto',busy:false},Event:class{constructor(name){this.type=name}},renderOptions(){},$:()=>({dispatchEvent(){}}),closeMatVariants(){},toast(){}});
vm.runInContext(matSource.split('const matVariantPanel=')[0]+matSource.match(/function selectMatVariant\(id\)\{[^\n]+/)[0],matContext);
for(const id of ['ice','rattan','bamboo']){matContext.id=id;vm.runInContext('selectMatVariant(id)',matContext);assert.equal(matContext.state.fabric,id);assert.equal(matContext.state.fabricMode,'selected');validateInput({...base,product:'mat',fabric:id});}
assert.ok(app.includes("$('matTypes').hidden=true"));
console.log(count+' 个四件套组合通过：三组独立选择、两种接口、参考图保留三组要求及默认下垂；3 种凉席菜单选择和参数检查通过。未调用真实生图服务。');
