import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('./dist/app.js',import.meta.url),'utf8');
const enqueue=app.match(/async function enqueueGeneration\(opt\)\{[\s\S]*?\n}\n(?=setTimeout)/)?.[0];
assert.ok(enqueue,'actual frontend submission function exists');

async function submit(response){
  const messages=[];
  let calls=0;
  const state={busy:false,patternB:null,referenceUpload:null};
  const context=vm.createContext({state,updateCount(){},prepareCameraReferences:async()=>[],patternData:async()=>'test-pattern',fetch:async()=>{calls++;return response;},toast:message=>messages.push(message)});
  await vm.runInContext(enqueue+'\nenqueueGeneration({})',context);
  assert.equal(calls,1);assert.equal(state.busy,false);
  return messages;
}

test('submission preserves backend source and provider validation errors',async()=>{
  assert.deepEqual(await submit(Response.json({error:'访问来源不允许：请配置网站域名'},{status:403})),['访问来源不允许：请配置网站域名']);
  assert.deepEqual(await submit(Response.json({message:'托管服务请求限制'},{status:429})),['托管服务请求限制']);
  assert.deepEqual(await submit(Response.json({msg:'平台维护中'},{status:503})),['平台维护中']);
  assert.deepEqual(await submit(Response.json({error:{message:'请求参数错误'}},{status:400})),['请求参数错误']);
});

test('cloud gateway and non-JSON failures show actionable errors instead of a generic toast',async()=>{
  assert.match((await submit(Response.json({code:502,msg:'bad gateway',data:null},{status:502})))[0],/网站网关.*HTTP 502.*来源配置/);
  assert.match((await submit(new Response('<html>too large</html>',{status:413})))[0],/图片总量.*托管平台限制/);
  assert.match((await submit(new Response('unavailable',{status:504})))[0],/HTTP 504/);
  assert.match((await submit(Response.json({},{status:200})))[0],/未返回任务编号/);
});
