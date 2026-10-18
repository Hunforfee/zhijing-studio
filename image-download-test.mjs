import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createImageDownloadPlan,buildImageArchive} from './dist/image-download.js';
const photo=(number,extra={})=>({number,url:`/generated/test/${number}.png`,...extra});
test('photo download includes originals and every edit in the existing UI groups',()=>{
  const items=[photo(1),photo(2),photo(3,{parentNumber:1,kind:'edited'}),photo(4,{parentNumber:3}),photo(5,{kind:'edited'}),photo(6,{deletedAt:'deleted'}),photo(7,{reference:true})];
  const plan=createImageDownloadPlan([...items,items[0]]);
  assert.deepEqual(plan.map(entry=>entry.path),['最新作品/','历史版本/','历史版本/图片_1.png','最新作品/图片_2.png','历史版本/图片_3.png','最新作品/图片_4.png','最新作品/图片_5.png']);
});
test('detail download keeps unchanged slices with current versions and retains all replaced versions',()=>{
  const slice=(number,index,extra={})=>photo(number,{detailPage:true,detailGroupId:'details',detailSliceIndex:index,detailSliceTitle:'测试',...extra});
  const items=[slice(1,0),slice(2,1),slice(3,2),slice(4,0,{parentNumber:1}),slice(5,0,{parentNumber:4}),slice(6,1,{parentNumber:2,deletedAt:'deleted'})];
  const plan=createImageDownloadPlan(items,{detail:true});
  assert.deepEqual(plan.filter(x=>x.directory).map(x=>x.path),['最新作品/','历史版本/']);
  assert.deepEqual(plan.filter(x=>x.path.startsWith('最新作品/')&&x.item).map(x=>x.item.number),[2,3,5]);
  assert.deepEqual(plan.filter(x=>x.path.startsWith('历史版本/')&&x.item).map(x=>x.item.number),[1,4]);
});
test('single-group exports stay flat and filenames cannot create extra folders or overwrite files',()=>{
  const plan=createImageDownloadPlan([photo(1),photo(2,{parentNumber:1})],{grouped:false,nameFor:()=> '../名称/相同'});
  assert.equal(plan.length,2);assert.ok(plan.every(entry=>!entry.path.includes('/')));assert.notEqual(plan[0].path,plan[1].path);
  assert.deepEqual(createImageDownloadPlan([]),[]);
});
test('ZIP independently extracts Chinese directories with unchanged file bytes and valid CRC',async()=>{
  const plans=[createImageDownloadPlan([photo(1),photo(2,{parentNumber:1})]),createImageDownloadPlan([photo(1,{detailPage:true,detailGroupId:'d',detailSliceIndex:0}),photo(2,{detailPage:true,detailGroupId:'d',detailSliceIndex:0,parentNumber:1})],{detail:true})];
  for(const plan of plans){
    const blob=await buildImageArchive(plan,item=>new Uint8Array([item.number,0,255,42]));
    const output=execFileSync(process.env.ZHIJING_TEST_PYTHON||'python',['-c','import sys,io,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps([{ "path":i.filename, "directory":i.is_dir(), "bytes":list(z.read(i)) } for i in z.infolist()]))'],{input:Buffer.from(await blob.arrayBuffer()),encoding:'utf8'});
    const files=JSON.parse(output);assert.deepEqual(files.map(x=>x.path),plan.map(x=>x.path));
    for(const [index,file] of files.entries()){assert.equal(file.directory,!!plan[index].directory);assert.deepEqual(file.bytes,plan[index].directory?[]:[plan[index].item.number,0,255,42]);}
  }
});
