import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {parseFirstImageReview} from './first-image-review.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const input={product:'set',fabric:'cotton',scenes:['warm'],angles:['front','reverse'],size:'普通平床单：自然外垂',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,imageB:image};
const assessment=(status='pass')=>JSON.stringify({checks:{panelAssignment:{status:'pass',evidence:'visible front A and reverse B'},seamBoundary:{status,evidence:'right turnover sewn edge'},componentStructure:{status:'pass',evidence:'independent cover and flat sheet'}}});
async function fixture(provider,fn,reviewEnabled=true){
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-auto-review-')),sent=[],reviews=[],png=Buffer.from(image.split(',')[1],'base64');
  let release,reviewBody=assessment(),reviewStatus=200,delay=false;
  const server=createServer({...(reviewEnabled?{firstImageReview:true}:{}),outputDir,stylingReferencePaths:[],service:{apiKey:'synthetic',provider,baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'gpt-image-2',visionModel:'vision-fixture'},fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions')){
      const request=JSON.parse(init.body);
      if(request.messages[0].role!=='system')return Response.json({choices:[{message:{content:'blue floral print'}}]});
      reviews.push(request);
      if(delay)await new Promise((resolve,reject)=>{release=resolve;init.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true});});
      return Response.json({choices:[{message:{content:typeof reviewBody==='function'?reviewBody(reviews.length):reviewBody}}]},{status:reviewStatus});
    }
    sent.push(init.body);return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const post=async(route,data)=>fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data||{})});
  const poll=async(id,predicate)=>{for(let n=0;n<150;n++){const job=await(await fetch(base+'/api/jobs/'+id)).json();if(predicate(job))return job;await new Promise(r=>setTimeout(r,10));}throw Error('review test timeout');};
  try{await fn({post,poll,sent,reviews,png,base,outputDir,release:()=>release?.(),configure:opts=>{reviewBody=opts.body??reviewBody;reviewStatus=opts.status??reviewStatus;delay=opts.delay??delay;}});}finally{
    const active=await(await fetch(base+'/api/jobs/active')).json();if(active)await post('/api/jobs/'+active.id+'/cancel');
    await new Promise(r=>setTimeout(r,20));await new Promise(r=>server.close(r));
    assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep+'zhijing-auto-review-'));
    await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:50});
  }
}
for(const provider of ['sub2api','zhipu'])test(provider+' compares first image and original A/B in the backend; approval automatically releases later generation',()=>fixture(provider,async({post,poll,sent,reviews,png,configure,release,outputDir})=>{
  configure({delay:true});const id=(await(await post('/api/jobs',{...input,firstImageReview:false})).json()).id;
  const held=await poll(id,j=>j.review?.status==='checking');assert.equal(sent.length,1);assert.equal(held.results.length,1);
  const queued=await post('/api/jobs',input);assert.equal(queued.status,202);await post('/api/jobs/'+(await queued.json()).id+'/cancel');
  assert.equal((await post('/api/jobs/'+id+'/review',{decision:'approve',number:held.review.number})).status,405);
  assert.equal(reviews[0].messages[1].content.filter(c=>c.type==='image_url').length,3);
  assert.ok(reviews[0].messages[1].content[2].image_url.url.endsWith(png.toString('base64')));
  release();const done=await poll(id,j=>j.status==='done');assert.equal(done.review.status,'approved');assert.equal(sent.length,2);assert.equal(reviews.length,1);
  const saved=JSON.parse(await readFile(path.join(outputDir,id,'first-image-review.json'),'utf8'));assert.equal(saved.status,'approved');
  if(provider==='sub2api')assert.ok(sent[1].getAll('image[]').some(file=>file.name==='first-product-photo.png'));
}));
for(const [name,body,status] of [['crossed seam',assessment('fail'),200],['unclear seam',assessment('unknown'),200],['malformed response','approved',200],['service failure',assessment(),503]])test(name+' stops after bounded repairs or an unavailable assessment and preserves the candidate',()=>fixture('sub2api',async({post,poll,sent,configure})=>{
  configure({body,status});const id=(await(await post('/api/jobs',input)).json()).id,done=await poll(id,j=>j.status==='error');
  assert.equal(sent.length,name==='service failure'?1:3);assert.equal(done.results.length,1);assert.notEqual(done.review.status,'approved');assert.ok(done.error);
}));
for(const provider of ['sub2api','zhipu'])test(provider+' automatically repairs rejected first image, audits again and continues with the approved reference',()=>fixture(provider,async({post,poll,sent,reviews,configure,base})=>{
  configure({body:n=>assessment(n===1?'fail':'pass')});
  const id=(await(await post('/api/jobs',input)).json()).id,done=await poll(id,j=>j.status==='done');
  assert.equal(sent.length,3);assert.equal(reviews.length,2);assert.equal(done.results.length,2);assert.match(done.results[0].url,/1-repair-1/);
  assert.equal((await fetch(base+done.results[0].url)).status,200);
  const prompt=provider==='sub2api'?sent[1].get('prompt'):JSON.parse(sent[1]).prompt;
  assert.match(prompt,/自动修正/);assert.match(prompt,/right turnover sewn edge/);
  if(provider==='sub2api')assert.ok(!sent[1].getAll('image[]').some(f=>f.name==='first-product-photo.png'));
}));
const wideInput={...input,size:'三组同时满足：被套外缘4至6厘米平整单层宽边，有内侧压线、不填充不抽褶；普通平床单：自然外垂；两只枕套简约细缝边。'};
for(const provider of ['sub2api','zhipu'])test(provider+' normal website skips all candidate reviews and continues even for selected wide flanges',()=>fixture(provider,async({post,poll,sent,reviews,base})=>{
  const id=(await(await post('/api/jobs',{...wideInput,firstImageReview:true})).json()).id,done=await poll(id,j=>j.status!=='running');
  assert.equal(done.status,'done',done.error);assert.equal(sent.length,2);assert.equal(reviews.length,0);assert.equal(done.review,null);
  const prompt=provider==='sub2api'?sent[0].get('prompt'):JSON.parse(sent[0]).prompt;
  assert.match(prompt,/被套必须有宽边/);
  const status=await(await fetch(base+'/api/status')).json();assert.equal(status.firstImageReviewEnabled,false);assert.equal(status.firstImageReviewMode,'disabled');
},false));
const craftAssessment=status=>{const data=JSON.parse(assessment());data.checks.duvetCraft={status,evidence:status==='pass'?'duvet foot has an inset seam and flat unfilled strip':'duvet foot has only a narrow seam, no flat flange'};return JSON.stringify(data);};
for(const provider of ['sub2api','zhipu'])test(provider+' retries incomplete craft review on the same image and continues without regenerating an already good first image',()=>fixture(provider,async({post,poll,sent,reviews,configure})=>{
  configure({body:n=>n===1?assessment():craftAssessment('pass')});
  const id=(await(await post('/api/jobs',wideInput)).json()).id,done=await poll(id,j=>j.status!=='running');
  assert.equal(done.status,'done',done.error);assert.equal(sent.length,2);assert.equal(reviews.length,3);
  assert.deepEqual(reviews[0].messages[1].content,reviews[1].messages[1].content);
  assert.match(reviews[1].messages[0].content,/审核缺少有效检查项：duvetCraft/);
  assert.match(reviews[0].messages[0].content,/"duvetCraft":\{"status"/);
  assert.doesNotMatch(done.results[0].url,/repair/);
}));
test('invalid JSON is rechecked before any paid candidate regeneration',()=>fixture('sub2api',async({post,poll,sent,reviews,configure})=>{
  configure({body:n=>n===1?'approved':assessment()});
  const id=(await(await post('/api/jobs',input)).json()).id,done=await poll(id,j=>j.status!=='running');
  assert.equal(done.status,'done',done.error);assert.equal(sent.length,2);assert.equal(reviews.length,2);assert.equal(done.review.reviewAttempts,2);
}));
test('permanently incomplete reviews enter bounded repairs and never auto-pass',()=>fixture('sub2api',async({post,poll,sent,reviews,configure})=>{
  configure({body:assessment()});
  const id=(await(await post('/api/jobs',wideInput)).json()).id,done=await poll(id,j=>j.status==='error');
  assert.equal(sent.length,3);assert.equal(reviews.length,9);assert.equal(done.review.status,'unverified');assert.equal(done.review.checks.duvetCraft.status,'unknown');
  assert.match(done.error,/连续三次未返回完整结论/);
}));
test('single wide-flange image requires its own duvet craft check and is repaired automatically',()=>fixture('sub2api',async({post,poll,sent,reviews,configure})=>{
  configure({body:n=>craftAssessment(n===1?'fail':'pass')});
  const id=(await(await post('/api/jobs',{...wideInput,angles:['front']})).json()).id,done=await poll(id,j=>j.status==='done');
  assert.equal(sent.length,2);assert.equal(done.review.checks.duvetCraft.status,'pass');assert.match(sent[0].get('prompt'),/被套必须有宽边/);
  assert.match(reviews[0].messages[0].content,/pillow-only flange/);
}));
test('later wide-flange images are reviewed and corrected too',()=>fixture('sub2api',async({post,poll,sent,reviews,configure})=>{
  configure({body:n=>craftAssessment(n===2?'fail':'pass')});
  const id=(await(await post('/api/jobs',wideInput)).json()).id,done=await poll(id,j=>j.status==='done');
  assert.equal(sent.length,3);assert.equal(reviews.length,3);assert.match(done.results[1].url,/2-repair-1/);
}));
test('a missing or skipped selected craft cannot approve the image',()=>{
  assert.throws(()=>parseFirstImageReview(assessment(),true,['duvetCraft']));
  assert.throws(()=>parseFirstImageReview(craftAssessment('not_applicable'),true,['duvetCraft']));
  assert.equal(parseFirstImageReview(craftAssessment('fail'),true,['duvetCraft']).status,'rejected');
});
test('cancel while checking aborts the assessment without a second image request',()=>fixture('sub2api',async({post,poll,sent,configure})=>{
  configure({delay:true});const id=(await(await post('/api/jobs',input)).json()).id;await poll(id,j=>j.review?.status==='checking');
  await post('/api/jobs/'+id+'/cancel');const done=await poll(id,j=>j.status==='cancelled');assert.equal(sent.length,1);assert.equal(done.review.status,'cancelled');
}));
test('single sets and other product batches do not start this four-piece first-image review',()=>fixture('sub2api',async({post,poll,reviews})=>{
  for(const request of [{...input,angles:['front']},{...input,product:'sheet',sheetVariant:'flat'}]){const id=(await(await post('/api/jobs',request)).json()).id;await poll(id,j=>j.status==='done');}
  assert.equal(reviews.length,0);
}));
test('parser never treats missing, skipped A/B or uncertain checks as approval',()=>{
  assert.throws(()=>parseFirstImageReview('{}',true));assert.equal(parseFirstImageReview(assessment('unknown'),true).status,'unverified');
  assert.throws(()=>parseFirstImageReview(assessment('not_applicable'),true));assert.equal(parseFirstImageReview(assessment('not_applicable'),false).status,'approved');
});
test('page contains no manual approval controls or review submissions',async()=>{
  const source=await readFile('dist/app.js','utf8');assert.ok(!source.includes('approveFirstImage'));assert.ok(!source.includes('rejectFirstImage'));assert.ok(!source.includes("'/review'"));
});
