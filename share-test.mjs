import test from 'node:test';
import assert from 'node:assert/strict';
import {createShareServer} from './share-server.mjs';
import {readFile} from 'node:fs/promises';
const token='test-invite-token-for-local-tests-123456789';
const id='11111111-1111-1111-1111-111111111111';
test('shared website loads every frontend module and material thumbnail while private source stays unavailable',()=>fixture(async({base,auth,calls})=>{
  const html=await readFile('dist/index.html','utf8');
  const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
  for(const file of [...scripts,'/pattern-color.js','/camera-contract.js','/assets/fabrics/cotton.png','/assets/sheet-fitted-angles-v3-framed.png','/assets/scene-photos/warm-v1.png','/assets/scene-thumbs/warm.svg','/assets/crafts/wide-flange.png'])assert.equal((await fetch(base+file,{headers:auth})).status,200,file);
  const forwarded=calls.length;
  for(const file of ['/server.mjs','/secure-service-store.mjs','/.share/service-config.dpapi','/assets/fabrics/nested/private.png'])assert.equal((await fetch(base+file,{headers:auth})).status,404,file);
  assert.equal(calls.length,forwarded);
}));
async function fixture(fn){
  const calls=[];const server=createShareServer({token,getPublicOrigin:async()=>'https://friend.example',fetchImpl:async(url,init)=>{
    calls.push({url,init});if(url.endsWith('/api/status'))return Response.json({configured:true,verified:true,provider:'sub2api',model:'gpt-image-2',baseUrl:'https://private-provider.example',apiKey:'never-expose-secret'});
    if(url.endsWith('/api/free/documents'))return init?.method==='POST'?Response.json({document:{id}},{status:201}):Response.json({documents:[{id},{id:'22222222-2222-4222-8222-222222222222'}]});
    if(url.endsWith('/api/video/jobs'))return init?.method==='POST'?Response.json({id},{status:202}):Response.json({jobs:[{id},{id:'22222222-2222-4222-8222-222222222222'}]});
    if(url.includes('/api/video/jobs/'))return new Response('test-video',{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-9/100','accept-ranges':'bytes'}});
    if(url.endsWith('/api/jobs'))return Response.json({id},{status:202});
    if(url.includes('/api/jobs/'))return Response.json({id,status:'done',results:[]});
    return new Response('test file',{headers:{'content-type':'text/plain'}});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const auth={Cookie:'zhijing_invite='+token};
  try{await fn({base,auth,calls})}finally{await new Promise(r=>server.close(r))}
}

test('shared free creation exposes only documents created through the current invitation',()=>fixture(async({base,auth,calls})=>{
  const requestHeaders={...auth,Origin:'https://friend.example','Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/free/documents/'+id+'/images/original',{headers:auth})).status,404);
  assert.equal((await fetch(base+'/api/free/documents',{method:'POST',headers:requestHeaders,body:'{}'})).status,201);
  assert.deepEqual((await(await fetch(base+'/api/free/documents',{headers:auth})).json()).documents,[{id}]);
  assert.equal((await fetch(base+'/api/free/documents/'+id+'/images/original',{headers:auth})).status,200);
  assert.equal((await fetch(base+'/api/free/documents/'+id+'/edit',{method:'POST',headers:requestHeaders,body:'{}'})).status,200);
  const count=calls.length;
  assert.equal((await fetch(base+'/api/free/documents/22222222-2222-4222-8222-222222222222',{headers:auth})).status,404);
  assert.equal((await fetch(base+'/api/free/documents/'+id+'/edit',{method:'POST',headers:{...auth,Origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal(calls.length,count);
}));
test('public share requires invitation and sets a secure non-readable browser cookie',()=>fixture(async({base})=>{
  assert.equal((await fetch(base+'/')).status,403);
  assert.equal((await fetch(base+'/api/status')).status,403);
  const response=await fetch(base+'/invite/'+token,{redirect:'manual'});assert.equal(response.status,303);assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await fetch(base+'/invite/invalid')).status,403);
}));
test('visitors cannot inspect private configuration, modify keys, or submit cross-origin jobs',()=>fixture(async({base,auth,calls})=>{
  const status=await(await fetch(base+'/api/status',{headers:auth})).json();assert.equal(status.shared,true);assert.equal(status.configured,true);assert.equal(status.apiKey,undefined);assert.equal(status.baseUrl,undefined);
  assert.equal((await fetch(base+'/api/service',{method:'POST',headers:{...auth,Origin:'https://friend.example'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/jobs',{method:'POST',headers:{...auth,Origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal(calls.length,1);
}));
test('shared generation is forwarded locally and only shared jobs and their files can be read',()=>fixture(async({base,auth,calls})=>{
  assert.equal((await fetch(base+'/api/jobs/'+id,{headers:auth})).status,404);
  const created=await fetch(base+'/api/jobs',{method:'POST',headers:{...auth,Origin:'https://friend.example','Content-Type':'application/json'},body:JSON.stringify({image:'test-upload'})});assert.equal(created.status,202);
  assert.equal(calls[0].init.headers.Origin,'http://127.0.0.1:4173');assert.equal(calls[0].init.headers.Cookie,undefined);
  assert.equal((await fetch(base+'/api/jobs/'+id,{headers:auth})).status,200);
  assert.equal((await fetch(base+'/generated/'+id+'/1.png',{headers:auth})).status,200);
  assert.equal((await fetch(base+'/.env',{headers:auth})).status,404);
}));
test('shared videos isolate tasks and preserve range playback without exposing service configuration',()=>fixture(async({base,auth,calls})=>{
  assert.equal((await fetch(base+'/api/video/jobs/'+id+'/content',{headers:auth})).status,404);
  assert.deepEqual((await(await fetch(base+'/api/video/jobs',{headers:auth})).json()).jobs,[]);
  assert.equal((await fetch(base+'/api/video/jobs',{method:'POST',headers:{...auth,Origin:'https://friend.example','Content-Type':'application/json'},body:'{}'})).status,202);
  assert.deepEqual((await(await fetch(base+'/api/video/jobs',{headers:auth})).json()).jobs,[{id}]);
  const media=await fetch(base+'/api/video/jobs/'+id+'/content',{headers:{...auth,Range:'bytes=0-9'}});assert.equal(media.status,206);assert.equal(media.headers.get('content-range'),'bytes 0-9/100');assert.equal(calls.at(-1).init.headers.Range,'bytes=0-9');
  assert.equal((await fetch(base+'/api/service/video',{method:'POST',headers:{...auth,Origin:'https://friend.example'},body:'{}'})).status,403);
}));

test('shared textile planning permits only the invited same-origin POST endpoint',()=>fixture(async({base,auth,calls})=>{
  const route='/api/textile/plan',headers={...auth,Origin:'https://friend.example','Content-Type':'application/json'};
  assert.equal((await fetch(base+route,{method:'POST',body:'{}'})).status,403);
  assert.equal((await fetch(base+route,{headers:auth})).status,404);
  assert.equal((await fetch(base+route+'/private',{method:'POST',headers,body:'{}'})).status,404);
  assert.equal((await fetch(base+route,{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal(calls.length,0);
  const result=await fetch(base+route,{method:'POST',headers,body:JSON.stringify({kind:'copy',facts:{name:'测试被套'}})});
  assert.equal(result.status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'http://127.0.0.1:4173'+route);
  assert.equal(calls[0].init.headers.Origin,'http://127.0.0.1:4173');assert.equal(calls[0].init.headers.Cookie,undefined);
  assert.equal(JSON.parse(calls[0].init.body.toString()).kind,'copy');
}));
