import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createTextilePlanner,normalizeTextileRequest,validateTextilePlan} from './textile-ai-planner.mjs';
import {createServer} from './server.mjs';

const png=new PNG({width:2,height:2});png.data.fill(255);
const image='data:image/png;base64,'+PNG.sync.write(png).toString('base64');
const colors=['#f5f1e8','#7d9064','#d6b2a0','#536d4d'];
const palette={summary:'灰绿叶片与暖白底色适合安静的卧室氛围。',palettes:['晨光','暮色','春日'].map(name=>({name,colors,reason:'背景保持轻盈，主纹与点缀形成层次。'}))};
const moodboard={title:'春日灵感',note:'让细节围绕主图形成连续的视觉叙事。',colors,order:[1,0],layout:'focus',background:'#F5F1E8',reason:'成品图为主，局部为辅。'};
const delivery={ratio:'3:4',fit:'contain',format:'image/jpeg',maxEdge:2048,quality:90,prefix:'春日提案',reason:'保留主体，方便竖版页面阅读。'};
const copy={titles:['春日四件套'],bullets:['宽边设计','材质为纯棉'],body:'春日四件套，纯棉材质与宽边设计，让日常卧室更从容。'};
const facts={name:'春日四件套',product:'四件套',material:'纯棉',craft:'宽边设计'};
const design={name:'叶间晨光',brief:'以叶片做主纹，点状元素形成节奏。',colors,repeat:'halfdrop',motifs:Array.from({length:8},(_,i)=>({type:i%2?'leaf':'flower',x:(i%4+.5)/4,y:(Math.floor(i/4)+.5)/2,size:.12,rotation:i*15,colorIndex:1+i%3,secondaryIndex:2}))};
const config={provider:'sub2api',apiKey:'synthetic-private-key',baseUrl:'https://provider.example/v1',model:'image-model'};
const response=value=>Response.json({output_text:JSON.stringify(value)});

test('explicit palette POST uses configured Sub2API Responses recognition once, with all PNG references and no image model',async()=>{
  const calls=[];
  const planner=createTextilePlanner({getConfig:()=>({...config,recognitionModel:'configured-vision'}),fetchImpl:async(url,init)=>{calls.push({url,init,payload:JSON.parse(init.body)});return response(palette);}});
  assert.equal(calls.length,0);
  const result=await planner.plan({kind:'palette',images:[image,image],brief:'适合轻松卧室'});
  assert.equal(result.kind,'palette');assert.equal(result.model,'configured-vision');assert.equal(result.plan.palettes.length,3);
  const call=calls[0];assert.equal(calls.length,1);assert.equal(call.url,'https://provider.example/v1/responses');assert.equal(call.init.redirect,'error');
  assert.equal(call.payload.store,false);assert.equal(call.payload.model,'configured-vision');assert.equal(call.payload.stream,false);
  const content=call.payload.input[0].content;
  assert.equal(content.filter(item=>item.type==='input_image').length,2);assert.equal(content[0].image_url,image);assert.match(content.at(-1).text,/TEXTILE_KIND=palette/);
  assert.deepEqual(result.plan.palettes[0].colors,colors.map(color=>color.toUpperCase()));
  assert.equal(JSON.stringify(result).includes(config.apiKey),false);
});

test('compatible chat and Zhipu retain their own image and thinking formats',async()=>{
  for(const provider of ['compatible','zhipu']){
    let payload,url;
    const planner=createTextilePlanner({getConfig:()=>({...config,provider}),fetchImpl:async(target,init)=>{url=target;payload=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(moodboard)}}]});}});
    const result=await planner.plan({kind:'moodboard',images:[image,image]});
    assert.deepEqual(result.plan.order,[1,0]);assert.equal(url,config.baseUrl+'/chat/completions');
    assert.equal(payload.model,provider==='zhipu'?'glm-4.6v':'gpt-4.1-mini');
    assert.equal(payload.messages[0].content[0].image_url.url,provider==='zhipu'?image.split(',')[1]:image);
    assert.equal(payload.thinking?.type,provider==='zhipu'?'disabled':undefined);
  }
});

