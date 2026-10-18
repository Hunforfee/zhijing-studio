import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createTestDocument} from './test-dom.mjs';
const markup=await readFile('dist/index.html','utf8'),app=await readFile('dist/app.js','utf8'),controller=app.slice(app.indexOf('// Size the gallery from the selected image'));
function page(results){
  const {document}=createTestDocument(markup),layout=document.querySelector('.gallery-layout'),main=document.querySelector('.gallery-main'),frame=document.querySelector('.gallery-main .hero-frame');
  layout.style.setProperty=function(key,value){this[key]=value;};main.getBoundingClientRect=()=>({height:620.2});
  document.getElementById('heroCanvas').closest=()=>frame;
  let observerCallback,observed;
  const context={document,state:{results,selected:0},scenes:[{id:'warm',light:'柔和自然光'}],angles:[{id:'front'}],$:id=>document.getElementById(id),resultSceneLabel:()=> '暖白侘寂',resultAngleLabel:()=> '正面全景',ResizeObserver:class{constructor(callback){observerCallback=callback;}observe(node){observed=node;}}};context.window=context;
  vm.createContext(context);vm.runInContext(controller,context);vm.runInContext(app.match(/^function selectResult\(i\).*$/m)[0],context);
  return {context,layout,frame,main,document,resize:()=>observerCallback(),observed};
}
test('selecting square, landscape, portrait and edited images adapts the frame to actual pixel dimensions',()=>{
  const results=[{canvas:{width:1024,height:1024},ratio:'4:3'},{canvas:{width:1536,height:1024}},{canvas:{width:1088,height:1472}},{canvas:{width:1024,height:1536},kind:'edited',parentNumber:12}].map((result,i)=>({...result,number:i+11,scene:'warm',angle:'front'}));
  const p=page(results),columns=[];
  results.forEach((result,i)=>{p.context.selectResult(i);assert.equal(Number(p.frame.style.aspectRatio),result.canvas.width/result.canvas.height);assert.equal(p.frame.style.height,'auto');columns.push(parseFloat(p.layout.style['--gallery-main-column']));});
  assert.ok(columns[1]>columns[0]);assert.ok(columns[0]>columns[2]);assert.equal(p.layout.dataset.imageShape,'portrait');
  assert.equal(p.document.getElementById('imagePosition').textContent,'4 / 4');assert.equal(p.document.getElementById('heroCanvas').width,1024);assert.equal(p.document.getElementById('heroCanvas').height,1536);
});
test('generation placeholders use requested ratio and loaded atlas references recover their real cell ratio',()=>{
  const p=page([{reference:true,panel:0,scene:'warm',angle:'front'}]);
  p.context.updateGalleryImageLayout({ratio:'3:4'});assert.equal(Number(p.frame.style.aspectRatio),.75);
  p.context.updateGalleryImageLayout({ratio:'4:3'});assert.equal(Number(p.frame.style.aspectRatio),4/3);
  p.context.updateGalleryImageLayout({ratio:'invalid'});assert.equal(Number(p.frame.style.aspectRatio),1);
  const image=p.document.getElementById('heroImage');image.setAttribute('src','/assets/bedding-scenes.png');image.naturalWidth=2400;image.naturalHeight=1600;image.listeners.load();assert.equal(Number(p.frame.style.aspectRatio),1.5);
});
test('browser height tracks the preview card after a resize without a fixed image height',()=>{
  const p=page([{canvas:{width:1024,height:1024},scene:'warm',angle:'front'}]);
  assert.equal(p.observed,p.main);assert.equal(p.layout.style['--gallery-browser-height'],'621px');
  p.main.getBoundingClientRect=()=>({height:430});p.resize();assert.equal(p.layout.style['--gallery-browser-height'],'430px');
  p.main.getBoundingClientRect=()=>({height:0});p.resize();assert.equal(p.layout.style['--gallery-browser-height'],'430px');
  assert.ok(markup.indexOf('/app.js')<markup.indexOf('/image-history.js'));
});
