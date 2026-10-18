import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequestSourcePolicy,deploymentPublicOrigin} from './request-source.mjs';
import {createServer} from './server.mjs';

const publicOrigin='https://a17ca245dd955fa7e.app.workbuddy.host';
const request=(headers={},remoteAddress='127.0.0.1',encrypted=false)=>({headers:{host:'127.0.0.1:4173',...headers},socket:{remoteAddress,encrypted}});

test('local HTTP, HTTPS and IPv6 retain same-origin access',()=>{
  const allowed=createRequestSourcePolicy();
  assert.equal(allowed(request()),true);
  assert.equal(allowed(request({origin:'http://127.0.0.1:4173'})),true);
  assert.equal(allowed(request({host:'localhost:4173',origin:'http://localhost:4173'})),true);
  assert.equal(allowed(request({host:'[::1]:4173',origin:'http://[::1]:4173'},'::1')),true);
  assert.equal(allowed(request({origin:'https://127.0.0.1:4173'},'127.0.0.1',true)),true);
});

test('configured HTTPS deployment works through preserved or rewritten proxy Host',()=>{
  const allowed=createRequestSourcePolicy({publicOrigin:publicOrigin+'/'});
  for(const host of ['a17ca245dd955fa7e.app.workbuddy.host','127.0.0.1:4173','container.internal:4173']){
    assert.equal(allowed(request({host,origin:publicOrigin,'sec-fetch-site':'same-origin'},'10.0.0.2')),true);
  }
  assert.equal(allowed(request({origin:'http://127.0.0.1:4173'})),true);
  assert.equal(deploymentPublicOrigin(),publicOrigin);
});

test('unlisted origins, null origins, cross-site requests and DNS rebinding stay blocked',()=>{
  const allowed=createRequestSourcePolicy({publicOrigin});
  for(const origin of ['https://evil.example','null','http://a17ca245dd955fa7e.app.workbuddy.host',publicOrigin+':444',publicOrigin+'.evil.example']){
    assert.equal(allowed(request({origin})),false);
  }
  assert.equal(allowed(request({origin:publicOrigin,'sec-fetch-site':'cross-site'})),false);
  assert.equal(allowed(request({host:'evil.example',origin:'http://evil.example'})),false);
  assert.equal(allowed(request({host:'evil.example'})),false);
  assert.equal(allowed(request({host:'127.0.0.1:4173'},'10.0.0.2')),false);
});

test('proxy headers cannot authorize an otherwise blocked origin',()=>{
  const allowed=createRequestSourcePolicy();
  assert.equal(allowed(request({origin:publicOrigin,'x-forwarded-host':'a17ca245dd955fa7e.app.workbuddy.host','x-forwarded-proto':'https',forwarded:'host=a17ca245dd955fa7e.app.workbuddy.host;proto=https'})),false);
});

test('deployment source must be an exact HTTP(S) origin',()=>{
  for(const value of ['*','null','file:///','https://user:pass@example.com','https://example.com/path','https://example.com/?q=1','https://example.com/#hash']){
    assert.throws(()=>createRequestSourcePolicy({publicOrigin:value}));
  }
});

test('actual task and service routes accept the cloud origin without generating or exposing keys',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-origin-test-'));
  let upstreamCalls=0,saves=0;
  const server=createServer({outputDir,publicOrigin,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'synthetic-origin-test-key',baseUrl:'https://image.example/v1',model:'test-image'},videoOptions:{loadConfig:async()=>null},persistService:async()=>{saves++;},fetchImpl:async()=>{upstreamCalls++;throw Error('This test must not contact a provider');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(route,origin,body,host='a17ca245dd955fa7e.app.workbuddy.host')=>fetch(base+route,{method:'POST',headers:{Host:host,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    const saved=await post('/api/service',publicOrigin,{provider:'sub2api',baseUrl:'https://image.example/v1',model:'test-image',apiKey:''});
    assert.equal(saved.status,200);assert.equal(saves,1);
    assert.equal((await saved.text()).includes('synthetic-origin-test-key'),false);
    for(const host of ['a17ca245dd955fa7e.app.workbuddy.host','127.0.0.1:4173','container.internal:4173']){
      const invalid=await post('/api/jobs',publicOrigin,{},host);
      assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/产品类型/);
    }
    // A larger JSON upload must reach validation rather than an early source
    // rejection that a reverse proxy can turn into an opaque gateway failure.
    const largeInvalid=await post('/api/jobs',publicOrigin,{probe:'0'.repeat(8*1024*1024)});
    assert.equal(largeInvalid.status,400);assert.match((await largeInvalid.json()).error,/产品类型/);
    for(const route of ['/api/jobs','/api/service','/api/pattern-materials/analyze','/api/video/jobs']){
      const blocked=await post(route,'https://evil.example',{});
      assert.equal(blocked.status,403);assert.equal((await blocked.json()).code,'ORIGIN_NOT_ALLOWED');
    }
    assert.equal((await fetch(base+'/api/admin/catalog',{headers:{Host:'a17ca245dd955fa7e.app.workbuddy.host',Origin:publicOrigin}})).status,403);
    assert.equal(await(await fetch(base+'/api/jobs/active')).json(),null);
    assert.equal(upstreamCalls,0);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
