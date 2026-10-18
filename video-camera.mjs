import {execFile} from 'node:child_process';
import {readFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {videoBinary} from './video-composer.mjs';
export function cameraPath(index,frames){
  const t=`min(on/${Math.max(1,frames-1)},1)`,e=`(${t}*${t}*(3-2*${t}))`;
  const centeredX='(iw-iw/zoom)/2',centeredY='(ih-ih/zoom)/2';
  return [
    {z:`1.025+0.055*${e}`,x:centeredX,y:centeredY},
    {z:'1.08',x:`(iw-iw/zoom)*(0.2+0.6*${e})`,y:centeredY},
    {z:`1.035+0.035*${e}`,x:centeredX,y:`(ih-ih/zoom)*(0.35+0.3*${e})`},
    {z:'1.07',x:`(iw-iw/zoom)*(0.8-0.6*${e})`,y:centeredY},
    {z:`1.08-0.045*${e}`,x:centeredX,y:centeredY},
    {z:'1.08',x:centeredX,y:`(ih-ih/zoom)*(0.25+0.5*${e})`},
  ][index%6];
}
export async function renderCameraShot({directory,index,duration,ratio,signal,dimensions}){
  if(!Number.isInteger(index)||index<0||index>5||![5,10].includes(duration))throw Error('稳定运镜参数无效');
  const frame='frame-'+(index+1)+'.png',bytes=await readFile(path.join(directory,frame));
  let width=1080,height=1440;
  if(ratio==='9:16')height=1920;else if(ratio==='16:9'){width=1920;height=1080;}else if(ratio==='1:1')height=1080;
  else if(bytes.length>24){const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(w>0&&h>0){const r=w/h;if(r>.2&&r<5){width=r>=1?Math.min(1920,Math.round(1080*r/2)*2):1080;height=Math.round(width/r/2)*2;}}}
  if(dimensions){width=dimensions.width;height=dimensions.height;}
  const frames=duration*30,p=cameraPath(index,frames),temporary='camera-'+(index+1)+'.partial.mp4';
  const filter=`scale=${width*2}:${height*2}:force_original_aspect_ratio=increase,crop=${width*2}:${height*2},zoompan=z='${p.z}':x='${p.x}':y='${p.y}':d=${frames}:s=${width}x${height}:fps=30,setsar=1`;
  const binary=await videoBinary();
  await new Promise((resolve,reject)=>execFile(binary,['-y','-hide_banner','-loglevel','error','-filter_threads','1','-i',frame,'-vf',filter,'-frames:v',String(frames),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',temporary],{cwd:directory,signal,windowsHide:true,timeout:240000,maxBuffer:1024*1024},error=>error?reject(Error(signal?.aborted?'已停止稳定运镜':'稳定运镜渲染失败，分镜图已保留')):resolve()));
  await rename(path.join(directory,temporary),path.join(directory,'shot-'+(index+1)+'.mp4'));
}