test('text only plans send no image, use the recognition fallback and support fenced valid JSON',async()=>{
  let payload;
  const planner=createTextilePlanner({getConfig:()=>({...config,visionModel:'glm-4.6v'}),fetchImpl:async(url,init)=>{payload=JSON.parse(init.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'```json\n'+JSON.stringify(delivery)+'\n```'}]}]});}});
  const result=await planner.plan({kind:'delivery',brief:'网站竖版交付'});
  assert.equal(payload.model,'gpt-5.6-luna');assert.equal(payload.input[0].content.length,1);assert.equal(result.plan.ratio,'3:4');
  for(const ratio of ['9:16','16:9'])assert.equal(validateTextilePlan('delivery',{...delivery,ratio}).ratio,ratio);
});

test('input image, field, type and actual designer numeric metadata are checked before any provider call',()=>{
  const invalid=[null,{kind:'unknown'},{kind:'copy'},{kind:'palette'},{kind:'moodboard',images:[...Array(7)].map(()=>image)},{kind:'design',brief:'a'.repeat(2001)},{kind:'design',brief:'ok',facts:{apiKey:'x'}},{kind:'design',brief:'ok',images:['data:image/png;base64,abcd']},{kind:'design',brief:'ok',facts:{dpi:0}},{kind:'copy',facts:{name:'四件套',features:[23]}}];
  for(const input of invalid)assert.throws(()=>normalizeTextileRequest(input),error=>error.status===400);
  assert.deepEqual(normalizeTextileRequest({kind:'design',brief:'叶子',facts:{widthCm:20,heightCm:30,dpi:300}}).facts,{widthCm:20,heightCm:30,dpi:300});
});

test('missing service configuration does not contact provider or substitute a local template',async()=>{
  let calls=0;const planner=createTextilePlanner({getConfig:()=>({}),fetchImpl:async()=>{calls++;throw Error('never');}});
  await assert.rejects(planner.plan({kind:'copy',facts}),error=>error.status===409&&error.code==='TEXTILE_AI_NOT_CONFIGURED');assert.equal(calls,0);
});

test('all planner schemas require exact keys, valid colors, image permutations and usable design coordinates',()=>{
  assert.equal(validateTextilePlan('design',design).motifs.length,8);
  assert.deepEqual(validateTextilePlan('moodboard',moodboard,{images:[image,image]}).order,[1,0]);
  for(const [kind,value,context]of [
    ['palette',{...palette,palettes:palette.palettes.slice(0,2)}],
    ['palette',{...palette,palettes:palette.palettes.map((item,i)=>i?item:{...item,colors:['bad',...colors.slice(1)]})}],
    ['palette',{...palette,script:'unexpected'}],
    ['moodboard',{...moodboard,order:[0,0]},{images:[image,image]}],
    ['moodboard',{...moodboard,order:[1]},{images:[image,image]}],
    ['moodboard',{...moodboard,background:'red'},{images:[image,image]}],
    ['delivery',{...delivery,maxEdge:5000}],['delivery',{...delivery,maxEdge:1024.5}],['delivery',{...delivery,quality:101}],['delivery',{...delivery,prefix:'../private'}],
    ['design',{...design,motifs:design.motifs.slice(0,5)}],['design',{...design,motifs:design.motifs.map((item,i)=>i?item:{...item,x:1.2})}],
    ['design',{...design,motifs:design.motifs.map((item,i)=>i?item:{...item,type:'custom-script'})}],['design',{...design,motifs:design.motifs.map((item,i)=>i?item:{...item,size:.8})}],
  ])assert.throws(()=>validateTextilePlan(kind,value,context),error=>error.status===502,kind);
});

test('grounded copy preserves real facts while unprovided material, craft, functions, certificates and numbers are rejected',()=>{
  assert.deepEqual(validateTextilePlan('copy',copy,{facts}),copy);
  const base={titles:['春日四件套'],bullets:[],body:'春日四件套'};
  for(const claim of ['100%纯棉','60支长绒棉','桑蚕丝','抗菌防螨','透气凉感','活性印花','OEKO-TEX认证','A类婴幼儿级','终身质保','200×230cm','三层结构']){
    assert.throws(()=>validateTextilePlan('copy',{...base,body:claim},{facts}),error=>error.code==='TEXTILE_FACTS_UNVERIFIED',claim);
  }
  assert.throws(()=>validateTextilePlan('copy',{...base,body:'200支'},{facts:{name:'被套',size:'200×230cm'}}),error=>error.code==='TEXTILE_FACTS_UNVERIFIED');
  assert.throws(()=>validateTextilePlan('copy',{...base,body:'抗菌'},{facts:{name:'被套',audience:'需要抗菌',tone:'抗菌'}}),error=>error.code==='TEXTILE_FACTS_UNVERIFIED');
  assert.equal(validateTextilePlan('copy',{...base,body:'200×230cm，纯棉，透气'},{facts:{...facts,size:'200×230cm',features:'透气'}}).body,'200×230cm，纯棉，透气');
});

