import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),{chromium}=require('playwright');
const id='640dcce6-45f8-4c02-9424-7fc47224ff90';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=route.request().url();return u.startsWith('http://127.0.0.1:4173/')||u.startsWith('data:')||u.startsWith('blob:')?route.continue():route.abort();});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.locator('a[href="#videoDesignModule"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.video-job').length>0);
 await page.locator('.video-records').evaluate(e=>e.open=true);
 await page.locator('.video-job').filter({hasText:'分层景深试片'}).click();
 await page.waitForFunction(pilot=>document.getElementById('videoPlayer').src.includes(pilot)&&document.getElementById('videoPlayer').readyState>=1,id);
 const player=page.locator('#videoPlayer');
 assert.equal(Math.round(await player.evaluate(v=>v.duration)),15);
 await player.evaluate(async v=>{v.muted=true;await v.play();});await page.waitForFunction(()=>document.getElementById('videoPlayer').currentTime>.3);
 await player.evaluate(v=>v.pause());
 for(const t of [1,6,11,14.6]){
  await player.evaluate((v,time)=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=time;}),t);
  await player.screenshot({path:'output/layered-pilot-'+String(t).replace('.','-')+'.png'});
 }
 await page.screenshot({path:'output/layered-pilot-desktop.png'});
 assert.equal(await page.locator('#videoMotionMode').inputValue(),'camera');assert.deepEqual(errors,[]);
 console.log('Passed: layered pilot appears in website history, plays for 15 seconds, seeks through all 3 shots, and preserves the existing default workflow.');
}finally{await browser.close();}
