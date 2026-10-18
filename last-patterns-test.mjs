import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createTestDocument} from './test-dom.mjs';

const app=await readFile(new URL('./dist/app.js',import.meta.url),'utf8');
const cache=app.slice(app.indexOf('// Keep the last successfully loaded'),app.indexOf('// LAST_PATTERN_CACHE_END'));
const file=name=>new File(['pattern-'+name],name,{type:'image/png',lastModified:123});
function database(){
  let saved;
  const db={createObjectStore(){},transaction(){const tx={objectStore:()=>({
    get(){const request={};queueMicrotask(()=>{request.result=structuredClone(saved);tx.oncomplete();});return request;},
    put(value){const request={};queueMicrotask(()=>{saved=structuredClone(value);tx.oncomplete();});return request;}
  })};return tx;}};
  return {open(){const request={result:db};queueMicrotask(()=>{request.onupgradeneeded();request.onsuccess();});return request;}};
}
function fixture(indexedDB=database(),{decodeError=false}={}){
  const {document}=createTestDocument('<button id="restoreLastPatterns"></button><button id="removeUploadB"></button>');
  const state={busy:false,upload:null,uploadB:null},messages=[],loads=[];
  const context={document,state,indexedDB,Blob,File,Date,Error,Promise,$:id=>document.getElementById(id),toast:message=>messages.push(message),URL:{createObjectURL:()=>'/blob',revokeObjectURL(){}},Image:class{naturalWidth=100;naturalHeight=100;async decode(){if(decodeError)throw Error('无法读取');}},upload:async file=>{state.upload={file};loads.push('A');},uploadBack:async file=>{state.uploadB={file};loads.push('B');}};
  context.$('removeUploadB').onclick=()=>{state.uploadB=null;loads.push('clearB');};
  vm.runInNewContext(cache,context);
  return {context,state,messages,loads,button:context.$('restoreLastPatterns')};
}

test('last A/B pair survives page reload with original files, names and side assignments',async()=>{
  const db=database(),first=fixture(db);first.state.upload={file:file('A-长文件名.png')};first.state.uploadB={file:file('B.png')};await first.context.rememberLastPatterns();
  const second=fixture(db);await second.context.loadLastPatterns();assert.equal(second.button.disabled,false);await second.context.restoreLastPatterns();
  assert.deepEqual(second.loads,['A','B']);assert.equal(second.state.upload.file.name,'A-长文件名.png');assert.equal(await second.state.upload.file.text(),'pattern-A-长文件名.png');assert.equal(second.state.uploadB.file.name,'B.png');assert.equal(second.state.upload.file.lastModified,123);assert.match(second.messages.at(-1),/A\/B/);
});
test('single-sided saved pattern clears a currently loaded B, and removing B updates the remembered pair',async()=>{
  const db=database(),first=fixture(db);first.state.upload={file:file('A.png')};first.state.uploadB={file:file('old-B.png')};await first.context.rememberLastPatterns();
  first.state.uploadB=null;await first.context.rememberLastPatterns();
  const second=fixture(db);second.state.uploadB={file:file('unrelated-B.png')};await second.context.loadLastPatterns();await second.context.restoreLastPatterns();assert.equal(second.state.uploadB,null);assert.deepEqual(second.loads,['A','clearB']);
});
test('busy generation, corrupted images and unavailable storage never replace existing uploads',async()=>{
  const db=database(),saved=fixture(db);saved.state.upload={file:file('saved.png')};await saved.context.rememberLastPatterns();
  const busy=fixture(db);await busy.context.loadLastPatterns();busy.state.busy=true;await busy.context.restoreLastPatterns();assert.equal(busy.loads.length,0);
  const broken=fixture(db,{decodeError:true});broken.state.upload={file:file('current.png')};await broken.context.loadLastPatterns();await broken.context.restoreLastPatterns();assert.equal(broken.state.upload.file.name,'current.png');assert.equal(broken.loads.length,0);assert.equal(broken.button.disabled,false);
  const unsupported=fixture(null);await unsupported.context.loadLastPatterns();assert.equal(unsupported.button.disabled,true);
  unsupported.state.upload={file:file('current.png')};await unsupported.context.rememberLastPatterns();assert.equal(unsupported.button.disabled,false);assert.match(unsupported.messages.at(-1),/未能保存/);
});
test('invalid stored blobs are not offered for reuse',async()=>{
  const db=database(),seed=fixture(db);await seed.context.lastPatternStorage('readwrite',{a:{blob:new Blob(['bad'],{type:'text/plain'}),name:'bad.png'},b:null});
  const page=fixture(db);await page.context.loadLastPatterns();assert.equal(page.button.disabled,true);
});
