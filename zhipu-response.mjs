function safeText(value,key=''){
  if(typeof value!=='string'&&typeof value!=='number')return '';
  let text=String(value);if(key)text=text.split(key).join('[密钥已隐藏]');
  return text.replace(/Bearer\s+\S+|sk-[\w-]+/gi,'[密钥已隐藏]').replace(/[\r\n\x00-\x1f]/g,' ').slice(0,240);
}
export function zhipuError(data,config,stage='智谱生图'){
  if(!data?.error)return null;
  const error=data.error;
  const code=safeText(error.code,config.apiKey),message=safeText(typeof error==='string'?error:error.message,config.apiKey);
  if(/StackOverflowError|Handler dispatch failed/i.test(message))return `${stage}：智谱服务内部异常（错误码 ${code||'500'} / StackOverflowError）。此次生成已停止，请稍后重试，或在 AI 服务设置选择另一个智谱图像模型；无需重新填写密钥。`;
  return `${stage}：${message||'服务返回错误'}${code?'（错误码 '+code+'）':''}`;
}
export async function zhipuJson(response,config,stage='智谱生图'){
  let data;try{data=await response.json()}catch{throw Error(`${stage}：服务未返回有效 JSON（HTTP ${response.status}），请检查接口是否为智谱官方接口`)}
  const error=zhipuError(data,config,stage);if(error)throw Error(error);
  if(!response.ok)throw Error(`${stage}：${response.status===401?'服务密钥无效':response.status===403?'账户尚无该模型的使用权限':response.status===429?'服务繁忙或余额不足':response.status>=500?'智谱服务内部异常，请稍后重试；无需重新填写密钥':'服务请求失败'}（HTTP ${response.status}）`);
  return data;
}
export function zhipuImage(data,config){
  const error=zhipuError(data,config);if(error)throw Error(error);
  const item=Array.isArray(data?.data)?data.data.find(i=>typeof i?.b64_json==='string'&&i.b64_json.trim()||typeof i?.url==='string'&&i.url.trim()):undefined;
  if(item?.b64_json){
    const encoded=item.b64_json.replace(/\s/g,'');
    if(encoded.length>Math.ceil(25*1024*1024/3)*4)throw Error('智谱生成图片超过大小限制');
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4===1)throw Error('智谱返回的图片编码无效');
    return {bytes:Buffer.from(encoded,'base64')};
  }
  if(item?.url)return {url:item.url.trim()};
  if(data?.content_filter?.some?.(f=>Number(f.level)<=1))throw Error('智谱未提供图片：内容审核拦截，请调整花型或补充说明后再试');
  if(data?.task_status||data?.task_id)throw Error('智谱返回了异步任务，当前连接需要同步 /images/generations 接口；未重复提交生成，请检查接口配置');
  throw Error('智谱生图响应没有图片（data 中缺少 url 或 b64_json）。请确认使用 GLM-Image 图像模型且已开通生图权限；识图模型不能直接输出产品图');
}
