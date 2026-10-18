import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
await mkdir('output',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
await page.emulateMedia({reducedMotion:'reduce'});
await page.route('**/*',route=>{const u=route.request().url();return u.startsWith('http://127.0.0.1:4173/')||u.startsWith('data:')||u.startsWith('blob:')?route.continue():route.abort();});
const rects=()=>page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};return {images:rect('results'),shooting:rect('creationPanel'),detail:rect('detailPageModule'),details:rect('detailSettingsPanel'),hero:document.querySelector('#results .hero-frame').getBoundingClientRect().width,editor:document.querySelector('#results .gallery-browser').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth};});
try{
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.waitForSelector('#detailSettingsPanel');
 assert.equal(await page.locator('#ratio').inputValue(),'3:4');await page.locator('#ratio').selectOption('1:1');await page.locator('#resetBtn').click();assert.equal(await page.locator('#ratio').inputValue(),'3:4');
 assert.ok(await page.evaluate(()=>{const shoot=document.getElementById('shootSection').getBoundingClientRect(),generation=document.getElementById('generationPanel').getBoundingClientRect();return generation.top-shoot.bottom<25;}));
 assert.equal(await page.locator('#workspace>.topbar').count(),0);assert.equal(await page.locator('#creationPanel .panel-title h2').textContent(),'拍摄设置');assert.equal(await page.locator('.workspace-nav-bottom #promptAdminLink').count(),1);assert.equal(await page.locator('.workspace-nav-bottom #settingsBtn').count(),1);assert.equal(await page.locator('.workspace-nav-bottom #helpBtn').count(),1);
 let r=await rects();assert.ok(Math.abs(r.images.height-r.shooting.height)<3,JSON.stringify(r));assert.ok(r.hero>r.editor,JSON.stringify(r));assert.ok(r.overflow<3,JSON.stringify(r));assert.ok((await page.locator('#results .hero-frame').boundingBox()).height>800);assert.equal(await page.locator('#settingsBtn>span').isVisible(),true);assert.equal(await page.locator('#helpBtn>span').isVisible(),true);
 await page.screenshot({path:'output/paired-image-workspace-1920.png'});
 await page.locator('.workspace-nav-links a[href="#detailPageModule"]').click();await page.waitForFunction(()=>Math.abs(document.getElementById('detailPageModule').getBoundingClientRect().top-16)<3);
 await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.getElementById('detailDesignWorkspace').scrollIntoView({block:'start',behavior:'instant'});});
 r=await rects();assert.ok(Math.abs(r.detail.height-r.details.height)<3,JSON.stringify(r));assert.ok(r.shooting.bottom<50,JSON.stringify(r));assert.ok(r.details.top>=0&&r.details.top<40,JSON.stringify(r));
 await page.screenshot({path:'output/paired-detail-workspace-1920.png'});
 await page.locator('#detailPrompt').fill('保留本款真实花型与工艺');await page.locator('#detailSizes input[placeholder="长"]').fill('180');await page.locator('#detailSizes input[placeholder="宽"]').fill('220');await page.locator('#detailSizes .detail-size-custom button').click();assert.ok((await page.locator('#detailSizes').textContent()).includes('180×220'));
 await page.locator('#collapseDetailSettings').click();assert.ok(await page.locator('#detailDesignWorkspace').evaluate(e=>e.classList.contains('detail-settings-collapsed')));assert.equal(await page.locator('#creationPanel').evaluate(e=>e.inert),false);await page.locator('#reopenDetailSettings').click();assert.equal(await page.locator('#detailPrompt').inputValue(),'保留本款真实花型与工艺');
 await page.evaluate(()=>document.getElementById('imageDesignWorkspace').scrollIntoView({block:'start',behavior:'instant'}));await page.locator('#schemeCollapseSettings').click();assert.equal(await page.locator('#creationPanel').isVisible(),false);assert.equal(await page.locator('#detailSettingsPanel').evaluate(e=>e.inert),false);await page.locator('.scheme-reopen-settings').click();
 // Existing buttons remain real controls after moving into the left navigation.
 await page.locator('#helpBtn').click();assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);await page.locator('#modal .close-modal').click();
 await page.locator('#results>.workspace-section-header button').click();await page.waitForFunction(()=>document.getElementById('imageDesignWorkspace').classList.contains('image-workspace-closed'));assert.ok((await page.locator('#results').boundingBox()).height<100);await page.locator('.workspace-nav-links a[href="#results"]').click();await page.waitForFunction(()=>!document.getElementById('imageDesignWorkspace').classList.contains('image-workspace-closed'));
 for(const width of [1280,1024,768,390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(120);r=await rects();assert.ok(r.overflow<3,'horizontal overflow at '+width+': '+JSON.stringify(r));assert.ok(r.images.width>200&&r.shooting.width>200);if(width>=980)assert.ok(Math.abs(r.images.height-r.shooting.height)<3);if(width===390)await page.screenshot({path:'output/paired-workspace-mobile.png'});}
 await page.setViewportSize({width:1920,height:1080});await page.route('**/api/history',route=>route.fulfill({json:{images:[],trash:[]}}));await page.reload({waitUntil:'networkidle'});await page.waitForSelector('#detailSettingsPanel');assert.equal(await page.locator('.detail-design-empty').isVisible(),true);assert.equal(await page.locator('#detailResult').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Passed: paired heights, larger preview, local settings, independent collapse, left utility controls and 5 viewport sizes.');
}finally{await browser.close();}
