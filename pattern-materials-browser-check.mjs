import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {productRecognitionCatalog} from './product-recognition.mjs';
const catalog=(await productRecognitionCatalog()).filter(x=>x.id==='set');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let analyses=0;
 await page.route('**/api/pattern-materials/analyze',async route=>{
  const request=route.request().postDataJSON();analyses++;assert.ok(request.images.A.length+request.images.B.length>=2);
  await route.fulfill({json:{observations:{A:{pattern:'青绿花叶',craft:'被套可见平整宽边',texture:'丝滑光泽',uncertain:'未知实际成分'}},product:request.product,catalog,craftChoices:{duvetCraft:{id:'wide-flange',evidence:'平整无填充边'}},textureChoice:{id:'smooth-silk',evidence:'可见柔和缎光'}}});
 });
 await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>!!globalThis.patternMaterials);await page.waitForFunction(()=>!document.body.classList.contains('is-booting'));
 assert.equal(await page.locator('#fabricGroupTitle').innerText().then(x=>x.includes('与面料')),false);
 const buffer=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
 const file=n=>({name:n+'.png',mimeType:'image/png',buffer});
 await page.locator('#upload').setInputFiles(file('主花型'));await page.locator('#uploadInfo').waitFor({state:'visible'});await page.waitForTimeout(700);assert.equal(analyses,0);
 await page.locator('#upload').setInputFiles([file('工艺细节'),file('纹理细节')]);await page.waitForFunction(()=>document.querySelector('.pattern-material-status').textContent.includes('已分析'));
 assert.ok(await page.locator('.pattern-material-status').isVisible(),'Analysis state should be visible beside materials');
 assert.equal(await page.locator('#uploadInfo .pattern-material-count').innerText(),'3 张 · 管理');
 assert.equal(await page.evaluate(()=>state.product),'set');assert.equal(await page.evaluate(()=>chosenDuvetVariant),'wide-flange');assert.equal(await page.evaluate(()=>state.fabric),'smooth-silk');
 await page.locator('#uploadB').setInputFiles([file('B主图'),file('B细节')]);await page.waitForTimeout(800);await page.evaluate(()=>globalThis.patternMaterials.ready());
 let payload=await page.evaluate(()=>globalThis.patternMaterials.payload());assert.equal(payload.patternMaterials.A.length,2);assert.equal(payload.patternMaterials.B.length,1);
 await page.locator('#uploadInfo .pattern-material-count').click();assert.equal(await page.locator('.pattern-material-list>section').count(),3);
 await page.locator('.pattern-material-list>section').nth(1).getByText('设为主图').click();await page.waitForTimeout(800);await page.evaluate(()=>globalThis.patternMaterials.ready());assert.equal(await page.evaluate(()=>state.upload.file.name),'工艺细节.png');
 await page.locator('.pattern-material-manager [data-close]').click();
 await page.locator('#resetBtn').click();assert.ok(await page.locator('#uploadInfo').isHidden());await page.locator('#restoreLastPatterns').click();await page.waitForFunction(()=>document.querySelector('#uploadInfo .pattern-material-count').textContent==='3 张 · 管理'&&!document.querySelector('#uploadInfo').hidden);await page.waitForTimeout(700);await page.evaluate(()=>globalThis.patternMaterials.ready());
 payload=await page.evaluate(()=>globalThis.patternMaterials.payload());assert.equal(payload.patternMaterials.A.length,2);assert.equal(payload.patternMaterials.B.length,1);
 await page.locator('#uploadInfoB .pattern-material-count').click();await page.locator('.pattern-material-list>section').nth(1).getByText('移除',{exact:true}).click();await page.waitForTimeout(700);await page.evaluate(()=>globalThis.patternMaterials.ready());payload=await page.evaluate(()=>globalThis.patternMaterials.payload());assert.equal(payload.patternMaterials.B.length,0);
 await page.locator('.pattern-material-manager [data-close]').click();
 await page.evaluate(()=>{state.productVariantChoices.set=true;chosenDuvetVariant='lace';state.fabricMode='selected';state.fabric='cotton';renderOptions();renderSelections();});
 await page.locator('#upload').setInputFiles(file('额外细节'));await page.waitForTimeout(800);await page.evaluate(()=>globalThis.patternMaterials.ready());
 assert.equal(await page.evaluate(()=>chosenDuvetVariant),'lace');assert.equal(await page.evaluate(()=>state.fabric),'cotton');
 await page.locator('#uploadB').setInputFiles(Array.from({length:8},(_,i)=>file('超限'+i)));assert.equal(await page.locator('#uploadInfoB .pattern-material-count').innerText(),'1 张 · 管理');
 await page.locator('#creationPanel').screenshot({path:'output/花型-多图上传.png'});
 assert.deepEqual(errors,[]);console.log('Verified multi-select, append, no single-image auto-analysis, multi-image craft/texture matching, A/B payloads, primary selection, reset/restore and per-image removal; all AI responses mocked.');
}finally{await browser.close();}
