import {renderCameraShot} from './video-camera.mjs';
import {mkdir,readFile,writeFile,rename,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {loadServiceConfig,saveServiceConfig} from './secure-service-store.mjs';
import {loadDeploymentConfiguration} from './deployment-config.mjs';
import {normalizeCreativeBrief,normalizeStoryboard,normalizePatternReference,shotPrompt,creativeFramePrompt} from './dist/video-storyboard.js';
import {planVideoStory,draftStoryboard} from './video-story-planner.mjs';
import {composeVideoStory,checkVideoComposer,storyboardSrt,cropVideoPatterns} from './video-composer.mjs';
import {MINIMAX_VIDEO_BASE,normalizeVideoConfig,videoConfigProfiles,videoProvider,assertVideoCapabilities,minimaxVideoRequest} from './video-providers.mjs';

export const VIDEO_BASE='https://open.bigmodel.cn/api/paas/v4';
export function videoImage(image){
  const m=typeof image==='string'&&image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!m)throw Error('请上传或选择一张商品图片');
  const bytes=Buffer.from(m[2],'base64');
  const valid=m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid||bytes.length<24||bytes.length>10*1024*1024)throw Error('素材必须是有效 PNG、JPEG 或 WebP，且不超过 10 MB');
  return {bytes,mime:'image/'+m[1]};
}
function videoSources(v){if(!Array.isArray(v.images)||!v.images.length||v.images.length>6)throw Error('请添加 1 至 6 张同款商品素材');return v.images.map(videoImage);}
export function validateVideoInput(v){
  if(!v||typeof v!=='object')throw Error('视频参数无效');const sources=videoSources(v);
  if(!['quality','speed'].includes(v.quality)||!['source','9:16','16:9','1:1'].includes(v.ratio)||typeof v.audio!=='boolean')throw Error('视频规格无效');
  const motionMode=v.motionMode??'camera';if(!['camera','ai'].includes(motionMode))throw Error('请选择有效的运镜方式');if(motionMode==='camera'&&v.audio)throw Error('稳定运镜不生成环境音效，请关闭后继续');
  const creative=normalizeCreativeBrief(v.creative),storyboard=normalizeStoryboard(v.storyboard,sources.length);
  if(creative.product==='auto'&&storyboard.source==='template')throw Error('模板创作请先选择商品类型，避免仅凭花型猜产品');
  storyboard.productReference=normalizePatternReference(storyboard.productReference,sources.length);
  return {sources,creative,storyboard,motionMode,quality:v.quality,ratio:v.ratio,audio:v.audio,duration:storyboard.duration,userPrompt:creative.brief};
}
const fingerprint=c=>createHash('sha256').update(videoProvider(c)==='minimax'?JSON.stringify(['minimax',c.model,c.apiKey]):c.apiKey||'').digest('hex');
const imageFingerprint=c=>createHash('sha256').update(JSON.stringify([c?.provider,c?.baseUrl,c?.model,c?.apiKey])).digest('hex');
async function defaultVideoConfiguration(){return await loadServiceConfig(new URL('./.share/video-service.dpapi',import.meta.url))||(await loadDeploymentConfiguration())?.video;}
export function createVideoService({outputDir,fetchImpl=fetch,loadConfig=defaultVideoConfiguration,saveConfig=c=>saveServiceConfig(c,new URL('./.share/video-service.dpapi',import.meta.url)),pollMs=5000,downloadVideo,getPlanningConfig=()=>({}),getKeyframeConfig=getPlanningConfig,generateKeyframe,cropPatterns=cropVideoPatterns,composeVideo=composeVideoStory,renderCamera=renderCameraShot,checkComposer=checkVideoComposer}={}){
  const directory=path.join(outputDir,'videos'),jobs=new Map(),recordWrites=new Map();let config={},profiles={},busy=false,closed=false,saving=false;
  const isActive=j=>['queued','running','submitting','assembling','designing'].includes(j.status);
  const canResume=j=>j.status==='failed'&&(j.motionMode==='camera'&&j.phase==='video'||(j.workflow==='creative-frames-v1'&&j.phase==='frames'?j.imageFingerprint===imageFingerprint(getKeyframeConfig())&&j.shotTasks.some(s=>s.frameStatus==='completed')&&!j.shotTasks.some(s=>s.frameUncertain):j.fingerprint===fingerprint(config)&&(j.storyboard?j.shotTasks.some(s=>s.providerId||s.status==='completed')&&!j.shotTasks.some(s=>s.providerFailed||s.uncertain&&!s.providerId):!!j.providerId)));
  const publicConfig=()=>({configured:!!config.apiKey,planningConfigured:!!getPlanningConfig()?.apiKey,keyframeConfigured:!!getKeyframeConfig()?.apiKey&&['sub2api','compatible','openai'].includes(getKeyframeConfig().provider),provider:videoProvider(config),model:config.model||'cogvideox-3',baseUrl:videoProvider(config)==='minimax'?MINIMAX_VIDEO_BASE:VIDEO_BASE,supportsAudio:videoProvider(config)!=='minimax',profiles:Object.fromEntries(Object.entries(profiles).map(([id,c])=>[id,{configured:!!c.apiKey,model:c.model}])),storyboard:true,referenceMode:'pattern-only'});
  const publicJob=j=>({id:j.id,motionMode:j.motionMode||'ai',status:j.status,phase:j.phase,workflow:j.workflow,progress:j.progress??null,message:j.message,created:j.created,finished:j.finished||null,duration:j.duration,ratio:j.ratio,motion:j.motion,userPrompt:j.userPrompt,storyboard:j.storyboard||null,creative:j.creative||null,canResume:canResume(j),shots:(j.shotTasks||[]).map((s,i)=>({index:i,status:s.status,frameStatus:s.frameStatus,frameUrl:s.frameStatus==='completed'?`/api/video/jobs/${j.id}/shots/${i}/frame`:null,title:j.storyboard.shots[i].title,url:s.status==='completed'?`/api/video/jobs/${j.id}/shots/${i}/content`:null})),url:j.status==='completed'?`/api/video/jobs/${j.id}/content`:null,poster:j.shotTasks?.[0]?.frameStatus==='completed'?`/api/video/jobs/${j.id}/shots/0/frame`:`/api/video/jobs/${j.id}/source`});
  const dir=j=>path.join(directory,j.id);
  function persist(j){const {controller,runtimeConfig,runtimeImageConfig,...record}=j,snapshot=JSON.stringify(record);const write=(recordWrites.get(j.id)||Promise.resolve()).catch(()=>{}).then(async()=>{await mkdir(dir(j),{recursive:true});const dest=path.join(dir(j),'job.json'),temporary=dest+'.'+randomUUID()+'.tmp';await writeFile(temporary,snapshot);await rename(temporary,dest);});recordWrites.set(j.id,write);void write.then(()=>{if(recordWrites.get(j.id)===write)recordWrites.delete(j.id);},()=>{});return write;}
  const ready=(async()=>{const stored=videoConfigProfiles(await loadConfig()||{});config=stored.config;profiles=stored.profiles;await mkdir(directory,{recursive:true});for(const id of await readdir(directory)){if(!/^[a-f0-9-]{36}$/.test(id))continue;try{const j=JSON.parse(await readFile(path.join(directory,id,'job.json'),'utf8'));if(j.id!==id)continue;if(isActive(j)){
    if(j.workflow==='creative-frames-v1')for(let i=0;i<j.shotTasks.length;i++){const s=j.shotTasks[i];if(s.frameUncertain){try{await stat(path.join(dir(j),'frame-'+(i+1)+'.png'));s.frameStatus='completed';s.frameUncertain=false;}catch{}}}
    const frames=j.phase==='frames',uncertain=j.storyboard?j.shotTasks.some(s=>s.uncertain&&!s.providerId||s.frameUncertain):j.status==='submitting'&&!j.providerId,changed=frames?j.imageFingerprint!==imageFingerprint(getKeyframeConfig()):j.motionMode!=='camera'&&(!config.apiKey||j.fingerprint!==fingerprint(config));
    if(changed||uncertain){j.status='failed';j.finished=Date.now();j.message='任务中断。请先检查供应商记录，确认后再新建，避免重复计费。';await persist(j);}else j.status='queued';}jobs.set(id,j);}catch(error){if(error.code!=='ENOENT')throw Error('无法读取视频任务记录');}}})().then(()=>{drain();});
  ready.catch(()=>{});
  function cleanError(error,c){return String(error?.message||'视频服务暂时不可用').split(c.apiKey||'__no_key__').join('[密钥已隐藏]').replace(/Bearer\s+\S+|sk-[\w-]+/gi,'[密钥已隐藏]').slice(0,300);}
  async function upstream(suffix,c,init={}){
    const request=async(url,requestInit=init)=>{
    const response=await fetchImpl(url,{...requestInit,headers:{Authorization:'Bearer '+c.apiKey,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.any([requestInit.signal||new AbortController().signal,AbortSignal.timeout(60000)])});
    let data;try{data=await response.json();}catch{throw Error('视频服务返回了无效结果');}
    if(!response.ok||data.error||data.base_resp?.status_code&&data.base_resp.status_code!==0){const error=Error('视频服务：'+(data.error?.message||data.base_resp?.status_msg||({401:'密钥无效',403:'账户没有视频模型权限',429:'服务繁忙或余额不足'}[response.status])||'请求失败（'+response.status+'）'));error.definitive=response.status<500;throw error;}
    return data;
    };
    return videoProvider(c)==='minimax'?minimaxVideoRequest(suffix,c,init,request):request(VIDEO_BASE+suffix);
  }
  async function prepareCreativeFrames(j){
    const imageConfig=j.runtimeImageConfig||getKeyframeConfig();if(!imageConfig?.apiKey||imageFingerprint(imageConfig)!==j.imageFingerprint)throw Error('图片服务已变化，请恢复原服务后继续');
    const references=await cropPatterns({directory:dir(j),reference:j.storyboard.productReference,signal:j.controller.signal});
    for(let i=0;i<j.storyboard.shots.length;i++){
      const task=j.shotTasks[i];j.controller.signal.throwIfAborted();
      if(task.frameStatus==='completed'){try{await stat(path.join(dir(j),'frame-'+(i+1)+'.png'));continue;}catch{task.frameStatus='pending';}}
      if(task.frameUncertain)throw Error('创意画面提交状态不明，请先核对图片服务记录，避免重复计费');
      j.status='designing';j.message='正在重新创作第 '+(i+1)+'/'+j.storyboard.shots.length+' 镜的场景画面';task.frameStatus='submitting';task.frameUncertain=true;await persist(j);
      let bytes;try{bytes=await generateKeyframe({references,prompt:creativeFramePrompt(j.storyboard,j.storyboard.shots[i],i,j.creative),config:imageConfig,ratio:j.ratio,signal:j.controller.signal});}catch(error){if(error.definitive){task.frameUncertain=false;task.frameStatus='failed';}throw error;}
      j.controller.signal.throwIfAborted();if(!Buffer.isBuffer(bytes)||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('未收到有效创意画面，不会使用上传原图代替');
      await writeFile(path.join(dir(j),'frame-'+(i+1)+'.png'),bytes);task.frameStatus='completed';task.frameUncertain=false;j.progress=Math.round((i+1)/j.storyboard.shots.length*100);await persist(j);
    }
    j.status='frames_ready';j.message='创意场景画面已完成，请预览确认后生成视频';j.progress=100;j.finished=Date.now();
  }
  async function runCameraStory(j){
    for(let i=0;i<j.storyboard.shots.length;i++){
      j.controller.signal.throwIfAborted();const task=j.shotTasks[i];
      if(task.status==='completed'){try{await stat(path.join(dir(j),'shot-'+(i+1)+'.mp4'));continue;}catch{}}
      if(task.frameStatus!=='completed')throw Error('请先确认本镜分镜图');
      j.status='running';j.message='稳定运镜渲染 · '+(i+1)+'/'+j.storyboard.shots.length+' 镜';task.status='running';await persist(j);
      await renderCamera({directory:dir(j),index:i,duration:j.storyboard.shots[i].duration,ratio:j.ratio,signal:j.controller.signal});
      task.status='completed';j.progress=Math.round((i+1)/j.storyboard.shots.length*90);await persist(j);
    }
    j.status='assembling';j.message='正在剪辑稳定运镜与字幕';await persist(j);
    await composeVideo({directory:dir(j),storyboard:j.storyboard,ratio:j.ratio,signal:j.controller.signal});
    j.controller.signal.throwIfAborted();j.status='completed';j.progress=100;j.finished=Date.now();j.message='稳定运镜成片已完成 · 床品保持分镜图形态';
  }
  async function runStory(j,c){
    for(let i=0;i<j.storyboard.shots.length;i++){
      j.controller.signal.throwIfAborted();const shot=j.storyboard.shots[i],task=j.shotTasks[i];
      if(task.status==='completed'){try{await stat(path.join(dir(j),'shot-'+(i+1)+'.mp4'));continue;}catch{task.status='pending';}}
      if(task.uncertain&&!task.providerId)throw Error('第 '+(i+1)+' 镜提交状态不明，请先到供应商核对，不能自动重复提交');
      if(task.providerFailed)throw Error('第 '+(i+1)+' 镜供应商生成失败，已完成分镜保留');
      if(!task.providerId){
        j.status='submitting';task.status='submitting';task.uncertain=true;j.message='正在生成第 '+(i+1)+'/'+j.storyboard.shots.length+' 镜 · '+shot.title;await persist(j);
        let image,mime;if(j.workflow==='creative-frames-v1'){if(task.frameStatus!=='completed')throw Error('创意分镜图尚未就绪，不会使用原照片代替');image=await readFile(path.join(dir(j),'frame-'+(i+1)+'.png'));mime='image/png';}else{image=await readFile(path.join(dir(j),'source-'+shot.sourceIndex));mime=j.sourceMimes[shot.sourceIndex];}
        const payload={model:'cogvideox-3',image_url:'data:'+mime+';base64,'+image.toString('base64'),prompt:shotPrompt(j.storyboard,shot,i,j.creative),duration:shot.duration,quality:j.quality,with_audio:j.audio,fps:30},sizes={'9:16':'1080x1920','16:9':'1920x1080','1:1':'1024x1024'};if(sizes[j.ratio])payload.size=sizes[j.ratio];
        let result;try{result=await upstream('/videos/generations',c,{method:'POST',body:JSON.stringify(payload),signal:j.controller.signal});}catch(error){if(error.definitive){task.uncertain=false;task.status='failed';}throw error;}
        if(typeof result.id!=='string'||!result.id||result.id.length>200)throw Error('分镜服务未返回任务编号，请核对供应商记录');task.providerId=result.id;task.uncertain=false;await persist(j);
      }
      j.status='running';task.status='running';j.message='第 '+(i+1)+'/'+j.storyboard.shots.length+' 镜生成中 · '+shot.title;await persist(j);const deadline=Date.now()+45*60*1000;let failures=0;
      for(;;){
        j.controller.signal.throwIfAborted();if(Date.now()>deadline)throw Error('分镜等待超时，可继续获取原任务，不要重复提交');let result;
        try{result=await upstream('/async-result/'+encodeURIComponent(task.providerId),c,{signal:j.controller.signal});failures=0;}catch(error){if(j.controller.signal.aborted||++failures>=5)throw error;await delay(pollMs,undefined,{signal:j.controller.signal});continue;}
        if(result.task_status==='FAIL'){task.providerFailed=true;task.status='failed';throw Error('第 '+(i+1)+' 镜生成失败，已完成分镜保留');}
        if(result.task_status==='SUCCESS'){
          const url=result.video_result?.[0]?.url;if(typeof url!=='string')throw Error('分镜服务未返回视频文件');const bytes=await downloadVideo(url,j.controller.signal);j.controller.signal.throwIfAborted();await writeFile(path.join(dir(j),'shot-'+(i+1)+'.mp4'),bytes);task.status='completed';j.progress=Math.round((i+1)/j.storyboard.shots.length*90);await persist(j);break;
        }
        if(!['PROCESSING','SUBMITTED'].includes(result.task_status))throw Error('分镜服务返回了未知状态');const p=Number(result.progress);j.progress=Math.round((i+(Number.isFinite(p)&&result.progress!=null?Math.max(0,Math.min(99,p))/100:0))/j.storyboard.shots.length*90);await delay(pollMs,undefined,{signal:j.controller.signal});
      }
    }
    j.controller.signal.throwIfAborted();j.status='assembling';j.message='全部分镜已完成，正在剪辑与添加字幕';j.progress=95;await persist(j);
    await composeVideo({directory:dir(j),storyboard:j.storyboard,ratio:j.ratio,signal:j.controller.signal});j.controller.signal.throwIfAborted();j.status='completed';j.progress=100;j.message='内容短片已完成 · '+j.storyboard.shots.length+' 镜 / '+j.duration+' 秒';j.finished=Date.now();
  }
  async function drain(){if(closed||busy)return;const j=[...jobs.values()].find(j=>j.status==='queued');if(!j)return;busy=true;j.controller=new AbortController();const c=j.runtimeConfig||{...config};
    try{
      if(j.workflow==='creative-frames-v1'&&j.phase==='frames'){await prepareCreativeFrames(j);return;}
      if(j.storyboard){if(j.motionMode==='camera')await runCameraStory(j);else await runStory(j,c);return;}
      if(!j.providerId){j.status='submitting';j.message='正在提交视频任务';await persist(j);const image=await readFile(path.join(dir(j),'source'));const payload={model:'cogvideox-3',image_url:'data:'+j.mime+';base64,'+image.toString('base64'),prompt:j.prompt,quality:j.quality,duration:j.duration,with_audio:j.audio,fps:30};const sizes={'9:16':'1080x1920','16:9':'1920x1080','1:1':'1024x1024'};if(sizes[j.ratio])payload.size=sizes[j.ratio];
        const data=await upstream('/videos/generations',c,{method:'POST',body:JSON.stringify(payload),signal:j.controller.signal});if(typeof data.id!=='string'||!data.id||data.id.length>200)throw Error('视频服务未返回任务编号');j.providerId=data.id;await persist(j);
      }
      j.status='running';j.message='视频生成中，请稍候';await persist(j);const deadline=Date.now()+45*60*1000;let failures=0;
      while(!closed&&!j.controller.signal.aborted){
        if(Date.now()>deadline)throw Error('视频生成等待超时，请到供应商记录核对任务，避免重复生成');
        let data;try{data=await upstream('/async-result/'+encodeURIComponent(j.providerId),c,{signal:j.controller.signal});failures=0;}catch(error){if(j.controller.signal.aborted||++failures>=5)throw error;await delay(pollMs,undefined,{signal:j.controller.signal});continue;}
        if(data.task_status==='FAIL')throw Error(data.error?.message||'视频生成失败，请调整素材或要求后重试');
        if(data.task_status==='SUCCESS'){
          const url=data.video_result?.[0]?.url;if(typeof url!=='string')throw Error('视频服务未返回可下载的视频');j.message='生成完成，正在保存视频';await persist(j);
          if(!downloadVideo)throw Error('视频下载服务不可用');
          const bytes=await downloadVideo(url,j.controller.signal);if(j.controller.signal.aborted)throw Error('已停止');await writeFile(path.join(dir(j),'video.mp4'),bytes);j.status='completed';j.progress=100;j.message='视频已生成';j.finished=Date.now();break;
        }
        if(!['PROCESSING','SUBMITTED'].includes(data.task_status))throw Error('视频服务返回了未知任务状态');
        const progress=Number(data.progress);j.progress=Number.isFinite(progress)&&data.progress!=null?Math.max(0,Math.min(99,progress)):null;
        await delay(pollMs,undefined,{signal:j.controller.signal});
      }
    }catch(error){if(closed)return;if(j.controller.signal.aborted){j.status='cancelled';j.message='已停止跟踪，供应商可能仍在生成并计费';}else{j.status='failed';j.message=cleanError(error,j.phase==='frames'?j.runtimeImageConfig||getKeyframeConfig():c);}j.finished=Date.now();}
    finally{delete j.controller;delete j.runtimeConfig;delete j.runtimeImageConfig;busy=false;if(!closed){await persist(j);drain();}}
  }
  async function handle(req,res,pathname,body,json){
    if(!pathname.startsWith('/api/video/')&&pathname!=='/api/service/video')return false;
    await ready;
    if(pathname==='/api/video/status'&&req.method==='GET'){json(res,200,{...publicConfig(),compositionReady:await checkComposer()});return true;}
    if(pathname==='/api/video/storyboard'&&req.method==='POST'){
      const input=await body(req,45*1024*1024),images=videoSources(input).map(s=>'data:'+s.mime+';base64,'+s.bytes.toString('base64')),brief=normalizeCreativeBrief(input.creative);
      let storyboard;if(input.template===true){storyboard=draftStoryboard(brief,images.length);if(input.reference)storyboard.productReference=normalizePatternReference(input.reference,images.length);}else storyboard=await planVideoStory({brief,images,reference:input.reference,config:getPlanningConfig(),fetchImpl,signal:AbortSignal.timeout(180000)});json(res,200,{storyboard});return true;
    }
    if(pathname==='/api/service/video'&&req.method==='POST'){
      if(saving){json(res,409,{error:'视频配置正在保存'});return true;}
      const input=await body(req,16384),provider=input.provider||videoProvider(config),saved=profiles[provider]||{};
      const next=normalizeVideoConfig({provider,model:input.model||saved.model,apiKey:typeof input.apiKey==='string'&&input.apiKey.trim()?input.apiKey.trim():saved.apiKey});
      if(!next.apiKey||next.apiKey.length<8||next.apiKey.length>8192||/\s/.test(next.apiKey))throw Error('请填写此视频服务对应的有效密钥');
      saving=true;try{const nextProfiles={...profiles,[provider]:next};await saveConfig({version:2,activeProvider:provider,profiles:nextProfiles});profiles=nextProfiles;config=next;}finally{saving=false;}json(res,200,publicConfig());return true;
    }
    if(pathname==='/api/video/jobs'&&req.method==='GET'){json(res,200,{jobs:[...jobs.values()].sort((a,b)=>b.created-a.created).map(publicJob)});return true;}
    if(pathname==='/api/video/jobs'&&req.method==='POST'){
      if([...jobs.values()].filter(isActive).length>=5){json(res,429,{error:'视频队列已满，请等待当前任务完成'});return true;}
      if(!await checkComposer()){json(res,409,{error:'本地视频剪辑组件未就绪，尚未提交生成'});return true;}
      const imageConfig=getKeyframeConfig();if(!imageConfig?.apiKey||!['sub2api','compatible','openai'].includes(imageConfig.provider)||!generateKeyframe){json(res,409,{error:'请先配置支持参考图生图的图片服务，视频只使用重新创作的分镜画面'});return true;}
      const v=validateVideoInput(await body(req,45*1024*1024)),{sources,...input}=v;
      if(v.motionMode==='ai'){if(!config.apiKey){json(res,409,{error:'请先配置视频生成服务'});return true;}assertVideoCapabilities(config,v);}
      const j={...input,workflow:'creative-frames-v1',phase:'frames',imageFingerprint:imageFingerprint(imageConfig),runtimeImageConfig:{...imageConfig},id:randomUUID(),mime:sources[0].mime,sourceMimes:sources.map(s=>s.mime),shotTasks:input.storyboard.shots.map(()=>({status:'pending',frameStatus:'pending'})),created:Date.now(),status:'queued',message:'创意画面已排队 · '+input.storyboard.shots.length+' 张，尚未提交视频生成',fingerprint:fingerprint(config),runtimeConfig:{...config}};
      await mkdir(dir(j),{recursive:true});await writeFile(path.join(dir(j),'source'),sources[0].bytes);for(let i=0;i<sources.length;i++)await writeFile(path.join(dir(j),'source-'+i),sources[i].bytes);await persist(j);jobs.set(j.id,j);json(res,202,publicJob(j));drain();return true;
    }
    const match=pathname.match(/^\/api\/video\/jobs\/([a-f0-9-]{36})(?:\/(cancel|content|source|resume|render|script|subtitles|shots\/[0-5]\/(?:content|frame)))?$/),j=match&&jobs.get(match[1]);
    if(!j){json(res,404,{error:'视频任务不存在'});return true;}
    if(!match[2]&&req.method==='GET'){json(res,200,publicJob(j));return true;}
    if(match[2]==='render'&&req.method==='POST'){
      if(j.workflow!=='creative-frames-v1'||j.status!=='frames_ready'||!j.shotTasks.every(s=>s.frameStatus==='completed')){json(res,409,{error:'请先完成并预览创意场景画面'});return true;}
      if(j.motionMode!=='camera'&&!config.apiKey||[...jobs.values()].filter(isActive).length>=5){json(res,409,{error:'视频服务未配置或队列已满'});return true;}
      if(j.motionMode!=='camera')assertVideoCapabilities(config,j);
      for(let i=0;i<j.shotTasks.length;i++)await stat(path.join(dir(j),'frame-'+(i+1)+'.png'));
      j.phase='video';j.fingerprint=fingerprint(config);j.runtimeConfig={...config};j.status='queued';j.progress=0;j.finished=null;j.message='创意画面已确认，开始逐镜生成视频';await persist(j);json(res,202,publicJob(j));drain();return true;
    }
    if(['script','subtitles'].includes(match[2])&&req.method==='GET'){
      if(!j.storyboard){json(res,404,{error:'旧版任务没有分镜脚本'});return true;}
      if(match[2]==='script'){res.setHeader('Content-Disposition','attachment; filename="storyboard.json"');json(res,200,j.storyboard);}else{res.writeHead(200,{'Content-Type':'application/x-subrip; charset=utf-8','Content-Disposition':'attachment; filename="captions.srt"'});res.end(storyboardSrt(j.storyboard));}return true;
    }
    if(match[2]==='resume'&&req.method==='POST'){
      if(!publicJob(j).canResume){json(res,409,{error:'此任务无法继续获取，请检查原视频服务账户'});return true;}
      j.status='queued';j.message='正在继续获取原任务结果';j.finished=null;j.runtimeConfig={...config};await persist(j);json(res,202,publicJob(j));drain();return true;
    }
    if(match[2]==='cancel'&&req.method==='POST'){
      if(isActive(j)){if(j.controller)j.controller.abort();else{j.status='cancelled';j.finished=Date.now();j.message='已取消排队';await persist(j);}}json(res,200,publicJob(j));return true;
    }
    const frameMatch=match[2]?.match(/^shots\/([0-5])\/frame$/);
    if(frameMatch&&['GET','HEAD'].includes(req.method)){const index=Number(frameMatch[1]);if(j.shotTasks?.[index]?.frameStatus!=='completed'){json(res,409,{error:'创意画面尚未就绪'});return true;}const bytes=await readFile(path.join(dir(j),'frame-'+(index+1)+'.png'));res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'private, no-cache'});res.end(req.method==='HEAD'?undefined:bytes);return true;}
    const shotMatch=match[2]?.match(/^shots\/([0-5])\/content$/);
    if((['content','source'].includes(match[2])||shotMatch)&&['GET','HEAD'].includes(req.method)){
      const video=match[2]==='content'||!!shotMatch;if(video&&(shotMatch?j.shotTasks?.[Number(shotMatch[1])]?.status!=='completed':j.status!=='completed')){json(res,409,{error:'视频尚未完成'});return true;}
      const file=path.join(dir(j),shotMatch?'shot-'+(Number(shotMatch[1])+1)+'.mp4':video?'video.mp4':'source'),info=await stat(file),headers={'Content-Type':video?'video/mp4':j.mime,'Cache-Control':'private, no-cache','Accept-Ranges':'bytes'};
      if(video)headers['Content-Disposition']='inline; filename="zhijing-'+j.id+'.mp4"';
      let start=0,end=info.size-1,code=200;
      if(req.headers.range){const r=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!r||!r[1]&&!r[2]){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return true;}start=r[1]?Number(r[1]):Math.max(0,info.size-Number(r[2]));end=r[1]&&r[2]?Math.min(Number(r[2]),end):end;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return true;}code=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
      headers['Content-Length']=end-start+1;res.writeHead(code,headers);if(req.method==='HEAD')res.end();else{const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}return true;
    }
    json(res,405,{error:'请求方法不支持'});return true;
  }
  return {handle,close(){closed=true;for(const j of jobs.values())j.controller?.abort();}};
}
