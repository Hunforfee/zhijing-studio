export const MINIMAX_VIDEO_BASE='https://api.minimax.cn/v1';
export const MINIMAX_VIDEO_MODELS=['MiniMax-Hailuo-2.3','MiniMax-Hailuo-2.3-Fast'];
export const videoProvider=c=>c?.provider||'zhipu';
export function normalizeVideoConfig(input={}){
  const provider=videoProvider(input);
  if(!['zhipu','minimax'].includes(provider))throw Error('视频服务类型无效');
  const model=provider==='minimax'?(input.model||MINIMAX_VIDEO_MODELS[0]):'cogvideox-3';
  if(provider==='minimax'&&!MINIMAX_VIDEO_MODELS.includes(model))throw Error('请选择支持的 MiniMax 海螺视频模型');
  return {...input,provider,model};
}
export function videoConfigProfiles(saved={}){
  const profiles={};
  for(const provider of ['zhipu','minimax'])if(saved.profiles?.[provider])profiles[provider]=normalizeVideoConfig({...saved.profiles[provider],provider});
  if(saved.apiKey)profiles[videoProvider(saved)]=normalizeVideoConfig(saved);
  const activeProvider=saved.activeProvider||videoProvider(saved);
  return {profiles,activeProvider,config:profiles[activeProvider]||normalizeVideoConfig({provider:activeProvider})};
}
export function assertVideoCapabilities(config,{audio=false,storyboard}={}){
  if(videoProvider(config)!=='minimax')return;
  if(audio)throw Error('MiniMax 海螺当前接入的模型不支持环境音效，请关闭后生成');
  if(storyboard?.shots.some(s=>s.duration>10))throw Error('MiniMax 海螺单镜时长最多 10 秒');
}
export async function minimaxVideoRequest(suffix,config,init,request){
  if(suffix==='/videos/generations'){
    const source=JSON.parse(init.body);
    assertVideoCapabilities(config,{audio:source.with_audio});
    if(!Number.isFinite(source.duration)||source.duration<=0||source.duration>10)throw Object.assign(Error('MiniMax 海螺单镜时长须在 1 至 10 秒之间'),{definitive:true});
    if(typeof source.prompt!=='string'||source.prompt.length>2000)throw Object.assign(Error('MiniMax 视频提示词最多 2000 字，请精简分镜内容后再生成'),{definitive:true});
    const duration=source.duration<=6?6:10;
    const payload={model:config.model||MINIMAX_VIDEO_MODELS[0],first_frame_image:source.image_url,prompt:source.prompt,prompt_optimizer:false,duration,resolution:duration===6&&source.quality!=='speed'?'1080P':'768P'};
    const data=await request(MINIMAX_VIDEO_BASE+'/video_generation',{...init,body:JSON.stringify(payload)});
    return {id:data.task_id};
  }
  const match=suffix.match(/^\/async-result\/(.+)$/);
  if(!match)throw Error('MiniMax 视频请求类型无效');
  const data=await request(MINIMAX_VIDEO_BASE+'/query/video_generation?task_id='+match[1],init);
  const states={Preparing:'SUBMITTED',Queueing:'SUBMITTED',Processing:'PROCESSING',Fail:'FAIL',Success:'SUCCESS'};
  const task_status=states[data.status];
  if(!task_status)throw Error('MiniMax 视频服务返回了未知任务状态');
  if(task_status!=='SUCCESS')return {task_status};
  if(typeof data.file_id!=='string'||!data.file_id)throw Error('MiniMax 未返回视频文件编号，可继续获取原任务');
  const file=await request(MINIMAX_VIDEO_BASE+'/files/retrieve?file_id='+encodeURIComponent(data.file_id),init);
  if(typeof file.file?.download_url!=='string'||!file.file.download_url)throw Error('MiniMax 未返回视频下载地址，可继续获取原任务');
  return {task_status,video_result:[{url:file.file.download_url}]};
}
