import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {createImageHistory} from './image-history.mjs';
import {groupHistoryImages} from './dist/history-groups.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const service={provider:'compatible',apiKey:'test-secret',baseUrl:'https://example.test/v1',model:'gpt-image-2'};
const input={product:'set',fabric:'cotton',scenes:['warm'],angles:['front'],size:'1.8m',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'4:3',notes:'',image:'data:image/png;base64,'+png.toString('base64')};
test('history groups every generation, sorts batches newest first and preserves original image numbering',()=>{
  const images=[{number:5,jobId:'edit',kind:'edited',parentNumber:1},{number:4,jobId:'second',createdAt:'2026-10-03T01:00:00Z'},{number:3,jobId:'second'},{number:2,jobId:'first'},{number:1,jobId:'first',createdAt:'2026-10-02T01:00:00Z'}];
  const before=JSON.stringify(images),groups=groupHistoryImages(images);
  assert.deepEqual(groups.map(g=>g.id),['first','second']);assert.deepEqual(groups.map(g=>g.images.map(r=>r.number)),[[5,2,1],[3,4]]);assert.equal(groups[0].cover.number,5);assert.equal(groups[0].original.number,1);assert.equal(groups[0].createdAt,images[4].createdAt);assert.equal(JSON.stringify(images),before);assert.deepEqual(groupHistoryImages([]),[]);
  const legacy=groupHistoryImages([{number:1,url:'/generated/old/1.png'},{number:2,url:'/generated/old/2.png'}]);assert.equal(legacy.length,1);assert.equal(legacy[0].images.length,2);
});
test('repeated edits and edits of sibling originals stay together with latest edits at original positions before historical versions',()=>{
  const images=[{number:1,jobId:'first'},{number:2,jobId:'first'},{number:3,jobId:'unrelated'},
    {number:4,jobId:'edit-one',kind:'edited',parentNumber:2},
    {number:5,jobId:'edit-again',kind:'edited',parentNumber:4},
    {number:6,jobId:'edit-sibling',kind:'edited',parentNumber:1}];
  const groups=groupHistoryImages(images);
  assert.deepEqual(groups.map(group=>group.images.map(image=>image.number)),[[6,5,4,2,1],[3]]);
  assert.equal(groups[0].original.number,1);
  assert.equal(groupHistoryImages([{number:7,jobId:'orphan',kind:'edited',parentNumber:99}])[0].cover.number,7);
});
async function fixture(fn,options={}){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-history-'));
  let server,base;
  const start=async()=>{server=createServer({outputDir,service,stylingReferencePaths:[],fetchImpl:async()=>Response.json({data:[{b64_json:png.toString('base64')}]}),...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;};
  const stop=async()=>{await new Promise(r=>server.close(r));server=null;};
  const get=async route=>(await fetch(base+route)).json();
  const post=async(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});
  const wait=async id=>{for(let i=0;i<100;i++){const j=await get('/api/jobs/'+id);if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,10));}throw Error('job timeout');};
  try{await start();await fn({outputDir,get,post,wait,restart:async()=>{await stop();await start();}});}finally{if(server)await stop();assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-history-'));await rm(outputDir,{recursive:true,force:true});}
}
test('generated photos and edited descendants retain numbers, prompts and original bytes across restart',async()=>{
  let editRequest;
  await fixture(async({post,get,wait,restart,outputDir})=>{
    const initial=await post('/api/jobs',input);assert.equal(initial.status,202);const job=await wait((await initial.json()).id);assert.equal(job.status,'done',job.error);assert.equal(job.results[0].number,1);
    const first=(await get('/api/history')).images[0];assert.equal(first.kind,'generated');assert.equal(first.ratio,'4:3');
    const response=await post('/api/history/edit',{number:1,prompt:'将背景改为浅蓝色，保留花型'});assert.equal(response.status,202);const edited=await wait((await response.json()).id);assert.equal(edited.status,'done',edited.error);assert.equal(edited.results[0].number,2);
    assert.equal(editRequest.getAll('image[]').length,1);assert.deepEqual(Buffer.from(await editRequest.get('image[]').arrayBuffer()),png);assert.match(editRequest.get('prompt'),/将背景改为浅蓝色/);assert.equal(editRequest.get('size'),'1344x1008');
    await restart();const images=(await get('/api/history')).images;assert.deepEqual(images.map(i=>i.number),[2,1]);assert.equal(images[0].parentNumber,1);assert.equal(images[0].editPrompt,'将背景改为浅蓝色，保留花型');assert.ok(!JSON.stringify(images).includes('test-secret'));
    assert.deepEqual(await readFile(path.join(outputDir,first.url.slice('/generated/'.length))),png);
    const again=await post('/api/history/edit',{number:2,prompt:'调整光线'});const next=await wait((await again.json()).id);assert.equal(next.results[0].number,3);assert.equal(next.results[0].parentNumber,2);
  },{fetchImpl:async(url,init)=>{if(init.body.get('prompt').startsWith('Edit '))editRequest=init.body;return Response.json({data:[{b64_json:png.toString('base64')}]});}});
});
test('editing references follow the source image in multipart requests and invalid references are rejected',async()=>{
  let request;
  await fixture(async({post,get,wait,restart})=>{
    await post('/api/history',{image:input.image});
    for(const referenceImage of ['invalid',input.image.replace('image/png','image/jpeg'),'data:image/png;base64,'+Buffer.alloc(24).toString('base64')]){
      assert.equal((await post('/api/history/edit',{number:1,prompt:'参考第二张图的场景',referenceImage})).status,400);
    }
    const response=await post('/api/history/edit',{number:1,prompt:'参考第二张图的场景',referenceImage:input.image});assert.equal(response.status,202);
    const edited=await wait((await response.json()).id);assert.equal(edited.status,'done',edited.error);
    const files=request.getAll('image[]');assert.equal(files.length,2);assert.equal(files[0].name,'image-1.png');assert.equal(files[1].name,'edit-reference.png');assert.deepEqual(Buffer.from(await files[1].arrayBuffer()),png);
    assert.match(request.get('prompt'),/Image 2 is a separate auxiliary editing reference/);assert.match(request.get('prompt'),/参考第二张图的场景/);
    await restart();assert.equal((await get('/api/history')).images[0].editReferenceUsed,true);
    const again=await post('/api/history/edit',{number:2,prompt:'只调整光线'});const next=await wait((await again.json()).id);assert.equal(next.status,'done');assert.equal(request.getAll('image[]').length,1);assert.equal(next.results[0].editReferenceUsed,false);
  },{fetchImpl:async(url,init)=>{request=init.body;return Response.json({data:[{b64_json:png.toString('base64')}]});}});
});
test('legacy image import and concurrent archives use stable unique numbers',async()=>{
  await fixture(async({outputDir,get,restart,post})=>{
    await get('/api/history');
    const dir=path.join(outputDir,'00000000-0000-4000-8000-000000000001');await mkdir(dir);await writeFile(path.join(dir,'1.png'),png);
    await restart();assert.equal((await get('/api/history')).images[0].kind,'imported');
    const responses=await Promise.all(Array.from({length:5},()=>post('/api/history',{image:input.image,ratio:'1:1'})));assert.ok(responses.every(r=>r.status===201));
    const images=(await get('/api/history')).images;assert.deepEqual(images.map(i=>i.number),[6,5,4,3,2,1]);await restart();assert.deepEqual((await get('/api/history')).images,images);
    const history=createImageHistory(outputDir);await history.list();await assert.rejects(()=>history.bytes({url:'/generated/../../server.mjs'}),/路径/);
  });
});
test('edit validation and provider failures preserve the source and create no history result',async()=>{
  await fixture(async({post,get,wait})=>{
    await post('/api/history',{image:input.image});
    for(const data of [{number:0,prompt:'edit'},{number:1.5,prompt:'edit'},{number:1,prompt:' '},{number:1,prompt:'a'.repeat(2001)}])assert.equal((await post('/api/history/edit',data)).status,400);
    assert.equal((await post('/api/history/edit',{number:999,prompt:'edit'})).status,404);
    const edit=await post('/api/history/edit',{number:1,prompt:'edit'});const job=await wait((await edit.json()).id);assert.equal(job.status,'error');assert.equal((await get('/api/history')).images.length,1);
    await post('/api/service',{provider:'zhipu',apiKey:'test-zhipu',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'});
    const redraw=await post('/api/history/edit',{number:1,prompt:'edit'});assert.equal(redraw.status,202);assert.equal((await wait((await redraw.json()).id)).status,'error');assert.equal((await get('/api/history')).images.length,1);
  },{fetchImpl:async()=>Response.json({error:{message:'failure'}},{status:502})});
});
test('local previews and their edits share one archive after restart',async()=>{
  await fixture(async({post,get,wait,restart})=>{
    const batchId='00000000-0000-4000-8000-000000000002';
    for(let i=0;i<3;i++)assert.equal((await post('/api/history',{image:input.image,batchId})).status,201);
    assert.equal((await post('/api/history',{image:input.image,batchId:'../invalid'})).status,400);
    let groups=groupHistoryImages((await get('/api/history')).images);assert.equal(groups.length,1);assert.equal(groups[0].images.length,3);
    const response=await post('/api/history/edit',{number:2,prompt:'change background'});assert.equal((await wait((await response.json()).id)).status,'done');
    await restart();groups=groupHistoryImages((await get('/api/history')).images);assert.equal(groups.length,1);assert.equal(groups[0].cover.number,1);assert.deepEqual(groups[0].images.map(image=>image.number),[1,4,3,2]);assert.equal(groups[0].original.batchId,batchId);
  });
});
test('single and group deletion retain bytes and lineage, restore original numbers after restart',async()=>{
  await fixture(async({post,get,wait,restart,outputDir})=>{
    const batchId='00000000-0000-4000-8000-000000000007';
    for(let i=0;i<2;i++)await post('/api/history',{image:input.image,batchId});
    const edit=await post('/api/history/edit',{number:1,prompt:'adjust lighting'});await wait((await edit.json()).id);
    assert.equal((await post('/api/history/delete',{number:1})).status,200);
    let archive=await get('/api/history');assert.deepEqual(archive.images.map(r=>r.number),[3,2]);assert.deepEqual(archive.trash.map(r=>r.number),[1]);
    assert.equal(groupHistoryImages([...archive.images,...archive.trash]).length,1);
    assert.equal((await post('/api/history/edit',{number:1,prompt:'edit'})).status,404);
    assert.equal((await post('/api/history/delete',{groupId:batchId})).status,200);
    await restart();archive=await get('/api/history');assert.equal(archive.images.length,0);assert.deepEqual(archive.trash.map(r=>r.number),[3,2,1]);
    assert.deepEqual(await readFile(path.join(outputDir,archive.trash[0].url.slice('/generated/'.length))),png);
    assert.equal((await post('/api/history/restore',{number:3})).status,200);assert.deepEqual((await get('/api/history')).images.map(r=>r.number),[3]);
    assert.equal((await post('/api/history/restore',{groupId:batchId})).status,200);
    archive=await get('/api/history');assert.equal(archive.trash.length,0);assert.deepEqual(groupHistoryImages(archive.images)[0].images.map(r=>r.number),[3,2,1]);
    await restart();assert.equal((await get('/api/history')).trash.length,0);
    for(const route of ['delete','restore']){
      assert.equal((await post('/api/history/'+route,{number:999})).status,404);
      assert.equal((await post('/api/history/'+route,{number:0})).status,400);
      assert.equal((await post('/api/history/'+route,{groupId:'missing'})).status,404);
    }
  });
});
test('edit cancellation stops upstream and keeps the original history',async()=>{
  let entered;const called=new Promise(r=>entered=r);
  await fixture(async({post,get,wait})=>{
    await post('/api/history',{image:input.image});const response=await post('/api/history/edit',{number:1,prompt:'edit'});const {id}=await response.json();await called;
    const other=await post('/api/history/edit',{number:1,prompt:'other'});assert.equal(other.status,202);const otherId=(await other.json()).id;assert.equal((await get('/api/jobs/'+otherId)).status,'queued');await post('/api/jobs/'+otherId+'/cancel',{});
    const queued=await post('/api/jobs',input);assert.equal(queued.status,202);const pending=(await queued.json()).id;assert.equal((await get('/api/jobs/'+pending)).status,'queued');await post('/api/jobs/'+pending+'/cancel',{});
    assert.equal((await post('/api/jobs/'+id+'/cancel',{})).status,200);assert.equal((await wait(id)).status,'cancelled');assert.equal((await get('/api/history')).images.length,1);
  },{fetchImpl:async(url,{signal})=>{entered();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
});
test('generation queue accepts new jobs during generation, cancels waiting work and continues after failure in FIFO order',async()=>{
  let enter,release;const entered=new Promise(resolve=>enter=resolve),gate=new Promise(resolve=>release=resolve);let calls=0,active=0,peak=0;const prompts=[];
  await fixture(async({post,get,wait})=>{
    const first=(await(await post('/api/jobs',{...input,notes:'first-task'})).json()).id;await entered;
    const second=(await(await post('/api/jobs',{...input,notes:'cancelled-task'})).json()).id;
    const third=(await(await post('/api/jobs',{...input,notes:'third-task',ratio:'3:4'})).json()).id;
    const fourth=(await(await post('/api/jobs',{...input,notes:'fourth-task'})).json()).id;
    assert.equal((await get('/api/jobs/'+second)).status,'queued');assert.equal((await get('/api/jobs/'+third)).queuePosition,2);
    await post('/api/jobs/'+second+'/cancel',{});assert.equal((await get('/api/jobs/'+second)).status,'cancelled');assert.equal((await get('/api/jobs/'+third)).queuePosition,1);
    release();assert.equal((await wait(first)).status,'error');
    for(const id of [third,fourth]){for(let i=0;i<100;i++){const job=await get('/api/jobs/'+id);if(!['running','queued'].includes(job.status)){assert.equal(job.status,'done',job.error);break;}await new Promise(resolve=>setTimeout(resolve,15));}}
    assert.equal((await get('/api/jobs/'+third)).results[0].ratio,'3:4');assert.equal((await get('/api/jobs/'+fourth)).status,'done');
    assert.equal(peak,1);assert.equal(calls,3);assert.match(prompts[1],/third-task/);assert.match(prompts[2],/fourth-task/);assert.ok(prompts.every(prompt=>!prompt.includes('cancelled-task')));
  },{fetchImpl:async(url,init)=>{active++;peak=Math.max(peak,active);const call=++calls;prompts.push(init.body.get('prompt'));try{if(call===1){enter();await gate;return new Response('failed',{status:503});}return Response.json({data:[{b64_json:png.toString('base64')}]});}finally{active--;}}});
});


test('GPT Image 2.5 routes generation to Sunburst and repeated sibling edits to Sunburst',async()=>{
  const calls=[];
  await fixture(async({post,wait,get})=>{
    const generated=await post('/api/jobs',{...input,autoReview:true});
    const original=await wait((await generated.json()).id);assert.equal(original.status,'done',original.error);
    for(const number of [original.results[0].number,original.results[0].number]){
      const response=await post('/api/history/edit',{number,prompt:'调整灯光'});
      const result=await wait((await response.json()).id);assert.equal(result.status,'done',result.error);
      assert.equal(result.results[0].parentNumber,number);
    }
    assert.deepEqual(calls.map(c=>c.model),['gpt-image-2.5-sunburst','gpt-image-2.5-sunburst','gpt-image-2.5-sunburst']);
    assert.ok(calls.every(c=>c.url==='https://example.test/v1/images/edits'));
    assert.equal((await get('/api/status')).model,'gpt-image-2.5-flare');assert.equal((await get('/api/status')).generationModel,'gpt-image-2.5-sunburst');assert.equal((await get('/api/status')).autoReviewSupported,undefined);
    assert.equal((await get('/api/history')).images.length,3);
    const alternate=await post('/api/jobs',{...input,generationModel:'gpt-image-2.5-sunburst'});
    assert.equal((await wait((await alternate.json()).id)).status,'done');
    assert.equal(calls.at(-1).model,'gpt-image-2.5-sunburst');
    const next=await post('/api/jobs',input);assert.equal((await wait((await next.json()).id)).status,'done');
    assert.equal(calls.at(-1).model,'gpt-image-2.5-sunburst');
    assert.equal((await post('/api/jobs',{...input,generationModel:'untrusted-model'})).status,400);
  },{service:{...service,provider:'sub2api',model:'gpt-image-2.5-flare'},fetchImpl:async(url,init)=>{
    calls.push({url,model:init.body.get('model')});
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
});

test('secondary edits share FIFO queue, wait without upstream requests and preserve originals',async()=>{
 let entered,release;const gate=new Promise(r=>release=r),called=new Promise(r=>entered=r);let calls=0,active=0,peak=0;const prompts=[];
 await fixture(async({post,get,wait})=>{
  await post('/api/history',{image:input.image});
  const first=(await (await post('/api/history/edit',{number:1,prompt:'first'})).json()).id;await called;
  const second=(await (await post('/api/history/edit',{number:1,prompt:'second'})).json()).id;
  const third=(await (await post('/api/history/edit',{number:1,prompt:'cancelled'})).json()).id;
  assert.equal((await get('/api/jobs/'+second)).status,'queued');assert.equal((await get('/api/jobs/'+second)).queuePosition,1);assert.equal(calls,1);
  await post('/api/jobs/'+third+'/cancel',{});release();assert.equal((await wait(first)).status,'done');assert.equal((await wait(second)).status,'done');assert.equal((await get('/api/jobs/'+third)).status,'cancelled');assert.equal((await get('/api/history')).images.length,3);assert.ok((await get('/api/jobs/'+second)).elapsedMs>=0);
 },{fetchImpl:async(url,init)=>{active++;peak=Math.max(peak,active);prompts.push(init.body.get('prompt'));try{if(++calls===1){entered();await gate;}return Response.json({data:[{b64_json:png.toString('base64')}]});}finally{active--;}}});
 assert.equal(peak,1);assert.equal(calls,2);assert.match(prompts[0],/first/);assert.match(prompts[1],/second/);
});
