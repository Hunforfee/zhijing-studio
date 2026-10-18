import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer,validateInput,buildPrompt} from './server.mjs';
import {materialPriority} from './material-priority.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const image='data:image/png;base64,'+png.toString('base64'),texture=Buffer.concat([png,Buffer.from('independent-texture')]),textureImage='data:image/png;base64,'+texture.toString('base64');
const base={product:'set',fabric:'cotton',fabricMode:'auto',size:'参考图款式',scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'',image,scenes:['hotel','studio'],angles:['side','top','reverse']};
const app=await readFile('dist/app.js','utf8'),reference=await readFile('dist/shooting-reference.js','utf8'),picker=await readFile('dist/fabric-picker.js','utf8'),camera=await readFile('dist/camera-input.js','utf8');

test('reference scope and custom texture inputs validate independently and preserve the unselected dimension',()=>{
  for(const [referenceScene,referenceAngle]of [[true,true],[true,false],[false,true]])for(const product of ['set','sheet','quilt','mat','pillow','blanket']){
    const cameraAvailable=['set','sheet','quilt','mat'].includes(product);
    const input={...base,product,fabric:product==='mat'?'bamboo':product==='blanket'?'velvet':'cotton',referenceImage:image,referenceScene,referenceAngle,textureReferenceImage:textureImage,cameraReferences:cameraAvailable?{side:image}:undefined},v=validateInput(input),prompt=buildPrompt(v,'hotel','side',false,0,true,cameraAvailable&&!referenceAngle);
    assert.equal(v.referenceScene,referenceScene);assert.equal(v.referenceAngle,referenceAngle);assert.equal(v.textureSource,'upload');assert.deepEqual(v.textureReferenceBytes,texture);assert.equal(Object.keys(v.cameraReferenceBytes).length,referenceAngle||!cameraAvailable?0:1);assert.match(prompt,/MATERIAL MODE: USER-UPLOADED TEXTURE/);assert.match(prompt,/NEVER copy or blend the texture reference print/);
    if(referenceScene&&referenceAngle){assert.match(prompt,/overrides menu scene, menu camera/);assert.doesNotMatch(prompt,/MENU SCENE|MENU CAMERA/);}
    else if(referenceScene){assert.match(prompt,/REFERENCE SCENE ONLY/);assert.match(prompt,/MENU CAMERA \[side:/);assert.match(prompt,/45-degree[^.]*three-quarter/);assert.doesNotMatch(prompt,/MENU SCENE \[hotel\]|dark walnut hotel bedroom/);}
    else{assert.match(prompt,/REFERENCE ANGLE ONLY/);assert.match(prompt,/MENU SCENE \[hotel\]/);assert.match(prompt,/dark walnut hotel bedroom/);assert.doesNotMatch(prompt,/MENU CAMERA|CAMERA COMPOSITION AND PILLOW-PLACEMENT/);}
  }
  const defaults=validateInput({...base,referenceImage:image});assert.equal(defaults.referenceScene,true);assert.equal(defaults.referenceAngle,true);
  for(const invalid of [{referenceScene:'yes'},{referenceAngle:1},{referenceScene:false,referenceAngle:false}])assert.throws(()=>validateInput({...base,referenceImage:image,...invalid}),/参考范围|至少选择/);
  assert.throws(()=>validateInput({...base,referenceScene:true}),/参考图/);
  for(const invalid of [{textureSource:'bad'},{textureSource:'upload'},{textureSource:'library',textureReferenceImage:textureImage},{textureReferenceImage:'https://example.test/texture.png'},{textureReferenceImage:'data:image/png;base64,'+Buffer.alloc(30).toString('base64')}])assert.throws(()=>validateInput({...base,...invalid}),/质感/);
  assert.throws(()=>validateInput({...base,textureReferenceImage:'data:image/png;base64,'+Buffer.concat([png,Buffer.alloc(10*1024*1024)]).toString('base64')}),/10 MB/);
  assert.match(materialPriority(validateInput({...base,textureReferenceImage:textureImage,fabricMode:'selected',fabric:'brushed'}),'brushed cotton',4),/Image 4 is TEXTURE-ONLY reference uploaded by the user/);
  assert.doesNotMatch(materialPriority(validateInput({...base,textureReferenceImage:textureImage,fabricMode:'selected',fabric:'brushed'}),'brushed cotton',4),/Highest authority for surface texture is the selected material: brushed/);
});

function frontend(){
  const nodes=new Map(),sceneButtons=[{},{}],angleButtons=[{},{},{}],revoked=[],messages=[],loads=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,checked:false,value:{scale:'100',direction:'0',repeat:'tile',ratio:'1:1',notes:'客户要求'}[id]||'',attributes:new Map(),classList:{values:new Set(),toggle(name,value){value?this.values.add(name):this.values.delete(name)},add(){},remove(){}},setAttribute(k,v){this.attributes.set(k,v)},getAttribute(k){return this.attributes.get(k)},removeAttribute(k){this.attributes.delete(k)},querySelector(){return node(id+'-strong')},querySelectorAll(){return []},click(){}});return nodes.get(id)};
  const context=vm.createContext({localModelTools:null,fixedEngineSelected:()=>false,state:{...base,referenceUpload:null,referencePattern:null,referenceScene:true,referenceAngle:true,textureSource:'library',textureUpload:null,texturePattern:null,ready:true,mode:'ai',service:{},busy:false},fabrics:{cotton:['细密哑光']},$:node,document:{querySelector:node,querySelectorAll:selector=>selector==='[data-scene]'?sceneButtons:selector==='[data-angle]'?angleButtons:[]},toast:text=>messages.push(text),refreshLastPatternButton(){},refreshPatternProof(){},renderSelections(){context.syncReferenceShootingControls();context.updateCount()},URL:{createObjectURL:file=>'blob:'+file.name,revokeObjectURL:url=>revoked.push(url)},Image:class{naturalWidth=800;naturalHeight=600;decode(){return new Promise((resolve,reject)=>loads.push({resolve,reject}))}},modal(){},Event:class{}});
  for(const name of ['options','referencePlanDescription','resultSceneLabel','resultAngleLabel'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],context);
  vm.runInContext(app.match(/function updateCount\(\)\{[\s\S]*?\n\}/)[0],context);
  vm.runInContext(reference.slice(0,reference.indexOf('function anglePreviewPlacement')),context);
  vm.runInContext(picker.slice(0,picker.indexOf('(() => {')),context);
  return {context,node,sceneButtons,angleButtons,revoked,messages,loads};
}
const file=name=>({name,type:'image/png',size:200});
test('reference upload defaults to both, toggles unlock only the menu dimension in use and keep counts and prior selections',async()=>{
  const f=frontend(),s=f.context.state,pending=f.context.uploadShootingReference(file('scene.png'));f.loads[0].resolve();await pending;
  assert.equal(s.referenceScene,true);assert.equal(s.referenceAngle,true);assert.ok(f.sceneButtons.every(b=>b.disabled));assert.ok(f.angleButtons.every(b=>b.disabled));assert.equal(f.node('count').textContent,1);
  assert.equal(f.node('referenceUploadedPanel').hidden,false);
  f.node('referenceAngle').checked=false;f.context.changeReferenceScope();assert.equal(s.referenceScene,true);assert.equal(s.referenceAngle,false);assert.ok(f.sceneButtons.every(b=>b.disabled));assert.ok(f.angleButtons.every(b=>!b.disabled));assert.equal(f.node('count').textContent,3);assert.match(f.node('referenceModeHint').textContent,/3 个自选角度/);
  s.angles=[];f.context.updateCount();assert.equal(f.node('count').textContent,0);assert.equal(f.node('generateBtn').disabled,true);s.angles=['side','top','reverse'];
  f.node('referenceScene').checked=false;f.context.changeReferenceScope();assert.equal(s.referenceScene,true,'cannot uncheck both');assert.equal(f.node('referenceScene').checked,true);
  f.node('referenceAngle').checked=true;f.context.changeReferenceScope();f.node('referenceScene').checked=false;f.context.changeReferenceScope();assert.ok(f.sceneButtons.every(b=>!b.disabled));assert.ok(f.angleButtons.every(b=>b.disabled));assert.equal(f.node('count').textContent,2);
  s.busy=true;f.node('referenceAngle').checked=false;f.context.changeReferenceScope();assert.equal(s.referenceAngle,true);assert.equal(f.node('referenceAngle').checked,true);s.busy=false;
  const replacement=f.context.uploadShootingReference(file('replacement.png'));f.loads[1].resolve();await replacement;assert.equal(s.referenceScene,true);assert.equal(s.referenceAngle,true);assert.ok(f.revoked.includes('blob:scene.png'));
  f.context.clearShootingReference();assert.equal(f.node('referenceScopeControls').hidden,true);assert.equal(f.node('count').textContent,6);assert.deepEqual(Array.from(s.scenes),['hotel','studio']);assert.deepEqual(Array.from(s.angles),['side','top','reverse']);
  assert.equal(f.node('referenceUploadedPanel').hidden,true);
});