test('bad upstream JSON, HTML and schema violations stop after one request without fallback',async()=>{
  for(const upstream of ['not json','<html>bad gateway</html>',JSON.stringify({...palette,palettes:[]})]){
    let calls=0;const planner=createTextilePlanner({getConfig:()=>config,fetchImpl:async()=>{calls++;return Response.json({output_text:upstream});}});
    await assert.rejects(planner.plan({kind:'palette',images:[image]}),error=>error.status===502&&error.code==='TEXTILE_AI_INVALID_RESPONSE');assert.equal(calls,1);
  }
});

test('provider status and network errors never expose a key or provider response payload',async()=>{
  for(const scenario of [401,403,429,500,'network']){
    const planner=createTextilePlanner({getConfig:()=>config,fetchImpl:async()=>{if(scenario==='network')throw Error('Bearer '+config.apiKey);return Response.json({error:{message:config.apiKey}},{status:scenario});}});
    await assert.rejects(planner.plan({kind:'delivery'}),error=>{assert.equal(error.message.includes(config.apiKey),false);assert.equal(error.message.includes(config.baseUrl),false);return [429,502].includes(error.status);});
  }
});

test('timeout and caller cancellation are explicit and do not retry paid requests',async()=>{
  let calls=0;
  const fetchImpl=async(url,{signal})=>{calls++;await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));};
  const planner=createTextilePlanner({getConfig:()=>config,fetchImpl,timeoutMs:25});
  // Keep the event loop alive while AbortSignal.timeout uses an unreferenced timer.
  const keepAlive=setInterval(()=>{},100);
  try{await assert.rejects(planner.plan({kind:'delivery'}),error=>error.status===504&&error.code==='TEXTILE_AI_TIMEOUT');}finally{clearInterval(keepAlive);}
  const controller=new AbortController(),pending=planner.plan({kind:'delivery'},{signal:controller.signal});controller.abort();
  await assert.rejects(pending,error=>error.code==='TEXTILE_AI_CANCELLED');assert.equal(calls,2);
});

test('concurrency is bounded and slot releases after success',async()=>{
  let release,calls=0;const planner=createTextilePlanner({getConfig:()=>config,maxConcurrent:1,fetchImpl:async()=>{calls++;if(calls===1)await new Promise(resolve=>release=resolve);return response(delivery);}});
  const first=planner.plan({kind:'delivery'});await assert.rejects(planner.plan({kind:'delivery'}),error=>error.status===429&&error.code==='TEXTILE_AI_BUSY');release();await first;await planner.plan({kind:'delivery'});assert.equal(calls,2);
});

test('real server routes enforce source restrictions, POST-only and return exact contract using a mock provider',async()=>{
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'textile-ai-http-'));let calls=0;
  const server=createServer({outputDir,service:config,publicOrigin:'https://studio.example',stylingReferencePaths:[],videoOptions:{loadConfig:async()=>null},fetchImpl:async(url,init)=>{calls++;return response(delivery);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const post=(origin,payload)=>fetch(base+'/api/textile/plan',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  try{
    assert.equal((await fetch(base+'/api/textile/plan')).status,405);
    assert.equal((await post('https://evil.example',{kind:'delivery'})).status,403);assert.equal(calls,0);
    assert.equal((await post('https://studio.example',{kind:'unknown'})).status,400);assert.equal(calls,0);
    const result=await post('https://studio.example',{kind:'delivery'});assert.equal(result.status,200);assert.deepEqual(await result.json(),{kind:'delivery',model:'gpt-5.6-luna',plan:delivery});assert.equal(calls,1);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
