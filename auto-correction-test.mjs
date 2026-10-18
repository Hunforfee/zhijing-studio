import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',png=Buffer.from(image.split(',')[1],'base64');
const input={product:'set',fabric:'cotton',scenes:['warm'],angles:['front','side'],size:'普通平床单：自然外垂',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,imageB:image,autoReview:true};
async function fixture(provider,fn,{assessment=()=>({}),visionModel='vision-fixture',reviewStatus=200}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'zhijing-every-review-')),images=[],reviews=[];
 const server=createServer({outputDir:dir,firstImageReview:false,stylingReferencePaths:[],service:{provider,apiKey:'synthetic-every-review',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image',visionModel},fetchImpl:async(url,init)=>{
 if(url.endsWith('/chat/completions')){const request=JSON.parse(init.body);if(request.messages[0].role!=='system')return Response.json({choices:[{message:{content:'{"fabricA":"blue floral","fabricB":"yellow dots"}'}}]});reviews.push(request);const keys=JSON.parse(request.messages[0].content.split('Required complete JSON shape (choose ONE valid status per item): ')[1].split('. Every key')[0]);const overrides=assessment(reviews.length,request),checks=Object.fromEntries(Object.keys(keys.checks).map(key=>[key,{status:'pass',evidence:'Visible '+key+' agrees with the original fabrics and selected structure'}]));return Response.json({choices:[{message:{content:JSON.stringify({checks:{...checks,...overrides}})}}]},{status:typeof reviewStatus==='function'?reviewStatus(reviews.length):reviewStatus});}
 images.push(init.body);return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 const post=async(data)=>{const response=await fetch(root+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,...data})});return {httpStatus:response.status,...await response.json()}};
 const poll=async id=>{for(let n=0;n<200;n++){const job=await(await fetch(root+'/api/jobs/'+id)).json();if(['done','error','cancelled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,10));}throw Error('timeout')};
 try{await fn({dir,root,post,poll,images,reviews});}finally{await new Promise(r=>server.close(r));assert.ok(dir.startsWith(path.join(tmpdir(),'zhijing-every-review-')));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
}
for(const provider of ['sub2api','zhipu'])test(provider+' checks every image, fixes crossed A/B, audits again and publishes only approved candidates',()=>fixture(provider,async({post,poll,images,reviews,root,dir})=>{
 const created=await post();assert.equal(created.httpStatus,202);const job=await poll(created.id);assert.equal(job.status,'done',job.error);assert.equal(images.length,3);assert.equal(reviews.length,3);assert.equal(job.results.length,2);assert.ok(job.results.every(r=>r.reviewStatus==='approved'));assert.equal(job.results[0].repairAttempts,1);assert.match(job.results[0].url,/1-repair-1/);
 const corrected=provider==='sub2api'?images[1].get('prompt'):JSON.parse(images[1]).prompt;assert.match(corrected,/自动修正/);assert.match(corrected,/A print leaks onto the exposed B reverse/);
 if(provider==='sub2api')for(const form of images)assert.ok(!form.getAll('image[]').some(i=>/first-product|repair/.test(i.name)));
 assert.equal((await(await fetch(root+'/api/history')).json()).images.length,2);assert.equal((await readdir(path.join(dir,created.id,'review-candidates'))).length,3);
 assert.ok(reviews.every(r=>r.messages[1].content.filter(c=>c.type==='image_url').length===3));
},{assessment:n=>n===1?{panelAssignment:{status:'fail',evidence:'A print leaks onto the exposed B reverse at right duvet fold'}}:{}}));
test('selected craft is checked independently and uploaded edge reference reaches the reviewer',()=>fixture('sub2api',async({post,poll,reviews,images})=>{
 const created=await post({angles:['front'],size:'被套外缘4至6厘米；普通平床单：自然外垂；每只枕套简约细缝边',craftReferences:{'wide-flange':image}});assert.equal(created.httpStatus,202);const job=await poll(created.id);assert.equal(job.status,'done',job.error);assert.equal(images.length,2);assert.match(reviews[0].messages[0].content,/duvetCraft/);assert.equal(reviews[0].messages[1].content.filter(i=>i.type==='image_url').length,4);assert.equal(job.results[0].reviewChecks.duvetCraft.status,'pass');
},{assessment:n=>n===1?{duvetCraft:{status:'fail',evidence:'Left duvet edge is piping, missing selected flat wide flange'}}:{}}));
for(const outcome of ['fail','unknown'])test(outcome+' publishes each repaired version after one attempt and continues the batch',()=>fixture('sub2api',async({post,poll,images,root})=>{
 const created=await post();const job=await poll(created.id);assert.equal(job.status,'done',job.error);assert.equal(images.length,4);assert.equal(job.results.length,2);assert.ok(job.results.every(r=>r.repairAttempts===1&&r.reviewAcceptedAfterRepair));assert.ok(job.results.every(r=>r.reviewStatus===(outcome==='fail'?'rejected':'unverified')));assert.ok(job.results.every(r=>r.url.includes('-repair-1.')));const history=(await(await fetch(root+'/api/history')).json()).images;assert.equal(history.length,2);assert.ok(history.every(r=>r.reviewAcceptedAfterRepair));
},{assessment:()=>({panelAssignment:{status:outcome,evidence:'Visible B reverse does not match, or cannot be identified'}})}));
test('review service failure stops without further image requests',()=>fixture('sub2api',async({post,poll,images})=>{const created=await post();const job=await poll(created.id);assert.equal(job.status,'error');assert.equal(images.length,1);assert.equal(job.results.length,0);},{reviewStatus:503}));
test('missing vision setup is rejected before generating, and switching off keeps normal generation',()=>fixture('sub2api',async({post,poll,images,reviews})=>{
 assert.equal((await post()).httpStatus,400);assert.equal(images.length,0);const created=await post({autoReview:false});const job=await poll(created.id);assert.equal(job.status,'done',job.error);assert.equal(images.length,2);assert.equal(reviews.length,0);
},{visionModel:''}));



test('stopping during review aborts without publishing or generating another image',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'zhijing-review-stop-'));let images=0,reviews=0;
 const server=createServer({outputDir:dir,firstImageReview:false,service:{provider:'sub2api',apiKey:'synthetic-review-stop',baseUrl:'https://example.test/v1',model:'test-image',visionModel:'vision-fixture'},fetchImpl:async(url,init)=>{
 if(url.endsWith('/chat/completions')){reviews++;await new Promise((resolve,reject)=>{if(init.signal.aborted)return reject(init.signal.reason);init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});});}
 images++;return Response.json({data:[{b64_json:png.toString('base64')}]});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 try{const created=await(await fetch(root+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json();let job;for(let n=0;n<100;n++){job=await(await fetch(root+'/api/jobs/'+created.id)).json();if(reviews)break;await new Promise(r=>setTimeout(r,10));}assert.equal(reviews,1);await fetch(root+'/api/jobs/'+created.id+'/cancel',{method:'POST'});for(let n=0;n<100;n++){job=await(await fetch(root+'/api/jobs/'+created.id)).json();if(job.status==='cancelled')break;await new Promise(r=>setTimeout(r,10));}assert.equal(job.status,'cancelled');assert.equal(images,1);assert.equal(job.results.length,0);assert.equal((await(await fetch(root+'/api/history')).json()).images.length,0);}finally{await new Promise(r=>server.close(r));assert.ok(dir.startsWith(path.join(tmpdir(),'zhijing-review-stop-')));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});

test('unavailable second audit still publishes the repaired image and continues',()=>fixture('sub2api',async({post,poll,images,reviews})=>{
 const created=await post({angles:['front']});const job=await poll(created.id);assert.equal(job.status,'done',job.error);assert.equal(images.length,2);assert.equal(reviews.length,2);assert.equal(job.results[0].reviewStatus,'error');assert.equal(job.results[0].reviewAcceptedAfterRepair,true);assert.equal(job.results[0].repairAttempts,1);
},{assessment:()=>({panelAssignment:{status:'fail',evidence:'A print on B reverse at right fold'}}),reviewStatus:n=>n===1?200:503}));
