import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeFreeEdit,buildFreeEditPrompt} from './dist/free-creation-policy.js';
import {freeImageData,decodeFreePng,preserveOutsideRegion} from './free-creation-images.mjs';
const uuid=/^[a-f0-9-]{36}$/;
const active=operation=>['queued','running'].includes(operation?.status);
const errorWithStatus=(message,status)=>Object.assign(Error(message),{status});

export function createFreeCreation({outputDir,getConfig,enqueue,getJob,cancelJob,fetchImpl=fetch,downloadImage}){
  const directory=path.join(outputDir,'free-creation'),documents=new Map(),writes=new Map();
  const folder=id=>path.join(directory,id);
  const fileFor=(id,version)=>path.join(folder(id),version==='original'?'original.png':version+'.png');
  const imageUrl=(id,version)=>`/api/free/documents/${id}/images/${version}`;
  function persist(doc){
    const snapshot=JSON.stringify(doc),next=(writes.get(doc.id)||Promise.resolve()).catch(()=>{}).then(async()=>{
      await mkdir(folder(doc.id),{recursive:true});const target=path.join(folder(doc.id),'document.json'),temporary=target+'.'+randomUUID()+'.tmp';
      await writeFile(temporary,snapshot);await rename(temporary,target);
    });writes.set(doc.id,next);return next;
  }
  const ready=(async()=>{
    await mkdir(directory,{recursive:true});
    for(const entry of await readdir(directory,{withFileTypes:true}))if(entry.isDirectory()&&uuid.test(entry.name)){
      try{
        const doc=JSON.parse(await readFile(path.join(folder(entry.name),'document.json'),'utf8'));
        if(doc.id!==entry.name||doc.version!==1||!Array.isArray(doc.versions)||!Array.isArray(doc.operations))continue;
        for(const operation of doc.operations)if(active(operation)){
          try{
            if(!uuid.test(operation.id))throw Error('Invalid operation');
            const image=decodeFreePng(await readFile(fileFor(doc.id,operation.id)));
            if(!doc.versions.some(item=>item.id===operation.id))doc.versions.push({id:operation.id,label:'V'+doc.versions.length,url:imageUrl(doc.id,operation.id),parent:operation.sourceVersion,mode:operation.mode,prompt:operation.prompt,created:Date.now(),width:image.width,height:image.height});
            operation.status='done';operation.message='已恢复完成的编辑版本';
          }catch{operation.status='error';operation.message='服务已重启，原图和已完成版本已保留；请确认后重新编辑';}
          operation.finished=Date.now();
        }
        documents.set(doc.id,doc);await persist(doc);
      }catch(error){if(error.code!=='ENOENT')throw Error('自由创作记录无法读取，请检查服务器存储');}
    }
  })();ready.catch(()=>{});
  function publicDocument(doc){return {...doc,operations:doc.operations.map(operation=>{const job=getJob(operation.id);return active(operation)&&job?{...operation,status:job.status,message:job.message}:operation;})};}
  const cleanError=(error,config)=>String(error?.message||'图片编辑暂时不可用').split(config.apiKey||'__no_key__').join('[密钥已隐藏]').replace(/Bearer\s+\S+|sk-[\w-]+/gi,'[密钥已隐藏]').slice(0,300);

  async function run(doc,operation,input,config,referenceBytes,job){
    try{
      operation.status='running';operation.message='正在编辑图片，完成后会自动显示新版本';await persist(doc);
      const sourceBytes=await readFile(fileFor(doc.id,operation.sourceVersion));job.controller.signal.throwIfAborted();
      const form=new FormData();form.append('model',config.model);form.append('image[]',new Blob([sourceBytes],{type:'image/png'}),'primary-image.png');
      if(referenceBytes)form.append('image[]',new Blob([referenceBytes],{type:'image/png'}),'optional-reference.png');
      form.append('prompt',buildFreeEditPrompt(input,{reference:!!referenceBytes}));
      form.append('size',({'3:4':'1008x1344','4:3':'1344x1008','1:1':'1024x1024'})[input.ratio]||'auto');form.append('quality','high');form.append('output_format','png');
      const signal=AbortSignal.any([job.controller.signal,AbortSignal.timeout(600000)]);
      const response=await fetchImpl(config.baseUrl+'/images/edits',{method:'POST',headers:{Authorization:'Bearer '+config.apiKey},body:form,redirect:'error',signal});
      if(!response.ok)throw Error('图片编辑服务请求失败（HTTP '+response.status+'），请检查服务权限、额度或网络');
      let data;try{data=await response.json();}catch{throw Error('图片服务返回了无法读取的结果，请检查接口兼容性');}let bytes;
      if(typeof data.data?.[0]?.b64_json==='string'){
        if(data.data[0].b64_json.length>35*1024*1024)throw Error('返回图片超过大小限制');bytes=Buffer.from(data.data[0].b64_json,'base64');
      }else if(typeof data.data?.[0]?.url==='string')bytes=await downloadImage(data.data[0].url,signal);
      else throw Error('图片服务未返回编辑结果，请确认接口支持参考图编辑');
      decodeFreePng(bytes);job.controller.signal.throwIfAborted();
      if(input.region)bytes=preserveOutsideRegion(sourceBytes,bytes,input.region);
      const info=decodeFreePng(bytes);await writeFile(fileFor(doc.id,operation.id),bytes);job.controller.signal.throwIfAborted();
      doc.versions.push({id:operation.id,label:'V'+doc.versions.length,url:imageUrl(doc.id,operation.id),parent:operation.sourceVersion,mode:input.mode,prompt:input.prompt,created:Date.now(),width:info.width,height:info.height});
      doc.updated=Date.now();operation.status=job.status='done';operation.message=job.message='编辑完成，已另存新版本';job.progress=100;
    }catch(error){operation.status=job.status=job.cancelled?'cancelled':'error';operation.message=job.message=job.cancelled?'已停止编辑，原图和已有版本保留':error.name==='TimeoutError'?'编辑超时，原图保留；请确认服务记录后再试':error instanceof TypeError?'无法连接图片编辑服务，请检查接口地址和网络':cleanError(error,config);}
    finally{operation.finished=Date.now();await persist(doc);}
  }
  async function handle(req,res,pathname,body,json){
    if(!pathname.startsWith('/api/free/'))return false;
    try{
      await ready;
      if(pathname==='/api/free/documents'&&req.method==='GET'){
        await Promise.all(writes.values());
        json(res,200,{documents:[...documents.values()].sort((a,b)=>b.updated-a.updated).map(publicDocument)});return true;
      }
      if(pathname==='/api/free/documents'&&req.method==='POST'){
        const input=await body(req,15*1024*1024),image=freeImageData(input.image);
        if(input.title!=null&&(typeof input.title!=='string'||input.title.length>160))throw Error('图片名称过长');
        const id=randomUUID(),doc={version:1,id,title:input.title?.trim()||'未命名创作',created:Date.now(),updated:Date.now(),versions:[{id:'original',label:'原图',url:imageUrl(id,'original'),width:image.width,height:image.height,created:Date.now()}],operations:[]};
        await mkdir(folder(id),{recursive:true});await writeFile(fileFor(id,'original'),image.bytes);await persist(doc);documents.set(id,doc);json(res,201,{document:publicDocument(doc)});return true;
      }
      const match=pathname.match(/^\/api\/free\/documents\/([a-f0-9-]{36})(?:\/(edit|cancel|images\/(original|[a-f0-9-]{36})))?$/);
      const doc=match&&documents.get(match[1]);if(!doc)throw errorWithStatus('找不到该自由创作记录',404);
      if(!match[2]&&req.method==='GET'){await writes.get(doc.id);json(res,200,{document:publicDocument(doc)});return true;}
      if(match[3]&&['GET','HEAD'].includes(req.method)){
        if(!doc.versions.some(version=>version.id===match[3]))throw errorWithStatus('找不到该图片版本',404);
        const bytes=await readFile(fileFor(doc.id,match[3]));res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, no-store'});res.end(req.method==='HEAD'?undefined:bytes);return true;
      }
      if(match[2]==='edit'&&req.method==='POST'){
        const config=getConfig();if(!config.apiKey)throw errorWithStatus('请先在左侧设置中连接图片编辑服务',503);
        if(!['sub2api','openai','compatible'].includes(config.provider))throw errorWithStatus('自由创作需要支持参考图编辑的图片服务，请在设置中切换接口',409);
        if(doc.operations.some(operation=>active(publicDocument(doc).operations.find(item=>item.id===operation.id))))throw errorWithStatus('这张图片正在编辑，请等待完成或先停止',409);
        const value=await body(req,30*1024*1024),input=normalizeFreeEdit(value),sourceVersion=value.sourceVersion;
        if(!doc.versions.some(version=>version.id===sourceVersion))throw errorWithStatus('请选择仍然存在的原图或编辑版本',404);
        const referenceBytes=value.referenceImage==null?null:freeImageData(value.referenceImage).bytes;
        const operation={id:randomUUID(),sourceVersion,...input,referenceUsed:!!referenceBytes,created:Date.now(),status:'queued',message:'已加入图片编辑队列'};
        // Reserve the shared image queue synchronously so two simultaneous clicks
        // cannot create two operations for the same document.
        if(doc.operations.some(active))throw errorWithStatus('这张图片正在编辑，请稍后再试',409);
        doc.operations.push(operation);doc.updated=Date.now();
        try{enqueue({id:operation.id,run:job=>run(doc,operation,input,{...config},referenceBytes,job)});}catch(error){doc.operations.pop();throw error;}
        await persist(doc);json(res,202,{document:publicDocument(doc),operationId:operation.id});return true;
      }
      if(match[2]==='cancel'&&req.method==='POST'){
        const operation=[...doc.operations].reverse().find(active);
        if(operation){cancelJob(operation.id);operation.status='cancelled';operation.message='已停止编辑，原图和已有版本保留';operation.finished=Date.now();await persist(doc);}
        json(res,200,{document:publicDocument(doc)});return true;
      }
      throw errorWithStatus('请求方式不支持',405);
    }catch(error){if(!req.readableEnded)req.resume();json(res,error.status||400,{error:error.message});return true;}
  }
  return {handle};
}
