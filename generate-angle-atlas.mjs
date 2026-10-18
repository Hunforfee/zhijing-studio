// 一次性工具：用网站已配置的图像服务生成「12 格角度参考图集」。
// 用法：node generate-angle-atlas.mjs <产品键> [输出文件|-] [结构参考图...]
// 例如：node generate-angle-atlas.mjs sleepbag-travel
//       node generate-angle-atlas.mjs sleepbag-travel - 自家睡袋实拍1.jpg 自家睡袋实拍2.jpg
// 传入结构参考图时改走 /images/edits，让模型照着实拍的结构与铺法出图（会明显更准）。
// 只读取本机已保存的服务配置（.share/service-config.dpapi），不打印密钥，不修改网站数据。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadServiceConfig} from './secure-service-store.mjs';
import {serviceProfiles} from './service-profiles.mjs';
import {downloadImage} from './server.mjs';
import {sleepbagProductPrompt,sleepbagAngleName} from './dist/sleepbag-contract.js';
import {cameraAngleIds} from './dist/camera-contract.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const product=process.argv[2]||'sleepbag-travel';
const outputArg=process.argv[3];
const output=!outputArg||outputArg==='-'?path.join(root,'dist','assets',product+'-angles-v1.png'):outputArg;
const references=process.argv.slice(4);

// 每格构图说明，顺序必须与 cameraAngleIds 一致（4 列 × 3 行，行优先）。
const cells={
  side:'R1C1 complete 45-degree foot-left three-quarter of the WHOLE bed, the bag covering the entire mattress like flat bedding, the open unsewn side entry clearly visible along the upper half of the near long side',
  front:'R1C2 straight symmetrical frontal view from the foot of the bed, the whole bed and the closed invisible foot-end zipper facing the camera',
  top:'R1C3 true 90-degree vertical overhead of the WHOLE bed, the bag covering the entire mattress, its unsewn open upper half lying slightly open along one long side and the pillow wrapped at the head underneath the fabric',
  detail:'R1C4 contextual medium-close of the printed cotton flat weave with gentle natural creases and one narrow sewn hem, no pile, no filling, no elastic band',
  left:'R2C1 true left long-side near-profile with the headboard LEFT and foot RIGHT, the whole bed, the lower-half side seam clearly ending where the unsewn open upper half begins',
  right:'R2C2 true right long-side near-profile with the headboard RIGHT and foot LEFT from the physically opposite camera, showing the invisible foot-end zipper and the open unsewn upper half',
  low:'R2C3 low near-horizontal camera at the foot end, close to the mattress top: looking straight at the foot edge where the INVISIBLE ZIPPER with its slider closes the bag, the thin edge of the folded bedding flush with the mattress edge and the TWO stacked panels clearly readable',
  wide:'R2C4 step-back hotel-room wide view, the whole bed and the sleeping bag at 40-50% of the frame',
  reverse:'R3C1 the completely unsewn UPPER HALF of the top panel lifted and folded back broadly over its own lower half in one relaxed irregular band, revealing the bottom panel, the pillow wrapped underneath at the head, and the open interior',
  foot:'R3C2 slightly elevated 30-45-degree view of the lower half of the bed and the FULL foot width, with the INVISIBLE ZIPPER that closes the foot end running clearly across the foreground, its slider and sewn zipper tape plainly readable, both real lower corners visible and the side seam ending at the corner',
  pillowclose:'R3C3 contextual medium-close 70-85 mm detail of the same-width sleeve about 40-50 cm deep sewn on the BACK of the bottom panel at the head edge: the sleeve mouth and the edge of the pillow slid inside, proving the pillow is wrapped by the bag fabric and lies UNDERNEATH the bottom panel',
  drape:'R3C4 contextual view along at least half of one long side: the lower-half side seam running up from the foot end, the clear transition where the stitching stops, and the free unsewn upper half of the top panel draping softly there'
};

