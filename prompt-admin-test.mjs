import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createServer,buildPrompt,validateInput} from './server.mjs';
import {createShareServer} from './share-server.mjs';
import {createPromptEdits,defaultPromptTemplate} from './prompt-edits.mjs';
import {createPromptSectionEdits,sectionScope} from './prompt-section-edits.mjs';
import vm from 'node:vm';
import {setStructurePrompt,compactSetStructurePrompt,setSurfacePlacement,setPanelBoundaryRule} from './set-surface-prompts.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const key='synthetic-admin-private-key';
test('admin atlas cropping follows the current frontend dimensions and product changes remove unavailable angles',async()=>{
  const source=await readFile(new URL('./dist/admin.js',import.meta.url),'utf8'),element={style:{}},fields={product:{value:'sheet'},angle:{value:'headclose'}};
  const c=vm.createContext({element,$:id=>fields[id],document:{getElementById:id=>fields[id]},options:(select,items,value)=>{select.value=items.some(i=>i.id===value)?value:items[0].id;}});
  vm.runInContext(source.match(/function imageCell\([^\n]+/)[0],c);
  c.atlas={src:'/assets/set-angles-v7-blue-side.png',cols:4,rows:5,cell:19};vm.runInContext('imageCell(element,atlas)',c);assert.equal(element.style.backgroundSize,'400% 500%');assert.equal(element.style.backgroundPosition,'100% 100%');
  c.atlas={src:'/assets/quilt.png',cols:4,rows:3,cell:4};vm.runInContext('imageCell(element,atlas)',c);assert.equal(element.style.backgroundSize,'400% 300%');assert.equal(element.style.backgroundPosition,'0% 50%');
  c.state={catalog:{defaultAngle:'front',productAngleIds:{sheet:['front','side'],set:['side','front','headclose']},angles:{front:{name:'正面'},side:{name:'斜侧'},headclose:{name:'床头'}}}};
  vm.runInContext(source.match(/function updateAngles\([^\n]+/)[0],c);vm.runInContext('updateAngles()',c);assert.equal(fields.angle.value,'front');fields.product.value='set';fields.angle.value='side';vm.runInContext('updateAngles()',c);assert.equal(fields.angle.value,'side');
});
test('blanket and sleeping-bag section scopes include the selected subtype',()=>{
  for(const id of ['product','size','camera','placement']){
    assert.notEqual(sectionScope({product:'blanket',blanketVariant:'fleece'},'warm','front',id),sectionScope({product:'blanket',blanketVariant:'gauze'},'warm','front',id));
    assert.equal(sectionScope({product:'sleepbag'},'warm','front',id),sectionScope({product:'sleepbag',sleepbagVariant:'travel'},'warm','front',id));
  }
});
for(const provider of ['sub2api','zhipu'])test(provider+' all 20 frontend set angles reach generation and admin request records with the front reference generated first',async()=>fixture(async({base,post,requests})=>{
  const catalog=await(await fetch(base+'/api/admin/catalog')).json(),ids=catalog.productAngleIds.set;
  assert.equal(ids.length,20);assert.deepEqual(ids.slice(0,3),['side','relaxed','front']);assert.equal(catalog.defaultAngle,'front');
  const plan=await(await post('/api/admin/preview',{product:'set',angle:'side'})).json();assert.match(plan.atlas.src,/set-angles-v21-left-diagonal\.png$/);assert.equal(plan.atlas.cell,1);assert.equal(plan.atlas.rows,5);
  const response=await post('/api/jobs',{product:'set',fabric:'cotton',fabricMode:'auto',size:'普通四件套',scenes:['warm'],angles:ids,scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image});assert.equal(response.status,202);const{id}=await response.json();let job;
  for(let n=0;n<200;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}assert.equal(job.status,'done',job.error);assert.equal(requests.length,20);const generatedIds=['front',...ids.filter(a=>a!=='front')];assert.deepEqual(job.results.map(r=>r.angle),generatedIds);
  const {records}=await(await fetch(base+'/api/admin/records')).json();assert.deepEqual(records.map(r=>r.angle).reverse(),generatedIds);
  assert.equal((await post('/api/admin/preview',{product:'blanket',angle:'headclose'})).status,400);
},provider));
test('inline editor shows existing text next to copy, saves replacement, cancels and retains failed drafts',async()=>{
  const source=await readFile(new URL('./dist/admin.js',import.meta.url),'utf8');
  class Element{constructor(tag,text){this.tag=tag;this.textContent=text;this.children=[];this.hidden=false;this.disabled=false;}append(...items){this.children.push(...items);for(const item of items)item.parent=this;}prepend(item){this.children.unshift(item);}setAttribute(){}focus(){}remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}}
  let submitted,refreshed=0,fail=false;const copied=[];
  const c=vm.createContext({sectionDrafts:new Map(),node:(tag,text)=>new Element(tag,text),copyButton:text=>{const b=new Element('button','复制');b.onclick=()=>copied.push(text);return b;},api:async(url,options)=>{if(fail)throw Error('模拟保存失败');submitted={url,...JSON.parse(options.body)};},requestPreview:async()=>{refreshed++;},toast(){}});
  vm.runInContext(source.slice(source.indexOf('function sectionContent('),source.indexOf('function pendingSections(')),c);
  const body=new Element('div');c.body=body;c.item={id:'product',scope:'product/set',prompt:'原提示词',version:null,name:'产品结构',scopeLabel:'四件套'};c.configuration={product:'set'};
  vm.runInContext('sectionContent(item,body,configuration)',c);const row=body.children[1];assert.deepEqual(row.children.map(x=>x.textContent),['复制','编辑']);row.children[0].onclick();assert.deepEqual(copied,['原提示词']);
  row.children[1].onclick();let panel=body.children[2],area=panel.children[1],actions=panel.children[2];assert.equal(area.value,'原提示词');area.value='替换提示词';area.oninput();await actions.children[0].onclick();assert.equal(submitted.prompt,'替换提示词');assert.equal(submitted.id,'product');assert.equal(submitted.version,null);assert.equal(refreshed,1);
  panel.remove();row.children[1].hidden=false;row.children[1].onclick();panel=body.children[2];area=panel.children[1];actions=panel.children[2];area.value='失败草稿';area.oninput();fail=true;await actions.children[0].onclick();assert.equal(area.value,'失败草稿');assert.equal(area.disabled,false);assert.equal(actions.children[3].textContent,'模拟保存失败');actions.children[1].onclick();assert.equal(c.sectionDrafts.size,0);assert.equal(body.children[0].hidden,false);
  row.children[1].onclick();fail=false;await body.children[2].children[2].children[2].onclick();assert.equal(submitted.reset,true);
});
test('section replacements survive restart and reject stale writes without affecting other scopes',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-sections-'));try{
    const file=path.join(dir,'sections.json'),store=createPromptSectionEdits(file),v={product:'sheet',sheetVariant:'flat',fabric:'cotton',fabricMode:'auto'},scope=sectionScope(v,'warm','side','product');
    const saved=await store.save({scope,prompt:'新的床单结构',version:null});assert.equal((await createPromptSectionEdits(file).resolve(v,'warm','front')).product,'新的床单结构');
    assert.equal((await store.resolve({...v,sheetVariant:'fitted'},'warm','side')).product,undefined);
    await assert.rejects(store.save({scope,prompt:'旧页面修改',version:null}),e=>e.status===409);
    await store.save({scope,prompt:null,version:saved.version});assert.equal((await createPromptSectionEdits(file).resolve(v,'warm','side')).product,undefined);
  }finally{await rm(dir,{recursive:true,force:true});}
});
for(const provider of ['sub2api','zhipu'])test(provider+' inline section saves replace original clauses in preview and real generation',async()=>fixture(async({base,post,requests})=>{
  const configuration={product:'blanket',scene:'warm',angle:'pillowclose'},original=await(await post('/api/admin/preview',configuration)).json(),versions={};
  for(const item of original.sections){const response=await post('/api/admin/section-edit',{configuration,id:item.id,prompt:'人工替换_'+item.id,version:null});assert.equal(response.status,200);versions[item.id]=(await response.json()).version;}
  const updated=await(await post('/api/admin/preview',configuration)).json();
  for(const item of updated.sections){assert.equal(item.prompt,'人工替换_'+item.id);assert.equal(item.custom,true);assert.equal(item.version,versions[item.id]);for(const p of Object.values(updated.prompts))assert.ok(p.includes(item.prompt));}
  assert.ok(!updated.prompts.sub2api.includes(original.sections[0].prompt));assert.ok(!updated.prompts.sub2api.includes(original.sections[2].prompt));assert.ok(!updated.prompts.sub2api.includes(original.sections[3].prompt));assert.ok(!updated.prompts.sub2api.includes(original.sections[5].prompt));
  assert.equal((await post('/api/admin/section-edit',{configuration,id:'product',prompt:'stale',version:null})).status,409);
  for(const bad of [{id:'invalid'},{prompt:''},{prompt:'x'.repeat(12001)},{configuration:{product:'invalid'}}])assert.equal((await post('/api/admin/section-edit',{configuration,id:'product',prompt:'new',version:versions.product,...bad})).status,400);
  assert.equal((await fetch(base+'/api/admin/section-edit',{method:'POST',headers:{Origin:'https://foreign.test','Content-Type':'application/json'},body:'{}'})).status,403);
  const response=await post('/api/jobs',{product:'blanket',fabric:'velvet',fabricMode:'auto',size:'按所选产品的常规比例，自然铺设',scenes:['warm'],angles:['pillowclose','front'],scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image,promptSections:{product:'untrusted-client'}});const{id}=await response.json();let job;
  for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}assert.equal(job.status,'done',job.error);
  for(const item of updated.sections)assert.ok(requests[0].includes(item.prompt),item.id);assert.ok(!requests[0].includes('untrusted-client'));assert.ok(!requests[1].includes('人工替换_camera'));assert.ok(requests[1].includes('人工替换_product'));
  if(provider==='zhipu')assert.match(requests[0],/actual red floral/);
  const reference=await(await post('/api/admin/preview',{...configuration,reference:'both'})).json();for(const p of Object.values(reference.prompts)){assert.ok(p.includes('人工替换_product'));assert.ok(p.includes('人工替换_material'));assert.ok(p.includes('人工替换_placement'));assert.ok(!p.includes('人工替换_scene'));assert.ok(!p.includes('人工替换_camera'));}
  for(const item of updated.sections)assert.equal((await post('/api/admin/section-edit',{configuration,id:item.id,reset:true,version:versions[item.id]})).status,200);
  const reset=await(await post('/api/admin/preview',configuration)).json();assert.deepEqual(reset.prompts,original.prompts);assert.ok(reset.sections.every(s=>!s.custom));
},provider));
test('manual prompt templates persist, resolve dynamic content and reject stale writes',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-prompt-edit-'));
  const file=path.join(dir,'edits.json'),maps={products:{set:{}},scenes:{warm:{}},angles:{side:{}}},q={product:'set',scene:'warm',angle:'side',provider:'sub2api'};
  try{
    const store=createPromptEdits(file,maps);
    assert.equal((await store.get(q)).template,defaultPromptTemplate);
    const saved=await store.save({...q,version:null,template:defaultPromptTemplate+'\n人工要求：柔和光线'});
    assert.equal(await store.apply('真实花型摘要',q),'真实花型摘要\n人工要求：柔和光线');
    const restarted=createPromptEdits(file,maps);assert.equal((await restarted.get(q)).template,saved.template);
    await assert.rejects(store.save({...q,version:null,template:'stale'}),e=>e.status===409);
    await assert.rejects(store.save({...q,version:saved.version,template:'  '}),/不能为空/);
    const replacement=await store.save({...q,version:saved.version,template:'完全人工提示词'});
    assert.equal(await store.apply('default',q),'完全人工提示词');
    assert.equal(await store.apply('default',{...q,provider:'zhipu'}),'default');
    await store.save({...q,version:replacement.version,template:defaultPromptTemplate});
    assert.equal(await createPromptEdits(file,maps).apply('default',q),'default');
  }finally{await rm(dir,{recursive:true,force:true});}
});
for(const provider of ['sub2api','zhipu'])test(provider+' saved manual prompts affect preview and actual requests with isolated scope',async()=>fixture(async({base,post,requests})=>{
  const q={product:'blanket',scene:'warm',angle:'pillowclose',provider};
  const original=await(await post('/api/admin/preview',q)).json();
  const template=defaultPromptTemplate+'\n人工要求：暖色自然光';
  const savedResponse=await post('/api/admin/prompt-edit',{...q,version:null,template});assert.equal(savedResponse.status,200);const saved=await savedResponse.json();
  const preview=await(await post('/api/admin/preview',q)).json();assert.equal(preview.prompts[provider],original.prompts[provider]+'\n人工要求：暖色自然光');assert.equal(preview.edits[provider].version,saved.version);
  assert.equal((await post('/api/admin/prompt-edit',{...q,version:null,template:'stale'})).status,409);
  for(const bad of [{...q,provider:'invalid'},{...q,product:'__proto__'},{...q,template:''},{...q,template:'a'.repeat(24001)}])assert.equal((await post('/api/admin/prompt-edit',{version:saved.version,template,...bad})).status,400);
  assert.equal((await fetch(base+'/api/admin/prompt-edit',{method:'POST',headers:{Origin:'https://foreign.test','Content-Type':'application/json'},body:JSON.stringify({...q,version:saved.version,template})})).status,403);
  assert.equal((await fetch(base+'/generated/prompt-edits.json')).status,404);
  const response=await post('/api/jobs',{product:'blanket',fabric:'velvet',fabricMode:'auto',size:'普通毛毯',scenes:['warm'],angles:['pillowclose','reverse'],scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image});assert.equal(response.status,202);const{id}=await response.json();let job;
  for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}assert.equal(job.status,'done',job.error);
  assert.match(requests[0],/人工要求：暖色自然光$/);assert.ok(!requests[1].includes('人工要求：暖色自然光'));
  if(provider==='zhipu'){assert.match(requests[0],/actual red floral/);assert.ok(!requests[0].includes('实际识图后填入'));}
  const {records}=await(await fetch(base+'/api/admin/records')).json();const record=await(await fetch(base+'/api/admin/records/'+records.find(r=>r.angle===q.angle).id)).json();assert.equal(record.prompt,requests[0]);
  assert.equal((await post('/api/admin/prompt-edit',{...q,version:saved.version,template:defaultPromptTemplate})).status,200);
  assert.equal((await(await post('/api/admin/preview',q)).json()).prompts[provider],original.prompts[provider]);
},provider));
for(const provider of ['sub2api','zhipu'])test(provider+' four-piece approved defaults reach the admin and actual image request, with conditional A/B allocation',async()=>fixture(async({base,post,requests})=>{
  for(const hasB of [false,true])for(const reference of ['none','both']){
    const preview=await(await post('/api/admin/preview',{product:'set',angle:'reverse',hasB,reference})).json();
    assert.ok(preview.sections.find(s=>s.id==='product').prompt.includes(setStructurePrompt));
    assert.ok(preview.sections.find(s=>s.id==='placement').prompt.includes(setSurfacePlacement({product:'set',imageB:hasB?image:null})));
    const response=await post('/api/jobs',{product:'set',fabric:'cotton',fabricMode:'auto',size:'普通四件套',scenes:['warm'],angles:['reverse'],scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image,imageB:hasB?image:null,referenceImage:reference==='both'?image:null});
    assert.equal(response.status,202);const{id}=await response.json();let job;
    for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}
    assert.equal(job.status,'done',job.error);
    const sent=requests.at(-1);
    assert.ok(sent.includes(setSurfacePlacement({product:'set',imageB:hasB?image:null},provider==='zhipu')));
    if(hasB)assert.ok(sent.includes(setPanelBoundaryRule({product:'set',imageB:image},provider==='zhipu')));
    if(provider==='sub2api')assert.ok(sent.includes(setStructurePrompt));
    else{assert.ok(sent.includes(compactSetStructurePrompt));assert.ok(Array.from(sent).length<=3500);}
    const {records}=await(await fetch(base+'/api/admin/records')).json();const record=await(await fetch(base+'/api/admin/records/'+records.find(r=>r.jobId===id).id)).json();assert.equal(record.prompt,sent);
  }
},provider));
async function fixture(fn,provider='sub2api'){
  const outputDir=await mkdtemp(path.join(tmpdir(),'zhijing-admin-test-'));const requests=[];
  const server=createServer({firstImageReview:false,outputDir,stylingReferencePaths:[],service:{provider,apiKey:key,baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'actual red floral',fabricB:'actual blue check',sourceTexture:'fine matte cotton'})}}]});requests.push(provider==='zhipu'?JSON.parse(init.body).prompt:init.body.get('prompt'));return Response.json({data:[{b64_json:image.split(',')[1]}]})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const post=async(route,input)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  try{await fn({base,post,requests})}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(tmpdir())+path.sep+'zhijing-admin-test-'));await rm(outputDir,{force:true,recursive:true})}
}
test('local prompt admin serves its page and live catalog, rejects foreign access and remains inaccessible through sharing',async()=>fixture(async({base})=>{
  for(const file of ['/admin','/admin/','/admin.html','/admin.css','/admin.js'])assert.equal((await fetch(base+file)).status,200);
  const response=await fetch(base+'/api/admin/catalog'),catalog=await response.json();assert.equal(response.status,200);assert.equal(catalog.products.length,8);assert.equal(catalog.variants.pillowcore.length,9);assert.equal(Object.keys(catalog.scenes).length,10);assert.equal(Object.keys(catalog.angles).length,20);assert.equal(catalog.variants.set.length,22);assert.equal(catalog.variants.sleepbag.length,1);assert.ok(catalog.products.some(p=>p.id==='mattress'));assert.ok(catalog.products.some(p=>p.id==='sleepbag'));assert.ok(!JSON.stringify(catalog).includes(key));
  for(const route of ['/admin','/admin.css','/api/admin/catalog','/api/admin/records']){
    assert.equal((await fetch(base+route,{headers:{Origin:'https://foreign.test'}})).status,403);
    const foreignHostStatus=await new Promise((resolve,reject)=>{http.get(base+route,{headers:{Host:'foreign.test'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});assert.equal(foreignHostStatus,403);
    assert.equal((await fetch(base+route,{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  }
  assert.equal((await fetch(base+'/x%2f..%2fadmin.js',{headers:{Origin:'https://foreign.test'}})).status,403);
  const token='synthetic-admin-share-invitation-123456789',share=createShareServer({token,backend:base});await new Promise(r=>share.listen(0,'127.0.0.1',r));try{const shared='http://127.0.0.1:'+share.address().port;const entry=await fetch(shared+'/invite/'+token,{redirect:'manual'});assert.equal(entry.status,303);const cookie=entry.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');for(const route of ['/admin','/admin.html','/admin.js','/admin.css','/api/admin/catalog','/api/admin/records'])assert.equal((await fetch(shared+route,{headers:{Cookie:cookie}})).status,404)}finally{await new Promise(r=>share.close(r))}
}));
test('combination previews use the exact generation builder, product-specific camera and real simultaneous variant specifications without contacting a provider',async()=>fixture(async({base,post,requests})=>{
  const c=await(await fetch(base+'/api/admin/catalog')).json();
  for(const product of c.products){const variants=product.id==='set'?c.variants.set.filter(x=>x.group==='床单款式').map(x=>({setSheet:x.id,setCraft:'piping'})):c.variants[product.id]?.map(x=>({variant:x.id}))||[{}];for(const variant of variants)for(const angle of c.productAngleIds[product.id]){
    const response=await post('/api/admin/preview',{product:product.id,...variant,angle,hasB:true,reference:'none',fabricMode:'selected',fabric:product.fabrics[0]});assert.equal(response.status,200);const d=await response.json();assert.equal(d.sections.length,product.id==='set'?8:6);assert.equal(d.angleOptions.length,product.id==='set'?20:12);assert.deepEqual(d.angleOptions.map(a=>a.id),c.productAngleIds[product.id]);assert.equal(d.atlas.cols,4);assert.equal(d.atlas.rows,product.id==='set'?5:3);assert.ok(d.prompts.sub2api.includes(d.sections[0].prompt));assert.ok(d.prompts.sub2api.includes(d.sections[4].prompt));assert.ok(d.prompts.sub2api.includes(d.sections[5].prompt));assert.ok(d.prompts.sub2api.includes('Image 2 is fabric B'));assert.ok(!JSON.stringify(d).includes(key));
    if(product.id==='set'){assert.deepEqual(d.sections.slice(1,4).map(s=>s.id),['duvet','surface','pillow']);assert.match(d.sections[1].prompt,/细圆包布绳/)}
    if(product.id==='mattress')assert.match(d.sections[0].prompt,/MATTRESS/);
    if(product.id==='blanket'&&angle==='pillowclose')assert.match(d.sections[4].prompt,/BLANKET BINDING CLOSE-UP/);
  }}
  const input={product:'mattress',fabric:'cotton',fabricMode:'auto',size:'床垫类别：1张薄款绗缝垫，约1～2厘米轻薄夹棉，细浅菱格绗缝、窄平包边，平铺承托，柔软可轻掀垫角；不是厚弹簧床垫或床笠。',scenes:['warm'],angles:['front'],scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image};
  const d=await(await post('/api/admin/preview',{product:'mattress',angle:'front'})).json();assert.equal(d.prompts.sub2api,buildPrompt(validateInput(input),'warm','front',false,0,false,true));assert.equal(requests.length,0);
  for(const q of [{product:'invalid'},{product:'set',setCraft:'invalid'},{product:'set',setPillow:'invalid'},{product:'sheet',variant:'invalid'},{angle:'invalid'},{fabricMode:'invalid'},{hasB:'yes'},{reference:'invalid'},{notes:123},{scale:400}])assert.equal((await post('/api/admin/preview',q)).status,400);
}));
test('reference and uploaded texture preview honors both independent scopes and switches image numbering in source order',async()=>fixture(async({post})=>{
  for(const reference of ['none','both','scene','angle'])for(const fabricMode of ['auto','selected','upload']){
    const d=await(await post('/api/admin/preview',{product:'set',angle:'reverse',hasB:true,hasMaster:true,reference,fabricMode})).json();assert.equal(d.sections.find(s=>s.id==='scene').overridden,['both','scene'].includes(reference));assert.equal(d.sections.find(s=>s.id==='camera').overridden,['both','angle'].includes(reference));assert.equal(d.attachments.includes('当前角度单图参考'),!['both','angle'].includes(reference));assert.match(d.prompts.sub2api,new RegExp(fabricMode==='upload'?'USER-UPLOADED TEXTURE':fabricMode==='selected'?'EXPLICIT USER SELECTION':'UPLOAD-FIRST'));assert.match(d.prompts.zhipu,/实际识图后填入/);
  }
}));
test('pillow craft stays independent from duvet craft in both provider previews, including uploaded references',async()=>fixture(async({post,requests})=>{
  for(const reference of ['none','both','scene','angle']){
    const r=await post('/api/admin/preview',{product:'set',setSheet:'fitted',setCraft:'piping',setPillow:'pillow-wide-flange',reference});assert.equal(r.status,200);const d=await r.json();
    assert.match(d.settings.variantLabel,/被套埋绳款.*床笠款.*枕套宽边款/);
    for(const prompt of Object.values(d.prompts)){assert.match(prompt,/被套所选边缘接缝夹入细圆包布绳/);assert.match(prompt,/仅左右长边和床尾短边加工艺/);assert.match(prompt,/床面部件仅为单层床笠/);assert.match(prompt,/枕套外沿工艺默认四周加工/);assert.match(prompt,/每只枕套在所选边缘向原填芯主体外延伸4～6厘米/);assert.doesNotMatch(prompt,/两只枕套/);}
  }
  assert.equal(requests.length,0);
}));
for(const provider of ['sub2api','zhipu'])test(provider+' request records contain the exact sent prompt and no images or service keys',async()=>fixture(async({base,post,requests})=>{
  assert.deepEqual((await(await fetch(base+'/api/admin/records')).json()).records,[]);
  const response=await post('/api/jobs',{product:'blanket',fabric:'velvet',fabricMode:'auto',size:'普通毛毯',scenes:['warm'],angles:['pillowclose','reverse'],scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'check exact request',plainSheet:false,image});assert.equal(response.status,202);const{id}=await response.json();let job;for(let n=0;n<100;n++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15))}assert.equal(job.status,'done',job.error);
  const data=await(await fetch(base+'/api/admin/records')).json();assert.equal(data.records.length,2);assert.equal(data.sessionOnly,true);assert.ok(data.records.every(r=>!('prompt'in r)));for(const metadata of data.records){const r=await(await fetch(base+'/api/admin/records/'+metadata.id)).json();assert.equal(r.prompt,requests[r.index-1]);assert.equal(r.jobId,id);assert.doesNotMatch(JSON.stringify(r),new RegExp(key+'|data:image|Authorization'));assert.ok(r.angleName!=='枕套特写')}
},provider));
test('sheet request records retain the selected sheet subtype even when the workbench also submits a quilt season',async()=>fixture(async({base,post})=>{
  const response=await post('/api/jobs',{product:'sheet',sheetVariant:'flat',quiltSeason:'winter',fabric:'cotton',fabricMode:'auto',size:'普通床单',scenes:['warm'],angles:['pillowclose'],scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image});assert.equal(response.status,202);const{id}=await response.json();let job;for(let i=0;i<100;i++){job=await(await fetch(base+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15))}assert.equal(job.status,'done');const {records}=await(await fetch(base+'/api/admin/records')).json();assert.equal(records[0].variant,'flat');assert.equal(records[0].angleName,'床单包边特写');
}));
