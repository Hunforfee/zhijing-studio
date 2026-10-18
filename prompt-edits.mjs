import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const defaultPromptTemplate='{{默认提示词}}';
export function createPromptEdits(file,{products,scenes,angles}){
  let entries={},queue=Promise.resolve();
  function key(q){
    if(!q||!Object.hasOwn(products,q.product)||!Object.hasOwn(scenes,q.scene)||!Object.hasOwn(angles,q.angle)||!['sub2api','zhipu'].includes(q.provider))throw Error('请选择有效的产品、场景、角度与接口');
    return [q.provider,q.product,q.scene,q.angle].join('/');
  }
  const ready=(async()=>{
    try{
      const data=JSON.parse(await readFile(file,'utf8'));
      if(data.version!==1||!Array.isArray(data.entries))throw Error('格式无效');
      for(const item of data.entries){const id=key(item);if(typeof item.template!=='string'||item.template.length>24000||!item.template.trim()||typeof item.version!=='string')throw Error('条目无效');entries[id]=item;}
    }catch(e){if(e.code!=='ENOENT')throw Error('人工提示词文件读取失败，请检查文件后重试');}
  })();
  ready.catch(()=>{});
  async function get(q){await ready;return entries[key(q)]||{...q,template:defaultPromptTemplate,version:null,updatedAt:null};}
  async function save(q){
    const id=key(q);
    if(typeof q.template!=='string'||!q.template.trim()||q.template.length>24000)throw Error('提示词不能为空，最多支持 24000 个字符');
    if(q.version!==null&&typeof q.version!=='string')throw Error('提示词版本无效，请重新载入');
    const operation=queue.then(async()=>{
      await ready;
      if((entries[id]?.version??null)!==q.version){const e=Error('此提示词已被其他页面修改，请重新载入后保存');e.status=409;throw e;}
      const next={...entries};
      if(q.template.trim()===defaultPromptTemplate)delete next[id];
      else next[id]={provider:q.provider,product:q.product,scene:q.scene,angle:q.angle,template:q.template,version:randomUUID(),updatedAt:new Date().toISOString()};
      await mkdir(path.dirname(file),{recursive:true});
      const temp=file+'.'+randomUUID()+'.tmp';
      try{await writeFile(temp,JSON.stringify({version:1,entries:Object.values(next)},null,2),'utf8');await rename(temp,file);}catch{throw Error('提示词保存失败，请检查文件写入权限');}finally{await rm(temp,{force:true}).catch(()=>{});}
      entries=next;return get({provider:q.provider,product:q.product,scene:q.scene,angle:q.angle});
    });
    queue=operation.catch(()=>{});return operation;
  }
  async function apply(prompt,q){const item=await get(q);return item.template.split(defaultPromptTemplate).join(prompt);}
  return {get,save,apply};
}
