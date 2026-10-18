import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {groupHistoryImages,compareHistoryImages} from './dist/history-groups.js';
import {createTestDocument} from './test-dom.mjs';

// Run the real page controller with a minimal DOM and local image/job responses.
async function page({shared=false,failure=false,cancelled=false,decodeFailure=false}={}){
  const {document,elements,root}=createTestDocument(await readFile(new URL('./dist/index.html',import.meta.url),'utf8')),messages=[],requests=[];
  const element=id=>document.getElementById(id);
  const original={number:11,jobId:'first',kind:'ai',product:'set',scene:'warm',angle:'side',ratio:'1:1',createdAt:'2026-10-03T01:00:00Z',url:'/generated/first/1.png',canvas:{width:100,height:100}};
  const other={...original,number:12,url:'/generated/first/2.png'};
  const edited={...original,number:13,jobId:'edit',kind:'edited',parentNumber:12,url:'/generated/edit/1.png'};
  let records=[original,other],releasePoll,pollGate;
  const state={results:[original,other],selected:0,busy:false,service:{shared}};
  const context={document,window:{},$,state,products:[{id:'set',name:'四件套'}],fabrics:{},groupHistoryImages,compareHistoryImages,toast:message=>messages.push(message),modal(){},setTimeout:resolve=>queueMicrotask(resolve),updateCount(){context.window.syncCurrentImageEditor?.();},renderResults(){context.window.syncCurrentImageEditor?.();},Image:class{naturalWidth=1024;naturalHeight=1024;async decode(){if(decodeFailure)throw Error('decode failed');}},fetch:async(url,init)=>{
    requests.push({url,body:init?.body});
    if(url==='/api/status')return Response.json({shared});
    if(url==='/api/history')return Response.json({images:records});
    if(url==='/api/history/edit'){if(failure)return Response.json({error:'编辑服务失败'},{status:502});pollGate=new Promise(resolve=>releasePoll=resolve);return Response.json({id:'edit'});}
    if(url==='/api/jobs/edit/cancel')return Response.json({status:'cancelling'});
    if(url==='/api/jobs/edit'){await pollGate;if(!cancelled)records=[edited,...records];return Response.json({status:cancelled?'cancelled':'done',message:cancelled?'已停止':'完成',results:cancelled?[]:[edited]});}
    throw Error('Unexpected URL '+url);
  }};
  function $(id){return element(id);}
  let script=await readFile(new URL('./dist/image-history.js',import.meta.url),'utf8');
  // Only replace module loading; execute the unchanged event handlers and flow.
  context.historyModule={groupHistoryImages,compareHistoryImages};
  script=script.replaceAll("await import('/history-groups.js')",'historyModule');
  vm.runInNewContext(script,context);
  const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};await tick();
  return {state,elements,messages,requests,original,other,context,tick,root,release:()=>releasePoll?.(),submit:()=>element('currentEditForm').onsubmit({preventDefault(){}}),historySubmit:()=>element('historyEditForm').onsubmit({preventDefault(){}})};
}

test('gallery initialization moves connected controls without inserting null text or duplicating elements',async()=>{
  const p=await page(),header=p.context.document.querySelector('.gallery-browser-title'),summary=header.querySelector('.gallery-title-summary');
  for(const id of ['cancelBtn','jobElapsed','galleryCount','jobBanner'])assert.equal(p.context.document.querySelectorAll('#'+id).length,1,id);
  assert.equal(p.elements.get('cancelBtn').parentNode,summary);assert.equal(p.elements.get('jobElapsed').parentNode,p.elements.get('jobBanner'));assert.equal(p.elements.get('galleryCount').parentNode,summary);assert.equal(p.elements.get('jobBanner').parentNode,p.context.document.querySelector('.gallery-browser'));assert.equal(p.context.document.querySelector('.works-actions').parentNode,header);assert.equal(p.context.document.querySelector('.works-header').hidden,true);assert.equal(header.querySelector('strong'),null);assert.equal(p.elements.get('jobElapsed').hidden,true);assert.ok(!p.root.textContent.includes('null'));assert.ok(!p.context.document.querySelector('.works-caption').textContent.includes('null'));
});

