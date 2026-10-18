import {readFile,writeFile,mkdir,readdir,stat,rename,unlink,rmdir} from 'node:fs/promises';
import path from 'node:path';

const imagePath=/^([a-f0-9-]{36})\/(\d+(?:-repair-[12])?\.(?:png|jpg|webp))$/;
export function createImageHistory(outputRoot) {
  const indexFile=path.join(outputRoot,'history.json');
  let records=[],queue=Promise.resolve();
  const persist=async()=>{
    await writeFile(indexFile+'.tmp',JSON.stringify({version:1,records},null,2));
    await rename(indexFile+'.tmp',indexFile);
  };
  const ready=(async()=>{
    await mkdir(outputRoot,{recursive:true});
    try{const data=JSON.parse(await readFile(indexFile,'utf8'));if(data.version!==1||!Array.isArray(data.records))throw Error('图片历史格式无效');records=data.records;}
    catch(e){if(e.code!=='ENOENT')throw e;}
    const known=new Set(records.map(r=>r.url)),legacy=[];
    for(const dir of await readdir(outputRoot,{withFileTypes:true})){
      if(!dir.isDirectory()||!/^[a-f0-9-]{36}$/.test(dir.name))continue;
      for(const file of await readdir(path.join(outputRoot,dir.name),{withFileTypes:true})){
        const relative=dir.name+'/'+file.name,url='/generated/'+relative;
        if(!file.isFile()||!imagePath.test(relative)||known.has(url))continue;
        const info=await stat(path.join(outputRoot,relative));
        legacy.push({url,createdAt:info.mtime.toISOString(),kind:'imported',jobId:dir.name});
      }
    }
    legacy.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.url.localeCompare(b.url,undefined,{numeric:true}));
    let next=Math.max(0,...records.map(r=>r.number));
    records.push(...legacy.map(r=>({...r,number:++next})));
    if(legacy.length)await persist();
  })();
  ready.catch(()=>{});
  // Serialize numbering and disk updates, including requests that finish together.
  function exclusive(fn){const task=queue.then(()=>ready).then(fn);queue=task.catch(()=>{});return task;}
  return {
    async list(includeDeleted=false){await ready;await queue;return records.filter(r=>includeDeleted||!r.deletedAt).reverse();},
    async get(number){await ready;await queue;return records.find(r=>r.number===number&&!r.deletedAt);},
    setDeleted(numbers,deleted){return exclusive(async()=>{
      if(!Array.isArray(numbers)||!numbers.length||numbers.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('图片编号无效');
      if(numbers.some(n=>!records.some(r=>r.number===n)))throw Error('图片不存在');
      const previous=records,timestamp=new Date().toISOString(),selected=new Set(numbers);
      records=records.map(record=>{
        if(!selected.has(record.number))return record;
        const next={...record};if(deleted){next.deletedAt=next.deletedAt||timestamp;}else delete next.deletedAt;return next;
      });
      try{await persist();}catch(e){records=previous;throw e;}
      return records.filter(r=>selected.has(r.number));
    });},
    // 清空回收站：永久移除所有带 deletedAt 的记录及其图片文件。
    purgeDeleted(){return exclusive(async()=>{
      const doomed=records.filter(r=>r.deletedAt);
      if(!doomed.length)return [];
      const previous=records;
      records=records.filter(r=>!r.deletedAt);
      try{await persist();}catch(e){records=previous;throw e;}
      const removedDirs=new Set();
      for(const record of doomed){
        const relative=record.url.slice('/generated/'.length);
        if(!imagePath.test(relative))continue;
        try{await unlink(path.join(outputRoot,relative));}catch(e){if(e.code!=='ENOENT')console.warn('回收站图片文件删除失败：',relative,e.message);}
        removedDirs.add(path.join(outputRoot,path.dirname(relative)));
      }
      for(const dir of removedDirs){try{if(!(await readdir(dir)).length)await rmdir(dir);}catch(e){}}
      return doomed;
    });},
    async bytes(record){const relative=record.url.slice('/generated/'.length);if(!imagePath.test(relative))throw Error('历史图片路径无效');return readFile(path.join(outputRoot,relative));},
    add(record){return exclusive(async()=>{
      const existing=records.find(r=>r.url===record.url);if(existing)return existing;
      const next={...record,createdAt:new Date().toISOString(),number:Math.max(0,...records.map(r=>r.number))+1};
      records.push(next);try{await persist();}catch(e){records.pop();throw e;}return next;
    })}
  };
}
