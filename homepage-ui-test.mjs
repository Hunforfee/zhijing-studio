import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createServer} from './server.mjs';

let require=createRequire(import.meta.url),chromium;
try { ({chromium}=require('playwright')); }
catch { require=createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM||'C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');({chromium}=require('playwright')); }
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-home-ui-'));
const providerCalls=[];
const server=createServer({outputDir,stylingReferencePaths:[],service:{apiKey:'',provider:'compatible',model:'test',baseUrl:'https://example.invalid/v1'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async(...args)=>{providerCalls.push(args);throw Error('No provider calls allowed');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[],mutations=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
  page.on('request',request=>{if(request.method()==='POST')mutations.push(request.url());});
  await page.addInitScript(()=>localStorage.setItem('zhijing-workspace-nav-guide-v1','seen'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',route=>{const url=route.request().url();return url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:')?route.continue():route.abort();});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('#heroTitle').waitFor();
  assert.equal(await page.locator('#workspace').count(),0);
  const expectedTools=['/pattern-design',...['hd','extract','recolor','repeat','board','delivery','copy'].map(id=>'/tools?tool='+id),'/scenes'];
  assert.deepEqual(await page.locator('.utility-card').evaluateAll(elements=>elements.map(element=>element.getAttribute('href'))),expectedTools);
  for(const href of expectedTools){
    const card=page.locator('.utility-card[href="'+href+'"]');await card.scrollIntoViewIfNeeded();
    assert.equal(await card.locator('.cover-demo').textContent(),'效果示意');assert.match(await card.locator('h2').textContent(),/^AI /);
    assert.equal(await card.evaluate(element=>{const box=element.getBoundingClientRect();return document.elementFromPoint(box.left+box.width/2,Math.max(box.top+50,box.top+box.height/3))?.closest('a')===element;}),true,'Effect art is an actual clickable link: '+href);
    await card.click({position:{x:Math.min(90,(await card.boundingBox()).width/2),y:90}});
    await page.waitForURL(url=>url.pathname===(href==='/scenes'?'/scenes':href==='/pattern-design'?'/pattern-design':'/tools'));
    await page.locator(href==='/scenes'?'#sceneStudio':href==='/pattern-design'?'#pdCanvas':'#toolPanels').waitFor({state:'attached'});
    if(href.startsWith('/tools'))assert.equal(new URL(page.url()).search,new URL(base+href).search);
    await page.goto(base,{waitUntil:'networkidle'});
  }
  for(const element of await page.locator('.cover-art>img,.tool-card>img,.ambient-photo>img,.inspiration-card>img').all()){await element.scrollIntoViewIfNeeded();await element.evaluate(image=>image.decode());}
  assert.equal(await page.locator('.faq-list').count(),0);
  assert.equal(await page.locator('figure.inspiration-card').count(),2);
  assert.equal(await page.locator('.ambient-photo a,.inspiration-card a').count(),0);
  assert.equal(await page.locator('.ambient-photo>img,.inspiration-card>img').evaluateAll(images=>images.every(image=>!image.closest('a'))),true);
  await mkdir('.share',{recursive:true});
  for(const size of [{width:1920,height:1080},{width:1440,height:1000},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:360,height:800}]) {
    await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.utility-card,.tool-card')].map(element=>element.getBoundingClientRect().width)}));
    assert.ok(layout.scroll<=layout.width+1,JSON.stringify({size,layout}));assert.ok(layout.cards.every(width=>width>140));
    for(const card of await page.locator('.utility-card').all()){
      await card.scrollIntoViewIfNeeded();
      const bounds=await card.evaluate(element=>{const a=element.getBoundingClientRect(),b=element.querySelector('.cover-caption').getBoundingClientRect();return{card:{left:a.left,right:a.right,top:a.top,bottom:a.bottom},caption:{left:b.left,right:b.right,top:b.top,bottom:b.bottom}};});
      assert.ok(bounds.caption.left>=bounds.card.left&&bounds.caption.right<=bounds.card.right&&bounds.caption.top>=bounds.card.top&&bounds.caption.bottom<=bounds.card.bottom,JSON.stringify({size,bounds}));
    }
    await page.evaluate(async()=>{scrollTo(0,0);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
    if(size.width===1440){await page.screenshot({path:'.share/homepage-desktop.png',fullPage:true});await page.screenshot({path:'.share/homepage-first-screen.png'});}
    if(size.width===390)await page.screenshot({path:'.share/homepage-mobile.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#menuToggle').click();assert.equal(await page.locator('#siteNav').isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#siteNav').isVisible(),false);
  await page.locator('#menuToggle').click();await page.locator('#siteNav a[href="#toolbox"]').click();assert.equal(await page.locator('#siteNav').isVisible(),false);
  await page.setViewportSize({width:1440,height:1000});await page.locator('.header-cta').click();await page.locator('#freeCreationWorkspace').waitFor();
  assert.equal(new URL(page.url()).pathname,'/workspace');assert.equal(await page.locator('#ratio').inputValue(),'3:4');
  for(const id of ['results','detailPageModule','videoDesignModule','freeCreationWorkspace'])await page.locator('#'+id).waitFor({state:'attached'});
  for(const target of ['detailPageModule','videoDesignModule','freeCreationWorkspace','results']) {
    console.log('Checking workspace entry: '+target);
    await page.locator('.workspace-nav-brand').click();await page.locator('#heroTitle').waitFor();
    await page.locator('.tool-card[href="/workspace#'+target+'"]').click();
    const scrollId=target==='videoDesignModule'?'videoDesignWorkspace':target;
    await page.waitForFunction(id=>{const element=document.getElementById(id);return !!element&&Math.abs(element.getBoundingClientRect().top)<40;},scrollId).catch(async error=>{console.log(JSON.stringify(await page.evaluate(()=>({url:location.href,scrollY,hash:location.hash,targets:[...document.querySelectorAll('#results,#detailPageModule,#videoDesignWorkspace,#freeCreationWorkspace')].map(element=>({id:element.id,top:element.getBoundingClientRect().top,open:element.open})),links:[...document.querySelectorAll('.workspace-nav-links a')].map(element=>element.outerHTML)}))));console.log(JSON.stringify({errors}));throw error;});
    assert.equal(new URL(page.url()).hash,'#'+target);
    if(['detailPageModule','videoDesignModule'].includes(target))assert.equal(await page.locator('#'+target).evaluate(element=>element.open),true);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(id=>{const element=document.getElementById(id);return !!element&&Math.abs(element.getBoundingClientRect().top)<40;},scrollId).catch(async error=>{console.log(JSON.stringify(await page.evaluate(()=>({reload:true,url:location.href,scrollY,ready:document.readyState,targets:[...document.querySelectorAll('#results,#detailPageModule,#videoDesignWorkspace,#freeCreationWorkspace')].map(element=>({id:element.id,top:element.getBoundingClientRect().top,open:element.open})),images:[...document.images].filter(image=>!image.complete).map(image=>image.src)}))));throw error;});
  }
  await page.goto(base+'/#freeCreationWorkspace',{waitUntil:'networkidle'});await page.waitForURL('**/workspace#freeCreationWorkspace');await page.locator('#fcUploadFile').waitFor({state:'attached'});
  assert.equal(new URL(page.url()).pathname,'/workspace');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(mutations,[]);assert.equal(providerCalls.length,0);
  console.log(JSON.stringify({home:true,clickableEffectImages:9,sceneStudio:true,illustrationsLabeled:true,mobileMenu:true,workspace:true,originalFeatureEntries:4,refreshDeepLinks:true,legacyBookmark:true,viewports:6,paidRequests:0}));
} finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));
  assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-home-ui-'));
  await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
