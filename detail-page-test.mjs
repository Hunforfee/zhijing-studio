import {detailExpansionRequired,validateDetailExpansion} from './dist/detail-expansion-policy.js';
import {buildDetailPlan,detailCatalog,detailCategoryFromImage} from './dist/detail-page-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createServer} from './server.mjs';
import {normalizeDetailSizes,sizeParts} from './dist/detail-size-policy.js';
import {redrawWithZhipu} from './zhipu-edit.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');

test('Zhipu recognizes the unordered asset pool and receives visual design rules in its final request',async()=>{
 const calls=[];
 await redrawWithZhipu({source:{detailPage:true,ratio:'3:4'},bytes:png,prompt:buildDetailPlan('auto','',{count:6})[2].prompt,config:{baseUrl:'https://mock.test',apiKey:'mock',model:'glm-image'},signal:new AbortController().signal,onStage(){},fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  return url.endsWith('/chat/completions')?Response.json({choices:[{message:{content:'素材包括蓝色花型四件套全景、枕套工艺局部与面料近景，按主题选择照片。'}}]}):Response.json({data:[{b64_json:png.toString('base64')}]});
 }});
 assert.match(calls[0].messages[0].content.find(x=>x.type==='text').text,/independently of upload order/);
 assert.match(calls[1].prompt,/上传顺序、拼板格子位置和图片编号不代表页面顺序/);assert.match(calls[1].prompt,/部件示意和收纳插画/);assert.match(calls[1].prompt,/局部放大镜/);
});
test('detail generation saves only the output, accepts automatic planning and supports nondestructive editing',async()=>{
const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-detail-'));const calls=[];
const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider:'compatible',apiKey:'mock',baseUrl:'https://mock.test/v1',model:'gpt-image-2'},fetchImpl:async(url,options)=>{calls.push({url,form:options.body});return Response.json({data:[{b64_json:png.toString('base64')}]});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const post=(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});
const wait=async id=>{for(let i=0;i<100;i++){const j=await (await fetch(base+'/api/jobs/'+id)).json();if(['done','error','cancelled'].includes(j.status))return j;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
try{
assert.equal((await post('/api/detail-page',{image:'bad'})).status,400);
assert.equal((await post('/api/detail-page',{image:'data:image/png;base64,'+png.toString('base64'),prompt:'x'.repeat(2001)})).status,400);
const response=await post('/api/detail-page',{image:'data:image/png;base64,'+png.toString('base64'),prompt:'',count:6});assert.equal(response.status,202);
const task=await wait((await response.json()).id);assert.equal(task.status,'done');const original=task.results[0];assert.equal(original.detailPage,true);assert.equal(original.kind,'detail-page');assert.equal(original.detailBytes,undefined);assert.equal(original.parentNumber,undefined);
assert.equal(task.results.length,6);assert.equal(calls.length,6);assert.deepEqual(task.results.map(x=>x.detailSliceIndex),[0,1,2,3,4,5]);assert.equal(new Set(task.results.map(x=>x.batchId)).size,1);
assert.equal(calls[0].form.getAll('image[]').length,1);assert.match(calls[0].form.get('prompt'),/详情页/);assert.match(calls[0].form.get('prompt'),/无证据不写/);
for(const call of calls){assert.match(call.form.get('prompt'),/上传顺序、拼板格子位置和图片编号不代表页面顺序/);assert.match(call.form.get('prompt'),/每段都必须有清晰可见的商品图或相关图示/);assert.match(call.form.get('prompt'),/花型元素与色卡/);}
const edit=await post('/api/history/edit',{number:original.number,prompt:'调整第二段标题'});const edited=await wait((await edit.json()).id);assert.equal(edited.status,'done');assert.equal(edited.results[0].parentNumber,original.number);assert.equal(edited.results[0].detailPage,true);assert.match(calls[6].form.get('prompt'),/existing product detail page/);
const history=await (await fetch(base+'/api/history')).json();assert.equal(history.images.length,7);
const all=await post('/api/detail-page/edit',{numbers:task.results.map(x=>x.number),prompt:'统一标题颜色',referenceImage:'data:image/png;base64,'+png.toString('base64')});assert.equal(all.status,202);const full=await wait((await all.json()).id);assert.equal(full.status,'done');assert.equal(full.results.length,6);assert.equal(calls[7].form.getAll('image[]').length,2);assert.equal(full.results[0].editReferenceUsed,true);assert.deepEqual(full.results.map(x=>x.parentNumber),task.results.map(x=>x.number));
assert.equal((await post('/api/detail-page/edit',{numbers:[original.number,original.number],prompt:'edit'})).status,400);
assert.equal((await post('/api/detail-page/edit',{numbers:[999],prompt:'edit'})).status,400);assert.equal((await post('/api/detail-page/edit',{numbers:[original.number],prompt:'edit',referenceImage:'bad'})).status,400);
}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('all existing categories get six different evidence-based sections and stable subtype routing',()=>{assert.equal(detailCatalog.length,17);for(const item of detailCatalog){const plan=buildDetailPlan(item.id,'保留A面蓝色花型',{count:6});assert.equal(plan.length,6);assert.equal(new Set(plan.map(x=>x.title)).size,6);for(const part of plan){assert.match(part.prompt,/保留A面蓝色花型/);assert.match(part.prompt,/无证据不写/);assert.match(part.prompt,/仅生成第/);}}assert.equal(detailCategoryFromImage({product:'blanket',blanketVariant:'cloud'}),'blanket:cloud');assert.equal(detailCategoryFromImage({product:'sheet',sheetVariant:'quilted'}),'sheet:quilted');assert.throws(()=>buildDetailPlan('invalid'),/类别/);});

test('one to twenty-five distinct sections include only confirmed dimensions, with safe presets and custom validation',()=>{
 const sizes=[{part:'被套',dimensions:[200,230]},{part:'床单',dimensions:[240,245]},{part:'枕套',dimensions:[48,74]}];
 assert.deepEqual(sizeParts('set').map(x=>x.name),['被套','床单','枕套']);assert.equal(sizeParts('sheet:fitted')[0].height,true);
 for(let count=1;count<=25;count++){const plan=buildDetailPlan('set','',{count,sizes});assert.equal(plan.length,count);assert.equal(new Set(plan.map(p=>p.title)).size,count);assert.equal(plan.filter(p=>p.prompt.includes('用户已确认尺寸')).length,1);assert.match(plan.find(p=>p.prompt.includes('用户已确认尺寸')).prompt,/被套 200×230 cm；床单 240×245 cm；枕套 48×74 cm/);}
 assert.equal(buildDetailPlan().length,15);assert.ok(buildDetailPlan('set').every(x=>!x.prompt.includes('200×230')));
 for(const count of [0,26,1.5,'25'])assert.throws(()=>buildDetailPlan('set','',{count}));
 for(const dimensions of [[0,20],[200],[200,'230'],[Infinity,20]])assert.throws(()=>normalizeDetailSizes([{part:'被套',dimensions}]));
 assert.deepEqual(normalizeDetailSizes([...sizes,sizes[0]]),sizes);
});

test('upload recognition and twenty-five-slice generation carry confirmed sizes into saved outputs',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-detail-sizes-')),calls=[];
 const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider:'compatible',apiKey:'mock',baseUrl:'https://mock.test/v1',model:'gpt-image-2',visionModel:'mock-vision'},fetchImpl:async(url,options)=>{
  if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'{"category":"set","name":"四件套","confidence":"high"}'}}]});
  calls.push(options.body.get('prompt'));return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,image='data:image/png;base64,'+png.toString('base64');
 const post=(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});
 try{
  const recognized=await post('/api/detail-page/recognize',{image});assert.equal(recognized.status,200);assert.equal((await recognized.json()).category,'set');
  assert.equal((await post('/api/detail-page',{image,count:26})).status,400);
  assert.equal((await post('/api/detail-page',{image,sizes:[{part:'被套',dimensions:[0,10]}]})).status,400);
  const sizes=[{part:'被套',dimensions:[210,235]}];const refused=await post('/api/detail-page',{image,category:'set',count:25,materialCount:2});assert.equal(refused.status,409);assert.equal((await refused.json()).code,'DETAIL_EXPANSION_CONFIRM_REQUIRED');assert.equal(calls.length,0);assert.equal((await(await fetch(base+'/api/history')).json()).images.length,0);const res=await post('/api/detail-page',{image,category:'set',count:25,sizes,materialCount:2,expandMaterials:true});assert.equal(res.status,202);const created=await res.json();assert.equal(created.total,25);
  let job;for(let i=0;i<200;i++){job=await(await fetch(base+'/api/jobs/'+created.id)).json();if(['done','error'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(job.status,'done',job.error);assert.equal(job.results.length,25);assert.ok(job.results.every(x=>x.detailSliceCount===25&&x.detailExpandedMaterials&&x.detailMaterialCount===2));assert.ok(calls.every(x=>x.includes('用户已确认智能扩展素材')&&x.includes('不同距离或机位')&&x.includes('未知反面、隐藏连接与内部结构不补造')));assert.equal((await post('/api/detail-page/edit',{numbers:Array.from({length:26},(_,i)=>i+1),prompt:'edit'})).status,400);assert.deepEqual(job.results[0].detailSizes,sizes);assert.ok(calls.some(x=>x.includes('被套 210×235 cm')));
  const edit=await post('/api/detail-page/edit',{numbers:job.results.map(x=>x.number),prompt:'统一字号，保留尺寸'});assert.equal(edit.status,202);const editing=await edit.json();assert.equal(editing.total,25);
  let edited;for(let i=0;i<200;i++){edited=await(await fetch(base+'/api/jobs/'+editing.id)).json();if(['done','error'].includes(edited.status))break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(edited.status,'done',edited.error);assert.equal(edited.results.length,25);assert.deepEqual(edited.results[24].detailSizes,sizes);assert.equal(edited.results[24].detailExpandedMaterials,true);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('stopping a long detail job retains completed slices and does not submit later slices',async()=>{
const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-detail-stop-'));let calls=0;
const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider:'compatible',apiKey:'mock',baseUrl:'https://mock.test/v1',model:'gpt-image-2'},fetchImpl:async(url,options)=>{calls++;if(calls===2)await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));return Response.json({data:[{b64_json:png.toString('base64')}]});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const post=(url,data)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});
try{const res=await post('/api/detail-page',{image:'data:image/png;base64,'+png.toString('base64'),category:'sheet:fitted'}),id=(await res.json()).id;for(let i=0;i<100&&calls<2;i++)await new Promise(r=>setTimeout(r,10));assert.equal(calls,2);await post('/api/jobs/'+id+'/cancel',{});let task;for(let i=0;i<100;i++){task=await(await fetch(base+'/api/jobs/'+id)).json();if(task.status==='cancelled')break;await new Promise(r=>setTimeout(r,10));}assert.equal(task.status,'cancelled');assert.equal(task.results.length,1);assert.equal(calls,2);const history=await(await fetch(base+'/api/history')).json();assert.equal(history.images.length,1);assert.equal(history.images[0].detailCategory,'sheet:fitted');}
finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('material shortage threshold and explicit confirmation validation',()=>{
 assert.equal(detailExpansionRequired(2,4),false);assert.equal(detailExpansionRequired(2,5),true);assert.equal(detailExpansionRequired(0,25),false);assert.equal(detailExpansionRequired(13,25),false);
 assert.deepEqual(validateDetailExpansion({materialCount:2,count:25}),{required:true,confirmed:false});
 assert.deepEqual(validateDetailExpansion({materialCount:2,count:25,expandMaterials:true}),{required:true,confirmed:true});
 for(const materialCount of [0,-1,1.5,'2',1001])assert.throws(()=>validateDetailExpansion({materialCount,count:25}));
 assert.throws(()=>validateDetailExpansion({materialCount:2,count:25,expandMaterials:'true'}));assert.throws(()=>validateDetailExpansion({count:25,expandMaterials:true}));
 assert.ok(buildDetailPlan('set','',{count:25}).every(x=>!x.prompt.includes('用户已确认智能扩展素材')));
});
