import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('dist/app.js','utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function generatedSelection('),source.indexOf('function showGenerated(')),context);
const choose=context.generatedSelection;
test('newly completed image becomes selected even after browsing an earlier image',()=>{
 const first={url:'/generated/batch/1.png'},second={url:'/generated/batch/2.png'},third={url:'/generated/batch/3.png'};
 assert.equal(choose([first,second],[first,second,third],0,true),2);
 assert.equal(choose([first],[first],0,false),0);
});
test('polls without a new image preserve manual browsing, and a new batch follows its latest image',()=>{
 const first={url:'/generated/batch/1.png'},second={url:'/generated/batch/2.png'};
 assert.equal(choose([first,second],[{...first},{...second}],0,true),0);
 assert.equal(choose([first,second],[{url:'/generated/next/1.png'},{url:'/generated/next/2.png'}],0,true),1);
});
test('local render outputs follow arrivals and preserve the selection between arrivals',()=>{
 const first={canvas:{}},second={canvas:{}};
 assert.equal(choose([first],[first,second],0,true),1);
 assert.equal(choose([first,second],[first,second],0,true),0);
});
