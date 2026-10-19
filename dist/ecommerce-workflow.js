export const commerceTasks={
  marketing:[
    {id:'daily',name:'日常主图',brief:'制作适合店铺日常使用的简洁商品海报，突出图片主体。'},
    {id:'new',name:'上新海报',brief:'采用清新、有新鲜感的上新海报风格；不凭用途选项断言商品刚上市。'},
    {id:'sale',name:'活动促销',brief:'制作重点清晰的活动海报；只使用已确认的活动和价格，未提供时不写折扣或价格。'}
  ],
  audit:[
    {id:'visual',name:'图片自检',brief:'检查图片中的明显文字冲突及多图可见商品外观疑点。没有商品资料时只做图片自检，不杜撰对照资料、尺寸、功能或结论。'},
    {id:'compare',name:'对照商品资料',brief:'对照已提供商品资料核对图片，标出具体图文冲突与需要人工核实的内容；不能验证的项目列为待确认。'}
  ]
};
export function commerceBrief(tool,task,brief=''){
  const purpose=commerceTasks[tool]?.find(t=>t.id===task)?.brief|| (tool==='size'?'根据用户填写的实际尺寸整理导购说明，不通过图片测量、不补未知数值。':'');
  return [purpose,brief.trim()&&'本次补充要求：'+brief.trim()].filter(Boolean).join('\n').slice(0,2000);
}
export function primarySizeKeys(category){return category==='枕芯'?['pillowWidth','pillowLength']:['床单','床笠'].includes(category)?['sheetWidth','sheetLength',...(category==='床笠'?['wrapHeight']:[])]:['coverWidth','coverLength'];}
export function sizeVariantName(variant,index){return variant.name.trim()||'规格 '+(index+1);}
