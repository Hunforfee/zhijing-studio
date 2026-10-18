import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createTestDocument} from './test-dom.mjs';
import {groupHistoryImages,compareHistoryImages} from './dist/history-groups.js';
const app=await readFile('dist/app.js','utf8');
const opt={product:'set',fabric:'cotton',fabricMode:'auto',ratio:'1:1',scenes:['warm'],angles:['side'],recommendAngle:false};
const old={number:11,jobId:'old',kind:'ai',product:'set',scene:'warm',angle:'side',ratio:'1:1',url:'/generated/old/1.png',canvas:{width:100,height:100}};
const fresh={...old,number:22,jobId:'new',url:'/generated/new/1.png'};
async function page(){
  const {document,elements,root}=createTestDocument(await readFile('dist/index.html','utf8'));
  Object.getPrototypeOf(root).closest=function(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;};
  const state={product:'set',resultProduct:'set',results:[old],selected:0,busy:false,generating:false,service:{shared:false},upload:{},scenes:['warm'],angles:['side']};
  const context={document,state,$:id=>document.getElementById(id),products:[{id:'set',name:'四件套'}],fabrics:{cotton:['哑光']},scenes:[{id:'warm',name:'卧室',light:'自然光'}],angles:[{id:'side',name:'斜侧'}],angleDisplayName:()=> '斜侧',cameraTools:null,groupHistoryImages,compareHistoryImages,historyModule:{groupHistoryImages,compareHistoryImages},toast(){},modal(){},setConfigCollapsed(){},updateCount(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),setInterval:()=>1,clearInterval(){},setTimeout:fn=>queueMicrotask(fn),Image:class{naturalWidth=100;naturalHeight=100;async decode(){}},fetch:async url=>Response.json(url==='/api/status'?{shared:false}:{images:[old],trash:[]})};
  context.window=context;vm.createContext(context);
  vm.runInContext((await readFile('dist/image-history.js','utf8')).replaceAll("await import('/history-groups.js')",'historyModule'),context);
  for(let i=0;i<20;i++)await Promise.resolve();
  for(const name of ['resultSceneLabel','resultAngleLabel','selectResult','renderResults','showJobMessage','updateGalleryElapsed'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],context);
  vm.runInContext(app.slice(app.indexOf('function generatedSelection('),app.indexOf('setTimeout(()=>{\n  let saved;')),context);
  vm.runInContext('let galleryClock=null,galleryPreviousLabels=null,galleryStartedAt=null;',context);
  vm.runInContext(app.slice(app.indexOf('function beginGalleryGeneration('),app.indexOf("$('toggleConfig').onclick=")),context);
  vm.runInContext(app.match(/async function loadLatestHistoryPreview\([^\n]+/)[0].replaceAll("await import('/history-groups.js')",'historyModule'),context);
  context.renderResults();
  return {context,state,element:id=>elements.get(id),root};
}
test('new generation clears old thumbnails, hero and editor; first arrival renders only the new batch',async()=>{
  const p=await page();assert.equal(p.element('thumbnails').querySelectorAll('.thumbnail').length,1);assert.equal(p.element('currentEditForm').hidden,false);
  p.context.beginGalleryGeneration(opt,true);
  assert.equal(p.state.results.length,0);assert.equal(p.element('thumbnails').querySelectorAll('.thumbnail').length,0);assert.equal(p.element('currentEditForm').hidden,true);assert.equal(p.element('heroCanvas').hidden,true);assert.equal(p.element('downloadAll').disabled,true);
  p.context.showGenerated([fresh],opt,true);
  assert.equal(p.element('thumbnails').querySelectorAll('.thumbnail').length,1);assert.ok(!p.element('thumbnails').textContent.includes('#11'));assert.equal(p.state.results[0].number,22);assert.equal(p.element('heroCanvas').hidden,false);assert.equal(p.element('currentEditForm').hidden,false);
});
test('switching to an empty queued task clears the prior task, while returning restores only its own outputs',async()=>{
  const p=await page(),first={id:'first',opt,outputs:[old],status:'running',createdAt:Date.now()},second={id:'second',opt,outputs:[],status:'queued',createdAt:Date.now()};
  p.context.focusGenerationTask(first);assert.equal(p.state.results[0].number,11);
  p.context.focusGenerationTask(second);assert.equal(p.state.results.length,0);assert.equal(p.element('currentEditForm').hidden,true);assert.equal(p.element('thumbnails').children.length,0);
  p.context.focusGenerationTask(first);assert.equal(p.state.results.length,1);assert.equal(p.state.results[0].number,11);
});
test('a slow startup history response cannot backfill a new generation, even if it finishes with no images',async()=>{
  const p=await page();p.state.results=[];let release;
  p.context.fetch=async()=>{await new Promise(r=>release=r);return Response.json({images:[old]});};
  const pending=p.context.loadLatestHistoryPreview();await Promise.resolve();
  p.context.beginGalleryGeneration(opt,true);p.context.endGalleryGeneration();p.state.queueDisplay=false;p.state.generating=false;release();await pending;
  assert.equal(p.state.results.length,0);assert.equal(p.element('currentEditForm').hidden,true);assert.equal(p.element('heroCanvas').hidden,true);
});
test('actual task polling refreshes each new arrival instead of showing stale thumbnail DOM',async()=>{
  const p=await page(),task={id:'new',label:1,opt,total:1,outputs:[],status:'queued',createdAt:Date.now()};
  p.context.focusGenerationTask(task);
  p.context.fetch=async url=>url==='/api/jobs/new'?Response.json({status:'done',progress:100,results:[fresh],message:'完成'}):Response.json(url==='/api/status'?{shared:false}:{images:[fresh,old],trash:[]});
  await p.context.pollGenerationTask(task);
  assert.equal(task.status,'done');assert.equal(p.state.results.length,1);assert.equal(p.state.results[0].number,22);assert.equal(p.element('thumbnails').querySelectorAll('.thumbnail').length,1);assert.ok(!p.element('thumbnails').textContent.includes('#11'));
});
