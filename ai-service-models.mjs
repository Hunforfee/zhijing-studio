const modelPattern=/^[-\w./:]+$/;
export function validAnalysisModel(value){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=120&&modelPattern.test(value.trim());}

// One policy for every active vision/text consumer; never inherit the image model.
export function resolveAnalysisService(config={}){
  const zhipu=config.provider==='zhipu';
  const legacy=!zhipu&&config.visionModel==='glm-4.6v'?undefined:config.visionModel;
  const model=config.recognitionModel||legacy||(zhipu?'glm-4.6v':config.provider==='sub2api'?'gpt-5.6-luna':'gpt-4.1-mini');
  const responses=!zhipu&&(config.provider==='sub2api'||config.recognitionApi==='responses');
  return {model,zhipu,responses,recognitionApi:responses?'responses':'chat'};
}

export function analysisSettings(input={},current={},provider=input.provider||'compatible'){
  const same=(current.provider||'compatible')===provider?current:{};
  if(input.recognitionModel!=null&&(typeof input.recognitionModel!=='string'||input.recognitionModel.trim()&&!validAnalysisModel(input.recognitionModel)))throw Error('请填写有效的识图与内容模型名称');
  if(input.recognitionApi!=null&&!['responses','chat'].includes(input.recognitionApi))throw Error('识图接口类型无效');
  const recognitionModel=input.recognitionModel?.trim()||resolveAnalysisService({...same,provider}).model;
  if(!validAnalysisModel(recognitionModel))throw Error('已保存的识图模型无效，请重新填写');
  const resolved=resolveAnalysisService({provider,recognitionModel,recognitionApi:input.recognitionApi||same.recognitionApi});
  return {recognitionModel,recognitionApi:resolved.recognitionApi,visionModel:recognitionModel};
}

export function classifyServiceModels(entries){
  const ids=[...new Set(entries.map(entry=>entry?.id).filter(id=>validAnalysisModel(id)).map(id=>id.trim()))];
  const image=id=>/image|cogview|dall[-_]?e|flux|sdxl|stable[-_]?diffusion|imagen/i.test(id);
  const other=id=>/embedding|rerank|moderation|whisper|(?:^|[-_/])tts(?:$|[-_/])|audio|speech|music|cogvideo|hailuo|veo[-_\d]|sora|video/i.test(id);
  return {imageModels:ids.filter(image).slice(0,100),analysisModels:ids.filter(id=>!image(id)&&!other(id)).slice(0,100)};
}
