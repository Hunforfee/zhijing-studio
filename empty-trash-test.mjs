import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {createImageHistory} from './image-history.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const service={provider:'compatible',apiKey:'test-secret',baseUrl:'https://example.test/v1',model:'gpt-image-2'};
const image='data:image/png;base64,'+png.toString('base64');

async function fixture(fn){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-trash-'));
  let server,base;
  const start=async()=>{server=createServer({outputDir,service,stylingReferencePaths:[],fetchImpl:async()=>Response.json({data:[{b64_json:png.toString('base64')}]})});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;};
  const stop=async()=>{await new Promise(r=>server.close(r));server=null;};
  const get=async route=>(await fetch(base+route)).json();
  const post=async(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});
  try{await start();await fn({outputDir,get,post,restart:async()=>{await stop();await start();}});}finally{if(server)await stop();assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-trash-'));await rm(outputDir,{recursive:true,force:true});}
}

test('empty trash permanently purges deleted images, their files and survives restart',async()=>{
  await fixture(async({outputDir,get,post,restart})=>{
    const a=await post('/api/history',{image,ratio:'1:1',scene:'warm',angle:'front'});assert.equal(a.status,201);
    const b=await post('/api/history',{image,ratio:'1:1',scene:'hotel',angle:'side'});assert.equal(b.status,201);
    const fileA=(await a.json()).image.url.slice('/generated/'.length);
    const first=(await get('/api/history')).images;assert.equal(first.length,2);
    // 软删除 #1：进回收站，文件仍在
    const del=await post('/api/history/delete',{number:1});assert.equal(del.status,200);
    let state=await get('/api/history');assert.equal(state.images.length,1);assert.equal(state.trash.length,1);
    await access(path.join(outputDir,fileA));
    // 清空回收站：记录与文件一起永久移除
    const empty=await post('/api/history/empty-trash',{});assert.equal(empty.status,200);
    const purged=await empty.json();assert.equal(purged.purged,1);assert.equal(purged.trash.length,0);assert.equal(purged.images.length,1);assert.equal(purged.images[0].number,2);
    await assert.rejects(()=>access(path.join(outputDir,fileA)),Error);
    // 重启后不复活（legacy 扫描不会把它当未登记文件重新收编）
    await restart();state=await get('/api/history');assert.equal(state.images.length,1);assert.equal(state.trash.length,0);
    // 再清一次是安全空操作
    const again=await post('/api/history/empty-trash',{});assert.equal((await again.json()).purged,0);
  });
});

test('purgeDeleted keeps non-deleted records and files even when they share the job directory',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-trash-'));
  try{
    const dir=path.join(outputDir,'00000000-0000-4000-8000-00000000000a');
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'1.png'),png);await writeFile(path.join(dir,'2.png'),png);
    const history=createImageHistory(outputDir);await history.list();
    const records=await history.list(true);
    const sorted=[...records].sort((x,y)=>x.url.localeCompare(y.url));
    await history.setDeleted([sorted[0].number],true);
    const purged=await history.purgeDeleted();assert.equal(purged.length,1);
    const left=await history.list(true);assert.equal(left.length,1);assert.equal(left[0].number,sorted[1].number);
    await access(path.join(dir,'2.png'));
    await assert.rejects(()=>access(path.join(dir,'1.png')),Error);
    assert.equal((await history.purgeDeleted()).length,0);
  }finally{await rm(outputDir,{recursive:true,force:true});}
});

test('trash UI exposes a confirmed empty-trash action restricted to the trash view',async()=>{
  const js=await readFile('dist/image-history.js','utf8'),css=await readFile('dist/image-history.css','utf8');
  assert.match(js,/historyEmptyTrashBtn/, '应有清空回收站按钮');
  assert.match(js,/worksActions\.append\(emptyTrashButton\)/, '按钮应放在回收站按钮旁的作品操作区');
  assert.match(js,/emptyTrashButton\.hidden=!trashMode\|\|!trash\.length/, '仅回收站视图且有内容时显示');
  assert.match(js,/emptyTrashButton\.hidden=[^;]*\|\|shared/, '分享访客不可见');
  assert.match(js,/fetch\('\/api\/history\/empty-trash',\{method:'POST',headers:\{'Content-Type':'application\/json'\},body:'\{\}'\}\)/, '应调用清空接口并携带 JSON body');
  assert.match(js,/清空回收站？/, '应有确认弹窗文案');
  assert.match(js,/\$\('emptyTrashCancel'\)\.onclick/, '确认弹窗应有取消按钮');
  assert.match(js,/回收站已清空/, '清空成功应有提示');
  assert.match(js,/trashMode=false;await refresh\(\);/, '清空后应回到生成记录视图');
  assert.match(css,/\.empty-trash-actions\{/, '确认弹窗按钮应有样式');
  assert.match(js,/for\(const id of \['historyEditBtn','historyNumber','historyPrompt','historyLookup','historyBack','currentWorksBtn','historyRecordsBtn','historyEmptyTrashBtn'\]\)/, '编辑锁定时应禁用清空按钮');
});
