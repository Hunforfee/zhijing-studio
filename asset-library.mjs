import {mkdir,readFile,writeFile,rename,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {PNG} from 'pngjs';

export const ASSET_LIBRARY_BODY_LIMIT=90*1024*1024;
export const ASSET_LIBRARY_IMAGE_LIMIT=32*1024*1024;
const rootRoute='/api/library/assets';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const metadataKeys=['name','kind','code','collection','tags','description','print','source','recipe'];
const productKeys=['set','mat','quilt','pillowcore','sheet','mattress','blanket','sleepbag'];
const recipeKeys=['product','fabric','fabricMode','quiltSeason','sheetVariant','mattressVariant','blanketVariant','sleepbagVariant','matVariant','pillowcoreVariant','productVariantChoices','duvetCraft','sheetStyle','pillowCraft'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const problem=(message,status=400,code='ASSET_INVALID_INPUT')=>Object.assign(Error(message),{status,code});

function text(value,max,label,{required=false}={}){
  if(value===undefined||value===null){if(required)throw problem('请填写'+label);return '';}
  if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)||/<\/?[a-z!][^>]*>/i.test(value))throw problem(label+'格式无效或超过'+max+'字');
  const result=value.trim();if(required&&!result)throw problem('请填写'+label);return result;
}

function normalizePrint(value){
  if(value===undefined||value===null)return undefined;
  if(!plain(value)||Object.keys(value).some(key=>!['widthCm','heightCm','dpi'].includes(key)))throw problem('印花尺寸须为完整的厘米与 DPI 参数');
  const result={};
  for(const key of ['widthCm','heightCm','dpi']){
    const number=value[key];if(typeof number!=='number'||!Number.isFinite(number)||number<=0||number>(key==='dpi'?2400:10000))throw problem('印花尺寸或 DPI 超出允许范围');result[key]=number;
  }
  return result;
}

function normalizeRecipe(value,kind){
  if(value===undefined||value===null)return undefined;
  if(kind!=='product'||!plain(value)||JSON.stringify(value).length>8192||Object.keys(value).some(key=>!recipeKeys.includes(key)))throw problem('商品工艺设置格式无效');
  const result={};
  for(const key of recipeKeys)if(Object.hasOwn(value,key)){
    const item=value[key];
    if(key==='productVariantChoices'){
      if(!plain(item)||Object.keys(item).some(product=>!productKeys.includes(product)||typeof item[product]!=='boolean'))throw problem('商品分类选择格式无效');
      result[key]={};for(const product of productKeys)if(Object.hasOwn(item,product))result[key][product]=item[product];
    }else{
      if(typeof item!=='string'||!item.length||item.length>80||!/^[a-z0-9-]+$/.test(item)||(key==='fabricMode'&&!['auto','selected'].includes(item))||(key==='product'&&!productKeys.includes(item)))throw problem('商品工艺标识无效');result[key]=item;
    }
  }
  return result;
}

export function normalizeAssetMetadata(input,previous){
  if(!plain(input)||Object.keys(input).some(key=>!metadataKeys.includes(key)))throw problem('图库资料字段无效');
  const value={...(previous||{}),...input},kind=value.kind;
  if(!['pattern','product'].includes(kind))throw problem('请选择花型或商品分类');
  let tags=[];
  if(value.tags!==undefined&&value.tags!==null){
    if(!Array.isArray(value.tags)||value.tags.length>20)throw problem('标签最多20项');
    tags=[...new Set(value.tags.map(tag=>text(tag,40,'标签',{required:true})))];
  }
  const source=text(value.source,240,'来源说明');
  if(/(?:^[a-z]:[\\/]|\\\\|file:\/\/|\/Users\/|\/home\/|\/tmp\/|\/private\/)/i.test(source))throw problem('来源说明请使用工具或作品名称，不要填写本机文件路径');
  const print=normalizePrint(value.print),recipe=normalizeRecipe(value.recipe,kind);
  return {name:text(value.name,80,'名称',{required:true}),kind,code:text(value.code,80,'款号'),collection:text(value.collection,80,'系列'),tags,description:text(value.description,2000,'说明'),...(source?{source}:{}),...(print?{print}:{}),...(recipe?{recipe}:{})};
}