function atlasPrompt(){
  const structure=sleepbagProductPrompt({product:'sleepbag',sleepbagVariant:'travel'});
  const rows=[];
  for(let i=0;i<cameraAngleIds.length;i++)rows.push(cells[cameraAngleIds[i]]);
  return [
    references.length?'Image 1'+(references.length>1?' and Image 2 are':' is')+' PHOTOGRAPHIC CONSTRUCTION REFERENCE'+(references.length>1?'S':'')+' of a flat hotel dirt-barrier travel sleeping bag. Copy ONLY its physical construction and the way it lies flat on the bed. Do NOT copy the reference room, lighting, crop, props, labels or its plain white textile: replace the textile with the muted print described below.':'',
    'Use case: product-mockup. Asset type: a camera-angle atlas used by a Chinese textile product website.',
    'Create ONE photorealistic catalog contact sheet, precisely 4 equal columns by 3 equal rows. Overall aspect ratio 4:3, prefer 1448x1086 pixels: each cell is a perfect square, no gutter, no frames, no dividing lines, no text, no labels, no numbers, no watermarks. Each of the 12 independent photographs fully fills its own square without spilling into another and without any collage inside a cell.',
    'Same ONE product in the same simple warm neutral hotel-style bedroom: one low bed with a plain mattress and a light wood headboard, plain wall, soft natural daylight. The sleeping bag covers the WHOLE mattress like flat bedding. Exactly ONE plain pillow stays wrapped by the bag fabric at the head; the hotel pillowcase is never visible. No duvet, quilt, blanket, bedspread, bed skirt, second pillow or decorative accessories. Every textile that belongs to the sleeping bag carries the same muted sage-and-cream small print on thin soft cotton.',
    'THE PRODUCT: '+structure,
    'Full-product photographs keep the whole bag and the mattress outline comfortably inside the square, product 60-70% of the cell with useful editing margins; the wide room shot 40-50%. Detail photographs show the actual connected cloth at 50-65% coverage, never a detached swatch. The right long-side view must be a physically opposite camera, never a mirrored copy of the left view.',
    'Exact row-major 12 photographs: '+rows.join('; ')+'.',
    'Photographic lens and perspective, real cloth scale and seams, coherent daylight and contact shadows. The bag must read as THIN FLAT BEDDING, never puffy or quilted. Absolutely no camping gear, no mummy-shaped bag, no hood, no insulation, no filling, no quilting, no full-length zipper, no elastic corner straps, no fitted skirt, no drawstring pouch, no sleeping pad, no text or logo anywhere in the image. Keep the construction identical in all twelve photographs: exactly two same-width panels, the bottom panel flat on the mattress reaching the mattress edges, side seams only along the lower half, a completely open unsewn upper half as the side entry, one invisible zipper at the foot end, and one same-width 40-50 cm sleeve on the BACK of the bottom panel wrapping one plain pillow at the head.'
  ].filter(Boolean).join(' ');
}

const saved=await loadServiceConfig();
if(!saved)throw Error('没有找到已保存的图像服务配置，请先在网站里填写并保存 AI 服务');
const profiles=serviceProfiles(saved);
const config=profiles.profiles[profiles.activeProvider];
if(!config?.apiKey)throw Error('当前服务没有可用密钥');
if(config.provider!=='sub2api')throw Error('本工具目前只支持 Sub2API 中转（当前：'+config.provider+'）');

const prompt=atlasPrompt();
console.log('服务：'+config.provider+' / '+config.model);
console.log('提示词长度：'+prompt.length);
console.log('结构参考图：'+(references.length?references.join(', '):'（无，纯文本出图）'));
console.log('角度顺序：'+cameraAngleIds.map(id=>id+'('+sleepbagAngleName(id,id)+')').join(', '));

const base=config.baseUrl.replace(/\/$/,'');
async function request(kind,body,headers={}){
  const response=await fetch(base+'/images/'+kind,{method:'POST',headers:{Authorization:'Bearer '+config.apiKey,...headers},body});
  if(!response.ok){let detail='';try{const data=await response.json();detail=data.error?.message||data.message||''}catch{}throw Error('生图失败（'+response.status+'）'+String(detail).slice(0,300));}
  return response.json();
}
function toBuffer(data){
  const encoded=data.data?.[0]?.b64_json;
  if(encoded)return Promise.resolve(Buffer.from(encoded,'base64'));
  if(data.data?.[0]?.url)return downloadImage(data.data[0].url);
  throw Error('服务没有返回图片');
}
function formBody(withReferences){
  const form=new FormData();
  form.append('model',config.model);form.append('prompt',prompt);
  form.append('size','1344x1008');form.append('quality','high');form.append('output_format','png');
  return form;
}

let bytes;
if(references.length){
  console.log('正在请求 /images/edits（带 '+references.length+' 张结构参考图）…');
  const form=formBody(true);
  for(const file of references){
    const data=await readFile(file);
    form.append('image[]',new Blob([data],{type:/\.png$/i.test(file)?'image/png':'image/jpeg'}),path.basename(file));
  }
  bytes=await toBuffer(await request('edits',form));
}else{
  console.log('正在请求 /images/generations …');
  bytes=await toBuffer(await request('generations',formBody(false)));
}
if(bytes.length<1024)throw Error('返回的图片过小，可能不是有效图集');
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,bytes);
console.log('已保存：'+output+'（'+bytes.length+' 字节）');
