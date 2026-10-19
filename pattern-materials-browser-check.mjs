import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-pattern-upload-ui-'));
const png=new PNG({width:64,height:64});for(let i=0;i<png.data.length;i+=4)png.data.set([150,175,130,255],i);const buffer=PNG.sync.write(png);
const calls=[],server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'mock-pattern-upload-key',baseUrl:'https://pattern-mock.example/v1',model:'gpt-image-2'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async(url,init)=>{
 calls.push(url);assert.equal(url,'https://pattern-mock.example/v1/images/edits');
 const names=init.body.getAll('image[]').map(file=>file.name);
 assert.ok(names.includes('fabric-A.png'));assert.ok(names.includes('fabric-B.png'));
 assert.deepEqual(names.slice(-3),['fabric-A-supplement-2.png','fabric-A-supplement-3.png','fabric-A-supplement-4.png']);
 assert.match(init.body.get('prompt'),/USER MULTI-IMAGE FABRIC MATERIALS/);
 return Response.json({data:[{b64_json:buffer.toString('base64')}]});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],analysisRequests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/api\/(pattern-materials\/analyze|product-recognition)$/.test(new URL(request.url()).pathname))analysisRequests.push(request.url());});
 await page.route('**/*',route=>route.request().url().startsWith(base)||/^(blob|data):/.test(route.request().url())?route.continue():route.abort());
 await page.addInitScript(()=>localStorage.setItem('zhijing-workspace-nav-guide-v1','seen'));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/workspace',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.patternMaterials&&!document.body.classList.contains('is-booting'));
 await page.evaluate(()=>{chosenDuvetVariant='lace';state.productVariantChoices={...state.productVariantChoices,set:false};state.fabricMode='auto';state.fabric='cotton';renderOptions();renderSelections();});
 const file=name=>({name:name+'.png',mimeType:'image/png',buffer});
 const count=async(side,n)=>page.waitForFunction(({side,n})=>document.querySelector((side==='A'?'#uploadInfo':'#uploadInfoB')+' .pattern-material-count').textContent===n+' 张 · 管理',{side,n});
 await page.locator('#upload').setInputFiles(file('主花型'));await count('A',1);
 await page.locator('#upload').setInputFiles([file('工艺细节'),file('纹理细节')]);await count('A',3);
 await page.locator('#uploadB').setInputFiles([file('B主图'),file('B细节')]);await count('B',2);
 // Wait beyond the former automatic-analysis debounce to detect accidental submissions.
 await page.waitForTimeout(900);assert.deepEqual(calls,[]);assert.deepEqual(analysisRequests,[]);assert.equal(await page.locator('.pattern-material-status').count(),0);assert.equal(await page.getByRole('button',{name:'重新分析',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>chosenDuvetVariant),'lace');assert.equal(await page.evaluate(()=>state.fabric),'cotton');assert.equal(await page.evaluate(()=>state.fabricMode),'auto');
 let payload=await page.evaluate(()=>globalThis.patternMaterials.payload());assert.equal(payload.patternMaterials.A.length,2);assert.equal(payload.patternMaterials.B.length,1);assert.equal(Object.hasOwn(payload.patternMaterials,'observations'),false);
 await page.locator('#uploadInfo .pattern-material-count').click();assert.equal(await page.locator('.pattern-material-list>section').count(),3);await page.locator('.pattern-material-list>section').nth(1).getByText('设为主图').click();await page.waitForFunction(()=>state.upload.file.name==='工艺细节.png');await page.locator('.pattern-material-manager [data-close]').click();
 await page.locator('#resetBtn').click();assert.equal(await page.locator('#uploadInfo').isHidden(),true);await page.locator('#restoreLastPatterns').click();await count('A',3);await count('B',2);await page.waitForFunction(()=>!restoringLastPatterns);
 payload=await page.evaluate(()=>globalThis.patternMaterials.payload());assert.equal(payload.patternMaterials.A.length,2);assert.equal(payload.patternMaterials.B.length,1);
 await page.locator('#uploadInfoB .pattern-material-count').click();await page.locator('.pattern-material-list>section').nth(1).getByText('移除',{exact:true}).click();await count('B',1);await page.locator('.pattern-material-manager [data-close]').click();
 await page.locator('#upload').setInputFiles(file('额外细节'));await count('A',4);await page.waitForTimeout(700);assert.deepEqual(calls,[]);assert.deepEqual(analysisRequests,[]);
 await page.locator('#uploadB').setInputFiles(Array.from({length:8},(_,i)=>file('超限'+i)));assert.equal(await page.locator('#uploadInfoB .pattern-material-count').textContent(),'1 张 · 管理');
 await page.evaluate(()=>{state.setCounts={main:1,duvet:0,sheet:0,pillow:0};renderSelections();});const submitted=page.waitForRequest(request=>request.url()===base+'/api/jobs'&&request.method()==='POST');await page.locator('#generateBtn').click();const request=(await submitted).postDataJSON();assert.equal(request.patternMaterials.A.length,3);assert.equal(request.patternMaterials.B.length,0);assert.ok(request.imageB);assert.equal(Object.hasOwn(request.patternMaterials,'observations'),false);await page.waitForFunction(()=>state.results.some(item=>item.ai&&!item.reference));
 assert.equal(calls.length,1);assert.deepEqual(analysisRequests,[]);assert.deepEqual(errors,[]);
 await mkdir('.share',{recursive:true});await page.locator('#creationPanel').screenshot({path:'.share/pattern-upload-no-analysis.png'});
 console.log(JSON.stringify({automaticAnalysisRequests:0,analysisUIRemoved:true,manualCraftAndTexturePreserved:true,multiUploadAndPrimarySelection:true,resetRestoreAndRemoval:true,supplementalImagesReachGeneration:true,mockGenerationRequests:1,paidRequests:0}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-pattern-upload-ui-'));await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
