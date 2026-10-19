import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {PNG} from 'pngjs';import {createServer} from './server.mjs';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),{chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-workflow-c-'));let calls=0,releasePlan;const planGate=new Promise(resolve=>releasePlan=resolve);
const plan={title:'原木花语',note:'让面料与自然光一起成为提案的主角。',colors:['#87977B','#C9D0B7','#ECE6D9','#AD8D6A'],order:[1,0],layout:'focus',background:'#F6F3EA',reason:'以空间为主图，织物细节辅助表达。'};
const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'mock-workflow-only-key',baseUrl:'https://mock-workflow.invalid/v1',model:'gpt-image-2'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async(url)=>{assert.ok(url.endsWith('/responses'));calls++;await planGate;return Response.json({output_text:JSON.stringify(plan)});}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/*',route=>route.request().url().startsWith(base)||/^(blob|data):/.test(route.request().url())?route.continue():route.abort());
try{
  await page.goto(base+'/tools?tool=board',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.toolbox-workflow').count(),1);assert.equal(await page.locator('#toolNavigation [data-tool-link]').count(),7);assert.equal(await page.locator('.toolbox-title .wf-steps button').count(),3);
  assert.ok(await page.locator('#wfExport').isDisabled());assert.ok(await page.locator('#wfSaveAsset').isDisabled());assert.equal(calls,0);
  const compact=await page.evaluate(()=>({toolbar:document.querySelector('.toolbox-title').getBoundingClientRect().height,workspaceTop:document.querySelector('#panel-board .wf-input').getBoundingClientRect().top}));
  assert.ok(compact.toolbar<=48&&compact.workspaceTop<=180,JSON.stringify(compact));
  const contrast=await page.evaluate(()=>{
    const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
    const luminance=value=>rgb(value).slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    const selectors=['#toolTitle','.wf-steps button','.wf-section-heading h2','.tt-ai-charge','.tt-empty p','.wf-candidate-empty strong','.wf-candidate-empty p','.tt-field>span','.tt-ai-brief','.tt-primary','.tt-secondary','.library-result-actions button','.tt-field input:not([type=range]):not([type=color]):not([type=checkbox])','.tt-field textarea','.tt-field select'];
    return [...document.querySelectorAll(selectors.join(','))].filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden').map(node=>{
      let background=node;while(background&&((rgb(getComputedStyle(background).backgroundColor)[3]??1)===0))background=background.parentElement;
      const fg=luminance(getComputedStyle(node).color),bg=luminance(background?getComputedStyle(background).backgroundColor:'rgb(255,255,255)');
      return {label:node.id||node.className,ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
    });
  });
  for(const item of contrast)assert.ok(item.ratio>=4.5,JSON.stringify(item));
  const room=await readFile('dist/assets/scene-photos/natural-v1.png'),fabric=await readFile('dist/assets/fabrics/linen.png');
  await page.locator('#boardUpload').setInputFiles([{name:'原木空间.png',mimeType:'image/png',buffer:room},{name:'面料细节.png',mimeType:'image/png',buffer:fabric}]);await page.waitForSelector('.tt-board-item');await page.waitForFunction(()=>!document.querySelector('#panel-board .tt-ai-start').disabled);
  assert.equal(await page.locator('#panel-board .wf-input #boardList .tt-board-item').count(),2);assert.equal(await page.locator('#panel-board .wf-input .tt-ai-card').count(),1);
  await page.locator('#panel-board .tt-ai-start').click();await page.waitForFunction(()=>[...document.querySelectorAll('.toolbox-title .wf-steps button')].every(button=>button.disabled));assert.ok(await page.locator('#wfExport').isDisabled());releasePlan();await page.waitForSelector('#panel-board .wf-side .tt-ai-results:not([hidden])');await page.waitForFunction(()=>!document.querySelector('#panel-board .tt-ai-start').disabled);
  assert.equal(await page.locator('#panel-board .wf-manual').evaluate(node=>node.open),false);assert.equal(await page.locator('#boardStage').isVisible(),true);assert.equal(await page.locator('#boardTitle').inputValue(),'');
  await page.locator('#panel-board .tt-ai-adopt').click();await page.waitForFunction(()=>document.getElementById('boardTitle').value==='原木花语');assert.equal(await page.locator('#panel-board .wf-manual').evaluate(node=>node.open),true);assert.equal(await page.locator('.toolbox-title [data-wf-step="3"]').getAttribute('aria-current'),'step');
  await page.waitForFunction(()=>!document.getElementById('wfExport').disabled&&!document.getElementById('wfSaveAsset').disabled);
  const downloading=page.waitForEvent('download');await page.locator('#wfExport').click();const file=await downloading;const target=path.join(outputDir,'board.png');await file.saveAs(target);const png=PNG.sync.read(await readFile(target));assert.deepEqual([png.width,png.height],[1600,1200]);
  await page.locator('#wfSaveAsset').click();await page.locator('dialog.lib-save-dialog').waitFor({state:'visible'});await page.locator('dialog.lib-save-dialog [data-save]').click();await page.waitForFunction(()=>!document.querySelector('dialog.lib-save-dialog'));
  assert.equal((await(await fetch(base+'/api/library/assets')).json()).assets.length,1);
  await mkdir('.share',{recursive:true});await page.screenshot({path:'.share/toolbox-c-board.png',fullPage:true});
  for(const id of ['hd','extract','recolor','repeat','board','delivery','copy']){
    await page.locator('[data-tool-link="'+id+'"]').click();assert.equal(await page.locator('#panel-'+id+' .wf-side').count(),1);
    for(const width of [1600,1280,1024,768,390,320]){
      await page.setViewportSize({width,height:1000});const geometry=await page.evaluate(id=>{const root=document.getElementById('panel-'+id);return {page:document.documentElement.scrollWidth,panels:[...root.querySelectorAll(':scope>.wf-input,:scope>.tt-preview,:scope>.wf-side')].map(node=>{const box=node.getBoundingClientRect();return {width:box.width,right:box.right};})};},id);
      assert.ok(geometry.page<=width+1,JSON.stringify({id,width,geometry}));for(const panel of geometry.panels)assert.ok(panel.right<=width+1&&panel.width>200,JSON.stringify({id,width,geometry}));
    }
  }
  await page.setViewportSize({width:390,height:844});await page.locator('[data-tool-link="board"]').click();await page.screenshot({path:'.share/toolbox-c-mobile.png',fullPage:true});
  assert.equal(calls,1);assert.deepEqual(errors,[]);console.log(JSON.stringify({schemeC:true,tools:7,threeColumns:true,workflowBusyProtected:true,compactToolbarHeight:compact.toolbar,workspaceTop:compact.workspaceTop,minimumTextContrast:Math.min(...contrast.map(item=>item.ratio)),realCandidateAdoption:true,originalPreviewRemains:true,headerExport1600x1200:true,headerLibrarySave:true,responsiveWidths:6,modelMocks:calls,paidRequests:0}));
}finally{releasePlan();await browser.close();await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-workflow-c-'));await rm(outputDir,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