test('custom texture upload switches source, library restores its choice and stale uploads cannot overwrite a later source choice',async()=>{
  const f=frontend(),s=f.context.state;s.fabricMode='selected';s.fabric='cotton';f.context.chooseTextureSource('upload');assert.equal(f.node('textureLibraryControl').hidden,true);assert.equal(f.node('generateBtn').disabled,true);
  const pending=f.context.uploadTextureReference(file('long-file-name-texture.png'));f.loads[0].resolve();await pending;assert.equal(s.textureSource,'upload');assert.equal(f.node('generateBtn').disabled,false);assert.equal(f.node('textureUploadName').title,'long-file-name-texture.png');let opt=f.context.options();assert.equal(opt.fabricMode,'auto');assert.equal(opt.textureSource,'upload');assert.doesNotMatch(opt.notes,/所选质感为视觉特征/);
  f.context.chooseTextureSource('library');opt=f.context.options();assert.equal(opt.fabricMode,'selected');assert.equal(opt.textureSource,'library');assert.equal(s.textureUpload.file.name,'long-file-name-texture.png');assert.equal(f.node('textureCustomControl').hidden,true);
  const stale=f.context.uploadTextureReference(file('stale.png'));f.context.chooseTextureSource('library');f.loads[1].resolve();await stale;assert.equal(s.textureSource,'library');assert.ok(f.revoked.includes('blob:stale.png'));
  s.busy=true;f.context.chooseTextureSource('upload');assert.equal(s.textureSource,'library');f.context.renderTextureControl();assert.equal(f.node('textureUploadBtn').disabled,true);s.busy=false;
  f.context.chooseTextureSource('upload');f.context.clearTextureReference();assert.equal(s.texturePattern,null);assert.equal(s.textureSource,'library');assert.ok(f.revoked.includes('blob:long-file-name-texture.png'));
});

