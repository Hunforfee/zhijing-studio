import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const p=await b.newPage({viewport:{width:1366,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/');await p.waitForSelector('.scheme-picker');await p.locator('[data-scheme=B]').click();await p.locator('.group-product>.scheme-picker').click();
 assert.equal(await p.locator('.scheme-product-details #setVariantPanel .set-craft-group').count(),3);
 assert.ok(await p.locator('.scheme-product-details #setVariantPanel').isVisible());
 const r=await p.locator('.scheme-picker-dialog[open]').boundingBox();assert.ok(r.width>900);
 const counts=await p.locator('[data-set-variant]').evaluateAll(es=>es.map(e=>({text:e.textContent,visible:e.getBoundingClientRect().height>0,bottom:e.getBoundingClientRect().bottom})));assert.ok(counts.every(e=>e.visible&&e.bottom<748));
 await p.locator('[data-set-variant=fitted]').click();assert.ok(await p.locator('#setVariantPanel').isVisible());
 await p.locator('.scheme-picker-dialog[open]').screenshot({path:'output/产品分类-大弹窗.png'});
 await p.locator('[data-product=quilt]').click();assert.ok(await p.locator('.scheme-product-details #quiltVariantPanel').isVisible());await p.locator('[data-quilt-variant=winter]').click();assert.ok(await p.locator('#quiltVariantPanel').isVisible());
 await p.locator('.scheme-modal-backdrop').click({position:{x:5,y:5}});assert.equal(await p.locator('.scheme-picker-dialog[open]').count(),0);
 await p.locator('[data-scheme=A]').click();assert.equal(await p.locator('body>#setVariantPanel').count(),1);assert.deepEqual(errors,[]);
 console.log('Verified: default four-piece details, all craft options visible, large popup, category switching, selections stay open, outside dismissal and A restoration.');
}finally{await b.close();}
