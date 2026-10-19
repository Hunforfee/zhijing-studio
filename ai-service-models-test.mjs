import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {resolveAnalysisService,analysisSettings,classifyServiceModels} from './ai-service-models.mjs';
import {createServer,validateService} from './server.mjs';
import {recognizeUploadedProduct} from './product-recognition.mjs';
import {recognizeDetailProduct} from './detail-recognition.mjs';
import {planVideoStory,draftStoryboard} from './video-story-planner.mjs';
import {createTextilePlanner} from './textile-ai-planner.mjs';

const config={provider:'sub2api',apiKey:'synthetic-analysis-only-secret',baseUrl:'https://relay.example/v1',model:'custom-image-model',recognitionModel:'configured-analysis-model',recognitionApi:'responses'};
const zhipu={provider:'zhipu',apiKey:'synthetic-zhipu-test-key',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-image',recognitionModel:'glm-4.6v'};
const png=new PNG({width:2,height:2});png.data.fill(255);const bytes=PNG.sync.write(png),image='data:image/png;base64,'+bytes.toString('base64');

test('all providers share explicit model precedence and Sub2API always uses Responses',()=>{
  assert.deepEqual(resolveAnalysisService({...config,visionModel:'legacy-vision',recognitionApi:'chat'}),{model:config.recognitionModel,zhipu:false,responses:true,recognitionApi:'responses'});
  assert.equal(resolveAnalysisService({provider:'sub2api',visionModel:'glm-4.6v'}).model,'gpt-5.6-luna');
  assert.equal(resolveAnalysisService({provider:'compatible',visionModel:'glm-4.6v'}).model,'gpt-4.1-mini');
  assert.equal(resolveAnalysisService({provider:'compatible',visionModel:'custom-vision'}).model,'custom-vision');
  assert.equal(resolveAnalysisService({provider:'compatible',recognitionApi:'responses'}).responses,true);
  assert.equal(resolveAnalysisService({...zhipu,recognitionApi:'responses'}).responses,false);
});

test('saving an image service preserves only matching supplier analysis settings and validates explicit names',()=>{
  const saved=validateService({...config,apiKey:'',recognitionModel:''},config);
  assert.equal(saved.apiKey,config.apiKey);assert.equal(saved.recognitionModel,config.recognitionModel);assert.equal(saved.recognitionApi,'responses');assert.equal(saved.visionModel,config.recognitionModel);
  const next=validateService({...config,recognitionModel:'new-analysis-model'},config);assert.equal(next.recognitionModel,'new-analysis-model');
  const legacy=analysisSettings({provider:'compatible'},{provider:'compatible',visionModel:'legacy-vision',recognitionApi:'responses'});assert.equal(legacy.recognitionModel,'legacy-vision');assert.equal(legacy.recognitionApi,'responses');
  assert.equal(analysisSettings({provider:'sub2api'},zhipu).recognitionModel,'gpt-5.6-luna');
  assert.equal(analysisSettings({provider:'sub2api',recognitionApi:'chat'},config).recognitionApi,'responses');
  for(const recognitionModel of [5,'model with spaces','x'.repeat(121),'https://host?key=private'])assert.throws(()=>validateService({...config,recognitionModel},config),/模型/);
  assert.throws(()=>validateService({...config,recognitionApi:'invalid'},config),/接口/);
});

test('model list separates image and analysis candidates without presenting audio/video as analysis models',()=>{
  const result=classifyServiceModels(['gpt-image-2','gpt-5.4-mini','claude-sonnet','custom-vision','glm-image','tts-1','text-embedding-3-large','sora-2','MiniMax-Hailuo-2.3','gpt-5.4-mini','invalid model'].map(id=>({id})));
  assert.deepEqual(result.imageModels,['gpt-image-2','glm-image']);assert.deepEqual(result.analysisModels,['gpt-5.4-mini','claude-sonnet','custom-vision']);
});

test('four active analysis consumers use one configured Sub2API model and Responses API',async()=>{
  const brief={topic:'craft',product:'set',duration:15,people:'hands',brief:'',facts:''};
  const story={...draftStoryboard(brief),productReference:{description:'叶片花型',swatches:[{sourceIndex:0,x:.2,y:.2,width:.4,height:.4,side:'A'}]}};
  const cases=[
    ['product',fetchImpl=>recognizeUploadedProduct({bytes,config,fetchImpl}),{product:null,duvetCraft:null,sheetStyle:null,pillowCraft:null,variant:null,message:'仅为花型资料'}],
    ['detail',fetchImpl=>recognizeDetailProduct({bytes,config,fetchImpl}),{category:'set',name:'四件套',confidence:'high'}],
    ['video',fetchImpl=>planVideoStory({brief,images:[image],config,fetchImpl}),story],
    ['tool',fetchImpl=>createTextilePlanner({getConfig:()=>config,fetchImpl}).plan({kind:'copy',facts:{name:'春日四件套'}}),{titles:['春日四件套'],bullets:[],body:'让春日的色彩陪伴日常。'}],
  ];
  for(const [name,run,result]of cases){
    let calls=0;await run(async(url,init)=>{
      calls++;assert.equal(url,config.baseUrl+'/responses',name);assert.equal(JSON.parse(init.body).model,config.recognitionModel,name);assert.equal(init.redirect,'error');
      const payload=JSON.parse(init.body);assert.equal(payload.store,false);assert.equal(payload.stream,false);
      return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
    });assert.equal(calls,1,name);
  }
});

test('detail recognition retains compatible chat and Zhipu formats while honoring recognitionModel',async()=>{
  for(const provider of ['compatible','zhipu']){
    const cfg={...config,provider,recognitionApi:'chat'};
    const result=await recognizeDetailProduct({bytes,config:cfg,fetchImpl:async(url,init)=>{
      assert.equal(url,config.baseUrl+'/chat/completions');const payload=JSON.parse(init.body);assert.equal(payload.model,config.recognitionModel);
      assert.equal(payload.messages[0].content[0].image_url.url,provider==='zhipu'?bytes.toString('base64'):image);
      return Response.json({choices:[{message:{content:JSON.stringify({category:'set',confidence:'high'})}}]});
    }});assert.equal(result.category,'set');
  }
  await assert.rejects(recognizeDetailProduct({bytes,config,fetchImpl:async()=>Response.json({status:'incomplete',output_text:'{"category":"set","confidence":"high"}'})}),/有效/);
});

async function fixture(run,options={}){
  const outputDir=await mkdtemp(path.join(os.tmpdir(),'ai-model-settings-'));
  const server=createServer({outputDir,service:config,stylingReferencePaths:[],videoOptions:{loadConfig:async()=>null},...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const post=(route,value)=>fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(value||{})});
  try{await run({base,post});}finally{await new Promise(resolve=>server.close(resolve));await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}

test('service metadata, save and restart preserve the selected analysis model without exposing keys',async()=>{
  let persisted;
  await fixture(async({base,post})=>{
    const status=await(await fetch(base+'/api/status')).json();assert.equal(status.recognitionModel,config.recognitionModel);assert.equal(status.recognitionApi,'responses');assert.equal(JSON.stringify(status).includes(config.apiKey),false);
    const saved=await(await post('/api/service',{...config,apiKey:'',recognitionModel:''})).json();assert.equal(saved.recognitionModel,config.recognitionModel);assert.equal(saved.apiKey,undefined);
    await post('/api/service',{...config,apiKey:'',recognitionModel:'selected-analysis-v2'});assert.equal(persisted.profiles.sub2api.recognitionModel,'selected-analysis-v2');
    const metadata=await(await fetch(base+'/api/service/profiles')).json();assert.equal(metadata.profiles.sub2api.recognitionModel,'selected-analysis-v2');assert.equal(JSON.stringify(metadata).includes(config.apiKey),false);
  },{persistService:async value=>persisted=structuredClone(value),fetchImpl:async()=>{throw Error('No provider request is allowed');}});
  await fixture(async({base})=>{assert.equal((await(await fetch(base+'/api/status')).json()).recognitionModel,'selected-analysis-v2');},{service:persisted});
});

test('connection check queries only GET models and returns both candidate lists with backward compatible models',async()=>{
  const calls=[];
  await fixture(async({post})=>{
    const response=await post('/api/service/check'),result=await response.json();assert.equal(response.status,200);
    assert.deepEqual(result.models,['gpt-image-2']);assert.deepEqual(result.imageModels,result.models);assert.deepEqual(result.analysisModels,[config.recognitionModel]);assert.equal(result.recognitionModel,config.recognitionModel);
    assert.equal(JSON.stringify(result).includes(config.apiKey),false);assert.match(result.message,/不生成或识图/);assert.equal(calls.length,1);
  },{fetchImpl:async(url,init)=>{calls.push({url,init});assert.equal(url,config.baseUrl+'/models');assert.equal(init.method||'GET','GET');assert.equal(init.body,undefined);return Response.json({data:[{id:'gpt-image-2'},{id:config.recognitionModel},{id:'tts-1'}]});}});
});

test('detail endpoint never silently switches from the active relay to a saved Zhipu account',async()=>{
  let calls=0;
  await fixture(async({post})=>{
    const response=await post('/api/detail-page/recognize',{image});assert.equal(response.status,200);assert.equal((await response.json()).category,'set');assert.equal(calls,1);
  },{service:{version:2,activeProvider:'sub2api',profiles:{sub2api:config,zhipu}},fetchImpl:async(url,init)=>{
    calls++;assert.equal(url,config.baseUrl+'/responses');assert.equal(init.headers.Authorization,'Bearer '+config.apiKey);assert.equal(JSON.parse(init.body).model,config.recognitionModel);return Response.json({output_text:'{"category":"set","confidence":"high"}'});
  }});
});