test('camera examples stay available for scene-only references and are skipped only when user angle is authoritative',async()=>{
  let loads=0;const context=vm.createContext({Image:class{naturalWidth=1448;naturalHeight=1086;async decode(){loads++}},cameraTools:{cameraAtlasFor:()=>({file:'set-framed-angles-v2-printed.png'}),cameraCellFor:()=>0},document:{createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=>image})}});vm.runInContext(camera,context);
  for(const referenceAngle of [false,true]){context.opt={...base,referenceGuided:true,referenceScene:true,referenceAngle};const result=await vm.runInContext('prepareCameraReferences(opt)',context);assert.equal(result===undefined,referenceAngle);}assert.equal(loads,1);
});

test('real job batches keep reference scopes, attach current camera and independent texture in the correct image order',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-ref-options-test-'));let expected,currentCalls=0;
  const references=Object.fromEntries(['side','top','reverse'].map((id,i)=>[id,'data:image/png;base64,'+Buffer.concat([png,Buffer.from('camera:'+i)]).toString('base64')]));
  const server=createServer({firstImageReview:false,service:{provider:'sub2api',apiKey:'synthetic-options-test-key',baseUrl:'https://example.test/v1',model:'test-image'},outputDir,fetchImpl:async(url,init)=>{
    const {scene,angle}=expected.pairs[currentCalls],images=init.body.getAll('image[]'),prompt=init.body.get('prompt'),hasRef=!!expected.input.referenceImage,hasB=!!expected.input.imageB,master=currentCalls>0,hasCamera=!expected.input.referenceAngle,fold=!hasRef&&angle==='reverse'?2:0;
    const names=[...(hasRef?['user-photographic-reference.png']:[]),'fabric-A.png',...(hasB?['fabric-B.png']:[]),...Array.from({length:fold},(_,i)=>'fold-styling-'+(i+1)+'.png'),...(hasCamera?['camera-angle-reference.png']:[]),'uploaded-texture-reference.png'];
    assert.deepEqual(images.map(i=>i.name),names);assert.deepEqual(Buffer.from(await images.at(-1).arrayBuffer()),texture);assert.match(prompt,new RegExp('Image '+images.length+' is TEXTURE-ONLY reference uploaded by the user'));assert.match(prompt,/MATERIAL MODE: USER-UPLOADED TEXTURE/);
    if(hasCamera){assert.deepEqual(Buffer.from(await images.at(-2).arrayBuffer()),Buffer.from(references[angle].split(',')[1],'base64'));assert.match(prompt,new RegExp('Image '+(images.length-1)+' is a CAMERA COMPOSITION'));}
    if(hasRef&&expected.input.referenceScene&&!expected.input.referenceAngle){assert.match(prompt,new RegExp('MENU CAMERA \\['+angle+':'));assert.doesNotMatch(prompt,/dark walnut hotel bedroom|seamless solid ivory cyclorama/);}
    if(hasRef&&!expected.input.referenceScene){assert.match(prompt,new RegExp('MENU SCENE \\['+scene+'\\]'));assert.match(prompt,scene==='hotel'?/dark walnut hotel bedroom/:/seamless solid ivory cyclorama/);}
    currentCalls++;return Response.json({data:[{b64_json:png.toString('base64')}]});
  }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{
    for(const mode of ['both','scene','angle','no-reference']){
      const hasRef=mode!=='no-reference',referenceScene=mode==='both'||mode==='scene',referenceAngle=mode==='both'||mode==='angle';
      const input={...base,angles:mode==='no-reference'?['side','reverse']:['side','top'],referenceImage:hasRef?image:null,referenceScene,referenceAngle,imageB:mode==='angle'?null:image,textureSource:'upload',textureReferenceImage:textureImage,cameraReferences:references};
      input.cameraReferences=Object.fromEntries(input.angles.map(id=>[id,references[id]]));expected={input,pairs:(referenceScene?input.scenes.slice(0,1):input.scenes).flatMap(scene=>(referenceAngle?input.angles.slice(0,1):input.angles).map(angle=>({scene,angle})))};currentCalls=0;
      const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,202);const {id}=await response.json();let job;for(let i=0;i<120;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20))}assert.equal(job.status,'done',job.error);assert.equal(currentCalls,expected.pairs.length);assert.deepEqual(job.results.map(({scene,angle})=>({scene,angle})),expected.pairs);assert.ok(job.results.every(r=>r.referenceScene===referenceScene&&r.referenceAngle===referenceAngle&&r.textureSource==='upload'));
    }
  }finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-ref-options-test-'));await rm(outputDir,{recursive:true,force:true})}
});

