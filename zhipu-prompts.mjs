import {sceneDirections,angleDirections} from './photography-prompts.mjs';
import {composeLayeredSet,setPromptData} from './set-layered-prompts.mjs';
import {otherProductPlacement} from './other-product-prompts.mjs';
import {enforceBeddingFidelity} from './bedding-fidelity.mjs';
import {setProductPrompt,setSpecificationPrompt,setCameraConstruction} from './set-product-prompts.mjs';
import {setSurfacePlacement,setPanelBoundaryRule} from './set-surface-prompts.mjs';
import {quiltSeason} from './quilt-prompts.mjs';
import {sheetVariant} from './sheet-prompts.mjs';
import {singleProductPrompt,singleProductPlacement,singleProductDirection} from './dist/camera-contract.js';
import {craftReferenceSpecs} from './craft-references.mjs';
import {compactRecommendationSections} from './shooting-recommendation.mjs';
import './dist/fabric-library.js';
export const zhipuModels=['glm-image','cogview-4-250304','cogview-4','cogview-3-flash'];
const libraryTextures=Object.fromEntries(globalThis.beddingFabricLibrary.map(entry=>[entry.id,entry.name+'：'+entry.hint]));
const textures={cotton:'细密织纹、柔软哑光',satin:'细腻缎纹、柔亮缎光',silk:'顺滑丝光、轻柔垂坠',linen:'粗细纱线麻纹、干爽哑光',velvet:'蓬松短绒、柔软厚实',brushed:'细短绒毛、温暖哑光，非厚绒毯',washed:'松弛自然细皱、柔软哑光',tencel:'柔顺垂感、细腻克制微光',jacquard:'立体织纹、细微织造凹凸，保持花型配色',ice:'细密网状编织、薄型柔软微光',rattan:'紧密横向藤条编织、平整硬挺',bamboo:'清晰竹片条纹、穿线接缝、硬挺平整'};
const structures={set:'四件套：1件被套、1件床单、2只套有枕套的枕头。床单默认床侧与床尾自然下垂，不塞床垫；若指定床笠/床裙/床罩则替代床单。被套工艺、床单款式、枕套工艺同时满足，各工艺只用于所属部件，不互相沿用。',mat:'凉席：1张薄型平铺凉席、2只同材质席枕套。席面完全承托在床垫上，窄包边，无下垂裙摆、被子或蓬松填充。',pillow:'仅2只装有枕芯的枕套，柔软圆角，受重力自然压扁底部，不增加被套。',blanket:'仅1条毯子，展示真实绒面与包边，不增加被子或枕套。'};
structures.set=setProductPrompt(true);
const sheets={flat:'一张薄型单层床单，床侧和床尾自然自由下垂，有柔软竖褶与窄缝边，不收紧、不加松紧或绗缝。',fitted:'一张薄型无填充床笠，平整无绗缝面，侧围包住床垫，缝合角袋与下缘松紧收在床垫下，不加垂边或裙摆。',quilted:'一张夹棉床笠，顶面轻薄填充、默认细浅菱格绗缝（兼容工艺参考可调整压线布局）；单层无绗缝侧围贴合床垫、四角角袋和下缘松紧，不增加被子或床裙。'};
function text(value,max){return typeof value==='string'?Array.from(value.replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,max).join(''):''}
export function zhipuSummary(description){
  let parsed;try{parsed=JSON.parse(description.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}catch{}
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&typeof parsed.fabricA==='string'&&parsed.fabricA.trim())return {fabricA:text(parsed.fabricA,320),fabricB:text(parsed.fabricB,320),sourceTexture:text(parsed.sourceTexture,150),referenceScene:text(parsed.referenceScene,160),referenceAngle:text(parsed.referenceAngle,160),productDetails:text(parsed.productDetails,140),userTexture:text(parsed.userTexture,150),craftDetails:text(parsed.craftDetails,500)};
  return {legacy:text(description,1000)};
}
export function buildZhipuPrompt(v,scene,angle,description,reserve=0){
  v=compactRecommendationSections(v);
  let prompt=enforceBeddingFidelity(buildBaseZhipuPrompt(v,scene,angle,description),v,{compact:true});
  if(Array.from(prompt).length>3500-reserve){
    const summary=zhipuSummary(description);
    if(!summary.legacy){
      // Compress secondary recognition descriptions, retaining A/B prints,
      // selected crafts, explicit user notes and all final structural guards.
      for(const key of ['referenceScene','referenceAngle','productDetails','sourceTexture','userTexture'])summary[key]=text(summary[key],60);
      prompt=enforceBeddingFidelity(buildBaseZhipuPrompt(v,scene,angle,JSON.stringify(summary)),v,{compact:true});
      if(Array.from(prompt).length>3500-reserve){
        for(const key of ['referenceScene','referenceAngle','productDetails','sourceTexture','userTexture'])summary[key]=text(summary[key],20);
        prompt=enforceBeddingFidelity(buildBaseZhipuPrompt(v,scene,angle,JSON.stringify(summary)),v,{compact:true});
      }
    }
  }
  return prompt;
}
function buildBaseZhipuPrompt(v,scene,angle,description){
  const s=zhipuSummary(description),hasB=!!(v.imageBBytes||v.imageB),hasRef=!!(v.referenceBytes||v.referenceImage),sceneRef=hasRef&&v.referenceScene!==false,angleRef=hasRef&&v.referenceAngle!==false;
  if(v.product==='set'){
    const material=v.textureReferenceBytes||v.textureReferenceImage?'上传质感参考优先：'+(s.userTexture||'采用识别的织纹、绒毛、光泽和垂感')+'；不复制其花色或结构。':v.fabricMode==='selected'?'质感优先使用：'+(libraryTextures[v.fabric]||textures[v.fabric])+'；保留原花型底色。':'参考原花型图质感：'+(s.sourceTexture||'沿用可辨织纹光泽，数字花型不添加明显绒毛或亮面');
    const references=hasRef?'参考范围：'+(sceneRef?'采用参考图实际场景；':'场景使用菜单；')+(angleRef?'采用参考图机位、透视与取景，勿为留白拉远；':'机位使用菜单；')+'参考产品细节仅采纳与所选结构兼容的部分：'+(s.productDetails||'可见接缝和铺放')+'。':'';
    return composeLayeredSet(v,{references,recognition:s.legacy||'花型A：'+s.fabricA+(hasB?'；花型B：'+s.fabricB:''),material:v.promptSections?.material??material,scene:sceneRef?(s.referenceScene||'参考照片实际场景'):'['+scene+'] '+(v.promptSections?.scene??sceneDirections[scene].zh),camera:angleRef?(s.referenceAngle||'参考照片机位与取景'):'['+(v.recommendAngle?'recommended: '+v.recommendAngleName:angle)+'] '+(v.promptSections?.camera??singleProductDirection('set',angle,v)?.zh??angleDirections[angle].zh),pose:angleRef||v.recommendAngle?'':angle==='reverse'?setPromptData.pose.turnback:'',extra:craftReferenceSpecs(v).some(ref=>ref.bytes)?'用户所选工艺图细节：'+(s.craftDetails||'按工艺参考识别结果')+'，只作用对应部件，主体仍用上传花型；所选结构高于冲突参考。':''});
  }
  let product=singleProductPrompt(v,true)||structures[v.product];
  if(v.product==='mat')product+='凉席类别：'+({ice:'薄型柔软冰丝编织席，细密网纹、窄织带包边',rattan:'紧密藤条编织席，薄而偏硬挺、平直包边',bamboo:'硬挺竹片席，条片与穿线接缝清晰，不产生软布厚褶'}[v.fabric]||'薄型编织凉席')+'。';
  if(v.product==='quilt')product=quiltSeason(v)==='summer'?'夏凉被：仅1件薄型低蓬松轻填充被，默认细小菱格绗缝（兼容工艺参考可调整压线布局）、窄包边、轻柔薄褶，不画成厚冬被或单层床单。':'冬被被芯：仅1件厚而柔软蓬松的填充被，默认宽方格绗缝（兼容工艺参考可调整压线布局），缝处压缩、格内柔软隆起、窄包边，翻折厚而可压缩，不画成硬板或薄夏被。';
  if(v.product==='sheet')product=sheets[sheetVariant(v)];
  if(['quilt','sheet'].includes(v.product))product+='全景床头保留2只配套枕套包覆的枕头；面料、边角特写可自然将枕头留在画外，不增加其他床品。';
  const placement=setSurfacePlacement(v,true)||otherProductPlacement(v)||singleProductPlacement(v,true)||(v.product==='sheet'?(hasB?'整张床单/床笠包括侧围、角部和反面均用B，枕套正面A、反面B。':'床单/床笠和枕套所有表面均用A。'):hasB?'被套/被芯/毯子正面A、反面B；床单B；枕套正面A、反面B。凉席席面与席枕套正面A，背面B。不能混合花型，只在真实翻折可见处露出反面。':'所有产品、床单、枕套正反面都用A，不增加素色反面或其他花型。');
  let camera=angleDirections[angle].zh;
  if(angle==='reverse')camera=v.product==='mat'?(v.fabric==='bamboo'?'竹席只沿可卷方向轻抬一条窄席边展示底部，不折断竹片，不画软被翻折。':'薄席轻抬一小段边缘展示底面，其余席面贴合床垫，不画被子翻折。'):v.product==='sheet'?(sheetVariant(v)==='flat'?'轻掀床单一小段薄边看反面，其余自然下垂，不画厚被翻折。':'床笠保持装在床垫上，局部略掀松紧底缘展示角袋与松紧，四角仍贴合，不画厚被翻折。'):'从床头将同一件被子宽幅松弛翻回，露出柔软不规则反面带，圆润起伏和压缩阴影，两侧自然垂落；未翻折布面仍为原正面，翻折露面按实际裁片朝向判断，不按画面上下分面。不是三角折角、直硬折线、卷筒或独立床尾巾。';
  if(angle==='pillowclose'&&['sheet','quilt'].includes(v.product))camera=v.product==='quilt'?'中近景拍被芯自身窄包边、真实缝线与所选冬夏厚度，细节占画面50%至65%，保留连续布面。':sheetVariant(v)==='flat'?'中近景拍床单自身薄包边、缝线和连续花型，细节占画面50%至65%。':'中近景拍床笠已安装的松紧角袋、顶面转侧围的接缝，细节占画面50%至65%，床笠贴合床垫。';
  if(v.product==='mat'&&['drape','foot','low'].includes(angle))camera+='只展示平直受承托的薄席边与窄包边，不产生垂坠裙摆或厚被边。';
  const specific=singleProductDirection(v.product,angle,v);if(specific)camera=specific.zh;
  camera+=setCameraConstruction(v,angle,true);
  const material=v.textureReferenceBytes||v.textureReferenceImage?'质感优先按独立上传的质感参考：'+(s.userTexture||'使用识别描述中 USER TEXTURE 的织纹、绒毛、光泽与软硬特点')+'。只参考表面质感，不复制该图花型、底色、房间或机位。':v.fabricMode==='selected'?'质感优先使用选定特征：'+(libraryTextures[v.fabric]||textures[v.fabric])+'，覆盖花型原图的表面质感；保留A/B配色与印花。':'质感优先参考原花型图：'+(s.sourceTexture||'沿用识别的织纹、绒毛、光泽、软硬；不清楚时呈现克制真实质感，不强制默认棉纹')+'。';
  return [
    craftReferenceSpecs(v).some(ref=>ref.bytes)?'用户工艺款式参考（高于默认边饰宽度和配色，只用于所列部件）：'+(s.craftDetails||'按识别描述中的工艺结构、边缘细节与装饰颜色')+'。主体花型保留A/B，房间和机位按当前设置。':'',
    '生成一张真实家纺商品摄影，非拼图。花型识别描述：',s.legacy||'FABRIC A: '+s.fabricA+(hasB?' FABRIC B: '+(s.fabricB||'沿用B面识别描述'):'')+'.',
    '产品：'+(v.promptSections?.product??product),'所选款式：'+setSpecificationPrompt(v)+'.',v.promptSections?.placement??placement,v.promptSections?.material??material,
    sceneRef?'场景优先按参考照片：'+(s.referenceScene||'识别描述中的 REFERENCE SCENE')+'；不采用菜单场景。':'场景 ['+scene+']：'+(v.promptSections?.scene??sceneDirections[scene].zh),
    angleRef?'机位、构图、取景范围优先按参考照片：'+(s.referenceAngle||'识别描述中的 REFERENCE ANGLE')+'；不采用菜单机位。':'拍摄角度 ['+(v.recommendAngle?v.recommendAngleName:angle)+']：'+(v.promptSections?.camera??camera),
    hasRef?'参考产品细节：'+(s.productDetails||'按识别描述的缝边、铺设方式与绗缝，兼容所选产品结构')+'。参考图花型和底色不能替代A/B；未勾选的参考维度必须使用菜单设置。':'',
    hasRef&&v.product==='set'?'工艺优先锁定：明确选定的被套工艺、床单款式、枕套工艺高于参考图中冲突的工艺；三组各自生效，不互相沿用。':'',
    hasRef?'参考范围锁定：'+(sceneRef?'保留识别出的实际房间结构、床头与家具、门窗、地面和光向，不改成泛化卧室。':'环境只使用当前菜单场景。')+(angleRef?'保留识别的床面方向、透视线、可见床面、主体位置与取景比例；不因全景留白默认要求拉远或改机位。':'机位、构图与取景只用当前菜单角度。'):'',
    '花型铺排：'+(v.repeat==='single'?'单个定位大花':'连续循环印花')+'，大小'+v.scale+'%，方向'+v.direction+'°，画幅'+v.ratio+'。印花随褶皱和透视变形，保留配色、图案和印花已有文字；中性白平衡、自然重力和接触阴影。不增加人物、标题或额外抱枕。全景留修图边距，特写只拍指定细节。',
    '补充要求：'+text(v.notes,500)+'，服从所选产品、A/B分配、质感与当前场景/角度。',setPanelBoundaryRule(v,true)
  ].filter(Boolean).join(' ');
}
export function zhipuImageRequest(config,v,prompt){
  if(!zhipuModels.includes(config.model))throw Error('请选择有效的智谱图像模型');
  if(Array.from(prompt).length>3500)throw Error('智谱拍摄描述过长，请缩短补充要求后再试');
  const glm=config.model==='glm-image';
  return {model:config.model,prompt,size:glm?(v.ratio==='1:1'?'1280x1280':v.ratio==='3:4'?'1088x1472':'1472x1088'):(v.ratio==='1:1'?'1024x1024':v.ratio==='3:4'?'864x1152':'1152x864'),quality:glm?'hd':'standard',watermark_enabled:true};
}
