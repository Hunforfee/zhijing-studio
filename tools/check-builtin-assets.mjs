import {readFile,lstat,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {cameraAtlases} from '../dist/camera-contract.js';
import {sceneDirections} from '../photography-prompts.mjs';
import '../dist/fabric-library.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('./builtin-assets.json',import.meta.url),'utf8'));
const listed=new Set();
let totalBytes=0;
for(const asset of manifest.assets){
  if(!/^(?:dist\/assets\/(?:[\w.-]+|(?:fabrics|crafts|scene-photos|scene-thumbs)\/[\w.-]+)|styling-references\/relaxed-fold-[12]\.png)$/.test(asset.path)||!/\.(?:png|jpe?g|webp|svg)$/.test(asset.path))throw Error('不允许的内置素材路径：'+asset.path);
  if(listed.has(asset.path))throw Error('素材清单重复：'+asset.path);
  listed.add(asset.path);
  const file=path.join(root,asset.path),metadata=await lstat(file);
  if(!metadata.isFile()||metadata.isSymbolicLink())throw Error('素材必须是普通文件：'+asset.path);
  const bytes=await readFile(file);
  if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('素材内容与清单不一致：'+asset.path);
  if(bytes.length>=100*1024*1024)throw Error('素材超过 GitHub 单文件限制：'+asset.path);
  totalBytes+=bytes.length;
}
const requireAsset=file=>{if(!listed.has(file))throw Error('缺少目录中引用的素材：'+file);};
for(const item of globalThis.beddingFabricLibrary)for(const extension of ['jpg','png'])requireAsset('dist/assets/fabrics/'+item.id+'.'+extension);
for(const item of Object.values(cameraAtlases))requireAsset('dist/assets/'+item.file);
for(const scene of Object.keys(sceneDirections))requireAsset('dist/assets/scene-photos/'+scene+'-v1.png');

let httpFiles=0;
if(process.argv.includes('--http')){
  const {createServer}=await import('../server.mjs');
  const temporary=await mkdtemp(path.join(os.tmpdir(),'zhijing-builtin-assets-'));
  const server=createServer({outputDir:temporary,service:{provider:'compatible',apiKey:'',baseUrl:'https://example.invalid/v1',model:'test-only'},videoOptions:{loadConfig:async()=>null},fetchImpl:async()=>{throw Error('素材检查禁止访问生成服务');}});
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    for(const asset of manifest.assets.filter(item=>item.path.startsWith('dist/'))){
      const reply=await fetch(base+'/'+asset.path.slice('dist/'.length));
      if(!reply.ok)throw Error('素材 HTTP 请求失败：'+asset.path+' ('+reply.status+')');
      const digest=createHash('sha256').update(Buffer.from(await reply.arrayBuffer())).digest('hex');
      if(digest!==asset.sha256)throw Error('HTTP 返回内容错误：'+asset.path);
      httpFiles++;
    }
  }finally{
    await new Promise(resolve=>server.close(resolve));
    if(!path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-builtin-assets-'))throw Error('临时目录范围错误');
    await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
console.log(JSON.stringify({assets:listed.size,bytes:totalBytes,MB:Math.round(totalBytes/10000)/100,httpFiles}));
