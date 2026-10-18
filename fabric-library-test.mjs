import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {textureIds} from './material-priority.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'set',fabricMode:'selected',size:'普通四件套',scenes:['warm'],angles:['front'],scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image};
test('all sixteen selections have unique real assets, supported product inputs and provider prompts',async()=>{
  const catalog=globalThis.beddingFabricLibrary;
  assert.equal(catalog.length,16);assert.equal(new Set(catalog.map(e=>e.id)).size,16);
  for(const entry of catalog){
    assert.ok(textureIds.includes(entry.id));
    const png=await readFile('dist/assets/fabrics/'+entry.id+'.png');
    const jpg=await readFile('dist/assets/fabrics/'+entry.id+'.jpg');
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8');
    for(const product of ['set','quilt','sheet','mattress','pillow','blanket','sleepbag'])assert.equal(validateInput({...base,product,fabric:entry.id}).fabric,entry.id);
    const v=validateInput({...base,fabric:entry.id});
    assert.ok(buildPrompt(v,'warm','front',false,0,true).includes(entry.prompt));
    const zhipu=buildZhipuPrompt(v,'warm','front','ivory floral print');assert.ok(zhipu.includes(entry.hint));assert.ok(!zhipu.includes('undefined'));
  }
  assert.equal(validateInput({...base,fabric:'cotton',fabricMode:'auto'}).fabricMode,'auto');
  assert.equal(validateInput({...base,product:'mat',fabric:'bamboo'}).fabric,'bamboo');
});
test('generation request includes the exact chosen new texture pixels',async()=>{
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-fabric19-'));let textureFile,prompt;
  const server=createServer({outputDir,stylingReferencePaths:[],firstImageReview:false,service:{provider:'sub2api',apiKey:'fixture',baseUrl:'https://example.test/v1',model:'test-image'},fetchImpl:async(url,init)=>{
    textureFile=init.body.getAll('image[]').find(file=>file.name==='selected-texture.png');prompt=init.body.get('prompt');return Response.json({data:[{b64_json:image.split(',')[1]}]});
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{
    const response=await fetch(url+'/api/jobs',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({...base,fabric:'smooth-premium'})});assert.equal(response.status,202);
    const {id}=await response.json();let job;
    for(let i=0;i<100;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(!['running','queued'].includes(job.status))break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'done',job.error);assert.ok(textureFile);assert.deepEqual(Buffer.from(await textureFile.arrayBuffer()),await readFile('dist/assets/fabrics/smooth-premium.png'));assert.match(prompt,/luminous elegant pearlescent satin sheen/);assert.match(prompt,/TEXTURE-ONLY/);
  }finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep+'zhijing-fabric19-'));await rm(outputDir,{recursive:true,force:true});}
});
