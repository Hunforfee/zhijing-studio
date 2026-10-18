import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {cameraAngleIds,cameraAtlasFor,cameraCellFor,matAngleName} from './dist/camera-contract.js';
const app=await readFile('dist/app.js','utf8'),source=await readFile('dist/shooting-reference.js','utf8');
test('hover metadata follows every product atlas and legacy strip without showing another angle',()=>{
  const context=vm.createContext({state:{product:'set',angles:[]},cameraTools:{cameraAtlasFor,cameraCellFor,matAngleName}});
  for(const name of ['angleDisplayName','angleSelectorCard'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],context);
  for(const [product,variant]of [['set',''],['quilt','winter'],['quilt','summer'],['sheet','flat'],['sheet','fitted'],['sheet','quilted'],['mat','ice'],['mat','rattan'],['mat','bamboo'],['pillow',''],['blanket','']]){
    context.state={product,fabric:product==='mat'?variant:'cotton',quiltSeason:variant,sheetVariant:variant,angles:[]};const atlas=cameraAtlasFor(context.state);
    const ids=atlas?.angleIds||cameraAngleIds;for(let i=0;i<ids.length;i++){context.angle={id:ids[i],name:ids[i]};context.index=i;const card=vm.runInContext('angleSelectorCard(angle,index)',context),get=key=>card.match(new RegExp('data-preview-'+key+'="([^"]+)"'))[1];
      assert.equal(get('src'),'/assets/'+(atlas?.file||(i<9?'angle-photography-atlas.png':'angle-details-atlas.png')));assert.equal(Number(get('cols')),atlas?4:3);assert.equal(Number(get('rows')),atlas?(atlas.rows||3):i<9?3:1);assert.equal(Number(get('cell')),atlas?cameraCellFor(context.state,context.angle.id):i<9?i:i-9);
    }
  }
});
function fixture(){
  const draws=[],loads=[],timers=new Map(),cards=new Set();let timerId=0,observer;
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();this.attributes=new Map();this.style={};this.dataset={};this.isConnected=true;this.hidden=false;this.textContent='';}
    append(...children){this.children.push(...children)}setAttribute(k,v){this.attributes.set(k,v)}getAttribute(k){return this.attributes.get(k)}removeAttribute(k){this.attributes.delete(k)}
    addEventListener(type,fn){this.listeners.set(type,fn)}contains(card){return cards.has(card)}
    get offsetWidth(){return parseFloat(this.style.width)||330}get offsetHeight(){return this.offsetWidth+60}
    getContext(){return {drawImage:(...args)=>draws.push(args)}}
  }
  const list=new Element('list'),body=new Element('body'),documentListeners=new Map(),windowListeners=new Map();
  list.classList={contains:name=>name==='show-angle-examples'};
  const document={getElementById:()=>list,createElement:tag=>new Element(tag),body,addEventListener:(type,fn)=>documentListeners.set(type,fn)};
  const context=vm.createContext({document,window:{addEventListener:(type,fn)=>windowListeners.set(type,fn)},innerWidth:800,innerHeight:620,setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),Image:class{naturalWidth=1448;naturalHeight=1086;decode(){return new Promise((resolve,reject)=>loads.push({image:this,resolve,reject}))}},MutationObserver:class{constructor(fn){observer=fn}observe(){}},fetch(){throw Error('hover must not call an API')}});
  vm.runInContext(source.slice(source.indexOf('function anglePreviewPlacement')),context);
  function card(cell,label,src='/assets/set-framed-angles-v2-printed.png'){const element=new Element('card'),photo=new Element('photo'),caption=new Element('caption');photo.dataset={previewSrc:src,previewCols:'4',previewRows:'3',previewCell:String(cell)};caption.textContent=label+'✓';element.querySelector=s=>s==='.angle-photo'?photo:caption;element.closest=()=>element;photo.closest=()=>element;element.getBoundingClientRect=()=>({left:630,right:700,top:480,height:90});cards.add(element);return element;}
  const flush=async()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn()}for(let i=0;i<6;i++)await Promise.resolve()};
  const hover=element=>list.listeners.get('pointerover')({target:element,pointerType:'mouse',relatedTarget:null});
  return {context,list,body,draws,loads,hover,flush,card,windowListeners,documentListeners,get observer(){return observer}};
}
test('only the current hovered cell appears after delayed decoding, then scroll/Escape/rerender dismiss it',async()=>{
  const f=fixture(),first=f.card(0,'45° 斜侧'),second=f.card(11,'床边垂坠'),preview=f.body.children[0];
  f.hover(first);await f.flush();assert.equal(f.loads.length,1);assert.equal(f.draws.length,0);
  f.list.listeners.get('pointerout')({target:first,relatedTarget:null});f.hover(second);await f.flush();f.loads[0].resolve();await f.flush();
  assert.equal(f.loads.length,1,'reuse loaded atlas');assert.equal(f.draws.length,1,'discard stale first hover');assert.deepEqual(f.draws[0].slice(1),[1086,724,362,362,0,0,362,362]);assert.equal(preview.children[1].textContent,'床边垂坠');assert.equal(preview.hidden,false);
  const left=parseFloat(preview.style.left),top=parseFloat(preview.style.top);assert.ok(left>=12&&left+preview.offsetWidth<=788);assert.ok(top>=12&&top+preview.offsetHeight<=608);
  f.windowListeners.get('scroll')();assert.equal(preview.hidden,true);assert.equal(second.getAttribute('aria-describedby'),undefined);
  f.list.listeners.get('focusin')({target:first});await f.flush();assert.equal(preview.hidden,false);f.documentListeners.get('keydown')({key:'Escape'});assert.equal(preview.hidden,true);
  f.hover(first);await f.flush();assert.equal(preview.hidden,false);first.isConnected=false;f.observer();assert.equal(preview.hidden,true);
});
test('moving within a card preserves preview, touching does not open it, and failed image decoding stays silent',async()=>{
  const f=fixture(),card=f.card(2,'俯视平铺'),preview=f.body.children[0];
  f.list.listeners.get('pointerover')({target:card,pointerType:'touch',relatedTarget:null});await f.flush();assert.equal(f.loads.length,0);
  f.hover(card);await f.flush();f.loads[0].reject(Error('unavailable'));await f.flush();assert.equal(preview.hidden,true);
  f.hover(card);await f.flush();assert.equal(f.loads.length,2);f.loads[1].resolve();await f.flush();assert.equal(preview.hidden,false);
  f.list.listeners.get('pointerout')({target:card,relatedTarget:card});assert.equal(preview.hidden,false);f.documentListeners.get('pointerdown')();assert.equal(preview.hidden,true);
});

