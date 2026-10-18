import {pillowcoreGuard} from './dist/pillowcore-contract.js';
// Runtime adaptation of bedding-image-fidelity; do not send agent workflow instructions to image models.
// Selected website construction is a target design, not a claim about an unverified SKU.
import {setCraftConstraint} from './set-product-prompts.mjs';
import {enforceLayeredSet,layeredSetStructure} from './set-layered-prompts.mjs';
import {sleepbagConstructionGuard} from './dist/sleepbag-contract.js';
import {applyRecommendationStyling,normalizeRecommendationDisplay} from './recommendation-styling.mjs';
import {applyChildBedDisplay} from './child-bed.mjs';
import {enforceWideFraming} from './wide-framing.mjs';
import {applyRecommendationVariation} from './recommendation-policy.mjs';
import {otherProductRule} from './other-product-prompts.mjs';
export const beddingFidelityVersion='bedding-image-fidelity/2026-10-10-craft-v6-three-side';
const marker='【床品结构约束 '+beddingFidelityVersion+'】';
const common='各部件独立，保留真实连接、厚度、承托与遮挡，无悬浮穿插。布面身份不因机位、明暗或翻折改变；折痕、压线和阴影不新建裁片或切换花型。同片图案连续随形，多图保持花型尺度方向及取花位置；跨裁片不强制对花或错位。未明确指定的开口、拉链、绑带、侧围和边饰不自行补造；不为展示细节强行露出隐藏结构。';
const types={
  set:'一件被套、一件所选床面部件、两只枕套，各自独立，内芯只提供承托不计作额外商品。翻回同一被套，床面布留在下层；枕套侧面露色不自动成为拼接侧围。三组所选工艺各属自己的部件。',
  pillow:'只生成所选两只枕套包覆的枕头，保持软体积、受压底部和松软边角；侧面露色宽度随体积与机位变化，不自动认定独立侧围；不凭空添加可见开口或拉链。',
  sheet:'床面布与被子分离，按所选床单或床笠结构铺放，不因抬边变成第二条被子。',
  quilt:'这是自身有壳布和填充的成品被芯或薄被，绗缝是压缩线，不是分离小块或印花；按所选款式厚度承托，不额外加带花型被套，不露散落填料。',
  blanket:'毯子的单层或复合层、厚薄、织纹或绒面按所选款式；翻面仍是同一毯子，不变成填芯被套，印花不自动变成绗缝或刺绣。',
  mat:'席面按所选软硬材料及连接方式弯折，保持薄型床面承托；竹片不按软被团褶，不添加填充或长裙摆。',
  mattress:'床垫顶面、侧壁、缝边及所选软硬厚度保持同一物件的连续结构，不把表面褶痕变成额外床裙或被套。',
  sleepbag:'保留所选旅行隔脏睡袋的上下薄布、侧面入口、脚端开口及背面枕袋关系，不套用普通填充睡袋或床笠结构；未选配件不从场景参考移入。'
};
const surfaces={
  flat:'平床单是一张连续薄布，自然外垂时越过床垫边落在床体外侧；角部布量自然叠压，窄折边不变成接裙，不添加收紧侧围或角袋。',
  fitted:'床笠包覆床垫顶面侧边，四角和下缘随所选结构贴合；不长出平床单长下摆。可垂落的上层被套是另一个部件。',
  quilted:'夹棉床笠仅所选顶面有轻薄填充与绗缝，侧围按所选无填充结构贴合，不长出平床单下摆或第二条被子。',
  skirt:'所选床裙的裙片连接床面部件，沿床体外侧下垂，不从被套边缘生长；褶型与下缘装饰只按所选款式。',
  coverlet:'所选合体床罩的床面与垂片按目标款式连接，不替换成弹力床笠，也不新增第五件覆盖物。'
};
export function beddingSurface(v){
  if(v.product==='sheet')return ['flat','fitted','quilted'].includes(v.sheetVariant)?v.sheetVariant:'flat';
  if(v.product!=='set')return null;
  const spec=v.size||'';
  if(spec.includes('床笠替代平床单：'))return 'fitted';
  if(spec.includes('床裙替代平床单：'))return 'skirt';
  if(spec.includes('床罩替代平床单：'))return 'coverlet';
  if(spec.includes('普通平床单：'))return 'flat';
  return null; // Unknown/custom set surface must not silently become a flat sheet.
}
export function beddingFidelityRule(v={}, {edit=false,compact=false}={}){
  if(v.product==='pillowcore'&&!edit)return pillowcoreGuard(v,compact);
  if(!types[v.product]&&v.product!=='pillowcore')return '';
  if(v.product==='set'&&!edit)return layeredSetStructure(v);
  // Zhipu already carries detailed selected construction and A/B rules; keep the
  // additional evidence/physical constraints within its 3500-character budget.
  if(compact&&!edit)return otherProductRule(v,true)+'【床品结构约束v1】各件连接承托合理，无穿插悬浮；花型随布面固定，跨裁片不强制对花或错位。未选开口配件不补造，不强露隐藏结构；参考不改所选结构，不伪造实测尺寸。';
  if(edit)return marker+' 编辑时保留原图中未要求改变的部件、连接、花型归属与工艺；按明确修改要求调整对应部件，不把调整迁移到其他部件。'+common;
  const surface=beddingSurface(v);
  return otherProductRule(v)+marker+common+types[v.product]+(surface?surfaces[surface]:'')+'明确选定的款式为本次目标设计，场景与机位参考只影响对应范围，不能覆盖产品结构；花型图不证明隐藏工艺，未核实尺寸不自行宣称为实测。';
}
export function enforceBeddingFidelity(prompt,v,options){
  if(v.product==='set'&&!options?.edit){
    const composed=enforceLayeredSet(prompt,v);
    return enforceWideFraming(applyChildBedDisplay(applyRecommendationVariation(applyRecommendationStyling(composed,v,options?.compact),v),v,options?.compact),v);
  }
  const rule=normalizeRecommendationDisplay(beddingFidelityRule(v,options),v);
  // A full manual replacement must not erase product-specific guards. The
  // normal Zhipu builder already supplies them and uses the short supplement.
  if(options?.compact&&options?.final&&!prompt.includes(rule))return enforceBeddingFidelity(prompt,v);
  const craft=options?.edit?'':normalizeRecommendationDisplay(setCraftConstraint(v,options?.compact),v);
  let guarded=craft&&!prompt.includes(craft)?craft+' '+prompt:prompt;
  const travel=options?.edit?'':sleepbagConstructionGuard(v,options?.compact);
  if(travel&&!guarded.includes(travel))guarded=travel+' '+guarded;
  const result=rule&&!guarded.includes(rule)?guarded+' '+rule:guarded;
  return options?.edit?result:enforceWideFraming(applyChildBedDisplay(applyRecommendationVariation(applyRecommendationStyling(result,v,options?.compact),v),v,options?.compact),v);
}
