import test from 'node:test';
import assert from 'node:assert/strict';
import {requestVideo,ensureVideoComposer} from './dist/video-request.js';
test('video requests expose gateway status, platform messages and upload limits',async()=>{
  const check=(response,pattern)=>assert.rejects(requestVideo('/test',{}, {fetchImpl:async()=>response}),pattern);
  await check(Response.json({code:502,msg:'bad gateway',data:null},{status:502}),/HTTP 502/);
  await check(Response.json({msg:'平台限流，请稍后重试'},{status:429}),/平台限流/);
  await check(Response.json({error:{message:'图片服务配置不完整'}},{status:409}),/图片服务配置不完整/);
  await check(new Response('<html>too large</html>',{status:413}),/上传限制/);
  await check(new Response('timeout',{status:504}),/HTTP 504/);
  await assert.rejects(requestVideo('/test',{}, {fetchImpl:async()=>{throw Error('Failed to fetch');}}),/无法连接视频后台/);
});
test('composer preflight blocks large image submissions when cloud dependencies are absent',async()=>{
  const calls=[];
  const request=async url=>{calls.push(url);return {configured:false,compositionReady:false};};
  await assert.rejects((async()=>{await ensureVideoComposer(request);await request('/api/video/jobs');})(),/服务器.*剪辑组件未就绪/);
  assert.deepEqual(calls,['/api/video/status']);
});
test('stable camera accepts a ready composer without a video API key',async()=>{
  const config=await ensureVideoComposer(async()=>({configured:false,compositionReady:true}));
  assert.equal(config.configured,false);assert.equal(config.compositionReady,true);
});