test('one works toolbar follows current images, history list and history detail without losing navigation',async()=>{
  const p=await page(),actions=p.context.document.querySelector('.works-actions'),gallery=p.context.document.querySelector('.gallery-browser-title');
  await p.elements.get('historyRecordsBtn').onclick();assert.equal(actions.parentNode,p.context.document.querySelector('.history-toolbar'));assert.equal(p.elements.get('currentWorksView').hidden,true);
  p.context.document.querySelector('.record-open').onclick();assert.equal(actions.parentNode,p.elements.get('historyDetailBar'));assert.equal(p.elements.get('historyViewer').hidden,false);
  p.elements.get('currentWorksBtn').onclick();assert.equal(actions.parentNode,gallery);assert.equal(p.elements.get('currentWorksView').hidden,false);assert.equal(p.elements.get('history').hidden,true);
  for(const id of ['downloadAll','currentWorksBtn','historyRecordsBtn','cancelBtn'])assert.equal(p.context.document.querySelectorAll('#'+id).length,1);
  assert.equal(p.context.document.querySelector('.works-header').hidden,true);
});

test('generation lifecycle shows stop beside all works, hides completion messages, and preserves exact final elapsed time',async()=>{
  const p=await page(),app=await readFile(new URL('./dist/app.js',import.meta.url),'utf8');let now=1000,clock=null,restored=0;
  Object.assign(p.context,{Date:{now:()=>now},setInterval:fn=>{clock=fn;return 1;},clearInterval:()=>{clock=null;},setConfigCollapsed(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),selectResult:()=>restored++});
  vm.createContext(p.context);vm.runInContext('let galleryClock=null,galleryPreviousLabels=null,galleryStartedAt=null;',p.context);
  for(const name of ['updateGalleryElapsed','showJobMessage'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],p.context);
  vm.runInContext(app.slice(app.indexOf('function beginGalleryGeneration('),app.indexOf("$('toggleConfig').onclick=")),p.context);
  p.context.beginGalleryGeneration({scenes:['warm'],angles:['side']},true);assert.equal(p.elements.get('cancelBtn').hidden,false);assert.equal(p.elements.get('jobElapsed').textContent,'已用时 0:00');
  assert.equal(p.elements.get('jobElapsed').parentNode,p.elements.get('jobBanner'));
  p.context.showJobMessage('正在生成第 1 / 1 张，单张可能需要数分钟');assert.equal(p.elements.get('jobBanner').hidden,false);assert.equal(p.elements.get('jobMessage').querySelector('.job-message-heading').textContent,'正在生成 1 / 1 张');assert.equal(p.elements.get('jobMessage').querySelector('small').textContent,'单张可能需要数分钟');assert.equal(p.elements.get('jobElapsed').parentNode,p.elements.get('jobMessage').querySelector('.job-message-details'));now=31000;clock();assert.equal(p.elements.get('jobElapsed').textContent,'已用时 0:30');
  p.context.showJobMessage('AI 摄影已完成：1 / 1 张。','complete');assert.equal(p.elements.get('jobBanner').hidden,true);now=91500;p.context.endGalleryGeneration();assert.equal(p.elements.get('jobElapsed').textContent,'耗时 1:30');assert.equal(p.elements.get('jobElapsed').hidden,false);assert.equal(p.elements.get('cancelBtn').hidden,true);assert.equal(clock,null);assert.equal(restored,1);
  assert.equal(p.elements.get('jobElapsed').parentNode,p.context.document.querySelector('.gallery-title-summary'));
  // A following run resets the timer; an error remains visible for recovery.
  now=100000;p.context.beginGalleryGeneration({scenes:['warm'],angles:['side']},false);assert.equal(p.elements.get('jobElapsed').textContent,'已用时 0:00');p.context.showJobMessage('生成服务连接失败','error');now=103000;p.context.endGalleryGeneration();assert.equal(p.elements.get('jobElapsed').textContent,'耗时 0:03');assert.equal(p.elements.get('jobBanner').hidden,false);assert.equal(p.elements.get('cancelBtn').hidden,true);
});

