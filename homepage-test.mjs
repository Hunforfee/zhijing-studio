import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {createShareServer} from './share-server.mjs';

async function fixture(run) {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'zhijing-home-test-'));
  const server = createServer({outputDir, stylingReferencePaths:[], service:{apiKey:'', provider:'compatible', model:'test', baseUrl:'https://example.invalid/v1'}, videoOptions:{loadConfig:async()=>null, checkComposer:async()=>false}, fetchImpl:async()=>{throw Error('Homepage tests must not call an image provider');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await run('http://127.0.0.1:'+server.address().port); }
  finally {
    await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-home-test-'));
    await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}

test('homepage and workspace have distinct entries while the previous index remains usable',()=>fixture(async base=>{
  for(const route of ['/','/home','/home/','/home.html']) {
    const response=await fetch(base+route);assert.equal(response.status,200,route);
    assert.match(response.headers.get('content-type'),/text\/html/);
    const html=await response.text();assert.match(html,/id="heroTitle"/);assert.doesNotMatch(html,/src="\/app\.js/);
    for(const target of ['results','detailPageModule','videoDesignModule','freeCreationWorkspace'])assert.ok(html.includes('href="/workspace#'+target+'"'));
  }
  for(const route of ['/workspace','/workspace/','/index.html']) {
    const response=await fetch(base+route);assert.equal(response.status,200,route);
    const html=await response.text();assert.match(html,/id="generateBtn"/);assert.match(html,/free-creation\.js/);assert.match(html,/video-creation\.js/);assert.doesNotMatch(html,/id="heroTitle"/);
  }
  for(const route of ['/tools','/tools/','/toolbox.html','/pattern-design','/pattern-design/','/pattern-design.html','/scenes','/scenes/','/scene-studio.html']){
    const response=await fetch(base+route);assert.equal(response.status,200,route);const html=await response.text();assert.match(html,route.includes('scene')?/sceneStudio/:route.includes('pattern')?/pdCanvas/:/toolPanels/);
  }
  for(const route of ['/','/workspace','/home.css','/home.js']) {
    const response=await fetch(base+route,{method:'HEAD'});assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,0);
  }
  assert.equal((await fetch(base+'/workspace',{method:'POST'})).status,405);
}));

test('all homepage modules and illustrative images are locally served without generation',()=>fixture(async base=>{
  const html=await(await fetch(base)).text();
  const resources=new Set([...html.matchAll(/(?:src|href)="(\/(?!workspace)[^"#?]+)(?:[?#][^"]*)?"/g)].map(match=>match[1]).filter(route=>route!=='/'));
  for(const resource of resources){const response=await fetch(base+resource);assert.equal(response.status,200,resource);assert.ok((await response.arrayBuffer()).byteLength>0,resource);}
  assert.ok(resources.has('/assets/bedding-scenes.png'));
  assert.ok(resources.has('/home.js'));assert.ok(resources.has('/home.css'));
  const links=[...html.matchAll(/class="utility-card [^"]*" href="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(links,['/pattern-design',...['hd','extract','recolor','repeat','board','delivery','copy'].map(id=>'/tools?tool='+id),'/scenes']);
  assert.equal(new Set(links).size,9);assert.equal([...html.matchAll(/class="cover-demo">效果示意/g)].length,9);
  assert.doesNotMatch(html,/faq-list|inspiration-section/);
  assert.equal(await(await fetch(base+'/api/jobs/active')).json(),null);
}));

test('invited visitors can enter the homepage and full workspace through the existing gateway',()=>fixture(async backend=>{
  const token='homepage-invitation-test-token-at-least-32';
  const share=createShareServer({token,backend});await new Promise(resolve=>share.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+share.address().port,headers={Cookie:'zhijing_invite='+token};
  try {
    for(const route of ['/','/workspace','/home.html','/home/','/workspace/','/home.js','/home.css','/tools','/tools/','/toolbox.html','/pattern-design','/pattern-design/','/pattern-design.html','/scenes','/scenes/','/scene-studio.html','/pattern-hd-worker.js','/pattern-designer.js']) {
      assert.equal((await fetch(base+route)).status,403);
      const response=await fetch(base+route,{headers});assert.equal(response.status,200,route);
      if(route==='/')assert.match(await response.text(),/id="heroTitle"/);
      if(route==='/workspace')assert.match(await response.text(),/id="generateBtn"/);
    }
    assert.equal((await fetch(base+'/server.mjs',{headers})).status,404);
    assert.equal((await fetch(base+'/api/service',{headers})).status,403);
  } finally { await new Promise(resolve=>share.close(resolve)); }
}));
