import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createServer} from './server.mjs';
import {draftStoryboard} from './dist/video-storyboard.js';

const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-video-runtime-ui-'));
let providerCalls=0,submissions=0;
const server=createServer({outputDir,service:{provider:'sub2api',apiKey:'synthetic-runtime-ui-key',model:'test-image',baseUrl:'https://example.invalid/v1'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async()=>{providerCalls++;throw Error('No real provider requests allowed');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const story=draftStoryboard({topic:'daily',product:'set',duration:15,people:'none',brief:'展示床品细节',facts:''},1);
  story.productReference={description:'真实产品花型',swatches:[{sourceIndex:0,x:.2,y:.2,width:.4,height:.4,side:'A'}]};
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===base){
      if(url.pathname==='/api/video/storyboard')return route.fulfill({json:{storyboard:story}});
      if(url.pathname==='/api/video/jobs'&&route.request().method()==='POST')submissions++;
      return route.continue();
    }
    return url.protocol==='data:'||url.protocol==='blob:'?route.continue():route.abort();
  });
  await page.goto(base);
  await page.waitForSelector('#videoGenerate',{state:'attached'});
  await page.locator('#videoSourceFile').setInputFiles('dist/assets/crafts/wide-flange.png');
  await page.locator('#videoProduct').selectOption('set');
  await page.locator('#videoPlanScript').click();
  await page.waitForFunction(()=>document.querySelectorAll('.video-shot-card').length===3);
  await page.locator('#videoGenerate').click();
  await page.waitForFunction(()=>document.getElementById('videoStatus').textContent.includes('服务器的视频剪辑组件未就绪'));
  assert.equal(submissions,0);assert.equal(providerCalls,0);
  assert.equal(await page.locator('#videoGenerate').isEnabled(),true);
  assert.equal(await page.locator('#videoConfigDialog').evaluate(element=>element.open),false);
  console.log(JSON.stringify({missingCloudComposerShown:true,imageUploadsBlocked:true,videoKeyNotRequired:true,providerCalls,submissions}));
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  if(!path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-video-runtime-ui-'))throw Error('Unexpected temporary directory');
  await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
