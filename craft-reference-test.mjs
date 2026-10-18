import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {craftReferenceSpecs,craftReferenceInstruction} from './craft-references.mjs';
import {createServer,validateInput} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';

const source=(await readFile('dist/set-variants.js','utf8')).split('const variantPanel=')[0];
const variants=runInNewContext(source+';setVariants');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
function size(duvet,sheet,pillow){return '三组同时满足：'+[duvet,sheet,pillow].map(id=>variants.find(v=>v.id===id).spec).join('；')+'。各工艺仅作用所属部件，互不沿用。';}
const craftInput={product:'set',fabric:'cotton',fabricMode:'auto',size:size('wide-flange','standard','pillow-piping'),scenes:['warm'],angles:['front'],scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image};

test('uploaded craft references are validated, scoped to selected crafts and override only decorative appearance',()=>{
  const v=validateInput({...craftInput,craftReferences:{'wide-flange':image}}),refs=craftReferenceSpecs(v);
  assert.ok(refs.find(ref=>ref.kind==='wide-flange').bytes.equals(v.imageBytes));
  assert.equal(refs.find(ref=>ref.kind==='piping').bytes,null);
  const prompt=craftReferenceInstruction(v,4);
  assert.match(prompt,/Image 4 is the USER CRAFT STYLE reference for 被套工艺/);
  assert.match(prompt,/Image 5 is a CONSTRUCTION-ONLY schematic for 枕套工艺/);
  assert.match(prompt,/overrides system default edge widths, colors/);
  assert.match(prompt,/original A\/B prints to the main panels/);
  assert.throws(()=>validateInput({...craftInput,craftReferences:{lace:image}}),/不匹配/);
  assert.throws(()=>validateInput({...craftInput,craftReferences:{'wide-flange':'broken'}}),/不匹配/);
  assert.throws(()=>validateInput({...craftInput,craftReferences:[]}),/参数无效/);
  const described=buildZhipuPrompt(v,'warm','front',JSON.stringify({fabricA:'white floral print',craftDetails:'被套宽边为柔软蓝色平布，内侧细压线'}));
  assert.match(described,/柔软蓝色平布/);assert.match(described,/高于默认边饰宽度和配色/);assert.ok(Array.from(described).length<=3500);
});
test('uploaded style pixels replace the corresponding default schematic in the actual generation request',async()=>{
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-upload-craft-'));let request;
  const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'fixture',baseUrl:'https://example.test/v1',model:'gpt-image-2'},fetchImpl:async(url,init)=>{request=init.body;return Response.json({data:[{b64_json:image.split(',')[1]}]});}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...craftInput,craftReferences:{'wide-flange':image}})});assert.equal(response.status,202);const {id}=await response.json();let job;
    for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(!['running','queued'].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,10));}
    assert.equal(job.status,'done',job.error);const files=request.getAll('image[]');
    assert.equal(files.at(-2).name,'user-craft-wide-flange.png');assert.equal(files.at(-1).name,'construction-piping.png');
    assert.deepEqual(Buffer.from(await files.at(-2).arrayBuffer()),Buffer.from(image.split(',')[1],'base64'));
    assert.match(request.get('prompt'),/USER CRAFT STYLE/);
  }finally{await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep));await rm(outputDir,{recursive:true,force:true});}
});
test('Zhipu identifies uploaded craft colors separately and carries them into the image prompt',async()=>{
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-zhipu-craft-'));let visionRequest,generationPrompt;
  const server=createServer({outputDir,service:{provider:'zhipu',apiKey:'fixture',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image'},fetchImpl:async(url,init)=>{
    const request=JSON.parse(init.body);
    if(url.endsWith('/chat/completions')){visionRequest=request;return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'ivory floral print',craftDetails:'被套宽边为蓝色平布，内侧有细压线'})}}]});}
    generationPrompt=request.prompt;return Response.json({data:[{b64_json:image.split(',')[1]}]});
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...craftInput,craftReferences:{'wide-flange':image}})});assert.equal(response.status,202);const {id}=await response.json();let job;
    for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(!['running','queued'].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,10));}
    assert.equal(job.status,'done',job.error);const content=visionRequest.messages[0].content;
    assert.equal(content.filter(item=>item.type==='image_url').length,2);assert.match(content.at(-1).text,/Image 2 is a USER CRAFT STYLE reference for 被套工艺/);
    assert.match(generationPrompt,/蓝色平布/);assert.match(generationPrompt,/主体花型保留A\/B/);
  }finally{await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep));await rm(outputDir,{recursive:true,force:true});}
});
test('every non-plain craft has a real PNG reference scoped only to its own component; shared geometry is deduplicated',async()=>{
  for(const variant of variants){
    const v={product:'set',size:size(variant.group==='被套工艺'?variant.id:'plain',variant.group==='床单款式'?variant.id:'standard',variant.group==='枕套工艺'?variant.id:'pillow-plain')};
    const refs=craftReferenceSpecs(v);
    assert.equal(refs.length,['plain','standard','pillow-plain'].includes(variant.id)?0:1);
    for(const ref of refs){assert.deepEqual(ref.groups,[variant.group]);assert.equal((await readFile(ref.file)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
  }
  const v={product:'set',size:size('wide-flange','fitted','pillow-wide-flange')},refs=craftReferenceSpecs(v);
  assert.equal(refs.length,2);assert.deepEqual(refs.find(r=>r.kind==='wide-flange').groups,['被套工艺','枕套工艺']);
  assert.match(craftReferenceInstruction(v,6),/Image 6/);assert.match(craftReferenceInstruction(v,6),/Image 7/);
  assert.equal(craftReferenceSpecs({...v,product:'sheet'}).length,0);
});
test('actual batch payload adds craft geometry after camera/texture, numbers it correctly and never starts review',async()=>{
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-craft-ref-')),requests=[];
  const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'fixture',baseUrl:'https://example.test/v1',model:'gpt-image-2'},fetchImpl:async(url,init)=>{
    assert.ok(url.endsWith('/images/edits'));requests.push(init.body);return Response.json({data:[{b64_json:image.split(',')[1]}]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({product:'set',fabric:'cotton',fabricMode:'selected',size:size('wide-flange','standard','pillow-piping'),scenes:['warm'],angles:['front','top'],cameraReferences:{front:image,top:image},scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,imageB:image})});
    const {id}=await response.json();let job;
    for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'done',job.error);assert.equal(requests.length,2);
    for(const [index,request] of requests.entries()){
      const files=request.getAll('image[]');assert.equal(files.at(-2).name,'construction-wide-flange.png');assert.equal(files.at(-1).name,'construction-piping.png');
      assert.match(request.get('prompt'),new RegExp('Image '+(index?6:5)+' is a CONSTRUCTION-ONLY schematic'));
      assert.match(request.get('prompt'),/filled-body silhouette/);assert.match(request.get('prompt'),/EACH PILLOWCASE MUST visibly have a single thin raised round/);
    }
  }finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep));await rm(outputDir,{recursive:true,force:true});}
});
