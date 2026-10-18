import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {setCameraDirections,cameraAngleIds,cameraAtlases,cameraAtlasFor,cameraCellFor,matAngleName} from './dist/camera-contract.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const png=Buffer.from(image.split(',')[1],'base64');
const app=await readFile('dist/app.js','utf8');
const matSource=await readFile('dist/mat-variants.js','utf8');
const base={product:'set',fabric:'cotton',fabricMode:'selected',scenes:['warm'],angles:cameraAngleIds,size:'常规比例',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image};
test('same atlas mapping drives thumbnails and square camera input for fourteen product variants',async()=>{
  const source=await readFile('dist/camera-input.js','utf8');
  const crops=[];let loads=0;
  const context=vm.createContext({cameraTools:{cameraAtlasFor,cameraCellFor,matAngleName},Image:class{naturalWidth=1448;naturalHeight=1086;async decode(){loads++}},document:{createElement:()=>({getContext:()=>({drawImage:(...args)=>crops.push(args)}),toDataURL:()=>image})},state:{...base},angles:cameraAngleIds.map(id=>({id,name:id})),fabrics:{cotton:['细密哑光']},$:id=>({value:{scale:'100',direction:'0',repeat:'tile',ratio:'1:1',notes:''}[id]})});
  vm.runInContext(source,context);for(const name of ['angleDisplayName','angleSelectorCard'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],context);
  for(const [product,variant]of [['set',null],['quilt','winter'],['quilt','summer'],['sheet','flat'],['sheet','fitted'],['sheet','quilted'],['mat','ice'],['mat','rattan'],['mat','bamboo'],['mattress',null],['blanket','fleece'],['blanket','milk'],['blanket','cloud'],['sleepbag','travel']]){
    context.opt={...base,product,fabric:product==='mat'?variant:base.fabric,quiltSeason:product==='quilt'?variant:undefined,sheetVariant:product==='sheet'?variant:undefined,blanketVariant:product==='blanket'?variant:undefined};context.state=context.opt;const atlas=cameraAtlasFor(context.opt);assert.ok((await stat('dist/assets/'+atlas.file)).size>1000);
    const references=await vm.runInContext('prepareCameraReferences(opt)',context);assert.deepEqual(Object.keys(references),cameraAngleIds);
    for(let i=0;i<12;i++){const c=crops.at(-12+i),cell=cameraCellFor(context.opt,cameraAngleIds[i]);assert.equal(c[0].src,'/assets/'+atlas.file);assert.deepEqual(c.slice(1),[(cell%4)*362,Math.floor(cell/4)*(1086/(atlas.rows||3)),362,1086/(atlas.rows||3),0,0,384,384]);context.angle=context.angles[i];context.index=i;const card=vm.runInContext('angleSelectorCard(angle,index)',context);assert.ok(card.includes('background-position:'+((cell%4)*100/3)+'% '+(Math.floor(cell/4)*100/((atlas.rows||3)-1))+'%'));if(product==='set')assert.match(card,/angle-photo-set-framed/);}
  }
  context.opt={...base,product:'mat',fabric:'bamboo',referenceGuided:true};assert.equal(await vm.runInContext('prepareCameraReferences(opt)',context),undefined);context.opt={...base,product:'pillow'};assert.equal(await vm.runInContext('prepareCameraReferences(opt)',context),undefined);assert.equal(loads,14);
  const initial=app.match(/const state=([^\n]+);/)[1];context.angles=cameraAngleIds.map(id=>({id}));const defaults=vm.runInContext('('+initial+')',context);assert.deepEqual(Array.from(defaults.scenes),['warm']);assert.deepEqual(Array.from(defaults.angles),[cameraAngleIds[0]]);
});
test('camera inputs validate selected angle and PNG limits, and user reference excludes automatic pose',()=>{
  const selected=validateInput({...base,cameraReferences:{side:image,front:image}});assert.deepEqual(selected.cameraReferenceBytes.side,png);
  for(const cameraReferences of [[],{side:'https://example.test/photo.png'},{unknown:image},{side:'data:image/png;base64,YmFk'}])assert.throws(()=>validateInput({...base,cameraReferences}),/机位参考/);
  const tooLarge=Buffer.concat([png,Buffer.alloc(1024*1024)]);assert.throws(()=>validateInput({...base,cameraReferences:{side:'data:image/png;base64,'+tooLarge.toString('base64')}}),/1 MB/);
  assert.throws(()=>validateInput({...base,angles:['side'],cameraReferences:{front:image}}),/机位参考/);
  const manual=validateInput({...base,referenceImage:image,cameraReferences:{side:image}});assert.deepEqual(manual.cameraReferenceBytes,{});assert.doesNotMatch(buildPrompt(manual,'warm','side',false,0,true,true),/CAMERA COMPOSITION AND PILLOW-PLACEMENT/);
  for(const sheetVariant of ['fitted','quilted']){const corner=buildPrompt(validateInput({...base,product:'sheet',sheetVariant}),'warm','reverse');assert.match(corner,/FITTED CORNER DISPLAY/);assert.match(corner,/EDITING SPACE FOR DETAILS/);assert.doesNotMatch(corner,/Main-product footprint/);}
  for(const product of ['set','quilt','sheet'])for(const imageB of [null,image]){const v=validateInput({...base,product,imageB});for(const angle of cameraAngleIds){const p=buildPrompt(v,'warm',angle,false,0,true,true);assert.match(p,/include exactly TWO standard rectangular sleeping pillows/);assert.match(p,imageB?/pillowcase FRONTS use original fabric A and REVERSES use fabric B/:/Both pillowcases use original fabric A on front, reverse/);assert.match(p,product==='set'?(setCameraDirections[angle].full?/65-75%/:/50-65%/):angle==='wide'?/40-50%/:['detail','foot','pillowclose','drape'].includes(angle)?/50-65%/:/60-70%/);assert.doesNotMatch(p,/No accessory pillows|No pillows needed|without adding pillowcases|No duvet, blanket, pillowcases/);}}
});
test('editing requests attach only current angle and correctly number A/B, folds, master, camera and texture',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-camera-test-'));let calls=0;
  const references=Object.fromEntries(cameraAngleIds.map((id,i)=>[id,'data:image/png;base64,'+Buffer.concat([png,Buffer.from('angle:'+i)]).toString('base64')]));
  const server=createServer({firstImageReview:false,service:{provider:'sub2api',apiKey:'synthetic-camera-test-key',baseUrl:'https://example.test/v1',model:'test-image'},outputDir,stylingReferencePaths:['styling-references/relaxed-fold-1.png','styling-references/relaxed-fold-2.png'],fetchImpl:async(url,init)=>{
    const angle=['front',...cameraAngleIds.filter(id=>id!=='front')][calls],images=init.body.getAll('image[]'),prompt=init.body.get('prompt');const fold=angle==='reverse'?2:0,master=calls>0?1:0,cameraIndex=2+fold+master;
    assert.equal(images.length,cameraIndex+2);assert.equal(images[0].name,'fabric-A.png');assert.equal(images[1].name,'fabric-B.png');assert.equal(images[cameraIndex].name,'camera-angle-reference.png');assert.equal(images.at(-1).name,'selected-texture.png');assert.deepEqual(Buffer.from(await images[cameraIndex].arrayBuffer()),Buffer.from(references[angle].split(',')[1],'base64'));
    assert.match(prompt,new RegExp('Image '+(cameraIndex+1)+' is a CAMERA COMPOSITION AND PILLOW-PLACEMENT reference for this exact selected angle '+angle));assert.match(prompt,new RegExp('Image '+images.length+' is TEXTURE-ONLY'));assert.match(prompt,/NEVER copy its demonstration product color/);assert.match(prompt,/do not blend its botanical flowers/);assert.match(prompt,/Preserve the CURRENT requested scene/);if(fold)assert.match(prompt,/Images 3 and 4 are STYLING-ONLY/);if(master)assert.match(prompt,new RegExp('Image '+(3+fold)+' is the first product photograph'));calls++;return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,imageB:image,cameraReferences:references})});assert.equal(response.status,202);const {id}=await response.json();let job;for(let i=0;i<150;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20))}assert.equal(job.status,'done',job.error);assert.equal(calls,12);assert.equal(job.results.length,12);}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-camera-test-'));await rm(outputDir,{recursive:true,force:true})}
});

