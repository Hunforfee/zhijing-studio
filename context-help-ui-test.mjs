import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';

const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-context-help-'));
let modelCalls=0,writes=0;
const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',baseUrl:'https://help-mock.invalid/v1',apiKey:'mock-help-only-key',model:'gpt-image-2'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async()=>{modelCalls++;throw Error('Help must not invoke a model');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>localStorage.setItem('zhijing-workspace-nav-guide-v1','seen'));
await page.emulateMedia({reducedMotion:'reduce'});
await page.route('**/*',route=>{const request=route.request();if(!['GET','HEAD'].includes(request.method())){writes++;return route.abort();}return request.url().startsWith(base)||/^(data|blob):/.test(request.url())?route.continue():route.abort();});
const question=key=>page.locator('[data-help-topic="'+key+'"]').first();
const dialog=()=>page.locator('#contextHelpDialog');
async function open(key){await question(key).click();await dialog().waitFor({state:'visible'});assert.equal(await question(key).getAttribute('aria-expanded'),'true');}
async function close(){await page.keyboard.press('Escape');await page.waitForFunction(()=>{const help=document.getElementById('contextHelpDialog');return !help.open&&!help.matches(':popover-open');});await page.waitForFunction(()=>document.activeElement?.matches('.zh-help-trigger'));}
try{
  await page.goto(base+'/workspace',{waitUntil:'networkidle'});await question('fabric').waitFor();
  const before=await page.evaluate(()=>JSON.stringify({product:state.product,fabric:state.fabric,a:state.upload,b:state.uploadB,scenes:state.scenes,angles:state.angles}));
  assert.equal(await page.locator('#fabricHint').isVisible(),false);assert.equal(await page.locator('#modeHint').isVisible(),true);
  const priorFocus=await page.evaluate(()=>[document.activeElement?.tagName,document.activeElement?.id,document.activeElement?.className].join('|'));await question('fabric').hover();await dialog().waitFor({state:'visible'});assert.equal(await dialog().evaluate(node=>node.matches(':popover-open')&&!node.open),true);assert.equal(await dialog().evaluate(node=>getComputedStyle(node,'::backdrop').backdropFilter),'none');assert.equal(await page.evaluate(()=>[document.activeElement?.tagName,document.activeElement?.id,document.activeElement?.className].join('|')),priorFocus);await dialog().hover();await page.waitForTimeout(300);assert.equal(await dialog().isVisible(),true);await page.mouse.move(5,5);await page.waitForFunction(()=>!document.getElementById('contextHelpDialog').matches(':popover-open'));assert.equal(await question('fabric').getAttribute('aria-expanded'),'false');
  await open('fabric');assert.match(await page.locator('#contextHelpContent').innerText(),/每面最多 8 张/);await close();
  assert.equal(await page.evaluate(()=>JSON.stringify({product:state.product,fabric:state.fabric,a:state.upload,b:state.uploadB,scenes:state.scenes,angles:state.angles})),before);
  await page.evaluate(()=>document.getElementById('fabricHint').textContent='当前所选质感：亚麻纹理');await open('fabric');assert.match(await page.locator('#contextHelpContent').innerText(),/亚麻纹理/);await close();
  await page.evaluate(()=>{const hint=document.getElementById('fabricHint');hint.setAttribute('role','status');hint.textContent='测试错误：需要重新选择';});await page.waitForFunction(()=>!document.getElementById('fabricHint').classList.contains('zh-help-source'));assert.equal(await page.locator('#fabricHint').getAttribute('role'),'status');
  await page.locator('#workspaceChooseAsset').click();await open('workspace-library');assert.equal(await page.locator('#workspaceLibraryDialog').evaluate(node=>node.open),true);await close();assert.equal(await dialog().evaluate(node=>node.parentElement===document.body),true);await page.locator('#workspaceLibraryDialog [data-close]').click();
  await page.goto(base+'/tools?tool=recolor',{waitUntil:'networkidle'});await open('tool');assert.ok((await page.locator('#contextHelpContent').innerText()).length>30);await close();
  await page.locator('[data-tool-link="extract"]').click();await open('tool');assert.match(await page.locator('#contextHelpContent').innerText(),/四角选择面料/);await close();assert.equal(await page.locator('#toolTitle .zh-help-trigger').count(),1);assert.equal(await page.locator('.tt-ai-charge:visible').count(),1);
  await page.goto(base+'/pattern-design',{waitUntil:'networkidle'});await open('designer-ai');assert.match(await page.locator('#contextHelpContent').innerText(),/例如/);await close();
  const printOpen=await question('designer-print').evaluate(node=>node.closest('details').open);await open('designer-print');await close();assert.equal(await question('designer-print').evaluate(node=>node.closest('details').open),printOpen);assert.equal(await page.locator('#pdResolution').isVisible(),true);
  for(const target of [{path:'/workspace',key:'fabric'},{path:'/scenes',key:'scene'},{path:'/tools?tool=hd',key:'hd-ai'}]){
    await page.setViewportSize({width:390,height:844});await page.goto(base+target.path,{waitUntil:'networkidle'});await open(target.key);
    const rect=await dialog().boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=390&&rect.y+rect.height<=844);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await close();
  }
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.route('**/*',route=>{const request=route.request();if(!['GET','HEAD'].includes(request.method())){writes++;return route.abort();}return request.url().startsWith(base)||/^(data|blob):/.test(request.url())?route.continue():route.abort();});
  await mobile.goto(base+'/scenes',{waitUntil:'networkidle'});assert.equal(await mobile.evaluate(()=>matchMedia('(hover: hover) and (pointer: fine)').matches),false);
  await mobile.locator('[data-help-topic="scene"]').tap();await mobile.locator('#contextHelpDialog[open]').waitFor({state:'visible'});await mobile.locator('.zh-help-close').tap();await mobile.waitForFunction(()=>!document.getElementById('contextHelpDialog').open);await mobile.close();
  await page.goto(base+'/library',{waitUntil:'networkidle'});const png=new PNG({width:24,height:24});png.data.fill(255);await page.locator('#alFile').setInputFiles({name:'help-preview.png',mimeType:'image/png',buffer:PNG.sync.write(png)});await page.locator('dialog.lib-save-dialog').waitFor({state:'visible'});await open('library-save-0');assert.match(await page.locator('#contextHelpContent').innerText(),/PNG/);await close();assert.equal(await dialog().evaluate(node=>node.parentElement===document.body),true);await page.locator('dialog.lib-save-dialog [data-cancel]').click();assert.equal(await dialog().count(),1);
  assert.equal(await page.locator('[role="status"].zh-help-source,[aria-live].zh-help-source').count(),0);
  assert.equal(writes,0);assert.equal(modelCalls,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({hoverWithoutClick:true,hoverDoesNotStealFocus:true,panelRemainsReadable:true,mouseleaveDismisses:true,clickAndEscape:true,focusRestored:true,nestedDialogSafe:true,liveHelpText:true,statusAndChargesVisible:true,settingsUnchanged:true,shortExamplesPreserved:true,mobileFits:true,touchClickWorks:true,writes,modelCalls}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-context-help-'));await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
