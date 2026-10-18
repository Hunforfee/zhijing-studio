import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {sceneDirections,angleDirections,photographyRules,promptVersion} from './photography-prompts.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
import {materialPriority,textureIds} from './material-priority.mjs';
import {setCameraDirections,cameraAngleIds,cameraAtlasFor,cameraCellFor,matAngleName,singleProductAngleName,singleProductDirection} from './dist/camera-contract.js';
import {sheetAngleName} from './sheet-prompts.mjs';
import {sectionScope,sectionIds} from './prompt-section-edits.mjs';
import {enforceReferenceEdit} from './reference-prompts.mjs';
import {enforceBeddingFidelity,beddingFidelityRule,beddingFidelityVersion} from './bedding-fidelity.mjs';
import {enforceSetPanelBoundaries} from './set-surface-prompts.mjs';
import {craftReferenceSpecs,craftReferenceInstruction} from './craft-references.mjs';
import {layeredSetDetails,layeredSetGroupPrompt,setPromptData} from './set-layered-prompts.mjs';

const exampleImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const materialNames={cotton:'细密哑光',satin:'柔亮缎光',silk:'顺滑丝光',linen:'粗纱麻纹',velvet:'蓬松绒感',brushed:'细短绒感',washed:'自然皱感',tencel:'柔顺垂感',jacquard:'立体织纹',ice:'细网微光',rattan:'紧密编织',bamboo:'条片硬挺'};
const placeholderSummary=JSON.stringify({fabricA:'【实际识图后填入 A 面花型、底色与排列】',fabricB:'【实际识图后填入 B 面花型、底色与排列】',sourceTexture:'【实际识图后填入上传面料的表面质感】',referenceScene:'【实际识图后填入参考图场景】',referenceAngle:'【实际识图后填入参考图机位与构图】',productDetails:'【实际识图后填入参考图产品细节】',userTexture:'【实际识图后填入独立质感参考图的特征】'});

// Read only the trusted app's static array literals; never execute its browser code.
export async function appArray(file,name){
  const source=await readFile(new URL('./dist/'+file,import.meta.url),'utf8');
  const start=source.indexOf('const '+name+'=');
  if(start<0)throw Error('未找到网站的产品定义：'+name);
  const from=start+('const '+name+'=').length,end=source.indexOf('];',from);
  if(end<0)throw Error('产品定义格式不完整：'+name);
  return JSON.parse(JSON.stringify(runInNewContext('('+source.slice(from,end+1)+')',Object.create(null),{timeout:500})));
}
function between(prompt,start,end){const a=prompt.indexOf(start),b=prompt.indexOf(end,a+start.length);if(a<0||b<0)throw Error('提示词结构已变化，请同步更新后台拆解');return prompt.slice(a+start.length,b).trim()}
function angleName(v,id){return singleProductAngleName(v.product,id,v.product==='mat'?matAngleName(id,angleDirections[id].name):v.product==='sheet'?sheetAngleName(v,id,angleDirections[id].name):v.product==='quilt'&&id==='pillowclose'?'包边特写':angleDirections[id].name,v)}
function boolean(value,fallback,label){if(value==null)return fallback;if(typeof value!=='boolean')throw Error(label+'参数无效');return value}