// Decode only for integrity checks and the separate preview. The original buffer is never re-encoded.
export function decodeAssetPng(dataURL){
  if(typeof dataURL!=='string'||!dataURL.startsWith('data:image/png;base64,'))throw problem('图库图片须为完整 PNG，不能使用外部链接',400,'ASSET_IMAGE_INVALID');
  const encoded=dataURL.slice(22);
  if(!encoded.length||encoded.length>Math.ceil(ASSET_LIBRARY_IMAGE_LIMIT/3)*4)throw problem('每张图库 PNG 不能超过32 MB',413,'ASSET_IMAGE_TOO_LARGE');
  if(encoded.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw problem('PNG 图片编码无效',400,'ASSET_IMAGE_INVALID');
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.length>ASSET_LIBRARY_IMAGE_LIMIT)throw problem('每张图库 PNG 不能超过32 MB',413,'ASSET_IMAGE_TOO_LARGE');
  if(bytes.length<45||!bytes.subarray(0,8).equals(signature)||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')throw problem('PNG 图片文件无效',400,'ASSET_IMAGE_INVALID');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width>16000||height>16000||width*height>64_000_000)throw problem('图库图片每边最多16000像素，总像素最多6400万',413,'ASSET_IMAGE_DIMENSIONS');
  let decoded;try{decoded=PNG.sync.read(bytes,{checkCRC:true});}catch{throw problem('PNG 图片无法完整解码，请重新导出后保存',400,'ASSET_IMAGE_INVALID');}
  if(decoded.width!==width||decoded.height!==height)throw problem('PNG 图片尺寸校验失败',400,'ASSET_IMAGE_INVALID');
  return {bytes,width,height,decoded};
}

function previewPng(decoded){
  const scale=Math.min(1,384/Math.max(decoded.width,decoded.height));
  const width=Math.max(1,Math.round(decoded.width*scale)),height=Math.max(1,Math.round(decoded.height*scale)),preview=new PNG({width,height});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const from=(Math.min(decoded.height-1,Math.floor((y+.5)/scale))*decoded.width+Math.min(decoded.width-1,Math.floor((x+.5)/scale)))*4,to=(y*width+x)*4;
    decoded.data.copy(preview.data,to,from,from+4);
  }
  return PNG.sync.write(preview);
}

