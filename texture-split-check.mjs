import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/');await page.waitForSelector('.scheme-texture-library');await page.locator('[data-scheme=B]').click();
 assert.equal(await page.locator('.scheme-texture-controls').evaluate(e=>e.clientHeight),42);
 await page.locator('.scheme-texture-library').click();await page.locator('#fabricPickerPanel').waitFor({state:'visible'});
 const panel=await page.locator('#fabricPickerPanel').boundingBox();assert.ok(panel.x>200);
 await page.locator('#fabricPickerPanel [data-fabric="auto"]').click();
 const chooser=page.waitForEvent('filechooser');await page.locator('.scheme-texture-upload').click();await chooser;
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
 await page.locator('#textureReferenceFile').setInputFiles({name:'质感参考.png',mimeType:'image/png',buffer});
 await page.locator('#textureUploadInfo').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('.scheme-texture-upload').textContent.includes('更换参考'));
 await page.locator('.scheme-texture-library').click();assert.ok(await page.locator('#fabricPickerPanel').isVisible());assert.ok(await page.locator('#textureCustomControl').isHidden());
 await page.locator('.breadcrumb').click();
 await page.locator('[data-scheme=A]').click();assert.ok(await page.locator('.scheme-texture-controls').isHidden());assert.ok(await page.locator('#textureLibraryBtn').isVisible());
 assert.deepEqual(errors,[]);console.log('Verified: same compact height, dropdown placement and selection, direct upload, reference replacement, library switching, scheme A restored.');
}finally{await browser.close();}
