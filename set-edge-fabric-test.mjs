import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrompt,validateInput} from './server.mjs';
import {buildZhipuPrompt,zhipuImageRequest} from './zhipu-prompts.mjs';
import {layeredSetDetails,layeredSetGroupPrompt,setEdgeFabricRule} from './set-layered-prompts.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
import {reviewFirstImage} from './first-image-review.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'set',fabric:'cotton',fabricMode:'auto',scenes:['warm'],angles:['front'],size:'被套外缘4至6厘米；普通平床单：自然外垂；每只枕套外缘单圈细圆埋绳',scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image};
test('without a craft photo edges extend the selected A/B in both providers, photographic references and manual overrides',()=>{
 for(const hasB of [false,true])for(const ref of [false,true]){
  const v=validateInput({...base,imageB:hasB?image:null,referenceImage:ref?image:null,referenceScene:ref,referenceAngle:ref});
  const rules=layeredSetDetails(v).filter(r=>r.group!=='床单款式').map(r=>setEdgeFabricRule(v,r));
  for(const prompt of [buildPrompt(v,'warm','front'),buildZhipuPrompt(v,'warm','front','{"fabricA":"green print","fabricB":"ivory dots"}'),enforceBeddingFidelity('自定义完整提示词',v)])for(const rule of rules){assert.ok(prompt.includes(rule));assert.match(rule,hasB?/反面直接延续主体B/:/反面直接延续主体A/);}
 }
});
test('uploaded craft style applies only to corresponding edge, other selected edge still extends its A/B',()=>{
 const v=validateInput({...base,imageB:image,craftReferences:{'wide-flange':image}});
 const prompt=buildPrompt(v,'warm','front');assert.match(prompt,/被套外沿已上传对应工艺参考/);assert.match(prompt,/枕套外沿未上传对应工艺参考/);assert.doesNotMatch(prompt,/被套外沿未上传对应工艺参考/);
 zhipuImageRequest({model:'glm-image'},v,buildZhipuPrompt(v,'warm','front','{}'));
 const rules=layeredSetDetails(v);const saved={...v,promptSections:{duvet:layeredSetGroupPrompt(v,rules[0]),pillow:layeredSetGroupPrompt(v,rules[2])}};
 assert.equal(buildPrompt(saved,'warm','front').split('被套外沿已上传对应工艺参考').length,2);
 assert.equal(buildPrompt(saved,'warm','front').split('枕套外沿未上传对应工艺参考').length,2);
});
test('automatic review receives no-reference edge print requirement',async()=>{
 const v=validateInput({...base,imageB:image});let request;
 await reviewFirstImage({bytes:v.imageBytes,v,angle:'front',config:{apiKey:'fixture',baseUrl:'https://example.test',visionModel:'fixture'},fetchImpl:async(url,init)=>{request=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify({checks:Object.fromEntries(['panelAssignment','seamBoundary','componentStructure','duvetCraft','pillowCraft'].map(k=>[k,{status:'pass',evidence:'fixture visible edge'}]))})}}]});}});
 assert.match(request.messages[1].content[0].text,/被套外沿未上传对应工艺参考/);assert.match(request.messages[1].content[0].text,/反面直接延续主体B/);
 assert.match(request.messages[0].content,/B-pattern frame around an A pillow front is a panelAssignment failure/);
});
test('pillow front flange stays A across inner topstitch in both providers and saved sections',()=>{
 const v=validateInput({...base,size:base.size.replace('每只枕套外缘单圈细圆埋绳','每只枕套外缘4至6厘米'),imageB:image});
 const rule=layeredSetDetails(v).find(r=>r.group==='枕套工艺');
 const saved={...v,promptSections:{pillow:layeredSetGroupPrompt(v,rule)}};
 for(const input of [v,saved])for(const prompt of [buildPrompt(input,'warm','front'),buildZhipuPrompt(input,'warm','front','{}')]){
  assert.equal(prompt.split('枕套平布外沿正面与填芯主体正面同属A面').length,2);
  assert.match(prompt,/从主体正面跨过压线到外缘始终为A/);
 }
 const uploaded=validateInput({...base,size:v.size,imageB:image,craftReferences:{'wide-flange':image}});
 assert.doesNotMatch(buildPrompt(uploaded,'warm','front'),/枕套平布外沿正面与填芯主体正面同属A面/);
});
