export const videoComposerUnavailable='当前服务器的视频剪辑组件未就绪，请安装项目依赖并重启服务，或配置可用的 FFmpeg；尚未提交分镜生成';

export async function requestVideo(url,data,{fetchImpl=fetch}={}){
  let res;
  try{res=await fetchImpl(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
  catch{throw Error('无法连接视频后台，请检查网络或云端服务状态后重试');}
  let value;try{value=await res.json();}catch{}
  if(!res.ok){
    const message=value?.error?.message||value?.error||value?.message||value?.msg;
    if(typeof message==='string'&&!/^(bad gateway|service unavailable|gateway timeout)$/i.test(message.trim()))throw Error(message.slice(0,300));
    if(res.status===413)throw Error('商品素材总量超过托管平台上传限制，请减少图片后重试');
    if([502,503,504].includes(res.status))throw Error(`视频后台或云端网关暂时不可用（HTTP ${res.status}），请检查服务状态、剪辑组件和上传限制`);
    throw Error(`视频请求失败（HTTP ${res.status}），请稍后重试`);
  }
  if(!value||typeof value!=='object')throw Error('视频后台返回了无法读取的结果，请检查云端服务状态');
  return value;
}

export async function ensureVideoComposer(request=requestVideo){
  const config=await request('/api/video/status');
  if(config.compositionReady!==true)throw Error(videoComposerUnavailable);
  return config;
}
