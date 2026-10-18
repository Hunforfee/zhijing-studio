import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
async function fixture(fn,fetchImpl){
 const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhipu-edit-'));
 const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'zhipu',apiKey:'mock-key',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'},fetchImpl});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=async(route,data)=>(await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));
 const get=async(route)=>(await fetch(base+route)).json();
 const wait=async(id)=>{for(let i=0;i<100;i++){const j=await get('/api/jobs/'+id);if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
 try{await post('/api/history',{image:'data:image/png;base64,'+png.toString('base64'),ratio:'3:4'});await fn({post,get,wait});}finally{await new Promise(r=>server.close(r));assert.ok(outputDir.startsWith(path.join(os.tmpdir(),'zhipu-edit-')));await rm(outputDir,{recursive:true,force:true});}
}
test('Zhipu edits analyze original and optional reference then regenerate; sequential edits retain lineage',async()=>{
 const calls=[];
 await fixture(async({post,get,wait})=>{
  for(const number of [1,2]){
   const res=await post('/api/history/edit',{number,prompt:'改成日式背景',...(number===1?{referenceImage:'data:image/png;base64,'+png.toString('base64')}: {})});assert.equal(res.status,202);
   const job=await wait((await res.json()).id);assert.equal(job.status,'done',job.error);assert.equal(job.results[0].parentNumber,number);assert.equal(job.results[0].editMode,'reference-redraw');assert.equal(job.results[0].approximate,true);assert.match(job.message,/花色与细节可能变化/);
  }
  const images=(await get('/api/history')).images;assert.equal(images.length,3);assert.equal(images.at(-1).kind,'preview');
 },async(url,init)=>{const body=JSON.parse(init.body);calls.push({url,body});return url.endsWith('/chat/completions')?Response.json({choices:[{message:{content:'白底蓝色花卉被套，两只枕头，独立床单，日式木质卧室，保留原图镜头。'}}]}):Response.json({data:[{b64_json:png.toString('base64')}]});});
 assert.deepEqual(calls.map(c=>c.url.split('/').at(-1)),['completions','generations','completions','generations']);
 assert.equal(calls[0].body.messages[0].content.filter(x=>x.type==='image_url').length,2);assert.equal(calls[2].body.messages[0].content.filter(x=>x.type==='image_url').length,1);
 assert.equal(calls[1].body.size,'1088x1472');assert.match(calls[1].body.prompt,/改成日式背景/);assert.match(calls[1].body.prompt,/白底蓝色/);assert.ok(Array.from(calls[1].body.prompt).length<=3500);
});
test('empty vision result stops before generation and keeps original',async()=>{
 let calls=0;await fixture(async({post,get,wait})=>{const res=await post('/api/history/edit',{number:1,prompt:'改背景'});const job=await wait((await res.json()).id);assert.equal(job.status,'error');assert.match(job.error,/未返回原图描述/);assert.equal((await get('/api/history')).images.length,1);},async()=>{calls++;return Response.json({choices:[]});});assert.equal(calls,1);
});
test('cancellation during vision prevents regeneration',async()=>{
 let entered;const gate=new Promise(r=>entered=r);let calls=0;
 await fixture(async({post,get,wait})=>{const res=await post('/api/history/edit',{number:1,prompt:'改背景'});const {id}=await res.json();await gate;await post('/api/jobs/'+id+'/cancel',{});assert.equal((await wait(id)).status,'cancelled');assert.equal((await get('/api/history')).images.length,1);},async(url,{signal})=>{calls++;entered();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});assert.equal(calls,1);
});
