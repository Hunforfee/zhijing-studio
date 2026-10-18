import {execFile} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {videoBinary} from './video-composer.mjs';
export function normalizeVideoLayers(value){
  const polygon=(points,required=false)=>{
    if(!Array.isArray(points)||points.length>64||required&&points.length<3||points.length>0&&points.length<3)throw Error('请标注有效的分层边界');
    const result=points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('分层坐标必须位于图内');return [...p];});
    const area=Math.abs(result.reduce((a,p,i)=>{const q=result[(i+1)%result.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;
    if(required&&(area<.05||area>.98))throw Error('床品区域过小或覆盖整张图片，无法形成分层');
    return result;
  };
  if(!value||typeof value!=='object')throw Error('请先标注床品范围');
  return {subject:polygon(value.subject,true),foreground:polygon(value.foreground||[]),ambient:polygon(value.ambient||[]),breeze:value.breeze!==false};
}
export async function renderLayeredShot({directory,index,duration,ratio,signal,layers,dimensions}){
  if(!Number.isInteger(index)||index<0||index>5||![5,10].includes(duration))throw Error('分层运镜参数无效');
  const reference=normalizeVideoLayers(layers),frame=await readFile(path.join(directory,'frame-'+(index+1)+'.png'));
  let width=1080,height=1440;
  if(ratio==='9:16')height=1920;else if(ratio==='16:9'){width=1920;height=1080;}else if(ratio==='1:1')height=1080;
  else{const r=frame.readUInt32BE(16)/frame.readUInt32BE(20);if(r>.2&&r<5){width=r>=1?Math.min(1920,Math.round(1080*r/2)*2):1080;height=Math.round(width/r/2)*2;}}
  if(dimensions){width=dimensions.width;height=dimensions.height;}
  const config=path.join(directory,'layers-'+(index+1)+'.json');await writeFile(config,JSON.stringify({version:1,index,duration,width,height,layers:reference}));
  const python=process.env.VIDEO_PYTHON||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  const binary=await videoBinary(),script=fileURLToPath(new URL('./video-layered.py',import.meta.url));
  await new Promise((resolve,reject)=>execFile(python,[script,'--config',config,'--ffmpeg',binary],{windowsHide:true,signal,timeout:300000,maxBuffer:1024*1024},error=>error?reject(Error(signal?.aborted?'已停止分层运镜':'分层运镜失败，原分镜图已保留')):resolve()));
}
