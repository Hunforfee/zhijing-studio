import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import * as camera from './dist/camera-contract.js';
import {validateInput,buildPrompt,createServer} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {sceneDirections} from './photography-prompts.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',png=Buffer.from(image.split(',')[1],'base64');
const base={product:'sleepbag',sleepbagVariant:'travel',fabric:'cotton',fabricMode:'auto',size:'旅行睡袋类别：1条酒店隔脏用双层旅行睡袋。',scenes:['warm'],angles:camera.cameraAngleIds,scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image};

test('a complete manual prompt replacement retains travel construction rules without duplicating them',()=>{
  const v=validateInput(base);
  for(const compact of [false,true]){
    const guarded=enforceBeddingFidelity('Custom product photograph.',v,{compact});
    assert.match(guarded,compact?/【旅行睡袋结构v2】/:/joined ONLY along the LOWER HALF of BOTH long sides/);
    assert.match(guarded,compact?/隐形拉链/:/INVISIBLE ZIPPER/);
    assert.equal(enforceBeddingFidelity(guarded,v,{compact}),guarded);
  }
});

test('更多产品 entry sits below 毯子, opens its own submenu and reuses the shared flyout placement',async()=>{
  const app=await readFile('dist/app.js','utf8'),menu=await readFile('dist/sleepbag-variants.js','utf8'),index=await readFile('dist/index.html','utf8');
  const blanket=app.indexOf("id:'blanket'"),more=app.indexOf("id:'sleepbag'");
  assert.ok(blanket>0&&more>blanket,'sleepbag entry must follow the blanket entry');
  assert.match(app,/id:'sleepbag',name:'更多产品'/);
  assert.match(menu,/function placeSleepbagVariants\(\)\{placeProductSubmenu\(/);
  assert.match(menu,/<h2 id="sleepbagVariantTitle">更多产品<\/h2>/);
  assert.match(menu,/id:'travel',name:'旅行睡袋'/);
  assert.match(menu,/renderChosenProductLabel\(trigger,'更多产品',state.lastMoreProduct/);
  assert.ok(index.indexOf('/product-submenus.js')<index.indexOf('/sleepbag-variants.js'),'placement helper must load first');
  assert.ok(index.indexOf('/blanket-variants.js')<index.indexOf('/sleepbag-variants.js'),'更多产品 follows 毯子 in load order too');
  assert.match(index,/\/sleepbag-variants\.js/);
});

test('selecting 旅行睡袋 keeps cotton texture, preserves an explicit choice and maps all twelve thumbnails to its own atlas',async()=>{
  const menu=await readFile('dist/sleepbag-variants.js','utf8'),app=await readFile('dist/app.js','utf8');
  const ctx=vm.createContext({state:{...base,sleepbagVariant:'travel'},cameraTools:camera,sleepbagVariantPanel:{querySelectorAll:()=>[]},renderSleepbagVariantControl(){},renderSelections(){},updateFabric(){}});
  vm.runInContext(menu.split('const sleepbagVariantPanel=')[0],ctx);
  vm.runInContext(menu.match(/function selectSleepbagVariant\([^\n]+/)[0],ctx);
  ctx.state.fabric='washed';vm.runInContext("selectSleepbagVariant('travel')",ctx);assert.equal(ctx.state.sleepbagVariant,'travel');
  ctx.state.fabricMode='selected';ctx.state.fabric='washed';vm.runInContext("selectSleepbagVariant('travel')",ctx);assert.equal(ctx.state.fabric,'washed');
  for(const name of ['angleDisplayName','angleSelectorCard'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],ctx);
  ctx.state.angles=['side'];
  for(let i=0;i<12;i++){ctx.angle={id:camera.cameraAngleIds[i],name:'test'};ctx.index=i;const card=vm.runInContext('angleSelectorCard(angle,index)',ctx);assert.match(card,/angle-photo-sleepbag-travel/);assert.match(card,/data-preview-src="\/assets\/sleepbag-travel-angles-v2\.png"/);assert.ok(card.includes('data-preview-cell="'+i+'"'),'thumbnail '+i+' must map to atlas cell '+i);assert.match(card,/data-preview-cols="4" data-preview-rows="3"/);assert.match(card,/旅行睡袋 · /);}
  assert.equal(camera.cameraAtlasFor({product:'sleepbag',sleepbagVariant:'travel'}).file,'sleepbag-travel-angles-v2.png');
  assert.equal(camera.cameraAtlasFor({product:'sleepbag'}).file,'sleepbag-travel-angles-v2.png');
});

test('travel sleeping bag prompts keep the flat one-piece structure and A/B assignment across all 108 scene-angle combinations',()=>{
  for(const hasB of [false,true])for(const scene of Object.keys(sceneDirections))for(const angle of camera.cameraAngleIds){
    const v=validateInput({...base,imageB:hasB?image:null}),p=buildPrompt(v,scene,angle,false,0,true,true),z=buildZhipuPrompt(v,scene,angle,JSON.stringify({fabricA:'A blue',fabricB:'B green',sourceTexture:'printed cotton'}));
    assert.match(p,/TWO-LAYER hotel dirt-barrier travel sleeping bag/);
    assert.match(p,/covers the WHOLE mattress like bedding/);
    assert.match(p,/joined ONLY along the LOWER HALF of BOTH long sides/);
    assert.match(p,/completely open and unsewn/);
    assert.match(p,/closed by an INVISIBLE ZIPPER/);
    assert.match(p,/sewn on the BACK \(the underside\) of the bottom panel/);
    assert.match(p,/no elastic corner straps, no drawstring pouch and no full-length zipper/);
    assert.ok(p.includes(camera.singleProductCameraPrompt(v,angle)),'angle prompt missing for '+angle);
    assert.match(z,/旅行睡袋/);
    assert.ok(z.length<3500);
    assert.match(p,hasB?/EXACT SLEEPING BAG A\/B: the TOP panel outer face/:/ENTIRE selected single product/);
    assert.match(p,/REQUIRED UNDERSIDE PILLOW/);
    assert.doesNotMatch(p,/envelope-style head-end pillow pocket|elastic corner straps that anchor|drawstring storage pouch shown ONLY/);
  }
});

test('travel sleeping bag angle names cover the six specialised views and the shared全景 views',()=>{
  const v=validateInput({...base});
  assert.equal(camera.singleProductAngleName('sleepbag','detail','面料特写',v),'面料织纹特写');
  assert.equal(camera.singleProductAngleName('sleepbag','foot','床尾近景',v),'脚端拉链近景');
  assert.equal(camera.singleProductAngleName('sleepbag','pillowclose','枕套特写',v),'背面枕袋特写');
  assert.equal(camera.singleProductAngleName('sleepbag','drape','床边垂坠',v),'侧边缝合与开口');
  assert.equal(camera.singleProductAngleName('sleepbag','reverse','翻折看反面',v),'翻折露内层');
  assert.equal(camera.singleProductAngleName('sleepbag','side','45° 斜侧',v),'45° 斜侧');
  assert.match(buildPrompt(v,'hotel','reverse'),/SLEEPING BAG OPEN-TOP FOLD-BACK/);
  assert.match(buildPrompt(v,'hotel','pillowclose'),/UNDERSIDE PILLOW SLEEVE CLOSE-UP/);
  assert.match(buildPrompt(v,'hotel','foot'),/SLEEPING BAG FOOT ZIPPER/);
});

test('后端拒绝无效的更多产品品种',()=>{
  assert.throws(()=>validateInput({...base,sleepbagVariant:'camping'}),/有效的更多产品品种/);
  assert.equal(validateInput({...base,sleepbagVariant:undefined}).sleepbagVariant,'travel');
});

test('旅行睡袋的款式规格不超过后端 size 上限，避免前端提交被拒',async()=>{
  const menu=await readFile('dist/sleepbag-variants.js','utf8'),spec=menu.match(/id:'travel'[^}]*?spec:'([^']+)'/)[1];
  assert.ok(spec.length<=240,'spec 长度 '+spec.length+' 超过后端 240 字上限');
  assert.equal(validateInput({...base,size:spec}).size,spec);
});

for(const provider of ['sub2api','zhipu'])test(provider+' accepts 旅行睡袋, uses its own camera prompts and records the subtype',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-sleepbag-'));let calls=0;
  const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider,apiKey:'synthetic-sleepbag-key',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'A blue cotton print',sourceTexture:'printed cotton'})}}]});const angle=camera.cameraAngleIds[calls++];if(provider==='sub2api'){assert.match(init.body.get('prompt'),/TWO-LAYER hotel dirt-barrier travel sleeping bag/);assert.ok(init.body.get('prompt').includes(camera.singleProductCameraPrompt(base,angle)));}else assert.match(JSON.parse(init.body).prompt,/旅行睡袋/);return Response.json({data:[{b64_json:png.toString('base64')}]});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{
    const c=await(await fetch(url+'/api/admin/catalog')).json();
    assert.ok(c.products.some(x=>x.id==='sleepbag'&&x.name==='更多产品'));
    assert.ok(c.variants.sleepbag.some(x=>x.id==='travel'));
    const previewResponse=await fetch(url+'/api/admin/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'sleepbag',variant:'travel',angle:'pillowclose'})});
    assert.equal(previewResponse.status,200);
    const preview=await previewResponse.json();
    assert.equal(preview.settings.variantLabel,'旅行睡袋');
    assert.match(preview.settings.angleName,/背面枕袋/);
    assert.equal(preview.atlas.src,'/assets/sleepbag-travel-angles-v2.png');
    const r=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(base)});
    assert.equal(r.status,202);
    const {id}=await r.json();let job;
    for(let n=0;n<150;n++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}
    assert.equal(job.status,'done',job.error);assert.equal(calls,12);assert.ok(job.results.every(x=>x.sleepbagVariant==='travel'));
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
