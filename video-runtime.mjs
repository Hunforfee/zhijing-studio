import {execFile} from 'node:child_process';
import {access,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const defaultRoot=fileURLToPath(new URL('./',import.meta.url));
const run=(binary,args)=>new Promise((resolve,reject)=>execFile(binary,args,{windowsHide:true,timeout:10000,maxBuffer:2*1024*1024},(error,stdout,stderr)=>error?reject(error):resolve(stdout+'\n'+stderr)));

export async function resolveVideoBinary({env=process.env,platform=process.platform,root=defaultRoot,probe=run,readDirectory=readdir,checkAccess=access,staticBinary=()=>require('ffmpeg-static')}={}){
  async function usable(binary){
    if(!binary||typeof binary!=='string')throw Error('没有可用的视频组件');
    if(binary!=='ffmpeg')await checkAccess(binary);
    if(!/ffmpeg version/i.test(await probe(binary,['-version'])))throw Error('不是有效 FFmpeg');
    const encoders=await probe(binary,['-hide_banner','-encoders']);
    const filters=await probe(binary,['-hide_banner','-filters']);
    if(!/\blibx264\b/.test(encoders)||! /\baac\b/.test(encoders)||! /\bass\b/.test(filters)||! /\bzoompan\b/.test(filters))throw Error('缺少 H.264、AAC、字幕或稳定运镜功能');
    return binary;
  }
  if(env.FFMPEG_PATH){
    try{return await usable(env.FFMPEG_PATH);}catch{throw Error('FFMPEG_PATH 指定的剪辑组件无法运行或缺少编码、字幕功能，请检查服务器配置');}
  }
  // Keep the existing Windows installation; cloud deployments also support PATH
  // and the platform-specific binary installed by npm.
  if(platform==='win32'){
    try{const folder=path.join(root,'tools/video-python/imageio_ffmpeg/binaries');for(const name of await readDirectory(folder))if(/^ffmpeg.*\.exe$/i.test(name)){try{return await usable(path.join(folder,name));}catch{}}}catch{}
  }
  try{return await usable('ffmpeg');}catch{}
  try{return await usable(await staticBinary());}catch{}
  throw Error('服务器的视频剪辑组件未就绪，请安装项目依赖（npm ci）或通过 FFMPEG_PATH 指定支持 H.264、AAC 和 ASS 字幕的 FFmpeg');
}
