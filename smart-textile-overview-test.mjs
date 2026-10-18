import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,buildPrompt} from './server.mjs';
import {createRecommendationPlan,recommendationSections} from './shooting-recommendation.mjs';
import {buildZhipuPrompt,zhipuImageRequest} from './zhipu-prompts.mjs';
import {isTextileProp,allowsTextileAccent} from './recommendation-styling.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'set',fabric:'cotton',scenes:['natural'],angles:['front'],size:'被套外缘4至6厘米；普通平床单：自然外垂；每只枕套外缘4至6厘米',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,imageB:image,smartAngles:true,setCounts:{main:10,duvet:0,sheet:0,pillow:0,detail:0}};
function rng(seed){return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);}
test('each selected scene gets varied textile props and two complete overviews in ten main images',()=>{
 for(let seed=1;seed<=30;seed++)for(const scene of ['warm','natural','hotel','studio','outdoor','terrace','minimal','french','kids','childbed']){
  const v=validateInput({...base,scenes:[scene],setCounts:{main:10,duvet:1,pillow:1}}),plan=createRecommendationPlan(v,rng(seed));
  const main=plan.filter(s=>s.shotKind==='main'),visible=main.filter(s=>s.styling.propsVisible),textile=visible.filter(s=>isTextileProp(s.styling.props));
  assert.equal(visible.length,8);if(scene==='childbed'){assert.ok(plan.every(s=>s.styling.pillowCount===1));assert.equal(new Set(plan.map(s=>s.styling.props)).size,1);assert.equal(new Set(plan.map(s=>s.scene[0])).size,1);}else{assert.equal(textile.length,4);assert.ok(textile.some(s=>/装饰抱枕/.test(s.styling.props)));assert.ok(textile.some(s=>/毯/.test(s.styling.props)));assert.ok(textile.every(s=>!/装饰抱枕/.test(s.styling.props)||s.styling.pillowCount<=3));}
  assert.equal(main.filter(s=>s.fullProductOverview).length,2);assert.ok(main.filter(s=>s.fullProductOverview).every(s=>s.camera[1].includes('40-50%')&&s.camera[1].includes('距离比近景主图增加约40%')&&!/55-65%|60-70%/.test(s.camera[1])&&s.camera[1].includes('28–35mm')&&!/RELAXED LIFESTYLE/.test(s.camera[1])));
  assert.ok(plan.filter(s=>s.shotKind!=='main').every(s=>!s.fullProductOverview&&!s.styling.propsVisible));
 }
});
test('ordinary, compact and final prompts carry props and overview without conflicting blanket prohibition or duplicated camera',()=>{
 const v=validateInput(base);v.recommendationPlan=createRecommendationPlan(v,rng(22));
 for(let i=0;i<10;i++){
  const current=recommendationSections({...v,recommendIndex:i}),p=enforceBeddingFidelity(buildPrompt(current,'natural','front'),current),z=buildZhipuPrompt(current,'natural','front','{"fabricA":"blue flowers","fabricB":"ivory dots"}');
  const final=enforceBeddingFidelity(z,current,{compact:true,final:true});zhipuImageRequest({model:'glm-image'},current,final);assert.equal(final,z);
  for(const prompt of [p,z]){assert.ok(prompt.includes(current.recommendStyling.props));if(allowsTextileAccent(current)){assert.doesNotMatch(prompt,/不铺额外被毯/);assert.match(prompt,/覆盖主体(?:不超过|≤)10%/);}if(v.recommendationPlan[i].fullProductOverview){assert.match(prompt,/COMPLETE BEDDING OVERVIEW/);assert.match(prompt,/【广角完整入画优先】/);assert.match(prompt,/每个外缘与画框至少留5%空隙/);};}
 }
});
test('multiple scenes keep full independent overview and textile counts',()=>{
 const v=validateInput({...base,scenes:['warm','hotel','studio']}),plan=createRecommendationPlan(v,rng(15));assert.equal(plan.length,30);
 for(let i=0;i<3;i++){const shots=plan.slice(i*10,(i+1)*10);assert.equal(shots.filter(s=>s.fullProductOverview).length,2);assert.equal(shots.filter(s=>s.styling.propsVisible&&isTextileProp(s.styling.props)).length,4);}
});

test('portrait main images increase room context while detail crops and other ratios retain their framing',()=>{
 for(const scene of ['natural','childbed'])for(const main of [1,3,10,15]){
  const v=validateInput({...base,ratio:'3:4',scenes:[scene],setCounts:{main,duvet:2,sheet:1,pillow:1}});v.recommendationPlan=createRecommendationPlan(v,rng(22));
  const plan=v.recommendationPlan;assert.equal(plan.filter(s=>s.portraitSpace).length,Math.ceil(main*0.5));
  assert.ok(plan.filter(s=>s.shotKind!=='main').every(s=>!s.portraitSpace&&!s.fullProductOverview));
  for(let i=0;i<plan.length;i++)if(plan[i].portraitSpace){
   assert.equal(plan[i].mainFraming,'context');assert.doesNotMatch(plan[i].camera[1],/fills 80|headboard.*cropped|90 degrees down/);
   const current=recommendationSections({...v,recommendIndex:i});
   for(const prompt of [enforceBeddingFidelity(buildPrompt(current,scene,'front'),current),buildZhipuPrompt(current,scene,'front','{"fabricA":"blue flowers","fabricB":"ivory dots"}')])assert.match(prompt,/主体位于画面中下部/);
   const prompt=buildZhipuPrompt(current,scene,'front','{"fabricA":"blue flowers","fabricB":"ivory dots"}');zhipuImageRequest({model:'glm-image'},current,prompt);
  }
 }
 for(const ratio of ['1:1','4:3'])assert.ok(createRecommendationPlan(validateInput({...base,ratio}),rng(22)).every(s=>!s.portraitSpace));
});
