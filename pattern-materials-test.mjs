import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {normalizePatternMaterials,patternMaterialInstruction} from './pattern-materials.mjs';
import {createServer,validateInput} from './server.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const image='data:image/png;base64,'+png.toString('base64');
const result={A:{pattern:'奶白底青绿花叶',craft:'被套左右及床尾可见平整外沿',texture:'可见柔和缎光',uncertain:'尺寸不可推断'},B:{pattern:'背面小花',craft:'',texture:'',uncertain:''},craftChoices:{duvetCraft:{id:'wide-flange',confidence:'high',evidence:'可见平整无填充边及内压线'},pillowCraft:{id:'pillow-wide-flange',confidence:'low',evidence:'枕套遮挡'}},textureChoice:{id:'smooth-silk',confidence:'high',evidence:'细密表面和连续柔和光泽'}};
test('side ownership, count and bytes validation; source settings retain priority',()=>{
 const v=normalizePatternMaterials({A:[image,image],B:[image],observations:{A:result.A}});assert.deepEqual(v.patternMaterialBytes.map(x=>x.side),['A','A','B']);assert.deepEqual(v.patternMaterialBytes.map(x=>x.index),[2,3,2]);
 assert.throws(()=>normalizePatternMaterials({A:Array(8).fill(image)}));assert.throws(()=>normalizePatternMaterials({A:['bad']}));assert.throws(()=>normalizePatternMaterials({B:[image.replace('iVBOR','ZZZZZ')]}));
 const p=patternMaterialInstruction(v,5);assert.match(p,/Image 5: A-side/);assert.match(p,/Image 7: B-side/);assert.match(p,/explicit product\/craft, texture reference\/library and user settings retain priority/);
});
test('retired analysis endpoint returns 410 without model calls while generation keeps all A/B supplemental images',async()=>{
 const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-multi-pattern-'));let generated=0,analyzed=0;
 const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'synthetic',baseUrl:'https://example.test/v1',model:'synthetic-image'},fetchImpl:async(url,init)=>{
  if(url.endsWith('/responses')){analyzed++;return Response.json({output_text:JSON.stringify(result)});}
  assert.ok(url.endsWith('/images/edits'));const files=init.body.getAll('image[]');const names=files.map(x=>x.name);
  assert.deepEqual(names.slice(-3),['fabric-A-supplement-2.png','fabric-A-supplement-3.png','fabric-B-supplement-2.png']);
  assert.deepEqual(Buffer.from(await files.at(-1).arrayBuffer()),png);assert.match(init.body.get('prompt'),/USER MULTI-IMAGE FABRIC MATERIALS/);assert.match(init.body.get('prompt'),/奶白底青绿花叶/);generated++;return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const r=await fetch(url+'/api/pattern-materials/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:{A:[image,image],B:[image]},product:'set'})});assert.equal(r.status,410);assert.equal((await r.json()).code,'PATTERN_ANALYSIS_REMOVED');assert.equal(analyzed,0);assert.equal(generated,0);
  const malformed=await fetch(url+'/api/pattern-materials/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'not-json'});assert.equal(malformed.status,410);assert.equal(analyzed,0);assert.equal(generated,0);
  const base={product:'set',fabric:'cotton',fabricMode:'auto',size:'参考图款式',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,imageB:image,referenceImage:image,referenceScene:true,referenceAngle:true,scenes:['warm'],angles:['front'],autoReview:false,patternMaterials:{A:[image,image],B:[image],observations:{A:result.A}}};
  assert.equal(validateInput(base).patternMaterialBytes.length,3);
  const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(base)});assert.equal(response.status,202);const job=await response.json();let last;
  for(let i=0;i<100;i++){last=await (await fetch(url+'/api/jobs/'+job.id)).json();if(['done','error','cancelled'].includes(last.status))break;await new Promise(r=>setTimeout(r,15));}
  assert.equal(last.status,'done',last.message);assert.equal(generated,1);assert.equal(analyzed,0);
 }finally{await new Promise(r=>server.close(r));if(!outputDir.startsWith(path.join(os.tmpdir(),'zhijing-multi-pattern-')))throw Error('Unexpected test directory');await rm(outputDir,{recursive:true,force:true});}
});
test('Zhipu vision receives all side references and final text generation retains multi-image evidence',async()=>{
 const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-multi-zhipu-'));let vision=0,generation=0;
 const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'zhipu',apiKey:'synthetic',baseUrl:'https://example.test/v4',model:'cogview-4-250304'},fetchImpl:async(url,init)=>{
  const request=JSON.parse(init.body);
  if(url.endsWith('/chat/completions')){const content=request.messages[0].content;assert.equal(content.filter(x=>x.type==='image_url').length,4);assert.ok(content.some(x=>x.text?.includes('Supplemental A-side')));vision++;return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'green leaves on ivory',fabricB:'small blue flowers',sourceTexture:'fine silky weave',craftDetails:'wide flange'})}}]});}
  assert.ok(url.endsWith('/images/generations'));assert.match(request.prompt,/奶白底青绿花叶/);assert.match(request.prompt,/不得覆盖所选产品/);generation++;return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'set',fabric:'cotton',fabricMode:'auto',size:'参考图款式',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,imageB:image,scenes:['warm'],angles:['front'],autoReview:false,patternMaterials:{A:[image],B:[image],observations:{A:result.A}}})});assert.equal(response.status,202);const job=await response.json();let last;for(let i=0;i<100;i++){last=await(await fetch(url+'/api/jobs/'+job.id)).json();if(['done','error'].includes(last.status))break;await new Promise(r=>setTimeout(r,15));}assert.equal(last.status,'done',last.message);assert.equal(vision,1);assert.equal(generation,1);}finally{await new Promise(r=>server.close(r));if(!outputDir.startsWith(path.join(os.tmpdir(),'zhijing-multi-zhipu-')))throw Error('Unexpected test directory');await rm(outputDir,{recursive:true,force:true});}
});
