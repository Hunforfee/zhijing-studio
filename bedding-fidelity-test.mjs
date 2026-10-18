import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer,buildPrompt,validateInput} from './server.mjs';
import {buildZhipuPrompt,zhipuImageRequest} from './zhipu-prompts.mjs';
import {beddingFidelityRule,beddingSurface,enforceBeddingFidelity,beddingFidelityVersion} from './bedding-fidelity.mjs';
import {setSeamMapRule,setPanelBoundaryRule} from './set-surface-prompts.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const base={product:'sheet',sheetVariant:'fitted',fabric:'cotton',scenes:['warm'],angles:['front'],size:'床笠包覆床垫',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image};

test('routes only the chosen surface, leaves custom set structure unspecified and separates edit scope',()=>{
  for(const [size,surface] of [['普通平床单：自然外垂','flat'],['床笠替代平床单：贴合','fitted'],['百褶连体床裙替代平床单：三侧','skirt'],['合体床罩替代平床单：三侧','coverlet']])assert.equal(beddingSurface({product:'set',size}),surface);
  assert.equal(beddingSurface({product:'set',size:'自定义新结构'}),null);
  const fitted=beddingFidelityRule(base);
  assert.ok(!fitted.includes('平床单是一张连续薄布'));
  assert.ok(fitted.includes('床笠包覆床垫顶面侧边'));
  const flat=beddingFidelityRule({...base,sheetVariant:'flat'});
  assert.ok(flat.includes('平床单是一张连续薄布'));
  assert.ok(!flat.includes('床笠包覆床垫顶面侧边'));
  const edit=beddingFidelityRule(base,{edit:true});
  assert.ok(edit.includes('按明确修改要求调整对应部件'));
  assert.ok(!edit.includes('床笠包覆床垫顶面侧边'));
  assert.equal(enforceBeddingFidelity(fitted,base),fitted);
  assert.equal(beddingFidelityRule({product:'unknown'}),'');
});

test('all product paths retain the guards in ordinary and reference builders without duplicating them',()=>{
  for(const product of ['set','sheet','quilt','pillow','mat','mattress','blanket','sleepbag'])for(const ref of [false,true]){
    const v=validateInput({...base,product,sheetVariant:undefined,fabric:product==='mat'?'ice':'cotton',referenceImage:ref?image:null});
    const prompt=buildPrompt(v,'warm','front');
    assert.ok(prompt.includes(beddingFidelityRule(v)));
    assert.equal(prompt.split(beddingFidelityVersion).length,2);
    const zh=buildZhipuPrompt(v,'warm','front','blue floral print');
    assert.ok(zh.includes(beddingFidelityRule(v,{compact:true})));
    assert.doesNotThrow(()=>zhipuImageRequest({model:'glm-image'},v,zh));
  }
});

async function fixture(provider,fn){
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-fidelity-')),requests=[];
  const service={provider,apiKey:'synthetic-only',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'gpt-image-2',visionModel:'glm-4.6v',verified:true};
  const server=createServer({firstImageReview:false,service,outputDir,stylingReferencePaths:[],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'blue flowers',sourceTexture:'cotton'})}}]});
    const prompt=init.body instanceof FormData?init.body.get('prompt'):JSON.parse(init.body).prompt;
    requests.push(prompt);
    return Response.json({data:[{b64_json:image.split(',')[1]}]});
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=async(route,data)=>{const response=await fetch(url+route,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(response.status<300,true,await response.clone().text());return response.json();};
  const wait=async(id)=>{for(let i=0;i<150;i++){const job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running'){assert.equal(job.status,'done',job.error);return job;}await new Promise(r=>setTimeout(r,20));}throw Error('job timeout');};
  try{await fn({post,wait,requests,url});}finally{
    await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep+'zhijing-fidelity-'));
    await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:60});
  }
}

for(const provider of ['sub2api','zhipu'])test(provider+' actual provider requests keep selected structure after full manual replacement; preview matches final enforcement',()=>fixture(provider,async({post,wait,requests,url})=>{
  const scope={provider,product:'sheet',scene:'warm',angle:'front'};
  await post('/api/admin/prompt-edit',{...scope,version:null,template:'Use soft daylight.'});
  const preview=await post('/api/admin/preview',{...scope,variant:'fitted'});
  assert.ok(preview.prompts[provider].includes(beddingFidelityRule(base)));
  assert.equal(preview.beddingFidelity.version,beddingFidelityVersion);
  const job=await wait((await post('/api/jobs',base)).id);
  assert.equal(requests.length,1);
  assert.ok(requests[0].includes(beddingFidelityRule(base)));
  assert.ok(!requests[0].includes('平床单是一张连续薄布'));
  const status=await(await fetch(url+'/api/status')).json();
  assert.equal(status.beddingFidelityVersion,beddingFidelityVersion);
  if(provider==='sub2api'){
    await wait((await post('/api/history/edit',{number:job.results[0].number,prompt:'仅调整光线'})).id);
    assert.ok(requests[1].includes(beddingFidelityRule(base,{edit:true})));
    assert.ok(!requests[1].includes('床笠包覆床垫顶面侧边'));
  }
}));

for(const provider of ['sub2api','zhipu'])test(provider+' A/B seam guards survive defaults, photographic reference and full replacement in actual provider payloads',()=>fixture(provider,async({post,wait,requests})=>{
  const set={...base,product:'set',size:'普通平床单：自然外垂',sheetVariant:undefined,imageB:image};
  for(const reference of [false,true]){
    await wait((await post('/api/jobs',{...set,referenceImage:reference?image:null})).id);
    const sent=requests.at(-1);
    assert.ok(sent.includes(setPanelBoundaryRule(set,provider==='zhipu')));
    if(provider==='sub2api'){
      const seam=setSeamMapRule(set);
      assert.ok(sent.includes(seam));assert.equal(sent.split(seam).length,2);
      assert.ok(sent.indexOf(seam)<sent.indexOf(' Product: ')||!sent.includes(' Product: '));
    }
  }
  const scope={provider,product:'set',scene:'warm',angle:'front'};
  await post('/api/admin/prompt-edit',{...scope,version:null,template:'Soft lighting; keep the selected print.'});
  await wait((await post('/api/jobs',set)).id);
  assert.ok(requests.at(-1).includes(setPanelBoundaryRule(set,provider==='zhipu')));
  if(provider==='sub2api')assert.ok(requests.at(-1).includes(setSeamMapRule(set)));
  assert.equal(setSeamMapRule({...set,imageB:null}),'');
  assert.equal(setSeamMapRule({...set,product:'sheet'}),'');
}));
