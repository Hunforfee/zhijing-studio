export const MAX_DETAIL_IMAGES=25;
export function detailExpansionRequired(materialCount,count){
  return Number.isSafeInteger(materialCount)&&materialCount>0&&count>materialCount*2;
}
export function detailExpansionMessage(materialCount,count){
  return `已上传 ${materialCount} 张素材，计划生成 ${count} 张详情页。素材较少，将基于已上传素材智能扩展产品图、局部细节和创意图，生成所选数量的详情页。是否继续？`;
}
export function validateDetailExpansion({materialCount,count,expandMaterials}){
  if(materialCount!=null&&(!Number.isSafeInteger(materialCount)||materialCount<1||materialCount>1000))throw Error('素材数量应为1至1000张');
  if(expandMaterials!=null&&typeof expandMaterials!=='boolean')throw Error('智能扩展确认参数无效');
  if(expandMaterials===true&&materialCount==null)throw Error('请提供用于智能扩展的素材数量');
  return {required:detailExpansionRequired(materialCount,count),confirmed:expandMaterials===true};
}
