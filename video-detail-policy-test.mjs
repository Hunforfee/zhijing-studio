import test from 'node:test';
import assert from 'node:assert/strict';
import {draftStoryboard,normalizeCreativeBrief,creativeFramePrompt,shotPrompt,videoTopics,videoArtStyles} from './dist/video-storyboard.js';
import {planVideoStory} from './video-story-planner.mjs';
const reference={description:'同款蓝色小花，仅花型',swatches:[{sourceIndex:0,x:.2,y:.2,width:.3,height:.4,side:'A'}]};
const brief={topic:'daily',product:'set',duration:15,people:'hands',brief:'',facts:''};
test('all narrative directions and art styles use distinct settled-bedding detail angles, including model mode',()=>{
  for(const topic of Object.keys(videoTopics))for(const artStyle of Object.keys(videoArtStyles))for(const people of ['hands','none','model'])for(const duration of [15,20,30]){
    const b={...brief,topic,artStyle,people,duration},story=draftStoryboard(b,2);
    assert.equal(story.shots.length,duration/5);
    assert.ok(story.shots.every(s=>/近景|特写/.test(s.visual)));
    assert.equal(new Set(story.shots.map(s=>s.action)).size,story.shots.length);
    assert.ok(story.shots.every(s=>s.sourceIndex<2));
    assert.ok(!/整理床品|重新铺放|拿取|宽景/.test(story.premise+story.artDirection+story.shots.map(s=>s.visual+s.action).join('')));
    assert.equal(normalizeCreativeBrief(b).people,people);
    assert.ok(story.shots.every((s,i)=>shotPrompt(story,s,i,b).length+story.artDirection.length+100<=2000),'default prompts must fit MiniMax without dropping safety constraints');
  }
});
test('both final image and video prompts prioritize no-flip rules even for old scripts and conflicting custom requests',()=>{
  const story=draftStoryboard(brief);story.productReference=reference;
  const shot={...story.shots[0],action:'翻动被芯，掀起被角露出反面'};
  const b={...brief,brief:'抖被子，翻身拉被盖住自己'};
  for(const prompt of [creativeFramePrompt(story,shot,0,b),shotPrompt(story,shot,0,b)]){
    assert.ok(prompt.startsWith('【床品稳定与细节拍摄优先规则'));
    assert.match(prompt,/禁止翻动被芯/);assert.match(prompt,/至少三分之二/);assert.match(prompt,/不环绕/);
    assert.ok(prompt.lastIndexOf('以本规则替代')>prompt.indexOf(b.brief)||!prompt.includes(b.brief));
  }
});
test('model mode permits a resting adult consistently in both image and video requests without hand-only conflict',()=>{
  const b={...brief,people:'model'},story=draftStoryboard(b);story.productReference=reference;
  for(const prompt of [creativeFramePrompt(story,story.shots[0],0,b),shotPrompt(story,story.shots[0],0,b)]){
    assert.match(prompt,/同一位成年模特/);assert.match(prompt,/静坐或侧躺/);assert.match(prompt,/不拍上床、翻身/);
    assert.ok(!prompt.includes('仅在脚本有需要时出现自然手部'));
    assert.ok(!prompt.includes('人物最多只出现自然的手部'));
  }
});
test('actual AI planner request carries detail and bedding stability instructions in model mode',async()=>{
  const b={...brief,people:'model'},story={...draftStoryboard(b),productReference:reference};let calls=0;
  await planVideoStory({brief:b,images:['fixture'],config:{provider:'sub2api',apiKey:'mock-secret',baseUrl:'https://mock.test/v1'},fetchImpl:async(url,init)=>{
    calls++;const p=JSON.parse(init.body);assert.match(p.instructions,/禁止翻动被芯/);assert.match(p.instructions,/至少三分之二/);assert.match(p.instructions,/同一位成年模特/);assert.ok(!p.instructions.includes('允许自然手部整理'));
    return Response.json({output_text:JSON.stringify(story)});
  }});assert.equal(calls,1);
});
test('video motion requests exclude narrative actions and allow only camera movement and existing background breeze',()=>{
  const story=draftStoryboard(brief);story.title='翻被动画';story.premise='拉被盖住模特';
  const shot={...story.shots[0],visual:'被子飞起',action:'手把被子翻过来',caption:'测试字幕'};
  const prompt=shotPrompt(story,shot,0,{...brief,brief:'拍打床面'});
  for(const text of ['翻被动画','拉被盖住模特','被子飞起','手把被子翻过来','测试字幕','拍打床面'])assert.ok(!prompt.includes(text));
  assert.match(prompt,/背景窗帘、植物叶片/);assert.match(prompt,/风不能吹到床品/);assert.match(prompt,/Animate ONLY the camera/);
});
