import {readFileSync} from 'node:fs';

// Approved product rules, shared by runtime generation and the admin inspector.
export const setPromptData=JSON.parse(readFileSync(new URL('./set-prompt-data.json',import.meta.url),'utf8'));
export const setLayeredVersion='2026-10-11.set-front-edge-v5';
const starts={standard:'普通平床单：',fitted:'床笠替代平床单：',skirt:'连体床裙替代平床单：','pleated-skirt':'百褶连体床裙替代平床单：','ruffle-skirt':'荷叶连体床裙替代平床单：',coverlet:'合体床罩替代平床单：',plain:'被套简约细缝边',piping:'被套外缘单圈细圆埋绳','wide-flange':'被套外缘4至6厘米','narrow-flange':'被套外缘1至2厘米',binding:'被套外缘平整撞色窄布包边',ruffle:'被套外缘单层柔软抽褶荷叶边',lace:'被套外缘细窄镂空蕾丝',scallop:'被套外缘连续圆弧波浪边','pillow-plain':'每只枕套简约细缝边','pillow-piping':'每只枕套外缘单圈细圆埋绳','pillow-wide-flange':'每只枕套外缘4至6厘米','pillow-narrow-flange':'每只枕套外缘1至2厘米','pillow-binding':'每只枕套外缘撞色窄布条包边','pillow-ruffle':'每只枕套外缘单层柔软抽褶荷叶边','pillow-lace':'每只枕套外缘细窄镂空蕾丝','pillow-scallop':'每只枕套外缘连续圆弧波浪边'};
export function layeredSetDetails(v={}){
  if(v.product!=='set')return [];
  const parts=String(v.size||'').replace(/^.*?三组同时满足：/,'').replaceAll('两只枕套','每只枕套').split(/[；;]/).map(p=>p.trim());
  return setPromptData.groups.map(g=>{
    const option=g.options.find(o=>parts.some(p=>p.startsWith(starts[o.id])))||g.options.find(o=>o.id===g.default);
    return {...option,group:g.name,match:starts[option.id],detail:option.prompt};
  });
}
export function layeredSetStructure(v={}){
  const hasB=!!(v.imageBBytes||v.imageB);
  let common=v.promptSections?.product||setPromptData.base.prompt;
  for(const rule of [setPromptData.base.ab,setPromptData.base.aOnly,setPromptData.base.panelIdentity])if(rule)common=common.replaceAll(rule,'').trim();
  if(!common.includes('最多4只'))common+=' 装芯枕套总数最多4只，数量位置按摄影造型安排，不限床头。';
  return [common,hasB?setPromptData.base.ab:setPromptData.base.aOnly,setPromptData.base.panelIdentity].filter(Boolean).join(' ');
}
export function layeredSetSpecification(v={}){
  if(v.product!=='set')return v.promptSections?.size??v.size??'';
  return layeredSetDetails(v).map(r=>r.group+'：'+layeredSetGroupPrompt(v,r)).join(' ');
}
// The exception concerns pillow edges, never the duvet's independently fixed three sides.
export function pillowThreeEdges(v={}){
  let subject=false,three=false;
  for(const clause of cleanSetNotes(v.notes).split(/[。；;\n，,]/)){
    let previous=0,mentionedPillow=false;
    for(const match of clause.matchAll(/枕套|枕头|被套|被子|床单|床笠|床裙|(?:三|3|四|4)(?:条)?(?:边|侧|面)|四周/g)){
      if(/套|头|被子|床单|床笠|床裙/.test(match[0])){subject=/枕/.test(match[0]);mentionedPillow||=subject;continue;}
      if(!subject&&!(mentionedPillow&&/都|均|同样/.test(clause.slice(previous,match.index)))){previous=match.index+match[0].length;mentionedPillow=false;continue;}
      const negative=/(?:不[要做是用]|取消|无需|不能)[^，。；]{0,8}$/.test(clause.slice(previous,match.index));
      if(!negative)three=/^(?:三|3)/.test(match[0]);
      else if(/^(?:三|3)/.test(match[0]))three=false;
      previous=match.index+match[0].length;mentionedPillow=false;
    }
  }
  return three;
}
function edgeAppearance(prompt){
  // Side coverage is supplied once from the current structure, including saved admin overrides.
  let detail=String(prompt);
  for(const rule of [setPromptData.base.duvetEdge,setPromptData.base.pillowFour,setPromptData.base.pillowThree])detail=detail.replaceAll(rule,'').trim();
  return detail
    .replace(/(?:被套|枕套)外沿未上传对应工艺参考：[^。]*。独立缝接边条仍按真实裁片取花，不强制跨缝对花；蕾丝保留所选镂空结构。|(?:被套|枕套)外沿已上传对应工艺参考：[^。]*。/g,'')
    .replace(/(?:被套|枕套)平布外沿正面与填芯主体正面同属A面；[\s\S]*?侧视、受压和阴影不把A边变成B边。/g,'')
    .replace(/左右长边及床尾短边/g,'所选三边')
    .replace(/；床头短边保留细缝，不加(?:宽边|窄边)。/g,'。')
    .replace(/原主体长宽不缩减[；。]?/g,'')
    .replace(/(?:四周|四边|四侧|一圈)/g,'所选边缘');
}
export function layeredSetGroupPrompt(v,rule){
  const id=rule.group==='被套工艺'?'duvet':rule.group==='床单款式'?'surface':'pillow';
  const detail=v.promptSections?.[id]??rule.detail;
  if(id==='surface'||/^(?:pillow-)?plain$/.test(rule.id))return detail;
  const coverage=id==='duvet'?setPromptData.base.duvetEdge:pillowThreeEdges(v)?setPromptData.base.pillowThree:setPromptData.base.pillowFour;
  const fabric=setEdgeFabricRule(v,rule);
  const appearance=hasUserEdgeReference(v,rule)?edgeAppearance(detail):edgeAppearance(detail).replace(/撞色/g,'同花型').replace(/默认边饰颜色从上传花型已有配色选取，不另造第三印花，不覆盖主体花型。/g,'');
  return coverage+' '+appearance+' '+fabric;
}
function hasUserEdgeReference(v,rule){
  const kind=rule.id.replace(/^pillow-/,'');
  return !!(v.craftReferenceBytes?.[kind]||v.craftReferences?.[kind]);
}
export function setEdgeFabricRule(v={},rule){
  if(v.product!=='set'||!rule||rule.group==='床单款式'||/^(?:pillow-)?plain$/.test(rule.id))return '';
  const component=rule.group==='被套工艺'?'被套':'枕套';
  if(hasUserEdgeReference(v,rule))return component+'外沿已上传对应工艺参考：边饰花色与材质按该图可见细节，主体A/B不变。';
  const identity=component+'外沿未上传对应工艺参考：外沿正面直接延续主体A花型和底色，反面直接延续主体'+((v.imageBBytes||v.imageB)?'B':'A')+'花型和底色，内侧压线不切换花型；不改素色、撞色或另造边饰图案。独立缝接边条仍按真实裁片取花，不强制跨缝对花；蕾丝保留所选镂空结构。';
  return identity+(/flange|scallop/.test(rule.id)?component+'平布外沿正面与填芯主体正面同属A面；内侧压线只是填芯区与无填充边的界线，不是A/B接合缝。从主体正面跨过压线到外缘始终为A，B仅在真实反面露出，不围成正面边框；侧视、受压和阴影不把A边变成B边。':'');
}
export function layeredSetEdgeRule(v={}){
  const selected=layeredSetDetails(v),hasB=!!(v.imageBBytes||v.imageB),rules=[];
  if(selected.some(r=>/flange|scallop/.test(r.id)&&!hasUserEdgeReference(v,r)))rules.push('平布边沿所属正反裁片分别延续'+(hasB?'A/B':'A')+'花型；内侧压线不改变布面归属。');
  if(selected.some(r=>/piping|binding|ruffle$|lace$/.test(r.id)))rules.push('独立边饰按对应所选工艺生成，不用翻折露出的反面代替边饰。');
  return rules.join(' ');
}
export function cleanSetNotes(notes=''){
  return String(notes).replace(/\s*四件套规格中的被套工艺、床单款式、枕套工艺同时生效[\s\S]*?按所选机位展示可见结构。/g,'').trim();
}
export function normalizeSetCamera(camera=''){
  return String(camera).replace(/both sleeping pillows|both pillows|two head pillows|two pillows|pillow pair/gi,'styled pillows')
    .replace(/两只枕头/g,'造型中的枕头').replace(/两只枕套/g,'所选枕套');
}
export function composeLayeredSet(v,{references='',material='',scene='',camera='',pose='',recognition='',extra=''}={}){
  return [
    'Create ONE photorealistic commercial bedding product photograph.',references,recognition,
    ' Product: '+layeredSetStructure(v)+'. Size specification: '+layeredSetSpecification(v)+'. Material: '+material,
    ' Setting: '+scene+'. Camera: '+normalizeSetCamera(camera)+(pose?' 产品铺放：'+pose:'')+'. Pattern repeat: '+(v.repeat==='single'?'one large centered placement motif':'continuous repeating print')+', motif scale '+v.scale+'%, rotation '+v.direction+' degrees. '+(v.promptSections?.placement??layeredSetEdgeRule(v)),
    ' Show physically plausible texture, thickness, seams, light and shadows; print follows perspective and folds. Closely preserve uploaded motif shapes, base colors, lettering and relative layout. Ignore only external sample borders, rulers and background objects. Aspect ratio '+v.ratio+'. No people, added lettering or logos.',
    'Client styling request: '+(cleanSetNotes(v.notes)||'none')+'. 已选结构、正反花型和工艺优先；摄影造型按本次安排。',extra
  ].filter(Boolean).join(' ');
}
// Manual full replacements retain one structure block, not multiple trailing guards.
export function enforceLayeredSet(prompt,v){
  if(v.product!=='set')return prompt;
  const structure=layeredSetStructure(v),spec=layeredSetSpecification(v);
  let result=prompt;
  if(/ Product: [\s\S]*?\. Size specification: /.test(result))result=result.replace(/ Product: [\s\S]*?\. Size specification: /,' Product: '+structure+'. Size specification: ');
  else if(!result.includes(structure))result=' Product: '+structure+'. Size specification: '+spec+'. Material: 按当前质感设置。 '+result;
  if(/\. Size specification: [\s\S]*?\. Material: /.test(result))result=result.replace(/\. Size specification: [\s\S]*?\. Material: /,'. Size specification: '+spec+'. Material: ');
  if(!result.includes(spec))result+=' 所选款式：'+spec;
  return normalizeSetCamera(result);
}
