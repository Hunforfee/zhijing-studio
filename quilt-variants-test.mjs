import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {validateInput,buildPrompt} from './server.mjs';
import {quiltSeason} from './quilt-prompts.mjs';
const app=await readFile('dist/app.js','utf8'),source=await readFile('dist/quilt-variants.js','utf8');
const base={product:'quilt',fabric:'cotton',fabricMode:'selected',quiltSeason:'winter',scenes:['warm'],angles:['side'],size:'',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='};
const context=vm.createContext({state:{...base},fabrics:{cotton:['细密哑光']},$:id=>({value:{scale:'100',direction:'0',repeat:'tile',ratio:'1:1',notes:'测'.repeat(250)}[id]})});
vm.runInContext(source.split('const quiltVariantPanel=')[0],context);vm.runInContext(app.match(/function options\(\)\{[^\n]+/)[0],context);
vm.runInContext(app.match(/function angleDisplayName\([^\n]+/)[0]+app.match(/function angleSelectorCard\([^\n]+/)[0],context);
assert.equal(vm.runInContext('currentQuiltVariant().id',context),'winter');
const ids=['side','front','top','detail','left','right','low','wide','reverse','foot','pillowclose','drape'];let combinations=0;
for(const season of ['winter','summer']){context.state.quiltSeason=season;const request=vm.runInContext('options()',context);assert.equal(request.quiltSeason,season);assert.ok(request.size.length<=100);assert.ok(request.notes.length<=500);assert.match(request.size,season==='winter'?/冬被.*蓬松/:/夏凉被.*轻薄/);
  for(const hasB of [false,true]){const input=validateInput({...base,...request,imageB:hasB?base.image:undefined});for(const scene of ['warm','natural','hotel','studio','outdoor','terrace','minimal','french','kids'])for(const angle of ids){const prompt=buildPrompt(input,scene,angle,true,angle==='reverse'?2:0,true);assert.match(prompt,season==='winter'?/WINTER DUVET INSERT/:/LIGHTWEIGHT SUMMER QUILT/);assert.match(prompt,/QUILT-SPECIFIC CAMERA/);assert.ok(prompt.includes(request.size));assert.match(prompt,/REQUIRED MATCHING PILLOW PAIR/);if(season==='winter')assert.doesNotMatch(prompt,/a single thin summer quilt|summer quilt remains light and thin/);if(angle==='pillowclose')assert.match(prompt,/EDGE BINDING CLOSE-UP/);combinations++;}}
  for(let i=0;i<ids.length;i++){context.angle={id:ids[i],name:ids[i]};context.index=i;const html=vm.runInContext('angleSelectorCard(angle,index)',context);assert.ok(html.includes('angle-photo-quilt-'+season));assert.equal(html.includes('angle-photo-extra'),false);if(ids[i]==='pillowclose')assert.ok(html.includes('包边特写'));}}
context.state.product='set';context.angle={id:'pillowclose',name:'枕套特写'};context.index=10;assert.match(vm.runInContext('angleSelectorCard(angle,index)',context),/angle-photo-extra/);assert.match(vm.runInContext('angleDisplayName(angle)',context),/枕套特写/);
assert.equal(quiltSeason({}), 'winter');assert.equal(quiltSeason({size:'夏凉被'}),'summer');assert.throws(()=>validateInput({...base,quiltSeason:'invalid'}),/被芯类别/);
context.state.product='quilt';context.state.quiltSeason='winter';context.state.busy=false;let renders=0;
context.quiltVariantPanel={querySelectorAll:()=>['winter','summer'].map(id=>({dataset:{quiltVariant:id},setAttribute(){}}))};context.renderQuiltVariantControl=()=>{};context.renderSelections=()=>renders++;
vm.runInContext(source.match(/function selectQuiltVariant\(id\)\{[^\n]+/)[0],context);vm.runInContext("selectQuiltVariant('summer')",context);assert.equal(context.state.quiltSeason,'summer');assert.equal(renders,1);context.state.busy=true;vm.runInContext("selectQuiltVariant('winter')",context);assert.equal(context.state.quiltSeason,'summer');context.state.busy=false;vm.runInContext("selectQuiltVariant('bad')",context);assert.equal(context.state.quiltSeason,'summer');
assert.ok(app.includes("quiltSeason:'winter',resultProduct:'set'"));
console.log(combinations+' 个被芯提示词组合通过：冬/夏 × A/AB × 9 场景 × 12 角度；默认冬被、参数长度、菜单选择、生成中锁定、角度切换与还原通过。未调用真实生图服务。');
