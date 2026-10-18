import test from 'node:test';
import assert from 'node:assert/strict';
import {planVideoStory,draftStoryboard} from './video-story-planner.mjs';
const brief={topic:'craft',product:'set',duration:15,people:'hands',brief:'',facts:''};
const reference={description:'白底蓝色花卉',swatches:[{sourceIndex:0,x:.2,y:.2,width:.4,height:.4,side:'A'}]};
const story={...draftStoryboard(brief),productReference:reference};
for(const [provider,visionModel,recognitionModel,expected] of [
  ['sub2api','glm-4.6v',undefined,'gpt-5.6-luna'],
  ['openai','glm-4.6v',undefined,'gpt-4.1-mini'],
  ['zhipu','glm-4.6v',undefined,'glm-4.6v'],
  ['sub2api','custom-vision',undefined,'custom-vision'],
  ['sub2api','glm-4.6v','explicit-vision','explicit-vision'],
])test(`planner selects ${expected} for ${provider}, explicit ${recognitionModel||visionModel}`,async()=>{
  let calls=0;
  const result=await planVideoStory({brief,images:['data:image/png;base64,fixture'],config:{provider,visionModel,recognitionModel,apiKey:'test-secret',baseUrl:'https://fixture.test/v1'},fetchImpl:async(url,init)=>{
    calls++;assert.equal(JSON.parse(init.body).model,expected);
    assert.equal(url,'https://fixture.test/v1/'+(provider==='sub2api'?'responses':'chat/completions'));
    return Response.json(provider==='sub2api'?{output_text:JSON.stringify(story)}:{choices:[{message:{content:JSON.stringify(story)}}]});
  }});
  assert.equal(calls,1);assert.equal(result.shots.length,3);
});
for(const [status,message] of [[401,'鉴权失败'],[403,'鉴权失败'],[404,'模型是否可用'],[429,'限流或额度不足'],[503,'上游服务异常']])test(`planner explains HTTP ${status} without exposing upstream secrets`,async()=>{
  let calls=0;
  await assert.rejects(()=>planVideoStory({brief,images:['fixture'],config:{provider:'sub2api',apiKey:'private-secret',baseUrl:'https://fixture.test/v1'},fetchImpl:async()=>{calls++;return Response.json({error:{message:'Bearer private-secret data:image/private'}},{status});}}),error=>{
    assert.ok(error.message.includes(message));assert.ok(error.message.includes(String(status)));assert.ok(!error.message.includes('private'));return true;
  });assert.equal(calls,1);
});
