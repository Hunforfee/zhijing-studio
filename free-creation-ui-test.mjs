import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),{chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-free-ui-')),payloads=[];
const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'synthetic-free-ui-key',baseUrl:'https://fixture.example/v1',model:'gpt-image-2.5-flare'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async(url,init)=>{
  assert.equal(url,'https://fixture.example/v1/images/edits');payloads.push({prompt:init.body.get('prompt'),images:init.body.getAll('image[]').length,size:init.body.get('size')});
  const bytes=Buffer.from(await init.body.getAll('image[]')[0].arrayBuffer()),png=PNG.sync.read(bytes);
  for(let i=0;i<png.data.length;i+=4){png.data[i]=Math.min(255,png.data[i]+8);png.data[i+2]=Math.max(0,png.data[i+2]-8);}
  return Response.json({data:[{b64_json:PNG.sync.write(png).toString('base64')}]});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('zhijing-workspace-nav-guide-v1','seen'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',route=>{const url=route.request().url();return url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:')?route.continue():route.abort();});
  await page.goto(base);await page.waitForSelector('#freeCreationWorkspace');
  const nav=page.locator('.workspace-nav-links a[href="#freeCreationWorkspace"]');assert.equal(await nav.textContent(),'自由创作');await nav.click();
  await page.waitForFunction(()=>document.getElementById('freeCreationWorkspace').getBoundingClientRect().top<32);
  assert.equal(await page.locator('#fcEmpty').isVisible(),true);assert.equal(await page.locator('#fcRatio').inputValue(),'3:4');
  await page.locator('#fcUploadFile').setInputFiles('dist/assets/scene-photos/warm-v1.png');
  await page.waitForSelector('.fc-version');assert.equal(await page.locator('#fcEmpty').isVisible(),false);assert.equal(await page.locator('#fcGenerate').isDisabled(),true);
  await page.locator('[data-free-mode="scene"]').click();assert.match(await page.locator('#fcPrompt').inputValue(),/原木卧室/);
  await page.locator('#fcReferenceFile').setInputFiles('dist/assets/scene-photos/natural-v1.png');await page.waitForSelector('#fcReference:not([hidden])');
  await page.locator('#fcSelect').click();const plane=await page.locator('#fcImagePlane').boundingBox();
  await page.mouse.move(plane.x+plane.width*.25,plane.y+plane.height*.25);await page.mouse.down();await page.mouse.move(plane.x+plane.width*.65,plane.y+plane.height*.65,{steps:8});await page.mouse.up();
  assert.equal(await page.locator('#fcRatio').inputValue(),'source');assert.equal(await page.locator('#fcRatio').isDisabled(),true);
  await page.locator('#fcGenerate').click();await page.waitForFunction(()=>document.querySelectorAll('.fc-version').length===2,{},{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.fc-version[aria-pressed="true"]>span')?.textContent==='V1');
  assert.equal(payloads.length,1);assert.equal(payloads[0].images,2);assert.match(payloads[0].prompt,/normalized rectangle/);
  await page.locator('#fcViewOriginal').click();assert.equal(await page.locator('#fcViewOriginal').getAttribute('aria-pressed'),'true');
  await page.locator('#fcViewCurrent').click();assert.equal(await page.locator('#fcDownload').isVisible(),true);
  for(const size of [{width:1920,height:1080},{width:1440,height:900},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
    await page.setViewportSize(size);await nav.click();await page.waitForTimeout(120);
    const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,main:document.querySelector('.fc-main').getBoundingClientRect().toJSON(),rail:document.querySelector('.fc-rail').getBoundingClientRect().toJSON()}));
    assert.ok(dimensions.scroll<=dimensions.width+2,JSON.stringify({size,dimensions}));
    assert.ok(dimensions.main.width>200);if(size.width>850)assert.ok(Math.abs(dimensions.main.height-dimensions.rail.height)<2);
  }
  await page.setViewportSize({width:1920,height:1080});await nav.click();await page.locator('#fcViewOriginal').click();await mkdir('.share',{recursive:true});await page.screenshot({path:'.share/free-creation-desktop.png'});
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.fc-version').length===2);await nav.click();
  await page.locator('#fcRecords').click();await page.waitForSelector('#fcLibraryGrid>button');await page.locator('#fcLibraryGrid>button').first().click();assert.equal(await page.locator('#fcLibraryDialog').evaluate(dialog=>dialog.open),false);
  assert.equal(payloads.length,1);assert.deepEqual(errors,[]);console.log(JSON.stringify({navigation:true,upload:true,reference:true,region:true,versions:true,comparison:true,restore:true,records:true,viewports:5,paidRequests:0}));
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  if(!path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-free-ui-'))throw Error('Unexpected temporary path');await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