export function createPromptInspector({buildPrompt,validateInput,productMap,fabricMap,stylingCount=2,promptEdits,sectionEdits}){
  let definitions;
  const records=[];
  async function catalog(){
    if(!definitions)definitions=Promise.all([appArray('app.js','products'),appArray('set-variants.js','setVariants'),appArray('quilt-variants.js','quiltVariants'),appArray('sheet-variants.js','sheetProductVariants'),appArray('mat-variants.js','matVariants'),appArray('mattress-variants.js','mattressProductVariants'),appArray('blanket-variants.js','blanketProductVariants'),appArray('sleepbag-variants.js','sleepbagProductVariants'),appArray('pillowcore-variants.js','pillowcoreProductVariants'),appArray('app.js','order'),appArray('app.js','angles')]).then(([products,set,quilt,sheet,mat,mattress,blanket,sleepbag,pillowcore,setOrder,initialAngles])=>({defaultAngle:initialAngles[0].id,productAngleIds:Object.fromEntries(products.map(p=>[p.id,p.id==='set'?setOrder:[...initialAngles.map(a=>a.id),...cameraAngleIds.filter(id=>!initialAngles.some(a=>a.id===id))]])),products:products.map(p=>({id:p.id,name:p.name,parts:p.parts,fabrics:[...new Set(productMap[p.id].fabrics)]})),variants:{set,quilt,sheet,mat,mattress,blanket,sleepbag,pillowcore}})).catch(e=>{definitions=null;throw e});
    return {version:promptVersion,...await definitions,setCrafts:setPromptData.groups.flatMap(g=>g.options.map(o=>({...o,group:g.name}))),setStructure:setPromptData.base,scenes:sceneDirections,angles:angleDirections,setAngles:setCameraDirections,materials:Object.entries(fabricMap).map(([id,prompt])=>({id,name:materialNames[id]||id,prompt})),rules:[{id:'photography',name:'通用摄影要求',zh:photographyRules.zh,prompt:photographyRules.prompt},{id:'auto',name:'默认：参考上传面料质感',prompt:materialPriority({fabricMode:'auto'},'')},{id:'selected',name:'选定面料质感优先',prompt:materialPriority({fabricMode:'selected'},'【当前选定质感的描述】')},{id:'upload',name:'上传质感参考图优先',prompt:materialPriority({textureReferenceImage:true},'',3)}]};
  }
  async function preview(q={}){
    if(!q||typeof q!=='object'||Array.isArray(q))throw Error('预览参数无效');
    const c=await catalog(),p=c.products.find(p=>p.id===(q.product||'set'));if(!p)throw Error('请选择有效的产品');
    const scene=q.scene||'warm',angle=q.angle||c.defaultAngle;if(typeof scene!=='string'||typeof angle!=='string'||!Object.hasOwn(sceneDirections,scene)||!Object.hasOwn(angleDirections,angle))throw Error('请选择有效的场景与角度');
    const fabricMode=q.fabricMode||'auto';if(!['auto','selected','upload'].includes(fabricMode))throw Error('面料质感模式无效');
    const ref=q.reference||'none';if(!['none','both','scene','angle'].includes(ref))throw Error('拍摄参考范围无效');
    const hasB=boolean(q.hasB,false,'B 面');
    let size='按所选产品的常规比例，自然铺设',fabric=q.fabric||p.fabrics[0],quiltSeason,sheetVariant,mattressVariant,blanketVariant,sleepbagVariant,pillowcoreVariant,variantLabel=p.name;
    if(p.id==='set'){
      const sheet=c.variants.set.find(x=>x.id===(q.setSheet||'standard')&&x.group==='床单款式'),craft=c.variants.set.find(x=>x.id===(q.setCraft||'plain')&&x.group==='被套工艺'),pillow=c.variants.set.find(x=>x.id===(q.setPillow||'pillow-plain')&&x.group==='枕套工艺');if(!sheet||!craft||!pillow)throw Error('四件套款式无效');size='三组同时满足：'+craft.spec+'；'+sheet.spec+'；'+pillow.spec+'。各工艺仅作用所属部件，互不沿用。';variantLabel='被套'+craft.name+' + '+sheet.name+' + 枕套'+pillow.name;
    }else if(['quilt','sheet','mattress'].includes(p.id)){
      const item=c.variants[p.id].find(x=>x.id===(q.variant||(p.id==='quilt'?'winter':p.id==='mattress'?'thin':'flat')));if(!item)throw Error('产品类别无效');size=item.spec;variantLabel=item.name;if(p.id==='quilt')quiltSeason=item.id;else if(p.id==='sheet')sheetVariant=item.id;else mattressVariant=item.id;
    }else if(p.id==='pillowcore'){
      const item=c.variants.pillowcore.find(x=>x.id===(q.variant||'fiber'));if(!item)throw Error('枕芯类别无效');pillowcoreVariant=item.id;size=item.spec;variantLabel=item.name;
    }else if(p.id==='mat'){
      const item=c.variants.mat.find(x=>x.id===(q.variant||'ice'));if(!item)throw Error('凉席类别无效');fabric=item.id;size=item.hint;variantLabel=item.name;
    }else if(p.id==='blanket'){
      const item=c.variants.blanket.find(x=>x.id===(q.variant||'fleece'));if(!item)throw Error('毯子款式无效');blanketVariant=item.id;size=item.spec;variantLabel=item.name;
    }else if(p.id==='sleepbag'){
      const item=c.variants.sleepbag.find(x=>x.id===(q.variant||'travel'));if(!item)throw Error('更多产品品种无效');sleepbagVariant=item.id;size=item.spec;variantLabel=item.name;
    }
    const hasRef=ref!=='none';
    let v=validateInput({product:p.id,fabric,fabricMode:fabricMode==='selected'?'selected':'auto',size,quiltSeason,sheetVariant,mattressVariant,blanketVariant,sleepbagVariant,pillowcoreVariant,scenes:[scene],angles:[angle],scale:q.scale??100,direction:q.direction??0,repeat:q.repeat||'tile',ratio:q.ratio||'1:1',notes:q.notes??'',plainSheet:false,image:exampleImage,imageB:hasB?exampleImage:null,referenceImage:hasRef?exampleImage:null,referenceScene:hasRef&&(ref==='both'||ref==='scene'),referenceAngle:hasRef&&(ref==='both'||ref==='angle'),textureSource:fabricMode==='upload'?'upload':'library',textureReferenceImage:fabricMode==='upload'?exampleImage:null});
    const atlas=cameraAtlasFor(v),cell=cameraCellFor(v,angle),hasCamera=!!atlas&&!v.referenceAngle,hasTexture=fabricMode==='upload'||fabricMode==='selected'&&textureIds.includes(v.fabric),folds=!hasRef&&angle==='reverse'&&['set','quilt'].includes(p.id)?stylingCount:0;
    const raw={...v};
    if(sectionEdits)v={...v,promptSections:await sectionEdits.resolve(v,scene,angle)};
    const full=buildPrompt(v,scene,angle,false,folds,hasTexture,hasCamera);
    const prompts={sub2api:full,zhipu:buildZhipuPrompt(v,scene,angle,placeholderSummary)},edits={};
    if(promptEdits)for(const provider of ['sub2api','zhipu']){const scope={provider,product:p.id,scene,angle};edits[provider]=await promptEdits.get(scope);prompts[provider]=await promptEdits.apply(prompts[provider],scope);}
    prompts.sub2api=enforceReferenceEdit(prompts.sub2api,v);
    for(const provider of ['sub2api','zhipu'])prompts[provider]=enforceBeddingFidelity(enforceSetPanelBoundaries(prompts[provider],v,provider==='zhipu'),v,{compact:provider==='zhipu',final:true});
    prompts.sub2api+=craftReferenceInstruction(v,(hasRef?1:0)+1+(hasB?1:0)+folds+(hasCamera?1:0)+(hasTexture?1:0)+1);
    // The unreferenced composition exposes the actual product/camera clauses even when a reference overrides them.
    const normal=buildPrompt({...raw,referenceBytes:null,referenceImage:null,referenceGuided:false,referenceScene:false,referenceAngle:false},scene,angle,false,0,hasTexture,hasCamera);
    const settings={product:p.id,productName:p.name,variantLabel,fabric:v.fabric,materialName:fabricMode==='auto'?'默认':fabricMode==='upload'?'上传质感参考图':materialNames[v.fabric],fabricMode,scene,angle,angleName:angleName(v,angle),reference:ref,hasB,scale:v.scale,direction:v.direction,repeat:v.repeat,ratio:v.ratio,notes:v.notes};
    const attachments=[...(hasRef?['用户拍摄参考图']:[]),'A 面花型',...(hasB?['B 面花型']:[]),...Array.from({length:folds},(_,i)=>'翻折摆放参考 '+(i+1)),...(hasCamera?['当前角度单图参考']:[]),...(hasTexture?[fabricMode==='upload'?'用户质感参考图':'选定质感示例图']:[])];
    attachments.push(...craftReferenceSpecs(v).map(ref=>'工艺结构示意（参考图生图接口）：'+ref.groups.join('、')));
    const result={version:promptVersion,configuration:q,settings,atlas:atlas?{src:'/assets/'+atlas.file,cell,cols:atlas.cols||4,rows:atlas.rows||3}:null,angleOptions:c.productAngleIds[p.id].filter(id=>cameraCellFor(v,id)!=null).map(id=>({id,name:angleName(v,id),cell:cameraCellFor(v,id)})),attachments,sections:[{name:'产品结构',prompt:between(normal,' Product: ',' Size specification: ')},{name:'具体款式',prompt:between(normal,' Size specification: ',' Material: ')},{name:'面料质感优先规则',prompt:between(normal,' Material: ',' Setting: ')},{name:'拍摄场景',zh:sceneDirections[scene].zh,prompt:sceneDirections[scene].prompt,overridden:v.referenceScene},{name:'产品专用拍摄角度',zh:singleProductDirection(v.product,angle,v)?.zh||(['sheet','mat','quilt'].includes(v.product)?'以下为此产品实际使用的专用角度规则。':angleDirections[angle].zh),prompt:between(normal,' Camera: ',' Pattern repeat: '),overridden:v.referenceAngle},{name:'A/B 面分配与配套要求',prompt:between(normal.slice(normal.indexOf(' Pattern repeat: ')),' degrees. ',' Show physically plausible texture, thickness, seams, light and shadows;')}],prompts,edits,notice:'组合预览使用与生成相同的提示词函数，不发送生图请求。智谱的花型、场景及质感识别摘要以占位说明展示，实际内容会随上传图片变化。'};
    result.sections.forEach((item,i)=>item.id=sectionIds[i]);
    if(v.product==='set'){
      const crafts=layeredSetDetails(raw).map(rule=>({id:rule.group==='被套工艺'?'duvet':rule.group==='床单款式'?'surface':'pillow',name:rule.group,prompt:layeredSetGroupPrompt(raw,rule)}));
      result.sections.splice(1,1,...crafts);
      result.sections.find(item=>item.id==='placement').name='印花边饰规则（正反归属见产品结构）';
    }
    for(let i=0;i<result.sections.length;i++){
      const item=result.sections[i],id=item.id,scope=sectionScope(raw,scene,angle,id),saved=sectionEdits?await sectionEdits.get(scope):{version:null,updatedAt:null,prompt:null};
      Object.assign(item,{id,scope,version:saved.version,updatedAt:saved.updatedAt,defaultPrompt:item.prompt,custom:saved.prompt!==null,scopeLabel:{product:'当前产品类别，适用于所有场景与角度',size:raw.product==='set'?'当前被套工艺、床单款式和枕套工艺组合，适用于所有场景与角度':'当前产品类别，适用于所有场景与角度',material:'当前产品与质感方式，适用于所有场景与角度',scene:'当前场景，适用于所有产品与角度',camera:'当前产品类别与拍摄角度，适用于所有场景',placement:'当前产品类别与 A/B 面方式，适用于所有场景与角度'}[id]});
      if(saved.prompt!==null){item.prompt=saved.prompt;item.zh='';}
      if(v.product==='set'&&id==='product'){item.prompt=result.prompts.sub2api.match(/ Product: ([\s\S]*?)\. Size specification: /)?.[1]||item.prompt;item.scopeLabel='四件套共有结构；自动合并当前A或A/B裁片规则';}
      if(['duvet','surface','pillow'].includes(id)){
        item.prompt=layeredSetGroupPrompt(v,layeredSetDetails(v).find(rule=>rule.group===item.name));item.zh='';
        item.scopeLabel='当前'+item.name+'选项，适用于所有四件套组合、场景和角度；边饰范围按当前结构及补充要求自动合并';
      }
    }
    result.beddingFidelity={version:beddingFidelityVersion,rule:beddingFidelityRule(v)};
    return result;
  }
  async function saveSection(q){
    if(!q||typeof q!=='object'||!sectionIds.includes(q.id)||q.reset!=null&&typeof q.reset!=='boolean')throw Error('提示词编辑参数无效');
    const data=await preview(q.configuration),item=data.sections.find(s=>s.id===q.id);
    if(!sectionEdits)throw Error('逐条编辑不可用');
    return sectionEdits.save({scope:item.scope,prompt:q.reset?null:q.prompt,version:q.version});
  }
  function record(entry){const item={...entry,angleName:entry.angleName||angleName({product:entry.product,fabric:entry.fabric,...(entry.product==='pillowcore'?{pillowcoreVariant:entry.variant}:entry.product==='quilt'?{quiltSeason:entry.variant}:entry.product==='sheet'?{sheetVariant:entry.variant}:entry.product==='mattress'?{mattressVariant:entry.variant}:entry.product==='blanket'?{blanketVariant:entry.variant}:entry.product==='sleepbag'?{sleepbagVariant:entry.variant}:{})},entry.angle),id:randomUUID(),time:new Date().toISOString()};records.unshift(item);records.length=Math.min(records.length,120);return item.id}
  return {catalog,preview,saveSection,record,listRecords:()=>records.map(({prompt,...metadata})=>metadata),getRecord:id=>records.find(item=>item.id===id)||null};
}

export function localAdminRequest(req){
  return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'')&&(!req.headers.origin||req.headers.origin==='http://'+req.headers.host)&&req.headers['sec-fetch-site']!=='cross-site';
}
