import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {layeredSetDetails} from './set-layered-prompts.mjs';

export const sectionIds=['product','size','material','scene','camera','placement','duvet','surface','pillow'];
export function sectionScope(v,scene,angle,id){
  const variant=v.product==='quilt'?(v.quiltSeason||'winter'):v.product==='sheet'?(v.sheetVariant||'flat'):v.product==='mat'?v.fabric:v.product==='mattress'?(v.mattressVariant||'thin'):v.product==='blanket'?(v.blanketVariant||'fleece'):v.product==='sleepbag'?(v.sleepbagVariant||'travel'):'';
  const product=[v.product,variant],mode=v.textureReferenceBytes||v.textureReferenceImage?'upload':v.fabricMode==='selected'?'selected':'auto';
  const scopes={product,size:[...product,v.product==='set'?v.size:''],material:[v.product,mode,mode==='selected'?v.fabric:''],scene:[scene],camera:[...product,angle],placement:[...product,!!(v.imageBBytes||v.imageB)]};
  for(const [id,group]of Object.entries({duvet:'被套工艺',surface:'床单款式',pillow:'枕套工艺'}))scopes[id]=[...product,layeredSetDetails(v).find(r=>r.group===group)?.id||''];
  if(!sectionIds.includes(id))throw Error('提示词分类无效');
  return JSON.stringify([id,...scopes[id]]);
}
export function createPromptSectionEdits(file){
  let entries={},queue=Promise.resolve();
  const ready=(async()=>{try{const data=JSON.parse(await readFile(file,'utf8'));if(data.version!==1||!Array.isArray(data.entries))throw Error();for(const item of data.entries){if(typeof item.scope!=='string'||typeof item.prompt!=='string'||!item.prompt.trim()||item.prompt.length>12000||typeof item.version!=='string')throw Error();entries[item.scope]=item;}}catch(e){if(e.code!=='ENOENT')throw Error('逐条提示词文件读取失败，请检查后重试');}})();
  ready.catch(()=>{});
  async function get(scope){await ready;return entries[scope]||{scope,prompt:null,version:null,updatedAt:null};}
  function save({scope,prompt,version}){
    if(prompt!==null&&(typeof prompt!=='string'||!prompt.trim()||prompt.length>12000))throw Error('提示词不能为空，最多支持 12000 个字符');
    if(version!==null&&typeof version!=='string')throw Error('提示词版本无效，请刷新后重试');
    const task=queue.then(async()=>{
      await ready;if((entries[scope]?.version??null)!==version){const e=Error('该提示词已被其他页面修改，请刷新后重新编辑');e.status=409;throw e;}
      const next={...entries};if(prompt===null)delete next[scope];else next[scope]={scope,prompt,version:randomUUID(),updatedAt:new Date().toISOString()};
      await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
      try{await writeFile(temp,JSON.stringify({version:1,entries:Object.values(next)},null,2),'utf8');await rename(temp,file);}catch{throw Error('提示词保存失败，请检查文件写入权限');}finally{await rm(temp,{force:true}).catch(()=>{});}
      entries=next;return get(scope);
    });queue=task.catch(()=>{});return task;
  }
  async function resolve(v,scene,angle){await ready;return Object.fromEntries(sectionIds.map(id=>[id,entries[sectionScope(v,scene,angle,id)]?.prompt]).filter(([,prompt])=>prompt!=null));}
  return {get,save,resolve};
}
