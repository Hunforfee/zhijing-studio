import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const p=await b.newPage({viewport:{width:1366,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/');await p.waitForSelector('.scheme-texture-entry');await p.waitForFunction(()=>!document.body.classList.contains('is-booting'));await p.locator('[data-scheme=B]').click();
 const left=await p.locator('.scheme-product-texture-row .scheme-picker').boundingBox(),right=await p.locator('.scheme-texture-entry').boundingBox();assert.ok(left.x<right.x&&Math.abs(left.y-right.y)<2);
 await p.locator('.scheme-texture-entry').click();assert.ok(await p.locator('.scheme-picker-dialog[data-picker=texture] #fabricPickerPanel').isVisible());
 await p.locator('[data-fabric=auto]').click();assert.ok(await p.locator('.scheme-picker-dialog[data-picker=texture]').evaluate(e=>e.open));
 const choose=p.waitForEvent('filechooser');await p.locator('.scheme-texture-upload').click();await choose;
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');await p.locator('#textureReferenceFile').setInputFiles({name:'参考.png',mimeType:'image/png',buffer});await p.locator('#textureUploadInfo').waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelector('.scheme-texture-entry small').textContent==='已上传参考');
 await p.locator('.scheme-picker-dialog[data-picker=texture]').screenshot({path:'output/面料质感-子菜单.png'});
 await p.locator('.scheme-modal-backdrop').click({position:{x:5,y:5}});
 await p.evaluate(()=>{state.results=referenceEntries();renderResults();});
 await p.locator('.scheme-product-texture-row .scheme-picker').click();await p.locator('[data-product=mat]').click();
 assert.equal(await p.locator('#thumbnails .thumbnail').count(),0);assert.ok(await p.locator('#heroImage').isHidden());assert.equal(await p.locator('#galleryCount').innerText(),'0 张');
 await p.locator('[data-product=quilt]').click();assert.equal(await p.locator('#thumbnails .thumbnail').count(),0);
 await p.locator('.scheme-modal-backdrop').click({position:{x:5,y:5}});
 await p.locator('#creationPanel').screenshot({path:'output/创作设置-产品质感并排.png'});
 await p.locator('[data-scheme=A]').click();assert.equal(await p.locator('#patternSection .texture-choice-field').count(),1);assert.equal(await p.locator('body>#fabricPickerPanel').count(),1);assert.deepEqual(errors,[]);
 console.log('Verified: product and texture side by side, texture modal library selection/direct upload/summary/outside dismissal, empty results on product switch, scheme A restored.');
}finally{await b.close();}
