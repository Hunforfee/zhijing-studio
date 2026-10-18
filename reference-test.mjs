import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createServer,validateInput,buildPrompt} from './server.mjs';
import {referenceEditGuard,enforceReferenceEdit} from './reference-prompts.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const image='data:image/png;base64,'+png.toString('base64');
const base={product:'set',fabric:'cotton',fabricMode:'auto',size:'参考图款式',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,referenceImage:image,referenceGuided:true,scenes:['hotel','studio'],angles:['reverse','top']};

test('reference scope remains authoritative after full manual prompt replacement',()=>{
  for(const [referenceScene,referenceAngle]of [[true,true],[true,false],[false,true]]){
    const v={...base,referenceScene,referenceAngle,imageB:image},p=enforceReferenceEdit('Manual product instruction.',v);
    assert.ok(p.endsWith(referenceEditGuard(v)));assert.match(p,/Image 1 is the PRIMARY photographic edit target; Image 2 supplies fabric A; Image 3 supplies fabric B/);
    if(referenceScene&&referenceAngle)assert.match(p,/Edit Image 1 in place/);
    else if(referenceScene)assert.match(p,/EXACT physical room.*CURRENT menu camera/);
    else assert.match(p,/camera geometry.*CURRENT menu scene/);
    assert.equal(enforceReferenceEdit(p,v),p);
  }
  assert.equal(enforceReferenceEdit('No photo selected',{product:'set'}),'No photo selected');
});