test('current editor follows the selected image, saves an edited sibling and preserves both originals',async()=>{
  const p=await page();assert.equal(p.elements.get('currentEditForm').hidden,false);assert.equal(p.elements.get('currentEditNumber').textContent,'#11');
  p.elements.get('currentEditPrompt').value='first draft';p.state.selected=1;p.context.window.syncCurrentImageEditor();assert.equal(p.elements.get('currentEditPrompt').value,'');assert.equal(p.elements.get('currentEditNumber').textContent,'#12');
  p.elements.get('currentEditPrompt').value='  Keep print, brighten the window  ';const editing=p.submit();await p.tick();assert.equal(p.state.busy,true);assert.equal(p.elements.get('currentEditBtn').disabled,true);assert.equal(p.elements.get('currentEditCancel').hidden,false);
  const request=p.requests.find(r=>r.url==='/api/history/edit');assert.deepEqual(JSON.parse(request.body),{number:12,prompt:'Keep print, brighten the window'});
  await p.submit();assert.equal(p.requests.filter(r=>r.url==='/api/history/edit').length,1);p.release();await editing;
  assert.equal(p.state.results.length,3);assert.equal(p.state.results[1],p.original);assert.equal(p.state.results[2],p.other);assert.equal(p.state.results[0].parentNumber,12);assert.equal(p.state.selected,0);assert.equal(p.elements.get('currentEditNumber').textContent,'#13 · 修改自 #12');assert.match(p.elements.get('currentEditStatus').textContent,/新图 #13.*原图 #12/);assert.equal(p.state.busy,false);assert.equal(p.elements.get('currentEditCancel').hidden,true);
  // An edited current image can itself be edited, without reverting to its parent.
  p.elements.get('currentEditPrompt').value='Reduce the shadow';const again=p.submit();await p.tick();assert.equal(JSON.parse(p.requests.filter(r=>r.url==='/api/history/edit').at(-1).body).number,13);p.release();await again;
});

test('current edit failures, cancellation and saved-image preview errors preserve the current originals and unlock controls',async()=>{
  for(const options of [{failure:true},{cancelled:true},{decodeFailure:true}]){
    const p=await page(options);p.elements.get('currentEditPrompt').value='modify light';const pending=p.submit();await p.tick();
    if(options.cancelled){await p.elements.get('currentEditCancel').onclick();assert.ok(p.requests.some(r=>r.url==='/api/jobs/edit/cancel'));}
    p.release();await pending;assert.equal(p.state.results.length,2);assert.equal(p.state.results[0],p.original);assert.equal(p.state.busy,false);assert.equal(p.elements.get('currentEditBtn').disabled,false);assert.equal(p.elements.get('currentEditCancel').hidden,true);
    assert.match(p.elements.get('currentEditStatus').textContent,options.failure?/编辑服务失败/:options.cancelled?/已停止编辑/:/已保存.*预览未加载/);
  }
});

test('edited images can be compared on the hero frame without leaving the gallery',async()=>{
  const p=await page();
  // An untouched image offers no comparison at all.
  p.state.selected=1;p.context.window.syncCurrentImageEditor();
  assert.equal(p.elements.get('heroCompare').hidden,true);
  // One edit: the parent is both the original and the previous version, so only one button appears.
  p.elements.get('currentEditPrompt').value='brighten';const editing=p.submit();await p.tick();p.release();await editing;
  assert.equal(p.state.selected,0);assert.equal(p.elements.get('heroCompare').hidden,false);
  assert.equal(p.elements.get('comparePrevBtn').hidden,false);assert.equal(p.elements.get('compareRootBtn').hidden,true);
  assert.equal(p.elements.get('comparePrevBtn').textContent,'⇔ 对比原图');assert.equal(p.elements.get('heroCompareExit').hidden,true);
  // Clicking shows the comparison inline inside the hero frame, not a modal.
  p.elements.get('comparePrevBtn').onclick();
  assert.ok(p.elements.get('heroCompare').classList.contains('is-active'));
  assert.equal(p.elements.get('heroCompareBeforeImg').src,'/generated/first/2.png');
  assert.equal(p.elements.get('heroCompareAfterImg').src,'/generated/edit/1.png');
  p.elements.get('heroCompareExit').onclick();
  assert.ok(!p.elements.get('heroCompare').classList.contains('is-active'));assert.equal(p.elements.get('heroCompareExit').hidden,true);
  // Two edits: the chain root differs from the direct parent, so both comparisons appear.
  p.state.results.unshift({number:14,parentNumber:13,url:'/generated/edit/2.png',canvas:{width:100,height:100}});p.state.selected=0;p.context.window.syncCurrentImageEditor();
  assert.equal(p.elements.get('compareRootBtn').hidden,false);assert.equal(p.elements.get('comparePrevBtn').hidden,false);
  assert.equal(p.elements.get('comparePrevBtn').textContent,'⇔ 对比上一版');
  p.elements.get('compareRootBtn').onclick();
  assert.equal(p.elements.get('heroCompareBeforeImg').src,'/generated/first/2.png');
  // Selecting another image exits the inline comparison.
  p.state.selected=1;p.context.window.syncCurrentImageEditor();
  assert.ok(!p.elements.get('heroCompare').classList.contains('is-active'));
  // The 生成记录 viewer shows its comparison inline on the large image, like 当前生成.
  await p.elements.get('historyRecordsBtn').onclick();await p.tick();
  p.state.results=[p.state.results[0]];p.state.selected=0;p.context.window.syncCurrentImageEditor();
  p.elements.get('historyLookup').value='13';p.elements.get('historyLookupForm').onsubmit({preventDefault(){}});
  assert.equal(p.elements.get('historyHeroCompare').hidden,false);assert.equal(p.elements.get('historyCompareRootBtn').hidden,true);
  assert.equal(p.elements.get('historyComparePrevBtn').hidden,false);assert.equal(p.elements.get('historyComparePrevBtn').textContent,'⇔ 对比原图');
  assert.equal(p.elements.get('historyHeroCompareExit').hidden,true);
  p.elements.get('historyComparePrevBtn').onclick();
  assert.ok(p.elements.get('historyHeroCompare').classList.contains('is-active'));
  assert.equal(p.elements.get('historyCompareBeforeImg').src,'/generated/first/2.png');
  assert.equal(p.elements.get('historyCompareAfterImg').src,'/generated/edit/1.png');
  p.elements.get('historyHeroCompareExit').onclick();
  assert.ok(!p.elements.get('historyHeroCompare').classList.contains('is-active'));assert.equal(p.elements.get('historyHeroCompareExit').hidden,true);
  // Selecting another image in the group exits the inline comparison automatically.
  p.elements.get('historyComparePrevBtn').onclick();
  p.elements.get('historyLookup').value='12';p.elements.get('historyLookupForm').onsubmit({preventDefault(){}});
  assert.ok(!p.elements.get('historyHeroCompare').classList.contains('is-active'));
});

test('examples cannot be edited and shared visitors cannot reach local history editing',async()=>{
  const p=await page();p.state.results=[{reference:true}];p.context.window.syncCurrentImageEditor();assert.equal(p.elements.get('currentEditForm').hidden,true);await p.submit();assert.equal(p.requests.some(r=>r.url==='/api/history/edit'),false);
  const visitor=await page({shared:true});assert.equal(visitor.elements.get('currentEditForm').hidden,true);assert.equal(visitor.elements.get('historyEditHint').hidden,true);assert.equal(visitor.requests.some(r=>r.url==='/api/history'),false);await visitor.submit();assert.equal(visitor.requests.some(r=>r.url==='/api/history/edit'),false);
});

test('history editing of the current batch synchronizes its edited image and preserves original outputs',async()=>{
  const p=await page();await p.elements.get('historyRecordsBtn').onclick();p.elements.get('historyLookup').value='12';p.elements.get('historyLookupForm').onsubmit({preventDefault(){}});p.elements.get('historyPrompt').value='Keep print, brighten window';
  const editing=p.historySubmit();await p.tick();p.release();await editing;assert.equal(p.state.results.length,3);assert.equal(p.state.results[0].number,13);assert.equal(p.state.results[1],p.original);assert.equal(p.state.results[2],p.other);assert.equal(p.elements.get('historyNumber').value,'13');assert.match(p.elements.get('historyEditStatus').textContent,/新图 #13.*原图 #12/);assert.equal(p.state.busy,false);
});