test('choosing a mat subtype refreshes all twelve previews and returning from a set preserves the mat choice',()=>{
  const source=app.match(/document\.addEventListener\('click',e=>\{const mt=[^\n]+/)[0];
  let click,refreshes=0,closed=0;
  const select={value:'ice',dispatchEvent(){select.onchange()}};
  const context=vm.createContext({cameraTools:{cameraAtlasFor,cameraCellFor,matAngleName},angles:cameraAngleIds.map(id=>({id})),state:{product:'set',fabric:'cotton',fabricMode:'auto',matVariant:null,angles:['side','drape'],busy:false},products:[{id:'set',fabrics:['cotton']},{id:'mat',fabrics:['ice','rattan','bamboo']}],document:{addEventListener(type,fn){click=fn}},$:()=>select,renderOptions(){select.value=context.state.fabricMode==='selected'?context.state.fabric:'auto'},renderSelections(){refreshes++},showMatStructure(){},resetGalleryToReference(){},updateFabric(){},closeMatVariants(){closed++},toast(){},Event:class{}});
  vm.runInContext(source,context);
  select.onchange=vm.runInContext(app.match(/\$\('fabric'\)\.onchange=([^\n]+?);\$\('scale'\)/)[1],context);
  for(const name of ['angleDisplayName','angleSelectorCard'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],context);
  vm.runInContext(matSource.split('const matVariantPanel=')[0]+matSource.match(/function selectMatVariant\([^\n]+/)[0],context);
  vm.runInContext(app.match(/function availableAngles\(\)\{[^\n]+/)[0],context);
  const switchProduct=id=>click({target:{closest:selector=>selector==='[data-product]'?{dataset:{product:id}}:null}});
  switchProduct('mat');assert.equal(cameraAtlasFor(context.state).file,'mat-ice-angles-v1.png');
  // Exercise the actual flyout selection and its native select-change dispatch.
  for(const variant of ['ice','rattan','bamboo']){
    context.variant=variant;vm.runInContext('selectMatVariant(variant)',context);
    assert.equal(cameraAtlasFor(context.state).file,'mat-'+variant+'-angles-v1.png');
    for(let i=0;i<12;i++){context.angle={id:cameraAngleIds[i],name:'default-'+cameraAngleIds[i]};context.index=i;const card=vm.runInContext('angleSelectorCard(angle,index)',context);assert.match(card,new RegExp('angle-photo-mat-'+variant));assert.match(card,new RegExp('data-preview-src="/assets/mat-'+variant+'-angles-v1.png"'));assert.doesNotMatch(card,/angle-photography-atlas|angle-photo-extra/);}
  }
  assert.equal(closed,3);
  switchProduct('set');assert.equal(cameraAtlasFor(context.state).file,cameraAtlases.set.file);switchProduct('mat');assert.equal(context.state.fabric,'bamboo');assert.equal(cameraAtlasFor(context.state).file,'mat-bamboo-angles-v1.png');assert.deepEqual(Array.from(context.state.angles),['side','drape']);assert.ok(refreshes>=6);
  context.state.busy=true;const before=refreshes;switchProduct('set');assert.equal(context.state.product,'mat');assert.equal(refreshes,before);
});

test('mat subtype prompts and editing requests use matching mat geometry and exactly the selected camera image',async()=>{
  for(const fabric of ['ice','rattan','bamboo']){
    for(const imageB of [null,image])for(const angle of cameraAngleIds){
      const v=validateInput({...base,product:'mat',fabric,imageB,cameraReferences:{[angle]:image}}),prompt=buildPrompt(v,'warm',angle,false,0,false,true);
      assert.match(prompt,/REQUIRED MAT PILLOW PAIR/);assert.match(prompt,/exactly TWO low-profile rectangular/);assert.match(prompt,/Keep the mat thin and flat/);assert.match(prompt,imageB?/EXACT MAT A\/B assignment/:/ENTIRE single mat top, underside/);assert.doesNotMatch(prompt,/duvet cover FRONT uses A|bedspread hem|gravity-driven hanging drape/);
      if(angle==='reverse'){assert.match(prompt,/MAT UNDERSIDE DISPLAY/);assert.match(prompt,/EDITING SPACE FOR DETAILS/);assert.match(prompt,fabric==='bamboo'?/Hard bamboo slats remain straight and rigid/:fabric==='rattan'?/Firm woven rattan forms a restrained broad curve/:/thin flexible ice-silk corner/);assert.doesNotMatch(prompt,/Turn the head-end of the duvet back/);}
      if(angle==='drape')assert.match(prompt,/MAT SIDE BINDING DISPLAY/);
      if(angle==='pillowclose')assert.match(prompt,/MATCHING MAT PILLOWCASE VIEW/);
      if(angle==='detail')assert.match(prompt,/MAT SURFACE TEXTURE VIEW/);
    }
    const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-mat-camera-test-'));let calls=0;
    const references=Object.fromEntries(cameraAngleIds.map((id,i)=>[id,'data:image/png;base64,'+Buffer.concat([png,Buffer.from(fabric+':'+i)]).toString('base64')]));
    const server=createServer({firstImageReview:false,service:{provider:'sub2api',apiKey:'synthetic-mat-test-key',baseUrl:'https://example.test/v1',model:'test-image'},outputDir,fetchImpl:async(url,init)=>{
      const angle=cameraAngleIds[calls],images=init.body.getAll('image[]'),prompt=init.body.get('prompt'),cameraIndex=2+(calls>0?1:0);
      assert.equal(images.length,cameraIndex+1);assert.equal(images[cameraIndex].name,'camera-angle-reference.png');assert.deepEqual(Buffer.from(await images[cameraIndex].arrayBuffer()),Buffer.from(references[angle].split(',')[1],'base64'));assert.match(prompt,new RegExp('Image '+(cameraIndex+1)+' is a CAMERA COMPOSITION AND PILLOW-PLACEMENT reference for this exact selected angle '+angle));assert.match(prompt,/REQUIRED MAT PILLOW PAIR/);assert.doesNotMatch(prompt,/STYLING-ONLY/);calls++;return Response.json({data:[{b64_json:png.toString('base64')}]});
    }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
    try{const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,product:'mat',fabric,imageB:image,cameraReferences:references})});assert.equal(response.status,202);const {id}=await response.json();let job;for(let i=0;i<150;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20))}assert.equal(job.status,'done',job.error);assert.equal(calls,12);assert.equal(job.results.length,12);}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-mat-camera-test-'));await rm(outputDir,{recursive:true,force:true})}
  }
});

