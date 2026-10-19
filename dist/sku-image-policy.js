export const SKU_IMAGE_LIMIT=24;
export function skuEditIntent(prompt,sourceVersion='original'){
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw Error('请填写本次处理要求，最多 2000 字');
  return {sourceVersion,mode:'custom',ratio:'source',lockPattern:true,lockCraft:true,region:null,prompt:[
    '这是 SKU 图片编辑。只执行用户明确提出的修改，其余画面保持原样。默认不添加边框、留白、底板、规格文字、价格、品牌或装饰，不自动做成规格卡片；只有用户明确要求时才添加对应元素。保持原构图和宽高比例，保留商品花型、颜色、工艺和数量；仅用户明确要求改变的部分可以修改。不要将本段约束绘制成图片文字。',
    '用户本次要求：'+prompt.trim()
  ].join('\n')};
}
export function skuImageName(name,index=0,edited=false){
  const safe=String(name).replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'SKU';
  return String(index+1).padStart(2,'0')+'_'+safe+(edited?'_已处理':'');
}