test('vision-based provider distinguishes fabric, scoped photograph and custom texture without mixing their roles',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-ref-vision-test-'));let visionCalls=0,generationCalls=0;
  const server=createServer({firstImageReview:false,service:{provider:'zhipu',apiKey:'synthetic-vision-options-test',baseUrl:'https://example.test/v1',model:'glm-image'},outputDir,lookupImpl:async()=>[{address:'8.8.8.8',family:4}],fetchImpl:async(url,init)=>{
    if(url.endsWith('/chat/completions')){
      visionCalls++;const request=JSON.parse(init.body),content=request.messages[0].content,text=content.at(-1).text;
      assert.equal(content.length,4);assert.equal(content[0].image_url.url,png.toString('base64'));assert.equal(content[1].image_url.url,png.toString('base64'));assert.equal(content[2].image_url.url,texture.toString('base64'));assert.match(text,/Image 2 is a SEPARATE photographic reference/);assert.match(text,/Ignore its viewpoint and crop/);assert.match(text,/Image 3 is a separate TEXTURE-ONLY reference/);assert.match(text,/Ignore and do not describe its print, base color/);return Response.json({choices:[{message:{content:'FABRIC A: original small blue flowers on white. REFERENCE SCENE: oak room with side daylight. USER TEXTURE: short dense brushed nap, matte response.'}}]});
    }
    if(url.endsWith('/images/generations')){const request=JSON.parse(init.body);assert.match(request.prompt,new RegExp('拍摄角度 \\['+['side','top'][generationCalls]+'\\]'));assert.match(request.prompt,/场景优先按参考照片/);assert.match(request.prompt,/质感优先按独立上传的质感参考/);assert.match(request.prompt,/USER TEXTURE: short dense brushed nap/);generationCalls++;return Response.json({data:[{url:'https://cdn.example.test/reference-result.png'}]});}
    return new Response(png);
  }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{const response=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...base,angles:['side','top'],referenceImage:image,referenceScene:true,referenceAngle:false,textureSource:'upload',textureReferenceImage:textureImage})});assert.equal(response.status,202);const {id}=await response.json();let job;for(let i=0;i<100;i++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20))}assert.equal(job.status,'done',job.error);assert.equal(visionCalls,1);assert.equal(generationCalls,2);assert.equal(job.results.length,2);}finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-ref-vision-test-'));await rm(outputDir,{recursive:true,force:true})}
});
