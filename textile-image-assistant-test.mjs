import test from 'node:test';
import assert from 'node:assert/strict';
import {ImageAssistant} from './dist/textile-tools-ai.js';

const oldDoc='11111111-1111-4111-8111-111111111111';
const oldOp='22222222-2222-4222-8222-222222222222';
const newDoc='33333333-3333-4333-8333-333333333333';
const newOp='44444444-4444-4444-8444-444444444444';
const key='textile-image-assistant-unit-test';
const oldPending=()=>({documentId:oldDoc,operationId:oldOp});
const completed=(documentId=oldDoc,operationId=oldOp)=>({document:{id:documentId,operations:[{id:operationId,status:'done'}],versions:[{id:operationId,url:'/api/free/documents/'+documentId+'/images/'+operationId}]}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function fixture(run,{saved=oldPending(),fetchImpl=async()=>Response.json(completed()),result=async()=>{}}={}){
  const previous=new Map(['fetch','window','localStorage'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const values=new Map(saved===null?[]:[[key,JSON.stringify(saved)]]),calls=[],statuses=[],busy=[],listeners=new Map();
  globalThis.localStorage={getItem:name=>values.get(name)??null,setItem:(name,value)=>values.set(name,String(value)),removeItem:name=>values.delete(name)};
  globalThis.window={addEventListener:(name,listener)=>listeners.set(name,listener)};
  globalThis.fetch=async(url,init={})=>{
    assert.equal(typeof url,'string');assert.match(url,/^\/(?:api\/status|api\/free\/documents(?:\/|$))/,'Only local mocked requests are permitted');
    calls.push({url,method:init.method||'GET',body:init.body?JSON.parse(init.body):undefined});
    return fetchImpl(url,init);
  };
  const assistant=new ImageAssistant({storageKey:key,status:value=>statuses.push(value),busy:value=>busy.push(value),result});
  try{await run({assistant,values,calls,statuses,busy,listeners});}
  finally{
    clearTimeout(assistant.timer);
    for(const [name,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  }
}

test('restored pending work locks submission and never automatically issues another paid request',()=>fixture(async({assistant,calls,busy,statuses,values})=>{
  assert.deepEqual(assistant.pending,oldPending());assert.deepEqual(busy,[true]);assert.match(statuses.at(-1),/不会自动重新生成/);assert.equal(calls.length,0);
  await assistant.start('mock-image','new prompt');await tick();assert.equal(calls.length,0);assert.deepEqual(JSON.parse(values.get(key)),oldPending());
  await assistant.check();assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');assert.equal(assistant.pending,null);assert.equal(values.has(key),false);assert.equal(busy.at(-1),false);
}));

test('concurrent checks of one pending operation share one metadata lookup and one result callback',async()=>{
  const lookup=deferred();let results=0;
  await fixture(async({assistant,calls})=>{
    const first=assistant.check();await assistant.check();await assistant.check();assert.equal(calls.length,1);
    lookup.resolve(Response.json(completed()));await first;assert.equal(results,1);assert.equal(assistant.pending,null);assert.equal(assistant.checking,null);
  },{fetchImpl:()=>lookup.promise,result:async(url,{isCurrent})=>{assert.equal(isCurrent(),true);results++;}});
});

test('failed candidate download keeps pending work and manual check recovers without paid resubmission',async()=>{
  let attempts=0;
  await fixture(async({assistant,calls,values,statuses,busy})=>{
    await assistant.check();assert.deepEqual(assistant.pending,oldPending());assert.equal(values.has(key),true);assert.equal(assistant.checking,null);assert.match(statuses.at(-1),/再次检查任务/);assert.equal(busy.at(-1),true);
    await assistant.check();assert.equal(attempts,2);assert.equal(assistant.pending,null);assert.equal(values.has(key),false);assert.equal(busy.at(-1),false);
    assert.equal(calls.length,2);assert.ok(calls.every(call=>call.method==='GET'));
  },{result:async()=>{attempts++;if(attempts===1)throw Error('mock image download unavailable');}});
});

test('cancel during old candidate download cannot clear or populate a new paid operation',async()=>{
  const oldResultEntered=deferred(),releaseOldResult=deferred(),newLookup=deferred(),newResultEntered=deferred();const visible=[];
  const fetchImpl=async(url)=>{
    if(url==='/api/status')return Response.json({configured:true,provider:'sub2api'});
    if(url==='/api/free/documents')return Response.json({document:{id:newDoc}});
    if(url.endsWith('/cancel'))return Response.json({status:'cancelled'});
    if(url.endsWith('/edit'))return Response.json({operationId:newOp});
    if(url==='/api/free/documents/'+newDoc)return newLookup.promise;
    return Response.json(completed());
  };
  await fixture(async({assistant,calls,values,busy})=>{
    const oldCheck=assistant.check();await oldResultEntered.promise;await assistant.cancel();
    await assistant.start('mock-new-image','new edit');assert.deepEqual(assistant.pending,{documentId:newDoc,operationId:newOp});
    releaseOldResult.resolve();await oldCheck;
    assert.deepEqual(assistant.pending,{documentId:newDoc,operationId:newOp});assert.deepEqual(JSON.parse(values.get(key)),assistant.pending);assert.deepEqual(visible,[]);assert.equal(busy.at(-1),true);
    assert.equal(calls.filter(call=>call.url.endsWith('/edit')).length,1);
    newLookup.resolve(Response.json(completed(newDoc,newOp)));await newResultEntered.promise;await tick();
    assert.deepEqual(visible,[newOp]);assert.equal(assistant.pending,null);assert.equal(values.has(key),false);
  },{fetchImpl,result:async(url,{isCurrent})=>{
    if(url.endsWith(oldOp)){oldResultEntered.resolve();await releaseOldResult.promise;if(isCurrent())visible.push(oldOp);}
    else{if(isCurrent())visible.push(newOp);newResultEntered.resolve();}
  }});
});

test('a stale metadata check cannot unlock or duplicate a newer check after cancellation',async()=>{
  const oldLookup=deferred(),newLookup=deferred();let oldResults=0,newResults=0;
  await fixture(async({assistant,calls,values})=>{
    const oldCheck=assistant.check();await assistant.cancel();await assistant.start('mock-new-image','new edit');
    const newPending=assistant.pending;assert.equal(assistant.checking,newPending);
    oldLookup.resolve(Response.json(completed()));await oldCheck;
    assert.equal(assistant.pending,newPending);assert.equal(assistant.checking,newPending);assert.equal(JSON.parse(values.get(key)).documentId,newDoc);
    const reads=calls.filter(call=>call.url==='/api/free/documents/'+newDoc).length;await assistant.check();assert.equal(calls.filter(call=>call.url==='/api/free/documents/'+newDoc).length,reads);
    newLookup.resolve(Response.json(completed(newDoc,newOp)));await tick();assert.equal(oldResults,0);assert.equal(newResults,1);assert.equal(assistant.pending,null);
  },{fetchImpl:async(url)=>{
    if(url==='/api/status')return Response.json({configured:true,provider:'sub2api'});
    if(url==='/api/free/documents')return Response.json({document:{id:newDoc}});
    if(url.endsWith('/cancel'))return Response.json({});if(url.endsWith('/edit'))return Response.json({operationId:newOp});
    return url.endsWith(newDoc)?newLookup.promise:oldLookup.promise;
  },result:async url=>{if(url.endsWith(oldOp))oldResults++;else newResults++;}});
});

test('simultaneous start clicks issue only one edit request and preserve the pending operation',async()=>{
  const service=deferred(),lookup=deferred();
  await fixture(async({assistant,calls,values})=>{
    const first=assistant.start('mock-image','first edit');await assistant.start('mock-image','second edit');assert.equal(calls.length,1);
    service.resolve(Response.json({configured:true,provider:'compatible'}));await first;
    assert.equal(calls.filter(call=>call.url.endsWith('/edit')).length,1);assert.equal(calls.find(call=>call.url.endsWith('/edit')).body.prompt,'first edit');assert.equal(JSON.parse(values.get(key)).operationId,newOp);
    lookup.resolve(Response.json(completed(newDoc,newOp)));await tick();assert.equal(assistant.pending,null);
  },{saved:null,fetchImpl:async url=>{
    if(url==='/api/status')return service.promise;if(url==='/api/free/documents')return Response.json({document:{id:newDoc}});if(url.endsWith('/edit'))return Response.json({operationId:newOp});return lookup.promise;
  }});
});

test('ambiguous edit submission retains document identity and recovers an accepted task without retrying it',()=>fixture(async({assistant,calls,values,statuses})=>{
  await assistant.start('mock-image','edit request');assert.equal(assistant.pending.documentId,newDoc);assert.equal(assistant.pending.operationId,null);assert.equal(JSON.parse(values.get(key)).documentId,newDoc);assert.match(statuses.at(-1),/勿连续重复提交/);
  await assistant.start('mock-image','must not be submitted');assert.equal(calls.filter(call=>call.url.endsWith('/edit')).length,1);
  await assistant.check();assert.equal(assistant.pending,null);assert.equal(calls.filter(call=>call.url.endsWith('/edit')).length,1);assert.equal(values.has(key),false);
},{saved:null,fetchImpl:async url=>{
  if(url==='/api/status')return Response.json({configured:true,provider:'sub2api'});if(url==='/api/free/documents')return Response.json({document:{id:newDoc}});if(url.endsWith('/edit'))throw Error('mock response lost after submission');return Response.json(completed(newDoc,newOp));
}}));

test('unconfirmed cancellation preserves pending state and prevents accidental paid resubmission',()=>fixture(async({assistant,calls,values,busy,statuses})=>{
  await assistant.cancel();assert.deepEqual(assistant.pending,oldPending());assert.equal(values.has(key),true);assert.equal(busy.at(-1),true);assert.match(statuses.at(-1),/停止结果未确认/);
  await assistant.start('mock-image','must not submit');assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/cancel'));
},{fetchImpl:async()=>{throw Error('mock cancellation response unavailable');}}));

test('a confirmed missing document releases an obsolete browser lock without submitting generation',async()=>{
  for(const operation of ['check','cancel'])await fixture(async({assistant,calls,values,busy,statuses})=>{
    await assistant[operation]();assert.equal(assistant.pending,null);assert.equal(values.has(key),false);assert.equal(busy.at(-1),false);assert.match(statuses.at(-1),/原任务记录已不存在/);assert.equal(calls.length,1);assert.ok(!calls.some(call=>call.url.endsWith('/edit')));
  },{fetchImpl:async()=>Response.json({error:'记录不存在'},{status:404})});
});
