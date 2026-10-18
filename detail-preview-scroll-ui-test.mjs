import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),{chromium}=require('playwright');
const id='22222222-2222-4222-8222-222222222222',png=await readFile('dist/assets/set20-fresh/bedupper.png');
const images=Array.from({length:13},(_,i)=>({number:9000+i,jobId:id,detailGroupId:id,detailPage:true,detailSliceIndex:i,detailSliceTitle:'测试第'+(i+1)+'段',url:'/generated/'+id+'/'+(i+1)+'.png',createdAt:new Date().toISOString()}));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',route=>{const url=route.request().url();if(url.includes('/api/history'))return route.fulfill({json:{images,trash:[]}});if(url.includes('/generated/'+id+'/'))return route.fulfill({body:png,contentType:'image/png'});return url.startsWith('http://127.0.0.1:4173/')||url.startsWith('data:')||url.startsWith('blob:')?route.continue():route.abort();});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('#detailSlices .detail-slice').length===13);
 await page.locator('a[href="#detailPageModule"]').click();await page.locator('#detailSlices img').first().evaluate(i=>i.decode());
 const dimensions=await page.evaluate(()=>{const data=id=>{const el=document.getElementById(id),c=getComputedStyle(el),r=el.getBoundingClientRect();return {height:r.height,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflow:c.overflowY,display:c.display,flex:c.flex,heightRule:c.height};};return Object.fromEntries(['detailPageModule','detailResult','detailPreviewViewport','detailSlices'].map(id=>[id,data(id)]).concat([['content',{display:getComputedStyle(document.getElementById('detailPageModule'),'::details-content').display,height:getComputedStyle(document.getElementById('detailPageModule'),'::details-content').height}]]));});
 console.log(JSON.stringify(dimensions));
 if(process.argv.includes('--probe')){await page.screenshot({path:'output/detail-scroll-before.png'});}
 else{
  assert.ok(dimensions.detailPreviewViewport.scrollHeight>dimensions.detailPreviewViewport.clientHeight+1000,'long preview must overflow inside its viewport');
  assert.ok(dimensions.detailPreviewViewport.height<1000,'preview must fit the workspace');
  const top=await page.evaluate(()=>scrollY);
  await page.locator('#detailEditThumbs button').nth(8).click();
  await page.waitForFunction(()=>document.getElementById('detailPreviewViewport').scrollTop>1000);
  const aligned=await page.evaluate(()=>{const viewport=document.getElementById('detailPreviewViewport'),slice=document.querySelector('#detailSlices [data-slice-index="8"]');return Math.abs(slice.getBoundingClientRect().top-viewport.getBoundingClientRect().top);});
  assert.ok(aligned<5,'selected slice must align with the preview viewport');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-top)<3,'thumbnail click must not move the page');
  const viewport=page.locator('#detailPreviewViewport');await viewport.hover();const previous=await viewport.evaluate(e=>e.scrollTop);await page.mouse.wheel(0,500);await page.waitForFunction(value=>document.getElementById('detailPreviewViewport').scrollTop>value,previous);
  await page.locator('#detailPreviewSlider').fill('1000');assert.equal(await page.locator('#detailPreviewPercent').textContent(),'100%');
  await page.screenshot({path:'output/detail-scroll-fixed.png'});
  for(const width of [1280,1024,768,390]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
   assert.ok(await viewport.evaluate(e=>e.scrollHeight>e.clientHeight+1000),'preview still scrolls at '+width);
   assert.ok(await viewport.evaluate(e=>e.clientHeight<1000),'preview remains bounded at '+width);
   await page.locator('#detailEditThumbs button').nth(4).click();
   await page.waitForFunction(()=>document.getElementById('detailEditScope').value==='9004'&&document.getElementById('detailPreviewViewport').scrollTop>500);
   const delta=await page.evaluate(()=>Math.abs(document.querySelector('#detailSlices [data-slice-index="4"]').getBoundingClientRect().top-document.getElementById('detailPreviewViewport').getBoundingClientRect().top));assert.ok(delta<5,'thumbnail alignment at '+width);
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(items=>{const host=document.getElementById('historyDetailHost');host.hidden=false;document.getElementById('historyDialog').showModal();window.detailPages.openGroup(items,host);},images);
  assert.ok(await viewport.evaluate(e=>e.clientHeight<=620&&e.scrollHeight>e.clientHeight));
  await page.locator('#detailEditThumbs button').nth(10).click();
  await page.waitForFunction(()=>document.getElementById('detailEditScope').value==='9010'&&document.getElementById('detailPreviewViewport').scrollTop>1000);
  assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('#detailSlices [data-slice-index="10"]').getBoundingClientRect().top-document.getElementById('detailPreviewViewport').getBoundingClientRect().top)<5));
  await page.evaluate(()=>{window.detailPages.leaveHistory();document.getElementById('historyDialog').close();});
  assert.ok(await viewport.evaluate(e=>e.clientHeight<1000&&e.scrollHeight>e.clientHeight));
  assert.deepEqual(errors,[]);
  console.log('Passed: 13-slice scroll viewport, thumbnail-to-preview alignment, wheel scrolling and slider synchronization. No generation requests.');
 }
}finally{await browser.close();}
