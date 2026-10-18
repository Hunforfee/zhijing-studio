import test from 'node:test';
import {shootingPairs} from './shooting-plan.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateInput,validateService,buildPrompt,createServer,imageTarget} from './server.mjs';
import {extractPalette,colorConstraint} from './dist/pattern-color.js';
import {sceneDirections,angleDirections,photographyRules} from './photography-prompts.mjs';
test('fabric color constraints use original pixels and retain client notes within the request limit',()=>{
  const pixels=new Uint8ClampedArray([255,0,0,255,255,0,0,255,0,0,255,255,0,255,0,0]);
  assert.deepEqual(extractPalette(pixels),[{hex:'#ff0000',percent:67},{hex:'#0000ff',percent:33}]);
  const palette=['#123456','#abcdef','#001122','#334455','#778899'].map(hex=>({hex,percent:20}));
  const notes='n'.repeat(250),constraint=colorConstraint(palette,notes);
  assert.ok(constraint.length<=500);assert.ok(constraint.endsWith(notes));assert.match(constraint,/#123456 20%/);assert.deepEqual(extractPalette(new Uint8ClampedArray([0,0,0,0])),[]);
});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const input={product:'set',fabric:'cotton',scenes:['warm','hotel'],angles:['side','detail'],size:'1.8m 床',scale:100,direction:0,repeat:'tile',plainSheet:true,ratio:'4:3',notes:'no props',image:'data:image/png;base64,'+png.toString('base64')};
const empty=()=>({apiKey:'',baseUrl:'https://api.openai.com/v1',model:'gpt-image-2',verified:false});
async function fixture(fn,settings={}){const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-api-test-'));const server=createServer({firstImageReview:false,service:empty(),outputDir,stylingReferencePaths:[],...settings});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const post=async(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data||{})});try{await fn({base,post,outputDir})}finally{await new Promise(r=>server.close(r));const resolved=path.resolve(outputDir);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-api-test-'));await removeDir(resolved)}}
// Windows can keep the job directory briefly locked after the server closes: retry instead of failing the suite.
async function removeDir(dir){
  for(let attempt=0;;attempt++){
    try{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:40});return}
    catch(error){if(attempt>=3||!['ENOTEMPTY','EBUSY','EPERM'].includes(error.code))throw error;await new Promise(r=>setTimeout(r,120*(attempt+1)))}
  }
}
async function waitJob(base,id){for(let i=0;i<600;i++){const j=await(await fetch(`${base}/api/jobs/${id}`)).json();if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,25))}throw Error('Test job did not finish')}
const config={apiKey:'test-key-local-only',baseUrl:'https://example.test/v1',model:'gpt-image-2'};
const zhipu={provider:'zhipu',apiKey:'test-zhipu-key-local-only',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'};
const relay={provider:'sub2api',apiKey:'test-relay-key-local-only',baseUrl:'https://relay.example/v1',model:'gpt-image-2'};

test('front establishes the selected set and every subsequent edit receives exactly that first image',async()=>{
  const master=Buffer.concat([png,Buffer.from('first-front-product')]);
  const seen=[];
  await fixture(async({base,post})=>{
    await post('/api/service',relay);
    const {id}=await(await post('/api/jobs',{...input,scenes:['warm'],angles:['detail','side','front']})).json();
    const job=await waitJob(base,id);
    assert.equal(job.status,'done',job.error);
    assert.deepEqual(job.results.map(r=>r.angle),['front','detail','side']);
    assert.equal(seen.length,3);
  },{fetchImpl:async(url,init)=>{
    const files=init.body.getAll('image[]');
    const first=files.find(f=>f.name==='first-product-photo.png');
    if(!seen.length){assert.equal(first,undefined);assert.match(init.body.get('prompt'),/Camera: \[front:/);}
    else{assert.ok(first);assert.deepEqual(Buffer.from(await first.arrayBuffer()),master);assert.match(init.body.get('prompt'),/never recut or rearrange motifs/);}
    seen.push(init.body.get('prompt'));
    return Response.json({data:[{b64_json:(seen.length===1?master:png).toString('base64')}]});
  }});
});

test('front ordering adds no unselected views and respects reference-controlled cameras',()=>{
  assert.deepEqual(shootingPairs({...input,angles:['detail','side']}).map(p=>p.angle),['detail','side','detail','side']);
  assert.deepEqual(shootingPairs({...input,referenceAngle:true,angles:['side','front']}).map(p=>p.angle),['side','side']);
  assert.deepEqual(shootingPairs({...input,referenceScene:true,angles:['side','front']}).map(p=>p.angle),['front','side']);
});
test('upload-first is default and explicit material supplies a texture-only image after fabric and master',async()=>{
  assert.match(buildPrompt(input,'warm','side'),/MATERIAL MODE: UPLOAD-FIRST/);
  assert.doesNotMatch(buildPrompt(input,'warm','side'),/Material: matte cotton/);
  assert.throws(()=>validateInput({...input,fabricMode:'invalid'}),/质感/);
  let calls=0;const texture=await readFile('dist/assets/fabrics/brushed.png');
  await fixture(async({base,post})=>{
    await post('/api/service',relay);
    const {id}=await(await post('/api/jobs',{...input,fabric:'brushed',fabricMode:'selected',imageB:input.image,scenes:['warm'],angles:['front','detail']})).json();
    assert.equal((await waitJob(base,id)).status,'done');assert.equal(calls,2);
  },{fetchImpl:async(url,init)=>{const imgs=init.body.getAll('image[]');const prompt=init.body.get('prompt');calls++;assert.equal(imgs.length,calls===1?3:4);assert.deepEqual(Buffer.from(await imgs.at(-1).arrayBuffer()),texture);assert.match(prompt,/MATERIAL MODE: EXPLICIT USER SELECTION/);assert.match(prompt,new RegExp('Image '+imgs.length+' is TEXTURE-ONLY'));assert.match(prompt,/brushed cotton/);return Response.json({data:[{b64_json:png.toString('base64')}]});}});
});
test('reverse shots attach styling references separately from A/B and number the master correctly',async()=>{
  const stylingReferencePaths=['styling-references/relaxed-fold-1.png','styling-references/relaxed-fold-2.png'];
  const refs=await Promise.all(stylingReferencePaths.map(p=>readFile(p)));let calls=0;
  await fixture(async({base,post})=>{
    await post('/api/service',relay);
    const {id}=await(await post('/api/jobs',{...input,imageB:input.image,scenes:['warm'],angles:['front','reverse']})).json();
    assert.equal((await waitJob(base,id)).status,'done');assert.equal(calls,2);
  },{stylingReferencePaths,fetchImpl:async(url,init)=>{
    const images=await Promise.all(init.body.getAll('image[]').map(async b=>Buffer.from(await b.arrayBuffer())));
    if(calls++===0)assert.deepEqual(images,[png,png]);
    else {assert.deepEqual(images,[png,png,...refs,png]);assert.match(init.body.get('prompt'),/Images 3 and 4 are STYLING-ONLY/);assert.match(init.body.get('prompt'),/Image 5 is the first product photograph/);assert.doesNotMatch(init.body.get('prompt'),/15–25|shallow.*S-curve|turn back a duvet corner/);}
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});
});
test('nine scenes and twelve angles and new textile materials are valid',()=>{
  const expanded={...input,ratio:'1:1',fabric:'washed',scenes:['warm','natural','hotel','studio','outdoor','terrace','minimal','french','kids'],angles:['side','front','top','detail','left','right','low','wide','reverse','foot','pillowclose','drape']};
  assert.equal(validateInput(expanded).scenes.length*validateInput(expanded).angles.length,108);
  for(const fabric of ['brushed','washed','tencel','jacquard'])assert.equal(validateInput({...expanded,fabric}).fabric,fabric);
  assert.match(buildPrompt(expanded,'outdoor','reverse'),/warm outdoor garden/);
  assert.match(buildPrompt(expanded,'outdoor','reverse'),/broadly across the width/);
});
test('all current set scene-angle pairs reach the editing service without leaking the master composition',async()=>{
  const requests=[];
  const scenes=Object.keys(sceneDirections),angles=['front',...Object.keys(angleDirections).filter(a=>a!=='front')];
  await fixture(async({base,post})=>{
    await post('/api/service',relay);
    const {id}=await(await post('/api/jobs',{...input,ratio:'1:1',scenes,angles})).json();
    const job=await waitJob(base,id);assert.equal(job.status,'done',job.error);assert.equal(job.results.length,scenes.length*angles.length);
    assert.deepEqual(job.results.map(r=>[r.scene,r.angle]),scenes.flatMap(scene=>angles.map(angle=>[scene,angle])));
    assert.equal(new Set(requests).size,scenes.length*angles.length);
    for(let i=0;i<requests.length;i++){
      const scene=scenes[Math.floor(i/angles.length)],angle=angles[i%angles.length];
      assert.ok(requests[i].includes(sceneDirections[scene].prompt));assert.ok(requests[i].includes(angleDirections[angle].prompt));
      assert.ok(requests[i].includes(photographyRules.prompt));
      if(i>0)assert.match(requests[i],/Do NOT preserve its room, background, camera position, crop, lighting/);
    }
  },{fetchImpl:async(url,init)=>{requests.push(init.body.get('prompt'));return Response.json({data:[{b64_json:png.toString('base64')}]});}});
});
test('camera crop and material constraints distinguish difficult product-angle combinations',()=>{
  assert.match(buildPrompt(input,'minimal','top'),/exactly 90-degree top-down/);
  assert.match(buildPrompt(input,'studio','detail'),/textile detail occupying about 50-65%/);
  assert.match(buildPrompt(input,'warm','left'),/headboard projects toward frame left/);
  assert.match(buildPrompt(input,'warm','right'),/never horizontally flip/);
  assert.match(buildPrompt(input,'hotel','wide'),/40-50% of frame/);
  const mat=buildPrompt({...input,product:'mat',fabric:'bamboo'},'outdoor','drape');
  assert.match(mat,/MAT CAMERA ADAPTATION/);assert.match(mat,/MAT SIDE BINDING DISPLAY/);assert.match(mat,/NO hanging mat drape, skirt or blanket hem/);
  const single=buildPrompt({...input,product:'blanket',fabric:'velvet'},'kids','pillowclose');
  assert.match(single,/BLANKET BINDING CLOSE-UP/);assert.match(single,/No pillow, pillowcase/);
  const pair=buildPrompt({...input,product:'pillow'},'french','reverse');
  assert.match(pair,/one pillow front-up and the other reverse-up/);assert.match(pair,/never hang an entire filled pillow/);
  assert.match(pair,/original base fabric color and printed lettering/);
  assert.throws(()=>buildPrompt(input,'unknown','front'),/场景/);
});
test('new angles each produce a distinct request and complete as a batch',async()=>{
  const prompts=[];
  await fixture(async({base,post})=>{
    await post('/api/service',relay);
    const {id}=await(await post('/api/jobs',{...input,scenes:['warm'],angles:['foot','pillowclose','drape']})).json();
    const job=await waitJob(base,id);assert.equal(job.status,'done');assert.deepEqual(job.results.map(r=>r.angle),['foot','pillowclose','drape']);
    assert.match(prompts[0],/foot of the bed/);assert.match(prompts[1],/pillowcase fabric/);assert.match(prompts[2],/gravity-driven vertical fabric drape/);
  },{fetchImpl:async(url,init)=>{prompts.push(init.body.get('prompt'));return Response.json({data:[{b64_json:png.toString('base64')}]});}});
});
test('A-only applies A to all surfaces and A/B overrides coordinating plain sheets',()=>{
  assert.match(buildPrompt({...input,plainSheet:true},'warm','side'),/ALL product components and ALL front and reverse surfaces use fabric A/);
  const dual=validateInput({...input,imageB:input.image,plainSheet:true});assert.equal(dual.plainSheet,false);assert.deepEqual(dual.imageBBytes,png);
  const prompt=buildPrompt(dual,'warm','reverse',true);assert.match(prompt,/Image 2 is fabric B/);assert.match(prompt,/Image 3 is the first product photograph/);assert.match(prompt,/ENTIRE bedsheet uses B/);assert.match(prompt,/pillowcase FRONTS use A and their REVERSES use B/);
  assert.throws(()=>validateInput({...input,imageB:'data:image/png;base64,YWJj'}),/B 面/);
  assert.throws(()=>validateInput({...input,image:undefined,imageB:input.image}),/花型图片/);
});
test('two fabric references precede the master photograph and square output is requested',async()=>{const calls=[];const b=Buffer.concat([png,Buffer.from([0])]);await fixture(async({base,post})=>{
  await post('/api/service',relay);const {id}=await(await post('/api/jobs',{...input,ratio:'1:1',fabric:'brushed',scenes:['outdoor'],angles:['front','reverse'],imageB:'data:image/png;base64,'+b.toString('base64')})).json();const job=await waitJob(base,id);assert.equal(job.status,'done');assert.equal(calls.length,2);
  assert.deepEqual(calls[0],[png,b]);assert.deepEqual(calls[1],[png,b,png]);
},{fetchImpl:async(url,init)=>{assert.ok(url.endsWith('/images/edits'));assert.equal(init.body.get('size'),'1024x1024');assert.match(init.body.get('prompt'),/ENTIRE bedsheet uses B/);calls.push(await Promise.all(init.body.getAll('image[]').map(async blob=>Buffer.from(await blob.arrayBuffer()))));return Response.json({data:[{b64_json:png.toString('base64')}]})}})});
test('Sub2API normalizes base addresses, permits loopback HTTP, and requires a new key when switching providers',()=>{
  assert.equal(validateService({...relay,baseUrl:'https://relay.example/'}).baseUrl,'https://relay.example/v1');
  assert.equal(validateService({...relay,baseUrl:'https://relay.example/v1/images/edits'}).baseUrl,relay.baseUrl);
  assert.equal(validateService({...relay,baseUrl:'http://127.0.0.1:8080/v1'}).baseUrl,'http://127.0.0.1:8080/v1');
  assert.throws(()=>validateService({...relay,baseUrl:'http://relay.example/v1'}),/HTTPS/);
  assert.throws(()=>validateService({...relay,baseUrl:'http://127.0.0.1:4173/v1'}),/预览端口/);
  assert.throws(()=>validateService({...relay,apiKey:''},zhipu),/切换服务/);
});
test('Sub2API sends original fabric and first photo to image edits, accepts image URLs and lists available image models',async()=>{let edits=0;await fixture(async({base,post})=>{
  await post('/api/service',relay);const check=await(await post('/api/service/check')).json();assert.deepEqual(check.models,['gpt-image-2']);
  const {id}=await(await post('/api/jobs',{...input,scenes:['warm']})).json();const job=await waitJob(base,id);assert.equal(job.status,'done');assert.equal(edits,2);assert.ok(job.results.every(r=>!r.approximate));
},{lookupImpl:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async(url,init)=>{
  if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-image-2'},{id:'gpt-5.4-mini'}]});
  if(url.endsWith('/images/edits')){edits++;assert.equal(init.headers.Authorization,'Bearer '+relay.apiKey);assert.equal(init.redirect,'error');assert.equal(init.body.get('model'),relay.model);assert.equal(init.body.getAll('image[]').length,edits===1?1:2);assert.deepEqual(Buffer.from(await init.body.getAll('image[]')[0].arrayBuffer()),png);return edits===1?Response.json({data:[{url:'https://cdn.example/photo.png'}]}):Response.json({data:[{b64_json:png.toString('base64')}]})}
  assert.equal(init.headers,undefined);return new Response(png);
}})});
test('Sub2API errors give actionable detail and redact echoed credentials',async()=>fixture(async({base,post})=>{
  await post('/api/service',relay);const {id}=await(await post('/api/jobs',input)).json();const job=await waitJob(base,id);assert.equal(job.status,'error');assert.match(job.error,/image account unavailable/);assert.ok(!job.error.includes(relay.apiKey));assert.match(job.error,/中转账号/);
},{fetchImpl:async()=>Response.json({error:{message:'image account unavailable '+relay.apiKey,code:'upstream_error'}},{status:502})}));
test('image CDN validation accepts public cloud storage and rejects private destinations',async()=>{
  const publicDNS=async()=>[{address:'8.8.8.8',family:4}];
  assert.equal((await imageTarget('https://images.example-cloud.com/photo.jpg?signature=temporary',publicDNS)).url.hostname,'images.example-cloud.com');
  await assert.rejects(()=>imageTarget('http://images.example.com/a',publicDNS),/HTTPS/);
  await assert.rejects(()=>imageTarget('https://secret@images.example.com/a',publicDNS),/HTTPS/);
  for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','0.0.0.0'])await assert.rejects(()=>imageTarget('https://internal.example/a',async()=>[{address,family:4}]),/内部网络/);
});
test('Zhipu cloud CDN redirects and JPEG images are downloaded and served without API credentials',async()=>{let downloads=0;const jpeg=Buffer.from([255,216,255,224,0,16]);await fixture(async({base,post})=>{await post('/api/service',zhipu);const {id}=await(await post('/api/jobs',{...input,scenes:['warm'],angles:['side']})).json();const job=await waitJob(base,id);assert.equal(job.status,'done');assert.equal(downloads,2);assert.match(job.results[0].url,/\.jpg$/);const response=await fetch(base+job.results[0].url);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(await response.arrayBuffer()),jpeg)},{lookupImpl:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async(url,init)=>{if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'Blue flowers on white cotton'}}]});if(url.endsWith('/images/generations'))return Response.json({data:[{url:'https://cdn.example-cloud.com/first.jpg?token=test'}]});downloads++;assert.equal(init.headers,undefined);return downloads===1?new Response(null,{status:302,headers:{location:'https://storage.example-cloud.com/final.jpg'}}):new Response(jpeg)}})});
test('Zhipu CDN redirect into internal network is blocked before fetching it',async()=>{let downloads=0;await fixture(async({base,post})=>{await post('/api/service',zhipu);const {id}=await(await post('/api/jobs',{...input,scenes:['warm'],angles:['side']})).json();const job=await waitJob(base,id);assert.equal(job.status,'error');assert.match(job.error,/内部网络/);assert.equal(downloads,1)},{lookupImpl:async(host)=>[{address:host==='internal.example'?'127.0.0.1':'8.8.8.8',family:4}],fetchImpl:async(url)=>{if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'Blue cotton'}}]});if(url.endsWith('/images/generations'))return Response.json({data:[{url:'https://cdn.example-cloud.com/photo.png'}]});downloads++;return new Response(null,{status:302,headers:{location:'https://internal.example/private'}})}})});
test('Zhipu recognizes the uploaded pattern once and generates approximate photographs without leaking keys to image downloads',async()=>{let vision=0,images=0;await fixture(async({base,post})=>{await post('/api/service',zhipu);const check=await(await post('/api/service/check')).json();assert.equal(check.verified,false);assert.equal(vision,0);const status=await(await fetch(base+'/api/status')).json();assert.equal(status.approximate,true);const {id}=await(await post('/api/jobs',input)).json();const job=await waitJob(base,id);assert.equal(job.status,'done');assert.equal(job.results.length,4);assert.equal(vision,1);assert.equal(images,4);assert.ok(job.results.every(r=>r.approximate));assert.equal((await fetch(base+job.results[0].url)).status,200)},{lookupImpl:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async(url,init)=>{if(url.endsWith('/chat/completions')){vision++;const data=JSON.parse(init.body);assert.equal(data.model,'glm-4.6v');assert.equal(data.messages[0].content[0].image_url.url,png.toString('base64'));return Response.json({choices:[{message:{content:'Ivory background, sage green botanical leaves spaced evenly.'}}]})}if(url.endsWith('/images/generations')){images++;const data=JSON.parse(init.body);assert.equal(data.model,'glm-image');assert.match(data.prompt,/sage green botanical/);assert.ok(!data.prompt.includes('Image 1'));assert.equal(data.size,'1472x1088');return Response.json({data:[{url:'https://aigc-files.bigmodel.cn/test.png'}]})}assert.equal(init.headers,undefined);assert.equal(init.redirect,'manual');return new Response(png)}})});
test('Zhipu recognition failure stops before image generation',async()=>fixture(async({base,post})=>{await post('/api/service',zhipu);const {id}=await(await post('/api/jobs',input)).json();const job=await waitJob(base,id);assert.equal(job.status,'error');assert.equal(job.results.length,0);assert.match(job.error,/花型识别/);assert.match(job.error,/权限/)},{fetchImpl:async(url)=>{assert.ok(url.endsWith('/chat/completions'));return Response.json({}, {status:403})}}));
test('validates products, materials and pattern input',()=>{assert.deepEqual(validateInput(input).imageBytes,png);assert.throws(()=>validateInput({...input,product:'mat'}),/面料/);assert.throws(()=>validateInput({...input,scenes:[]}),/场景/);assert.throws(()=>validateInput({...input,angles:['side','side']}),/角度/);assert.throws(()=>validateInput({...input,image:'data:image/png;base64,YWJj'}),/图片/)});
test('service configuration requires HTTPS and never embeds credentials in URL',()=>{assert.equal(validateService(config).apiKey,config.apiKey);assert.throws(()=>validateService({...config,baseUrl:'http://example.test'}),/HTTPS/);assert.throws(()=>validateService({...config,baseUrl:'https://key@example.test/v1'}),/HTTPS/);assert.throws(()=>validateService({...config,apiKey:''}),/密钥/);assert.equal(validateService({...config,apiKey:''},config).apiKey,config.apiKey)});
test('prompts distinguish physical product structure and consistent later shots',()=>{const mat=buildPrompt({...input,product:'mat',fabric:'bamboo',fabricMode:'selected'},'hotel','top',true);assert.match(mat,/no puffy quilt/);assert.match(mat,/bamboo slats/);assert.match(mat,/overhead/);assert.match(mat,/Image 2 is the first product photograph/);assert.match(buildPrompt(input,'warm','side'),/ALL product components/)});
test('missing service fails explicitly, config and status never expose key',async()=>fixture(async({base,post})=>{assert.equal((await fetch(base)).status,200);assert.equal((await post('/api/jobs',input)).status,503);assert.equal((await post('/api/service',config)).status,200);const status=await(await fetch(base+'/api/status')).json();assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes(config.apiKey));assert.equal((await fetch(base+'/.env')).status,404);const response=await fetch(base+'/api/service',{method:'POST',headers:{Origin:'https://untrusted.test'},body:JSON.stringify(config)});assert.equal(response.status,403)}));
test('multipart image editing produces every scene-angle pair and uses first photo for consistency',async()=>{const calls=[];await fixture(async({base,post,outputDir})=>{await post('/api/service',config);assert.equal((await post('/api/service/check')).status,200);const response=await post('/api/jobs',input);assert.equal(response.status,202);const {id}=await response.json();const job=await waitJob(base,id);assert.equal(job.status,'done');assert.equal(job.results.length,4);assert.equal(job.progress,100);assert.deepEqual(job.results.map(r=>[r.scene,r.angle]),[['warm','side'],['warm','detail'],['hotel','side'],['hotel','detail']]);assert.equal(calls[0].images.length,1);assert.equal(calls[1].images.length,2);assert.match(calls[1].prompt,/first product photograph/);assert.deepEqual(Buffer.from(await calls[0].images[0].arrayBuffer()),png);for(const out of job.results){assert.deepEqual(Buffer.from(await(await fetch(base+out.url)).arrayBuffer()),png)}assert.deepEqual(await readFile(path.join(outputDir,id,'1.png')),png)},{fetchImpl:async(url,init)=>{if(url.endsWith('/models'))return Response.json({data:[{id:'gpt-image-2'}]});assert.equal(url,'https://example.test/v1/images/edits');assert.equal(init.headers.Authorization,'Bearer '+config.apiKey);calls.push({images:init.body.getAll('image[]'),prompt:init.body.get('prompt')});return Response.json({data:[{b64_json:png.toString('base64')}]})}})});
test('upstream failure retains completed pictures and does not replace them with mock results',async()=>{let count=0;await fixture(async({base,post})=>{await post('/api/service',config);const {id}=await(await post('/api/jobs',input)).json();const job=await waitJob(base,id);assert.equal(job.status,'error');assert.equal(job.results.length,1);assert.match(job.error,/余额不足/);assert.equal((await fetch(base+job.results[0].url)).status,200)},{fetchImpl:async()=>++count===1?Response.json({data:[{b64_json:png.toString('base64')}]}):Response.json({error:'not enough balance'},{status:429})})});
test('cancellation stops pending generation',async()=>{let release;const entered=new Promise(r=>release=r);await fixture(async({base,post})=>{await post('/api/service',config);const {id}=await(await post('/api/jobs',input)).json();await entered;assert.equal((await post(`/api/jobs/${id}/cancel`)).status,200);const job=await waitJob(base,id);assert.equal(job.status,'cancelled');assert.equal(job.results.length,0)},{fetchImpl:async(url,init)=>{release();return new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})})}})});
