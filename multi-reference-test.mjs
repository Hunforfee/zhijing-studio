import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer,validateInput} from './server.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const data=bytes=>'data:image/png;base64,'+bytes.toString('base64');
const refs=[png,Buffer.concat([png,Buffer.from('second-photo')]),Buffer.concat([png,Buffer.from('third-photo')])];
const base={product:'set',fabric:'cotton',fabricMode:'auto',size:'按所选产品',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image:data(png),imageB:data(png),scenes:['hotel'],angles:['side'],referenceImages:refs.map(data),referenceScene:true,referenceAngle:true};
test('all references validate; reference angle excludes smart angle, scene-only references allow smart angles',()=>{
 const v=validateInput(base);assert.deepEqual(v.referenceImagesBytes,refs);assert.deepEqual(v.referenceBytes,png);
 for(const invalid of [{referenceImages:'bad'},{referenceImages:Array(9).fill(data(png))},{referenceImages:[data(png),'bad']},{referenceImage:data(png)}])assert.throws(()=>validateInput({...base,...invalid}));
 assert.throws(()=>validateInput({...base,smartAngles:true}),/参考角度/);
 const smart=validateInput({...base,smartAngles:true,referenceAngle:false,setCounts:{main:2}});assert.equal(smart.recommendCount,2);assert.equal(smart.referenceAngle,false);
});
test('multiple upload appends, removes individually, rejects bad batches and discards stale reads',async()=>{
 const source=await readFile('dist/shooting-reference.js','utf8'),nodes=new Map(),revoked=[],loads=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{checked:true,hidden:false,classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},querySelector:node,querySelectorAll:()=>[]});return nodes.get(id)};
 const context=vm.createContext({state:{busy:false,referenceUpload:null,referenceScene:true,referenceAngle:true},$:node,document:{querySelector:node,querySelectorAll:()=>[]},URL:{createObjectURL:f=>'blob:'+f.name,revokeObjectURL:u=>revoked.push(u)},Image:class{naturalWidth=800;naturalHeight=600;decode(){return new Promise((resolve,reject)=>loads.push({resolve,reject}))}},toast(){},options:()=>({}),referencePlanDescription:()=>'',renderSelections(){context.syncReferenceShootingControls()},modal(){}});
 vm.runInContext(source.slice(0,source.indexOf('function anglePreviewPlacement')),context);
 const file=name=>({name,type:'image/png',size:100});
 let pending=context.uploadShootingReference([file('a'),file('b')]);loads[0].resolve();await new Promise(r=>setImmediate(r));loads[1].resolve();await pending;
 assert.equal(context.state.referenceUploads.length,2);assert.equal(context.state.recommendAngle,false);
 pending=context.uploadShootingReference(file('c'));loads[2].resolve();await pending;assert.equal(context.state.referenceUploads.length,3);
 context.removeShootingReference(0);assert.equal(context.state.referenceUpload.file.name,'b');assert.ok(revoked.includes('blob:a'));
 pending=context.uploadShootingReference([file('bad'),file('invalid')]);loads[3].resolve();await new Promise(r=>setImmediate(r));loads[4].reject(Error('invalid'));await pending;assert.equal(context.state.referenceUploads.length,2);assert.ok(revoked.includes('blob:bad'));
 pending=context.uploadShootingReference(file('stale'));context.clearShootingReference();loads[5].resolve();await pending;assert.equal(context.state.referenceUploads.length,0);assert.ok(revoked.includes('blob:stale'));
});
for(const provider of ['sub2api','zhipu'])test(provider+' sends every photo without changing A/B and texture roles',async()=>{
 const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-multi-reference-'));let calls=0,vision=0;
 const server=createServer({firstImageReview:false,outputDir,lookupImpl:async()=>[{address:'8.8.8.8',family:4}],service:{provider,apiKey:'synthetic-multi-test',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{
  if(url.endsWith('/chat/completions')){vision++;const content=JSON.parse(init.body).messages[0].content;assert.equal(content.length,7);assert.deepEqual(content.slice(-3,-1).map(i=>i.image_url.url),refs.slice(1).map(b=>b.toString('base64')));assert.match(content.at(-1).text,/ADDITIONAL PHOTOGRAPHIC REFERENCES: Images 5, 6/);return Response.json({choices:[{message:{content:'{"fabricA":"blue floral","fabricB":"blue floral","referenceScene":"oak bedroom","referenceAngle":"side view"}'}}]});}
  if(url.endsWith('/images/edits')){calls++;const images=init.body.getAll('image[]');assert.deepEqual(images.map(i=>i.name),['user-photographic-reference.png','fabric-A.png','fabric-B.png','uploaded-texture-reference.png','user-photographic-reference-2.png','user-photographic-reference-3.png']);assert.deepEqual(await Promise.all(images.slice(-2).map(async i=>Buffer.from(await i.arrayBuffer()))),refs.slice(1));assert.match(init.body.get('prompt'),/Images 5, 6 supplement/);assert.match(init.body.get('prompt'),/Image 4 is TEXTURE-ONLY/);return Response.json({data:[{b64_json:png.toString('base64')}]});}
  if(url.endsWith('/images/generations')){calls++;return Response.json({data:[{url:'https://cdn.example.test/result.png'}]});}
  return new Response(png);
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 try{const response=await fetch(root+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,textureSource:'upload',textureReferenceImage:data(png)})});assert.equal(response.status,202);const {id}=await response.json();let job;for(let n=0;n<100;n++){job=await(await fetch(root+'/api/jobs/'+id)).json();if(['done','failed','cancelled'].includes(job.status))break;await new Promise(r=>setTimeout(r,20));}assert.equal(job.status,'done',job.error);assert.equal(calls,1);assert.equal(vision,provider==='zhipu'?1:0);}finally{await new Promise(r=>server.close(r));assert.ok(outputDir.startsWith(path.join(os.tmpdir(),'zhijing-multi-reference-')));await rm(outputDir,{recursive:true,force:true});}
});

