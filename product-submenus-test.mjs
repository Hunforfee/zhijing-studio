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
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',png=Buffer.from(image.split(',')[1],'base64');
const base={product:'blanket',blanketVariant:'gauze',fabric:'cotton',fabricMode:'auto',size:'纱布毯 · 常规比例',scenes:['warm'],angles:camera.cameraAngleIds,scale:100,direction:0,repeat:'tile',ratio:'1:1',notes:'',plainSheet:false,image};

test('all six submenus center against the whole product menu and stay within desktop and mobile bounds',async()=>{
  const source=await readFile('dist/product-submenus.js','utf8'),ctx=vm.createContext({});vm.runInContext(source,ctx);
  ctx.rect={left:100,right:300,top:200,bottom:600,width:200,height:400};let p=vm.runInContext('productSubmenuPlacement(rect,590,260,1400,900)',ctx);assert.equal(p.top+130,400);assert.equal(p.left,310);
  ctx.rect={left:1080,right:1280,top:200,bottom:600,width:200,height:400};p=vm.runInContext('productSubmenuPlacement(rect,590,260,1400,900)',ctx);assert.equal(p.left,480);assert.equal(p.top+130,400);
  for(const [w,h]of [[390,800],[700,320]]){ctx.rect={left:12,right:200,top:100,bottom:500,width:188,height:400};ctx.w=w;ctx.h=h;p=vm.runInContext('productSubmenuPlacement(rect,640,650,w,h)',ctx);assert.ok(p.left>=12);assert.ok(p.left+p.width<=w-12);assert.ok(p.top>=12);assert.ok(p.top+Math.min(650,p.maxHeight)<=h-12);}
  const files=['set','mat','quilt','sheet','mattress','blanket'];for(const id of files)assert.match(await readFile('dist/'+id+'-variants.js','utf8'),/function place\w+Variants\(\)\{placeProductSubmenu\(/);
  assert.match(source,/document.getElementById\('products'\)/);const index=await readFile('dist/index.html','utf8');assert.ok(index.indexOf('/product-submenus.js')<index.indexOf('/set-variants.js'));
});

test('gauze selection uses cotton defaults, preserves explicit texture, and maps all twelve thumbnails to its own atlas',async()=>{
  const menu=await readFile('dist/blanket-variants.js','utf8'),app=await readFile('dist/app.js','utf8'),ctx=vm.createContext({state:{...base,blanketVariant:'fleece'},cameraTools:camera,blanketVariantPanel:{querySelectorAll:()=>[]},renderBlanketVariantControl(){},renderSelections(){},updateFabric(){}});
  vm.runInContext(menu.split('const blanketVariantPanel=')[0],ctx);vm.runInContext(menu.match(/function selectBlanketVariant\([^\n]+/)[0],ctx);vm.runInContext("selectBlanketVariant('gauze')",ctx);assert.equal(ctx.state.blanketVariant,'gauze');assert.equal(ctx.state.fabric,'cotton');
  ctx.state.fabricMode='selected';ctx.state.fabric='washed';vm.runInContext("selectBlanketVariant('fleece');selectBlanketVariant('gauze')",ctx);assert.equal(ctx.state.fabric,'washed');
  for(const name of ['angleDisplayName','angleSelectorCard'])vm.runInContext(app.match(new RegExp('function '+name+'\\([^\\n]+'))[0],ctx);ctx.state.angles=['side'];for(let i=0;i<12;i++){ctx.angle={id:camera.cameraAngleIds[i],name:'test'};ctx.index=i;const card=vm.runInContext('angleSelectorCard(angle,index)',ctx);assert.match(card,/angle-photo-blanket-gauze/);assert.match(card,/data-preview-src="\/assets\/blanket-gauze-angles-v1.png"/);assert.ok(card.includes('data-preview-cell="'+i+'"'));if(ctx.angle.id==='detail')assert.match(card,/纱布织纹特写/);}
});

test('gauze prompts preserve loose weave, soft drape and A/B across all 216 scene-angle combinations',()=>{
  for(const hasB of [false,true])for(const scene of Object.keys(sceneDirections))for(const angle of camera.cameraAngleIds){const v=validateInput({...base,imageB:hasB?image:null}),p=buildPrompt(v,scene,angle,false,0,true,true),z=buildZhipuPrompt(v,scene,angle,JSON.stringify({fabricA:'A green',fabricB:'B blue',sourceTexture:'fine gauze'}));assert.match(p,/UNFILLED BLANKET, GAUZE style/);assert.match(p,/fine open warp\/weft/);assert.match(p,/No fleece, fur, velvet pile/);assert.ok(p.includes(camera.singleProductCameraPrompt(v,angle)));assert.match(z,/纱布毯/);assert.ok(z.length<3500);assert.match(p,hasB?/FRONT uses original A and actual REVERSE uses original B/:/ENTIRE selected single product/);}
});

for(const provider of ['sub2api','zhipu'])test(provider+' accepts gauze, uses selected angles and records its subtype',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'zhijing-gauze-'));let calls=0;
  const server=createServer({outputDir:dir,stylingReferencePaths:[],service:{provider,apiKey:'synthetic-gauze-key',baseUrl:'https://example.test/v1',model:provider==='zhipu'?'glm-image':'test-image'},fetchImpl:async(url,init)=>{if(url.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:JSON.stringify({fabricA:'A green',sourceTexture:'loose woven gauze'})}}]});const angle=camera.cameraAngleIds[calls++];if(provider==='sub2api'){assert.match(init.body.get('prompt'),/UNFILLED BLANKET, GAUZE style/);assert.ok(init.body.get('prompt').includes(camera.singleProductCameraPrompt(base,angle)));}else assert.match(JSON.parse(init.body).prompt,/纱布毯/);return Response.json({data:[{b64_json:png.toString('base64')}]});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{const c=await(await fetch(url+'/api/admin/catalog')).json();assert.ok(c.variants.blanket.some(x=>x.id==='gauze'));const previewResponse=await fetch(url+'/api/admin/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'blanket',variant:'gauze',angle:'detail'})});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert.match(preview.settings.angleName,/纱布织纹/);
    const r=await fetch(url+'/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(base)});assert.equal(r.status,202);const {id}=await r.json();let job;for(let n=0;n<150;n++){job=await(await fetch(url+'/api/jobs/'+id)).json();if(job.status!=='running')break;await new Promise(r=>setTimeout(r,15));}assert.equal(job.status,'done',job.error);assert.equal(calls,12);assert.ok(job.results.every(x=>x.blanketVariant==='gauze'));
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
