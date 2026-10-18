import {writeFile} from 'node:fs/promises';
import {sceneDirections,angleDirections,photographyRules,productCameraAdjustment,promptVersion} from './photography-prompts.mjs';
import {buildPrompt} from './server.mjs';
import {beddingFidelityRule,beddingFidelityVersion} from './bedding-fidelity.mjs';
import {cameraFramingRule,matchingPillowRule,cameraReferenceRule,matAngleName,singleProductAngleName,singleProductDirection,singleProductCameraPrompt,blanketVariantNames,mattressVariantNames,sleepbagVariantNames} from './dist/camera-contract.js';
import {materialPriority} from './material-priority.mjs';
const lines=['织景：拍摄场景与角度提示词','版本：'+promptVersion,'','本文由实际生图代码导出。英文段落是发送给模型的原文，中文为对应说明。每次请求会组合所选场景、角度、产品、面料、A/B面分配、花型设置和补充要求。','程序检查能保证场景/角度组合映射正确，不能保证生成模型每次都完全遵循。真实成图仍需核对。','','通用摄影规则',photographyRules.zh,photographyRules.prompt];
for(const [label,map] of [['9 个拍摄场景',sceneDirections],['12 个拍摄角度',angleDirections]]){
  lines.push('',label);
  for(const [id,item]of Object.entries(map))lines.push('',item.name+' ['+id+']',item.zh,'实际提示词：',item.prompt);
}
const base={product:'set',fabric:'cotton',size:'按所选产品的常规比例，自然铺设',scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',imageB:true};
lines.push('','床品结构约束 · '+beddingFidelityVersion,'按所选产品与款式在服务端加入生成请求；照片参考不证明隐藏工艺，自动成图审核尚未接入。');
for(const product of ['set','sheet','pillow','quilt','blanket','mat','mattress','sleepbag'])lines.push('',product,beddingFidelityRule({...base,product}));
lines.push('','配套枕套与修图余量（当前生效）',matchingPillowRule(base),cameraFramingRule('front'),cameraFramingRule('wide'),cameraFramingRule('detail'),'','实际拍摄角度单图参考：示例只控制机位/构图，用户自己的拍摄参考优先',cameraReferenceRule(base,'front',3));
lines.push('','不同产品的反面展示与结构限制（实际请求摘录）');
for(const [product,fabric]of [['set','cotton'],['mat','bamboo'],['quilt','cotton'],['sheet','cotton'],['mattress','cotton'],['blanket','velvet'],['sleepbag','cotton']]){
  const prompt=buildPrompt({...base,product,fabric},'warm','reverse');
  lines.push('',product,prompt.split(' Camera: ')[1].split(' Pattern repeat: ')[0]);
}
lines.push('','凉席专用 12 个角度：冰丝席、藤席、竹席');
for(const product of ['mattress','blanket','sleepbag']){
  const variants=product==='mattress'?Object.keys(mattressVariantNames):product==='sleepbag'?Object.keys(sleepbagVariantNames):Object.keys(blanketVariantNames);
  for(const variant of variants){
    const label=product==='mattress'?'床垫专用 12 个拍摄角度 · '+mattressVariantNames[variant]:product==='sleepbag'?'更多产品专用 12 个拍摄角度 · '+sleepbagVariantNames[variant]:'毯子专用 12 个拍摄角度 · '+(blanketVariantNames[variant]||variant);
    lines.push('',label);
    for(const [angle,item]of Object.entries(angleDirections)){
      const input={...base,product,fabric:product==='mattress'?'cotton':product==='sleepbag'?'cotton':'velvet',...(product==='mattress'?{mattressVariant:variant}:product==='sleepbag'?{sleepbagVariant:variant}:{blanketVariant:variant})};
      const direction=singleProductDirection(product,angle,input);
      if(!direction)continue; // The eight additional set-only angles have no single-product direction.
      const prompt=buildPrompt(input,'warm',angle);
      lines.push('',singleProductAngleName(product,angle,item.name,input)+' ['+angle+']',direction.zh,prompt.split(' Camera: ')[1].split(' Pattern repeat: ')[0]);
    }
  }
}
for(const [fabric,name]of [['ice','冰丝席'],['rattan','藤席'],['bamboo','竹席']])for(const [angle,item]of Object.entries(angleDirections)){
  const prompt=buildPrompt({...base,product:'mat',fabric,fabricMode:'selected'},'warm',angle);
  lines.push('',name+' / '+matAngleName(angle,item.name)+' ['+angle+']',prompt.split(' Camera: ')[1].split(' Pattern repeat: ')[0]);
}
lines.push('','用户拍摄参考范围：上传后默认场景与角度都参考；只参考一项时，另一项按勾选列表逐张生成。产品细节参考上传照片，但不改变所选产品结构、季节厚度与花型分配。');
for(const [referenceScene,referenceAngle]of [[true,true],[true,false],[false,true]]){
  lines.push('',referenceScene&&referenceAngle?'同时参考场景和角度':referenceScene?'只参考场景，角度用自选':'只参考角度，场景用自选',buildPrompt({...base,referenceImage:true,referenceScene,referenceAngle},'hotel','top'));
}
lines.push('','自上传质感图：与面料库二选一，只参考质感特征，A/B 面负责花型及原色',materialPriority({...base,textureReferenceImage:true},'',4));
lines.push('','毯子“包边特写”专用机位',singleProductCameraPrompt({product:'blanket',blanketVariant:'cloud'},'pillowclose'),'','完整示例：四件套 / 全棉 / 暖白侘寂 / 翻折看反面 / A+B / 两张翻折参考',buildPrompt(base,'warm','reverse',false,2));
await writeFile(new URL('./拍摄场景与角度提示词.txt',import.meta.url),lines.join('\r\n'),'utf8');
console.log('拍摄提示词文档已导出（9 个场景、12 个角度、产品适配和完整示例）。');