export function createAssetLibrary({outputDir}){
  if(typeof outputDir!=='string'||!outputDir)throw Error('Asset library needs an output directory');
  const directory=path.join(outputDir,'asset-library'),assets=new Map(),requests=new Map();let mutation=Promise.resolve();
  const folder=id=>path.join(directory,id),file=(id,name)=>path.join(folder(id),name);
  const persist=async record=>{const target=file(record.id,'asset.json'),temporary=target+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(record));await rename(temporary,target);};
  const ready=(async()=>{
    await mkdir(directory,{recursive:true});
    for(const entry of await readdir(directory,{withFileTypes:true}))if(entry.isDirectory()&&uuid.test(entry.name)){
      let record;
      try{
        const metadataFile=file(entry.name,'asset.json');if((await stat(metadataFile)).size>32*1024)throw Error('Invalid library metadata size');
        record=JSON.parse(await readFile(metadataFile,'utf8'));
      }catch(error){if(error.code==='ENOENT')continue;throw problem('图库记录无法读取，请检查服务器存储',503,'ASSET_STORAGE_UNAVAILABLE');}
      try{
        if(record.version!==1||record.id!==entry.name||!Number.isFinite(record.created)||!Number.isFinite(record.updated)||!Number.isInteger(record.width)||!Number.isInteger(record.height)||record.width<=0||record.height<=0||record.width>16000||record.height>16000||record.width*record.height>64_000_000||typeof record.hasB!=='boolean')throw Error('Invalid record');
        normalizeAssetMetadata(Object.fromEntries(metadataKeys.filter(key=>Object.hasOwn(record,key)).map(key=>[key,record[key]])));
        if(record.hasB&&(!Number.isInteger(record.widthB)||!Number.isInteger(record.heightB)||record.widthB<=0||record.heightB<=0||record.widthB>16000||record.heightB>16000||record.widthB*record.heightB>64_000_000))throw Error('Invalid B dimensions');
        if(record.requestId&&(!uuid.test(record.requestId)||!/^[0-9a-f]{64}$/.test(record.requestDigest)))throw Error('Invalid request identity');
        for(const name of ['original.png','thumbnail.png',...(record.hasB?['originalB.png']:[])])if(!(await stat(file(record.id,name))).isFile())throw Error('Missing image');
      }catch{throw problem('图库文件不完整或格式无效，请检查服务器存储',503,'ASSET_STORAGE_UNAVAILABLE');}
      assets.set(record.id,record);if(record.requestId)requests.set(record.requestId,record.id);
    }
  })();ready.catch(()=>{});
  const serial=operation=>{const next=mutation.catch(()=>{}).then(operation);mutation=next;return next;};
  async function readBody(req,body,limit){
    try{return await body(req,limit);}catch(error){
      if(error.status===413||error.message==='上传数据超过限制')throw problem('上传内容超过本次保存的大小限制',413,'ASSET_IMAGE_TOO_LARGE');
      throw problem('请求内容须为完整的 JSON',400,'ASSET_INVALID_INPUT');
    }
  }
  function publicAsset(record){
    return {...Object.fromEntries(metadataKeys.filter(key=>Object.hasOwn(record,key)).map(key=>[key,record[key]])),id:record.id,width:record.width,height:record.height,hasB:record.hasB,...(record.hasB?{widthB:record.widthB,heightB:record.heightB,imageBUrl:rootRoute+'/'+record.id+'/imageB'}:{}),imageUrl:rootRoute+'/'+record.id+'/image',thumbnailUrl:rootRoute+'/'+record.id+'/thumbnail',created:record.created,updated:record.updated};
  }
  function getAsset(id){const record=assets.get(id);if(!record||record.deletedAt)throw problem('图库作品不存在或已移除',404,'ASSET_NOT_FOUND');return record;}
  async function handle(req,res,pathname,body,json){
    if(pathname!==rootRoute&&!pathname.startsWith(rootRoute+'/'))return false;
    try{
      await ready;
      if(pathname===rootRoute&&req.method==='GET'){
        await mutation.catch(()=>{});json(res,200,{assets:[...assets.values()].filter(record=>!record.deletedAt).sort((a,b)=>b.updated-a.updated||a.id.localeCompare(b.id)).map(publicAsset)});return true;
      }
      if(pathname===rootRoute&&req.method==='POST'){
        const input=await readBody(req,body,ASSET_LIBRARY_BODY_LIMIT);
        if(!plain(input)||Object.keys(input).some(key=>!metadataKeys.concat(['image','imageB','requestId']).includes(key)))throw problem('图库保存参数无效');
        const metadata=normalizeAssetMetadata(Object.fromEntries(metadataKeys.filter(key=>Object.hasOwn(input,key)).map(key=>[key,input[key]])));
        if(input.requestId!==undefined&&(typeof input.requestId!=='string'||!uuid.test(input.requestId)))throw problem('保存请求编号须为有效 UUID');
        const result=await serial(async()=>{
          const a=decodeAssetPng(input.image),thumbnail=previewPng(a.decoded);a.decoded=null;
          const b=input.imageB!==undefined&&input.imageB!==null?decodeAssetPng(input.imageB):null;if(b)b.decoded=null;
          const hash=createHash('sha256').update(JSON.stringify(metadata)).update('\nA:').update(a.bytes).update('\nB:').update(b?.bytes||'').digest('hex');
          if(input.requestId&&requests.has(input.requestId)){
            const record=assets.get(requests.get(input.requestId));
            if(record.requestDigest!==hash)throw problem('该保存编号已用于其他内容，请重新确认保存',409,'ASSET_REQUEST_CONFLICT');
            if(record.deletedAt)throw problem('这次保存的作品已经移除；如需另存，请重新发起保存',409,'ASSET_REMOVED');
            return {status:200,asset:publicAsset(record)};
          }
          const now=Date.now(),record={version:1,id:randomUUID(),...metadata,width:a.width,height:a.height,hasB:!!b,...(b?{widthB:b.width,heightB:b.height}:{}),created:now,updated:now,...(input.requestId?{requestId:input.requestId,requestDigest:hash}:{})};
          await mkdir(folder(record.id),{recursive:true});await writeFile(file(record.id,'original.png'),a.bytes);if(b)await writeFile(file(record.id,'originalB.png'),b.bytes);await writeFile(file(record.id,'thumbnail.png'),thumbnail);await persist(record);
          assets.set(record.id,record);if(record.requestId)requests.set(record.requestId,record.id);return {status:201,asset:publicAsset(record)};
        });json(res,result.status,{asset:result.asset});return true;
      }
      const match=pathname.match(/^\/api\/library\/assets\/([0-9a-f-]{36})(?:\/(image|imageB|thumbnail|update|delete))?$/);
      if(!match||!uuid.test(match[1]))throw problem('图库地址不存在',404,'ASSET_NOT_FOUND');
      const [,,action]=match,id=match[1];
      await mutation.catch(()=>{});
      if(!action&&req.method==='GET'){json(res,200,{asset:publicAsset(getAsset(id))});return true;}
      if(['image','imageB','thumbnail'].includes(action)&&['GET','HEAD'].includes(req.method)){
        const record=getAsset(id);if(action==='imageB'&&!record.hasB)throw problem('该作品未保存 B 面图片',404,'ASSET_NOT_FOUND');
        const bytes=await readFile(file(id,action==='image'?'original.png':action==='imageB'?'originalB.png':'thumbnail.png'));
        res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);return true;
      }
      if(action==='update'&&req.method==='POST'){
        const input=await readBody(req,body,16*1024);
        const asset=await serial(async()=>{
          const previous=getAsset(id),metadata=normalizeAssetMetadata(input,Object.fromEntries(metadataKeys.filter(key=>Object.hasOwn(previous,key)).map(key=>[key,previous[key]])));
          const record={...previous,updated:Date.now()};for(const key of metadataKeys)delete record[key];Object.assign(record,metadata);await persist(record);assets.set(id,record);return publicAsset(record);
        });json(res,200,{asset});return true;
      }
      if(action==='delete'&&req.method==='POST'){
        const input=await readBody(req,body,1024);if(!plain(input)||Object.keys(input).length)throw problem('移除请求不接受其他字段');
        await serial(async()=>{const previous=assets.get(id);if(!previous)throw problem('图库作品不存在',404,'ASSET_NOT_FOUND');if(!previous.deletedAt){const record={...previous,deletedAt:Date.now(),updated:Date.now()};await persist(record);assets.set(id,record);}});
        json(res,200,{deleted:true,assetId:id});return true;
      }
      throw problem('请求方式不支持',405,'ASSET_METHOD_NOT_ALLOWED');
    }catch(error){
      req.resume?.();const known=typeof error.code==='string'&&error.code.startsWith('ASSET_');
      json(res,known?error.status:503,{error:known?error.message:'图库操作暂不可用，请检查服务器存储或稍后重试',code:known?error.code:'ASSET_STORAGE_UNAVAILABLE'});return true;
    }
  }
  return {handle};
}