test('distinct reference/A/B bytes, image numbers and actual request evidence remain correct in each reference scope',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-primary-reference-'));
  const bytes=Object.fromEntries(['photo','A','B','texture','side','top'].map(role=>[role,Buffer.concat([png,Buffer.from(role)])]));
  const data=role=>'data:image/png;base64,'+bytes[role].toString('base64');let expected,calls;
  const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'synthetic-primary-reference-key',baseUrl:'https://example.test/v1',model:'test-image'},fetchImpl:async(url,init)=>{
    const angle=expected.referenceAngle?'side':['side','top'][calls],imgs=init.body.getAll('image[]'),prompt=init.body.get('prompt'),names=['user-photographic-reference.png','fabric-A.png',...(expected.hasB?['fabric-B.png']:[]),...(!expected.referenceAngle?['camera-angle-reference.png']:[]),...(expected.texture?['uploaded-texture-reference.png']:[])];
    assert.deepEqual(imgs.map(x=>x.name),names);assert.deepEqual(Buffer.from(await imgs[0].arrayBuffer()),bytes.photo);assert.deepEqual(Buffer.from(await imgs[1].arrayBuffer()),bytes.A);
    if(expected.hasB)assert.deepEqual(Buffer.from(await imgs[2].arrayBuffer()),bytes.B);
    assert.match(prompt,/Image 1 is the USER PHOTOGRAPHIC REFERENCE/);assert.match(prompt,/Image 2 is authoritative fabric A/);if(expected.hasB)assert.match(prompt,/Image 3 is authoritative fabric B/);
    if(expected.texture){assert.deepEqual(Buffer.from(await imgs.at(-1).arrayBuffer()),bytes.texture);assert.match(prompt,new RegExp('Image '+imgs.length+' is TEXTURE-ONLY'));}
    if(!expected.referenceAngle){const camera=imgs.find(x=>x.name==='camera-angle-reference.png');assert.deepEqual(Buffer.from(await camera.arrayBuffer()),bytes[angle]);assert.match(prompt,new RegExp('MENU CAMERA \\['+angle+':'));}
    else assert.match(prompt,/do not zoom out to satisfy generic full-bed/);
    calls++;return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
  try{
    for(const [referenceScene,referenceAngle]of [[true,true],[true,false],[false,true]])for(const hasB of [false,true])for(const texture of [false,true]){
      expected={referenceScene,referenceAngle,hasB,texture};calls=0;
      const response=await fetch(root+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,image:data('A'),imageB:hasB?data('B'):null,referenceImage:data('photo'),referenceScene,referenceAngle,scenes:['hotel','studio'],angles:['side','top'],cameraReferences:{side:data('side'),top:data('top')},textureSource:texture?'upload':'library',textureReferenceImage:texture?data('texture'):null})});assert.equal(response.status,202);const {id}=await response.json();let job;
      for(let i=0;i<100;i++){job=await(await fetch(root+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}assert.equal(job.status,'done',job.error);assert.equal(calls,referenceScene&&referenceAngle?1:2);
      const {records}=await(await fetch(root+'/api/admin/records')).json();const record=await(await fetch(root+'/api/admin/records/'+records.find(x=>x.jobId===id).id)).json();assert.equal(record.referenceScene,referenceScene);assert.equal(record.referenceAngle,referenceAngle);assert.equal(record.inputImages[0].name,'user-photographic-reference.png');assert.equal(record.inputImages[0].bytes,bytes.photo.length);assert.ok(!JSON.stringify(record).includes('data:image'));
      const preview=await(await fetch(root+'/api/admin/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'set',hasB,reference:referenceScene&&referenceAngle?'both':referenceScene?'scene':'angle'})})).json();assert.equal(preview.attachments[0],'用户拍摄参考图');assert.match(preview.prompts.sub2api,/Image 1 is the USER PHOTOGRAPHIC REFERENCE/);
    }
  }finally{await new Promise(r=>server.close(r));await rm(outputDir,{recursive:true,force:true});}
});
test('reference images are validated independently and override camera/environment without copying their print',()=>{
  const v=validateInput(base);assert.deepEqual(v.referenceBytes,png);assert.equal(v.referenceGuided,true);
  for(const product of ['set','quilt','pillow','sheet','blanket','mat'])for(const hasB of [false,true]){const value={...v,product,fabric:product==='mat'?'ice':product==='blanket'?'velvet':'cotton',imageB:hasB?image:null,imageBBytes:hasB?png:null};const prompt=buildPrompt(value,'hotel','reverse',false,2,false);assert.match(prompt,/Image 1 is the USER PHOTOGRAPHIC REFERENCE/);assert.match(prompt,/overrides menu scene, menu camera/);assert.match(prompt,/replace the reference product print/);assert.doesNotMatch(prompt,/STYLING-ONLY|dark walnut hotel bedroom|turn the head-end|Camera: \[/i);}
  assert.throws(()=>validateInput({...base,referenceImage:'https://example.test/image.png'}),/参考图/);assert.throws(()=>validateInput({...base,referenceImage:null}),/参考图/);assert.throws(()=>validateInput({...base,referenceImage:'data:image/png;base64,'+Buffer.alloc(30).toString('base64')}),/参考图/);assert.throws(()=>validateInput({...base,referenceGuided:'yes'}),/参考图模式/);
});
test('frontend reference mode creates one image even with empty selected scenes and angles, and keeps print/material options',async()=>{
  const app=await readFile('dist/app.js','utf8');const context=vm.createContext({state:{...base,referenceUpload:{},scenes:[],angles:[]},fabrics:{cotton:['细密哑光']},$:id=>({value:{scale:'100',direction:'0',repeat:'tile',ratio:'1:1',notes:'客户端备注'}[id]})});vm.runInContext(app.match(/function options\(\)\{[^\n]+/)[0],context);const options=vm.runInContext('options()',context);assert.equal(options.referenceGuided,true);assert.equal(options.scenes.length*options.angles.length,1);assert.match(options.size,/参考图优先/);assert.doesNotMatch(options.notes,/四件套规格内床单款式/);assert.match(options.notes,/客户端备注/);
  context.state.referenceUpload=null;context.state.scenes=['hotel','studio'];context.state.angles=['reverse','top'];const manual=vm.runInContext('options()',context);assert.equal(manual.referenceGuided,false);assert.equal(manual.scenes.length*manual.angles.length,4);
  const html=await readFile('dist/index.html','utf8');assert.ok(html.indexOf('id="productGroupTitle"')<html.indexOf('id="fabricGroupTitle"'));assert.equal((html.match(/<section class="compact-row /g)||[]).length,3);assert.ok(html.includes('id="generationPanel"'));assert.ok(!html.includes('<b>04</b>'));assert.ok(html.includes('拍摄场景与角度'));assert.ok(html.includes('id="shootingReferenceFile"'));
});
test('actual editing request uses the photograph as primary image followed by A/B and texture and returns one reference-labelled result',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-ref-test-'));let calls=0;const texture=await readFile('dist/assets/fabrics/brushed.png');
  const server=createServer({service:{provider:'sub2api',apiKey:'synthetic-ref-test-key',baseUrl:'https://example.test/v1',model:'test-image'},outputDir,fetchImpl:async(url,init)=>{calls++;const imgs=init.body.getAll('image[]');assert.deepEqual(imgs.map(i=>i.name),['user-photographic-reference.png','fabric-A.png','fabric-B.png','selected-texture.png']);assert.deepEqual(Buffer.from(await imgs[0].arrayBuffer()),png);assert.deepEqual(Buffer.from(await imgs[3].arrayBuffer()),texture);assert.match(init.body.get('prompt'),/Image 1 is the USER PHOTOGRAPHIC REFERENCE/);assert.match(init.body.get('prompt'),/Image 4 is TEXTURE-ONLY/);assert.doesNotMatch(init.body.get('prompt'),/STYLING-ONLY/);return Response.json({data:[{b64_json:png.toString('base64')}]})}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,imageB:image,fabric:'brushed',fabricMode:'selected'})});assert.equal(response.status,202);const {id}=await response.json();let job;for(let i=0;i<80;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20))}assert.equal(job.status,'done',job.error);assert.equal(calls,1);assert.equal(job.results.length,1);assert.equal(job.results[0].referenceGuided,true);assert.equal(job.progress,100);}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-ref-test-'));await rm(outputDir,{recursive:true,force:true})}
});
