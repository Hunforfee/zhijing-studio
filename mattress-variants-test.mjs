import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import * as camera from './dist/camera-contract.js';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {sceneDirections} from './photography-prompts.mjs';
import {sectionScope,createPromptSectionEdits} from './prompt-section-edits.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const png=Buffer.from(image.split(',')[1],'base64');
const base={product:'mattress',fabric:'cotton',fabricMode:'auto',size:'常规比例',scenes:['warm'],angles:camera.cameraAngleIds,scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image};
const types=['thin','padded','foam'],structures={thin:/THIN QUILTED MATTRESS PAD/,padded:/THICK SOFT MATTRESS PAD/,foam:/MODEST-HEIGHT FOAM \/ LATEX STYLE MATTRESS TOPPER/};

test('three mattress subtypes keep construction, A/B and two pillows across all 648 scene-angle combinations',()=>{
  assert.equal(validateInput(base).mattressVariant,'thin');assert.throws(()=>validateInput({...base,mattressVariant:'invalid'}),/床垫款式/);
  for(const mattressVariant of types)for(const hasB of [false,true])for(const scene of Object.keys(sceneDirections))for(const angle of camera.cameraAngleIds){
    const v=validateInput({...base,mattressVariant,imageB:hasB?image:null}),p=buildPrompt(v,scene,angle,false,0,true,true),z=buildZhipuPrompt(v,scene,angle,JSON.stringify({fabricA:'A green print',fabricB:'B blue print',sourceTexture:'matte fine weave'}));
    assert.match(p,structures[mattressVariant]);assert.ok(p.includes(camera.singleProductCameraPrompt(v,angle)));assert.match(p,/REQUIRED MATCHING PILLOW PAIR/);assert.match(z,/2只/);assert.ok(z.includes(camera.singleProductDirection('mattress',angle,v).zh));assert.ok(z.length<3500,z.length);
    assert.match(p,hasB?/TOP and ALL SIDEWALLS use original A; actual BOTTOM uses original B/:/ENTIRE selected single product/);
    assert.match(p,hasB?/pillowcase FRONTS use original fabric A and REVERSES use fabric B/:/Both pillowcases use original fabric A on front, reverse/);
    if(angle==='reverse')assert.match(p,mattressVariant==='foam'?/ON ITS LONG EDGE/:/at least TWO THIRDS remain flat/);
  }
});

test('mattress menu sends its selection, updates labels and all twelve hover cells, and locks during generation',async()=>{
  const app=await readFile('dist/app.js','utf8'),menu=await readFile('dist/mattress-variants.js','utf8');
  const c=vm.createContext({cameraTools:camera,state:{...base},fabrics:{cotton:['细密哑光']},$:id=>({value:{scale:'100',direction:'0',repeat:'tile',ratio:'1:1',notes:''}[id]})});
  vm.runInContext(menu.split('const mattressVariantPanel=')[0],c);
  for(const name of ['options','angleDisplayName','angleSelectorCard','resultAngleLabel'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],c);
  assert.equal(vm.runInContext('currentMattressVariant().id',c),'thin');
  for(const mattressVariant of types){
    c.state.mattressVariant=mattressVariant;const opt=vm.runInContext('options()',c);assert.equal(opt.mattressVariant,mattressVariant);assert.ok(opt.size.length<=100);const atlas=camera.cameraAtlasFor(opt),bytes=await readFile('dist/assets/'+atlas.file);assert.ok(Math.abs(bytes.readUInt32BE(16)*3-bytes.readUInt32BE(20)*4)<=8,'4:3 atlas within one-pixel rounding');
    for(let i=0;i<12;i++){c.angle={id:camera.cameraAngleIds[i],name:'test'};c.index=i;const card=vm.runInContext('angleSelectorCard(angle,index)',c);assert.ok(card.includes('angle-photo-mattress-'+mattressVariant));assert.ok(card.includes('data-preview-src="/assets/'+atlas.file+'"'));assert.ok(card.includes('data-preview-cell="'+i+'"'));assert.ok(card.includes(camera.singleProductAngleName('mattress',c.angle.id,'test',opt)));}
  }
  let renders=0;c.mattressVariantPanel={querySelectorAll:()=>[]};c.renderMattressVariantControl=()=>{};c.renderSelections=()=>renders++;vm.runInContext(menu.match(/function selectMattressVariant\([^\n]+/)[0],c);vm.runInContext("selectMattressVariant('padded')",c);assert.equal(c.state.mattressVariant,'padded');assert.equal(renders,1);
  c.state.busy=true;vm.runInContext("selectMattressVariant('foam')",c);assert.equal(c.state.mattressVariant,'padded');c.state.busy=false;c.state.product='set';vm.runInContext("selectMattressVariant('thin')",c);assert.equal(c.state.mattressVariant,'padded');
});

test('saved mattress product and camera edits remain isolated by selected subtype',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-mattress-scope-'));try{
    const store=createPromptSectionEdits(path.join(dir,'edits.json'));
    for(const id of ['product','size','camera','placement']){
      await store.save({scope:sectionScope({...base,mattressVariant:'thin'},'warm','front',id),prompt:'thin-only-'+id,version:null});
      assert.equal((await store.resolve({...base,mattressVariant:'thin'},'warm','front'))[id],'thin-only-'+id);
      for(const mattressVariant of ['padded','foam'])assert.equal((await store.resolve({...base,mattressVariant},'warm','front'))[id],undefined);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

for(const provider of ['sub2api','zhipu'])test(provider+' generates and archives the correct subtype for each of twelve angles',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-mattress-request-'));let current,calls=0;
  const references=Object.fromEntries(camera.cameraAngleIds.map((angle,i)=>[angle,'data:image/png;base64,'+Buffer.concat([png,Buffer.from('pose-'+i)]).toString('base64')]));
  const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider,apiKey:'synthetic-key',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'A green',fabricB:'B blue',sourceTexture:'fine weave'})}}]});
    const angle=camera.cameraAngleIds[calls++];
    if(provider==='sub2api'){
      const p=init.body.get('prompt'),cameraImage=init.body.getAll('image[]').find(x=>x.name==='camera-angle-reference.png');assert.match(p,structures[current]);assert.ok(p.includes(camera.singleProductCameraPrompt({...base,mattressVariant:current},angle)));assert.match(p,/REQUIRED MATCHING PILLOW PAIR/);assert.ok(cameraImage);assert.deepEqual(Buffer.from(await cameraImage.arrayBuffer()),Buffer.from(references[angle].split(',')[1],'base64'));
    }else{const p=JSON.parse(init.body).prompt;assert.ok(p.includes(camera.singleProductDirection('mattress',angle,{mattressVariant:current}).zh));assert.match(p,/2只/);}
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{
    const catalog=await(await fetch(url+'/api/admin/catalog')).json();assert.deepEqual(catalog.variants.mattress.map(x=>x.id),types);
    for(const mattressVariant of types){current=mattressVariant;calls=0;const r=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,mattressVariant,imageB:image,cameraReferences:references})});assert.equal(r.status,202);const {id}=await r.json();let job;
      for(let n=0;n<150;n++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}
      assert.equal(job.status,'done',job.error);assert.equal(calls,12);assert.ok(job.results.every(x=>x.mattressVariant===mattressVariant));
    }
    const history=await(await fetch(url+'/api/history')).json();assert.equal(history.images.length,36);assert.ok(types.every(t=>history.images.filter(x=>x.mattressVariant===t).length===12));
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
