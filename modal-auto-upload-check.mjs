import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const p=await b.newPage({viewport:{width:1366,height:768}});let recognition=0;
 await p.route('**/api/product-recognition',route=>{recognition++;return route.fulfill({status:503,body:'{}'});});
 await p.goto('http://127.0.0.1:4173/');await p.waitForSelector('.scheme-picker');await p.locator('[data-scheme=B]').click();
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
 await p.locator('#upload').setInputFiles({name:'A.png',mimeType:'image/png',buffer});await p.locator('#uploadInfo').waitFor({state:'visible'});await p.waitForTimeout(300);
 assert.equal(recognition,0);assert.ok(await p.locator('#productRecognitionDialog').evaluate(e=>!e.open));
 for(const selector of ['.group-product>.scheme-picker','#shootSection>.scheme-picker']){
  await p.locator(selector).click();const r=await p.locator('.scheme-picker-dialog[open]').boundingBox();assert.ok(Math.abs(r.x+r.width/2-683)<2);assert.ok(Math.abs(r.y+r.height/2-384)<2);
  await p.locator('.scheme-modal-backdrop').click({position:{x:5,y:5}});assert.equal(await p.locator('.scheme-picker-dialog[open]').count(),0);
 }
 await p.locator('.group-product>.scheme-picker').click();await p.locator('[data-product=set]').click();const r=await p.locator('#setVariantPanel').boundingBox();assert.ok(Math.abs(r.x+r.width/2-683)<2);
 await p.locator('#setVariantPanel [data-set-variant=fitted]').click();await p.locator('#setVariantPanel .set-variant-done').click();await p.locator('.scheme-modal-backdrop').click({position:{x:5,y:5}});
 assert.ok(await p.locator('.scheme-modal-backdrop').isHidden());console.log('Verified: no automatic product recognition after A upload; centered product, shooting and craft popups; outside dismissal and option selection.');
}finally{await b.close();}
