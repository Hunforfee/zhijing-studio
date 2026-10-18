import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto('http://127.0.0.1:4173/');await page.waitForSelector('#schemeCollapseSettings');await page.locator('[data-scheme=B]').click();
 await page.evaluate(()=>{window.recognizeUploadedProduct=()=>{};});
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
 for(const [input,info,button] of [['upload','uploadInfo','uploadBtn'],['uploadB','uploadInfoB','uploadBtnB']]){
  await page.locator('#'+input).setInputFiles({name:'花型.png',mimeType:'image/png',buffer});await page.locator('#'+info).waitFor({state:'visible'});
  const b=await page.locator('#'+button).boundingBox(),i=await page.locator('#'+info).boundingBox();assert.ok(Math.abs(i.y-b.y)<=2);assert.ok(i.height<=b.height);assert.equal(await page.locator('#'+info+' img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
 }
 const chooser=page.waitForEvent('filechooser');await page.locator('#uploadBtn').click();await chooser;
 const widthBefore=await page.locator('#results').evaluate(e=>e.getBoundingClientRect().width);
 await page.locator('#schemeCollapseSettings').click();await page.waitForTimeout(300);
 assert.ok(await page.locator('#creationPanel').evaluate(e=>e.inert));assert.ok(await page.locator('.scheme-reopen-settings').isVisible());
 assert.ok(await page.locator('#results').evaluate(e=>e.getBoundingClientRect().width)>widthBefore);
 await page.locator('.scheme-reopen-settings').click();assert.equal(await page.locator('#creationPanel').evaluate(e=>e.inert),false);await page.waitForTimeout(300);
 await page.locator('#removeUploadB').click();assert.ok(await page.locator('#uploadInfoB').isHidden());
 await page.locator('#schemeCollapseSettings').click();await page.locator('[data-scheme=A]').click();assert.equal(await page.locator('#creationPanel').evaluate(e=>e.inert),false);
 console.log('Verified: A/B in-frame thumbnails, click replacement, removal, slide-out/reopen, wider artwork area, and scheme A accessibility.');
}finally{await browser.close();}
