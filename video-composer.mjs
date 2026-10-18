import {execFile} from 'node:child_process';
import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveVideoBinary} from './video-runtime.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));let binaryPromise;
export async function videoBinary(){
  if(!binaryPromise)binaryPromise=resolveVideoBinary({root}).catch(error=>{binaryPromise=null;throw error;});return binaryPromise;
}
function execute(binary,args,{cwd,signal,probe=false}={}){return new Promise((resolve,reject)=>{execFile(binary,args,{cwd,signal,windowsHide:true,timeout:240000,maxBuffer:2*1024*1024},(error,stdout,stderr)=>{if(error&&!probe)return reject(Error(signal?.aborted?'已停止剪辑':'视频剪辑失败，请继续获取原任务重试；分镜文件已保留'));resolve(stdout+'\n'+stderr);});});}
export async function checkVideoComposer(){try{await videoBinary();return true;}catch{return false;}}
export async function cropVideoPatterns({directory,reference,signal}){
  const binary=await videoBinary(),result=[];
  for(let i=0;i<reference.swatches.length;i++){const s=reference.swatches[i],file='pattern-'+(i+1)+'.png';await execute(binary,['-y','-hide_banner','-loglevel','error','-i','source-'+s.sourceIndex,'-vf',`crop=trunc(iw*${s.width}/2)*2:trunc(ih*${s.height}/2)*2:trunc(iw*${s.x}):trunc(ih*${s.y})`,'-frames:v','1',file],{cwd:directory,signal});const bytes=await readFile(path.join(directory,file));if(bytes.length<24)throw Error('花型裁片无效，请重新框选');result.push({bytes,mime:'image/png',side:s.side});}
  return result;
}
const clock=seconds=>{const n=Math.round(seconds*1000);return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;};
export function storyboardSrt(story){let start=0;return story.shots.map((s,i)=>{const end=start+s.duration,line=(i+1)+'\n'+clock(start)+' --> '+clock(end)+'\n'+s.caption.replace(/[\r\n]+/g,' ')+'\n';start=end;return line;}).join('\n');}
export function storyboardAss(story,width,height){
  const assClock=s=>clock(s).replace(/,(\d{2})\d$/,(all,d)=>'.'+d).replace(/^0/,'');let start=0;const font=Math.max(22,Math.round(width/24)),margin=Math.round(width*.075);
  const lines=story.shots.map(s=>{const end=start+s.duration,chars=Array.from(s.caption.replace(/[\r\n\\{}]/g,' ')),chunks=[];while(chars.length)chunks.push(chars.splice(0,Math.max(12,Math.floor(width/font*.8))).join(''));const result=`Dialogue: 0,${assClock(start)},${assClock(end)},Default,,0,0,0,,${chunks.join('\\N')}`;start=end;return result;});
  return '[Script Info]\nScriptType: v4.00+\nPlayResX: '+width+'\nPlayResY: '+height+'\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Microsoft YaHei,'+font+',&H00FFFFFF,&H00FFFFFF,&H801C2B25,&H801C2B25,0,0,0,0,100,100,0,0,1,1.5,1,2,'+margin+','+margin+','+Math.round(height*.08)+',1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+lines.join('\n')+'\n';
}
export async function composeVideoStory({directory,storyboard,ratio,signal}){
  const binary=await videoBinary(),first='shot-1.mp4';let width=1080,height=1440;
  if(ratio==='16:9'){width=1920;height=1080;}else if(ratio==='9:16'){width=1080;height=1920;}else if(ratio==='1:1'){width=height=1024;}else{const metadata=await execute(binary,['-hide_banner','-i',first],{cwd:directory,signal,probe:true});const match=metadata.match(/Video:[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/);if(match){const r=Number(match[1])/Number(match[2]);if(r>.2&&r<5){width=r>=1?Math.min(1920,Math.round(1080*r/2)*2):1080;height=Math.round(width/r/2)*2;}}}
  const normalized=[];
  for(let i=0;i<storyboard.shots.length;i++){
    const file='shot-'+(i+1)+'.mp4',metadata=await execute(binary,['-hide_banner','-i',file],{cwd:directory,signal,probe:true}),hasAudio=/Audio:/.test(metadata),name='cut-'+(i+1)+'.mp4';
    const picture='picture-'+(i+1)+'.mp4',duration=String(storyboard.shots[i].duration);
    // Normalize the finite picture first. An infinite silent input must not end
    // processing before the video filter has emitted its padded final frames.
    await execute(binary,['-y','-hide_banner','-loglevel','error','-i',file,'-an','-vf',`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x19251f,setsar=1,fps=30:start_time=0,tpad=stop_mode=clone:stop_duration=10`,'-t',duration,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',picture],{cwd:directory,signal});
    await execute(binary,['-y','-hide_banner','-loglevel','error','-i',picture,...(hasAudio?['-i',file]:['-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000']),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','apad','-t',duration,'-c:a','aac','-ar','48000','-ac','2',name],{cwd:directory,signal});normalized.push(name);
  }
  await writeFile(path.join(directory,'montage.txt'),normalized.map(file=>`file '${file}'`).join('\n'));
  await writeFile(path.join(directory,'captions.ass'),storyboardAss(storyboard,width,height),'utf8');await writeFile(path.join(directory,'captions.srt'),storyboardSrt(storyboard),'utf8');
  await execute(binary,['-y','-hide_banner','-loglevel','error','-f','concat','-safe','1','-i','montage.txt','-c','copy','joined.mp4'],{cwd:directory,signal});
  await execute(binary,['-y','-hide_banner','-loglevel','error','-i','joined.mp4','-vf','ass=captions.ass','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','final.partial.mp4'],{cwd:directory,signal});
  const info=await readFile(path.join(directory,'final.partial.mp4'));if(info.length<16||info.toString('ascii',4,8)!=='ftyp')throw Error('成片文件无效，已保留分镜');await rename(path.join(directory,'final.partial.mp4'),path.join(directory,'video.mp4'));return {width,height};
}
