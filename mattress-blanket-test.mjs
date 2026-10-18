import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as guide from './dist/camera-contract.js';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {sceneDirections} from './photography-prompts.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64'),image='data:image/png;base64,'+png.toString('base64');
const base={fabric:'cotton',fabricMode:'auto',scenes:['warm'],angles:guide.cameraAngleIds,size:'常规比例',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image};
test('mattress replaces the pillow category and both single products have complete square angle examples and matching hover metadata',async()=>{
  const app=await readFile('dist/app.js','utf8'),input=await readFile('dist/camera-input.js','utf8');const draws=[];
  const context=vm.createContext({cameraTools:guide,state:{...base},Image:class{naturalWidth=1448;naturalHeight=1086;async decode(){}},document:{createElement:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args)}),toDataURL:()=>image})}});
  const products=vm.runInContext('('+app.match(/const products=([^\n]+);/)[1]+')',context);assert.ok(products.some(p=>p.id==='mattress'&&p.name==='床垫'));assert.ok(!products.some(p=>p.id==='pillow'));assert.ok(products.some(p=>p.id==='blanket'&&p.name==='毯子'));
  for(const name of ['angleDisplayName','angleSelectorCard'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],context);vm.runInContext(input,context);
  for(const product of ['mattress','blanket']){
    const atlas=guide.cameraAtlasFor({product}),bytes=await readFile('dist/assets/'+atlas.file);
    // Atlases are 4x3 grids (1448x1086) so the 4x3 CSS sprite math holds. Real photography is
    // stored as PNG, or as JPEG when it compresses much smaller; verify whichever format is used.
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))assert.equal(bytes.readUInt32BE(16)*3,bytes.readUInt32BE(20)*4);
    else{assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert.ok(bytes.length>50000,atlas.file);}
    context.state={...base,product};context.opt=context.state;
    const references=await vm.runInContext('prepareCameraReferences(opt)',context);assert.deepEqual(Object.keys(references),guide.cameraAngleIds);
    for(let i=0;i<12;i++){
      const id=guide.cameraAngleIds[i],name=guide.singleProductAngleName(product,id,id);context.angle={id,name:id};context.index=i;
      const card=vm.runInContext('angleSelectorCard(angle,index)',context);assert.ok(card.includes('angle-photo-'+product));assert.ok(card.includes('data-preview-src="/assets/'+atlas.file+'"'));assert.ok(card.includes('data-preview-cols="4"'));assert.ok(card.includes('data-preview-cell="'+i+'"'));assert.ok(card.includes(name));assert.doesNotMatch(card,/angle-photography-atlas|angle-photo-extra|枕套特写/);
      const draw=draws.at(-12+i);assert.deepEqual(draw.slice(1),[(i%4)*362,Math.floor(i/4)*362,362,362,0,0,384,384]);
    }
  }
});
test('all scene-angle and A/B combinations preserve single-product construction, material and product-specific camera requirements',()=>{
  const summary=JSON.stringify({fabricA:'A green floral',fabricB:'B blue checks',sourceTexture:'fine weave',referenceScene:'oak room',referenceAngle:'frontal viewpoint',productDetails:'narrow seams',userTexture:'short matte nap'});
  for(const product of ['mattress','blanket'])for(const hasB of [false,true])for(const scene of Object.keys(sceneDirections))for(const angle of guide.cameraAngleIds){
    const v=validateInput({...base,product,imageB:hasB?image:null,fabricMode:'selected',fabric:product==='mattress'?'jacquard':'velvet'}),prompt=buildPrompt(v,scene,angle,false,0,true,true),compact=buildZhipuPrompt(v,scene,angle,summary),direction=guide.singleProductDirection(product,angle);
    assert.ok(prompt.includes(direction.prompt));assert.ok(compact.includes(direction.zh));assert.ok(compact.length<3500);assert.match(prompt,/MATERIAL MODE: EXPLICIT USER SELECTION/);assert.match(prompt,new RegExp('Setting: \\['+scene+':'));assert.match(prompt,/CAMERA COMPOSITION reference for this exact selected angle/);assert.match(prompt,product==='mattress'?/Exactly ONE (?:THIN QUILTED|THICK SOFT|MODEST-HEIGHT) MATTRESS/:/Exactly ONE UNFILLED BLANKET/);if(product==='mattress')assert.match(prompt,/REQUIRED MATCHING PILLOW PAIR/);else assert.doesNotMatch(prompt,/REQUIRED MATCHING PILLOW PAIR|duvet cover FRONT uses A/);
    assert.match(prompt,hasB?(product==='mattress'?/TOP and ALL SIDEWALLS use original A; actual BOTTOM uses original B/:/FRONT uses original A and actual REVERSE uses original B/):/ENTIRE selected single product/);
    if(angle==='reverse'){assert.match(prompt,product==='mattress'?/MATTRESS PAD CORNER UNDERSIDE/:/BLANKET REVERSE DISPLAY/);assert.doesNotMatch(prompt,/Turn the head-end of the duvet/)}
    if(angle==='drape')assert.match(prompt,product==='mattress'?/MATTRESS PAD SIDE EDGE DISPLAY/:/BLANKET SIDE DRAPE/);
  }
  for(const product of ['mattress','blanket']){
    const v=validateInput({...base,product,imageB:image,referenceImage:image,referenceScene:true,referenceAngle:false,cameraReferences:{reverse:image}}),prompt=buildPrompt(v,'hotel','reverse',false,0,false,true);
    assert.match(prompt,/REFERENCE SCENE ONLY/);assert.ok(prompt.includes(guide.singleProductCameraPrompt(v,'reverse')));
    // The mattress structure ships with a required matching pillow pair; the blanket must never add pillows.
    if(product==='mattress')assert.match(prompt,/REQUIRED MATCHING PILLOW PAIR/);
    else assert.doesNotMatch(prompt,/REQUIRED MATCHING PILLOW PAIR|Full-bed views include the required pair/);
  }
});
async function fixture(provider,fn){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-single-product-'));let expected;
  const references=Object.fromEntries(guide.cameraAngleIds.map((angle,i)=>[angle,'data:image/png;base64,'+Buffer.concat([png,Buffer.from('camera-'+i)]).toString('base64')]));
  const server=createServer({outputDir,service:{provider,apiKey:'synthetic-single-product-key',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},stylingReferencePaths:['does-not-exist.png'],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'A green floral',fabricB:'B blue checks',sourceTexture:'fine weave'})}}]});
    const angle=guide.cameraAngleIds[expected.calls++];
    if(provider==='zhipu'){const request=JSON.parse(init.body);assert.ok(request.prompt.includes(guide.singleProductDirection(expected.product,angle).zh));assert.equal(request.model,'glm-image')}
    else{
      const images=init.body.getAll('image[]'),camera=images.find(i=>i.name==='camera-angle-reference.png'),prompt=init.body.get('prompt');assert.ok(camera);assert.equal(images.length,expected.calls===1?3:4);assert.ok(!images.some(i=>i.name.startsWith('fold-styling-')));assert.deepEqual(Buffer.from(await camera.arrayBuffer()),Buffer.from(references[angle].split(',')[1],'base64'));assert.ok(prompt.includes(guide.singleProductCameraPrompt({product:expected.product},angle)));assert.equal(images[0].name,'fabric-A.png');assert.equal(images[1].name,'fabric-B.png');
    }
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const baseUrl='http://127.0.0.1:'+server.address().port;
  try{await fn({baseUrl,references,setExpected:value=>expected=value})}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-single-product-'));await rm(outputDir,{recursive:true,force:true})}
}
for(const provider of ['sub2api','zhipu'])test(provider+' sends all 12 mattress and blanket angle requests in order without duvet styling or additional pillows',async()=>fixture(provider,async({baseUrl,references,setExpected})=>{
  for(const product of ['mattress','blanket']){
    const expected={product,calls:0};setExpected(expected);const response=await fetch(baseUrl+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,product,imageB:image,cameraReferences:references})});assert.equal(response.status,202);const{id}=await response.json();let job;
    for(let n=0;n<150;n++){job=await(await fetch(baseUrl+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15))}
    assert.equal(job.status,'done',job.error);assert.equal(expected.calls,12);assert.deepEqual(job.results.map(r=>r.angle),guide.cameraAngleIds);
  }
}));
test('four blanket variants keep distinct construction, atlas, angle names and submenu labels',async()=>{
  // Variants reflect the three most common blanket structures in the marketplace category
  // (single-layer fleece, thick milk fleece, double-layer raschel); they must not collapse together.
  const variants=guide.blanketVariantNames;
  assert.deepEqual(Object.keys(variants),['fleece','milk','cloud','gauze']);
  const products=await readFile('dist/blanket-variants.js','utf8');
  const css=await readFile('dist/style.css','utf8');
  for(const [id,name]of Object.entries(variants)){
    assert.match(products,new RegExp("id:'"+id+"',name:'"+name+"'"));
    // The option preview class is built at runtime; the matching style is static in the stylesheet.
    assert.ok(products.includes("picture.className='blanket-variant-preview blanket-variant-preview-'+item.id"));
    const atlas='blanket-'+id+'-angles-v1.'+(id==='gauze'?'png':'jpg');
    assert.ok(css.includes('.blanket-variant-preview-'+id+"{background-image:url('/assets/"+atlas+"')}"),id+' preview style');
    assert.ok(css.includes('.angle-photo-blanket-'+id+"::before{background-image:url('/assets/"+atlas+"')"),id+' angle style');
  }
  const expectedAtlas={fleece:'blanket-fleece-angles-v1.jpg',milk:'blanket-milk-angles-v1.jpg',cloud:'blanket-cloud-angles-v1.jpg',gauze:'blanket-gauze-angles-v1.png'};
  const prompts=new Set(),reverses=new Set();
  for(const [variant,name]of Object.entries(variants)){
    assert.equal(guide.blanketVariant({blanketVariant:variant}),variant);
    const v={product:'blanket',blanketVariant:variant,fabric:'velvet',fabricMode:'auto'};
    const product=guide.singleProductPrompt(v);
    // English prompt for generation; Chinese prompt for the Zhipu text-to-image path.
    assert.match(product,/Exactly ONE UNFILLED BLANKET/);
    assert.ok(guide.singleProductPrompt(v,true).includes(name),name+' in zh prompt');
    const reverse=guide.singleProductDirection('blanket','reverse',v);
    assert.match(reverse.prompt,/BLANKET REVERSE DISPLAY/);
    const hem=guide.singleProductDirection('blanket','pillowclose',v);
    assert.match(hem.prompt,/BLANKET BINDING CLOSE-UP/);
    if(variant==='cloud'){assert.match(hem.prompt,/wide smooth satin bound edge/);assert.match(product,/two plush layers bonded/);}
    if(variant==='milk'){assert.match(hem.prompt,/wide firm bound edge/);assert.match(product,/jacquard check relief/);}
    if(variant==='fleece'){assert.match(hem.prompt,/narrow flat sewn hem/);assert.match(product,/single-layer/);}
    assert.equal(guide.cameraAtlasFor(v).file,expectedAtlas[variant]);
    assert.equal(guide.cameraCellFor(v,'side'),0);assert.equal(guide.cameraCellFor(v,'drape'),11);
    // Every angle name must use the new 毯子 wording rather than the old 毛毯 label.
    for(const angle of guide.cameraAngleIds)assert.ok(!/毛毯/.test(guide.singleProductAngleName('blanket',angle,angle,v)));
    assert.equal(guide.singleProductAngleName('blanket','pillowclose','x',v),'毯子包边特写');
    prompts.add(product);reverses.add(reverse.prompt);
  }
  assert.equal(prompts.size,4);assert.equal(reverses.size,4);
  assert.equal(guide.blanketVariant({}),'fleece');
  assert.equal(guide.blanketVariant({blanketVariant:'nope'}),'fleece');
  const app=await readFile('dist/app.js','utf8');
  assert.match(app,/id:'blanket',name:'毯子'/);
  assert.match(app,/blanketVariant:'fleece',resultBlanketVariant:'fleece'/);
  assert.match(app,/blanketSpecification\(\)/);
});