test('all four blanket atlases enlarge the hovered angle and subtype switches discard stale previews',async()=>{
  const f=fixture(),preview=f.body.children[0];
  for(const variant of ['fleece','milk','cloud','gauze']){
    const atlas=cameraAtlasFor({product:'blanket',blanketVariant:variant});
    assert.equal(atlas.file,'blanket-'+variant+'-angles-v1.'+(variant==='gauze'?'png':'jpg'));
    const bytes=await readFile('dist/assets/'+atlas.file);assert.equal(bytes.readUInt16BE(0),variant==='gauze'?0x8950:0xffd8);
    for(let cell=0;cell<12;cell++){
      const card=f.card(cell,variant+' '+cell,'/assets/'+atlas.file);f.hover(card);await f.flush();
      if(cell===0){f.loads.at(-1).resolve();await f.flush();}
      assert.equal(preview.hidden,false);assert.equal(f.draws.at(-1)[0].src,'/assets/'+atlas.file);
      assert.deepEqual(f.draws.at(-1).slice(1),[(cell%4)*362,Math.floor(cell/4)*362,362,362,0,0,362,362]);
      card.isConnected=false;f.observer();assert.equal(preview.hidden,true);
    }
  }
  assert.equal(f.loads.length,4);
  for(const src of ['/assets/../../private.jpg','https://foreign.test/example.jpg','/generated/example.jpg']){
    f.hover(f.card(0,'invalid',src));await f.flush();assert.equal(preview.hidden,true);
  }
  assert.equal(f.loads.length,4);
});
