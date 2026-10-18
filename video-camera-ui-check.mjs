import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{const u=route.request().url();return u.startsWith('http://127.0.0.1:4173/')||u.startsWith('data:')||u.startsWith('blob:')?route.continue():route.abort();});
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.locator('a[href="#videoDesignModule"]').click();
  assert.equal(await page.locator('#videoMotionMode').inputValue(),'camera');
  await page.waitForFunction(()=>document.getElementById('videoServiceStatus').textContent.includes('无视频模型费用'));
  assert.equal(await page.locator('#videoConfigure').isVisible(),false);
  await page.locator('#videoPlayer').evaluate(async video=>{video.src='/api/video/jobs/58af31c6-10cd-4a02-9a02-15046a3d0322/content';video.hidden=false;video.muted=true;await video.play();});
  await page.waitForFunction(()=>document.getElementById('videoPlayer').currentTime>.2);
  assert.equal(Math.round(await page.locator('#videoPlayer').evaluate(v=>v.duration)),15);
  await page.locator('#videoPlayer').evaluate(v=>{v.pause();v.currentTime=13;});
  await page.waitForTimeout(300);await page.screenshot({path:'output/camera-remaster-desktop.png'});
  await page.locator('#videoMotionMode').selectOption('ai');await page.waitForFunction(()=>!document.getElementById('videoConfigure').hidden);
  await page.locator('#videoMotionMode').selectOption('camera');
  for(const width of [1280,768,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<3));}
  await page.screenshot({path:'output/camera-remaster-mobile.png'});assert.deepEqual(errors,[]);console.log('Passed: stable camera default, mode controls, actual remastered MP4 playback and responsive layout. No external generation.');
}finally{await browser.close();}
