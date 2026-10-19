import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-custom-scene-ui-')),calls=[];
const picture=color=>{const png=new PNG({width:160,height:120});for(let i=0;i<png.data.length;i+=4)png.data.set([...color,255],i);return PNG.sync.write(png);};
const room=picture([200,190,165]),fabricA=picture([85,130,175]),fabricB=picture([165,85,120]);
const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'mock-scene-application-key',baseUrl:'https://scene-mock.example/v1',model:'gpt-image-2'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async(url,init)=>{
 assert.ok(url.startsWith('https://scene-mock.example/v1/'));
 if(url.endsWith('/images/generations')){calls.push({kind:'scene',body:JSON.parse(init.body)});return Response.json({data:[{b64_json:room.toString('base64')}]});}
 if(url.endsWith('/responses')){calls.push({kind:'analysis'});return Response.json({output_text:JSON.stringify({A:{pattern:'蓝色主花型',craft:'看不清',texture:'平整',uncertain:'局部资料'},B:{pattern:'粉色反面花型',craft:'看不清',texture:'平整',uncertain:'局部资料'},craftChoices:{},textureChoice:null})});}
 assert.ok(url.endsWith('/images/edits'));const images=[];for(const image of init.body.getAll('image[]')){const decoded=PNG.sync.read(Buffer.from(await image.arrayBuffer()));images.push({name:image.name,pixel:[...decoded.data.slice(0,3)]});}calls.push({kind:'photo',images,prompt:init.body.get('prompt')});return Response.json({data:[{b64_json:fabricA.toString('base64')}]});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const post=async(route,body)=>{const response=await fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;};
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const {job}=await post('/api/scenes/jobs',{name:'窗边晨光',brief:'原木床架，窗边自然光，素色床品便于应用新花型。',style:'natural',lighting:'morning',ratio:'3:4'});
 let completed;for(let i=0;i<100;i++){completed=(await(await fetch(base+'/api/scenes/jobs/'+job.id)).json()).job;if(completed.status==='done')break;await new Promise(resolve=>setTimeout(resolve,20));}assert.equal(completed.status,'done');
 const {scene}=await post('/api/scenes',{jobId:job.id,name:'窗边晨光'});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/*',route=>route.request().url().startsWith(base)||/^(data|blob):/.test(route.request().url())?route.continue():route.abort());
 await page.addInitScript(()=>localStorage.setItem('zhijing-workspace-nav-guide-v1','seen'));
 await page.goto(base+'/workspace?scene='+scene.id+'#results',{waitUntil:'networkidle'});
 await page.waitForFunction(id=>state.referenceUpload?.sceneId===id,scene.id);
 const applied=await page.evaluate(()=>({sceneId:state.referenceUpload.sceneId,name:state.referenceUpload.sceneName,scene:state.referenceScene,angle:state.referenceAngle,smart:state.recommendAngle,product:state.product,counts:state.setCounts}));
 assert.equal(applied.sceneId,scene.id);assert.equal(applied.name,'窗边晨光');assert.equal(applied.scene,true);assert.equal(applied.angle,false);assert.equal(applied.smart,true);assert.equal(applied.product,'set');assert.deepEqual(applied.counts,{main:15,duvet:2,sheet:2,pillow:2});
 assert.equal(new URL(page.url()).searchParams.has('scene'),false);assert.equal(await page.locator('[data-custom-scene="'+scene.id+'"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.workspace-nav-links a[href="/scenes"]').count(),0);
 await page.locator('#upload').setInputFiles({name:'A面.png',mimeType:'image/png',buffer:fabricA});await page.locator('#uploadB').setInputFiles({name:'B面.png',mimeType:'image/png',buffer:fabricB});
 await page.waitForFunction(()=>state.pattern&&state.patternB);await page.evaluate(async()=>{await globalThis.patternMaterials?.ready();state.setCounts={main:1,duvet:0,sheet:0,pillow:0};renderSelections();});
 const payloadEvent=page.waitForRequest(request=>request.url()===base+'/api/jobs'&&request.method()==='POST');await page.locator('#generateBtn').click();const payload=(await payloadEvent).postDataJSON();assert.equal(payload.referenceScene,true);assert.equal(payload.referenceAngle,false);assert.equal(payload.smartAngles,true);assert.equal(payload.referenceImages.length,1);assert.equal(payload.product,'set');assert.ok(payload.imageB);
 await page.waitForFunction(()=>state.results.some(item=>item.ai&&!item.reference),null,{timeout:30000});
 const photo=calls.find(call=>call.kind==='photo');assert.ok(photo);assert.deepEqual(photo.images.slice(0,3).map(image=>image.pixel),[[200,190,165],[85,130,175],[165,85,120]]);assert.deepEqual(photo.images.slice(0,3).map(image=>image.name),['user-photographic-reference.png','fabric-A.png','fabric-B.png']);assert.match(photo.prompt,/CURRENT menu camera|MENU CAMERA|vary the camera/i);assert.match(photo.prompt,/Image 2 (?:is authoritative|supplies) fabric A/);assert.match(photo.prompt,/Image 3 (?:is authoritative|supplies) fabric B/);
 await page.locator('#shootSection>.scheme-picker').click();await page.locator('.scheme-picker-dialog[data-picker="shooting"]').waitFor({state:'visible'});
 await page.locator('#removeCustomScene').click();await page.waitForFunction(()=>!state.referenceUpload);assert.equal(await page.locator('[data-custom-scene="'+scene.id+'"]').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>state.recommendAngle),true);
 const holdSceneImage=async()=>{let release;const gate=new Promise(resolve=>release=resolve),url=base+scene.imageUrl;const handler=async route=>{if(route.request().resourceType()==='fetch')await gate;await route.continue();};await page.route(url,handler);return async()=>{release();await page.waitForFunction(()=>!state.customSceneApplying);await page.unroute(url,handler);};};
 const finishManualScene=await holdSceneImage();await page.locator('[data-custom-scene="'+scene.id+'"]').click();await page.waitForFunction(()=>state.customSceneApplying);assert.equal(await page.locator('#generateBtn').isDisabled(),true);
 await page.locator('[data-scene]:not(.selected)').first().click();const manualSceneIds=await page.evaluate(()=>[...state.scenes]);await finishManualScene();assert.equal(await page.evaluate(()=>state.referenceUpload),null);assert.deepEqual(await page.evaluate(()=>state.scenes),manualSceneIds);assert.match(await page.locator('#customSceneStatus').textContent(),/已取消/);
 await page.locator('[data-custom-scene="'+scene.id+'"]').click();await page.waitForFunction(id=>state.referenceUpload?.sceneId===id,scene.id);assert.match(await page.locator('#customSceneStatus').textContent(),/窗边晨光/);
 const finishManualScope=await holdSceneImage();await page.locator('[data-custom-scene="'+scene.id+'"]').click();await page.waitForFunction(()=>state.customSceneApplying);await page.locator('#referenceAngle').check();await finishManualScope();assert.equal(await page.evaluate(()=>state.referenceAngle),true);assert.equal(await page.evaluate(()=>state.recommendAngle),false);await page.locator('#referenceAngle').uncheck();await page.locator('#chooseSmartAngles').click();assert.equal(await page.evaluate(()=>state.recommendAngle),true);
 await mkdir('.share',{recursive:true});await page.screenshot({path:'.share/custom-scene-applied-desktop.png',fullPage:true});
 for(const viewport of [{width:1600,height:1000},{width:1024,height:900},{width:768,height:1024},{width:390,height:844}]){await page.setViewportSize(viewport);const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+2,JSON.stringify({viewport,size}));}
 await page.reload({waitUntil:'networkidle'});await page.locator('[data-custom-scene="'+scene.id+'"]').waitFor({state:'attached'});assert.equal(calls.filter(call=>call.kind==='scene').length,1);assert.equal(calls.filter(call=>call.kind==='photo').length,1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({sceneCreatedAndSaved:true,workspaceDeepLink:true,smartAnglesPreserved:true,ABInputsPreserved:true,realPhotographyRequestContainsScene:true,lateSceneCannotOverrideManualChoice:true,lateSceneCannotOverrideReferenceScope:true,librarySurvivesReload:true,viewports:4,mockImageRequests:2,paidRequests:0}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-custom-scene-ui-'));await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
