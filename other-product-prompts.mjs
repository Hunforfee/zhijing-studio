// Shared selected-product evidence for generation, compact prompts and review.
// Brand research informs physics, never supplies the user's print or SKU details.
export const otherProductPromptVersion='2026-10-11.layered-products-v1';
export const otherProductStructures={
  'quilt:winter':'冬被：1件成品填充被，壳布包覆连续填充体，缝线压低、格内柔软隆起，厚边和翻折可压缩；不是被套另套被芯。方格为默认绗缝，兼容的用户工艺参考可调整压线布局；不推断羽绒、蚕丝等填料成分。',
  'quilt:summer':'夏凉被：1件轻薄低蓬松填充被，薄壳布、浅压线、窄缝边，翻折薄软贴床；不是厚冬被或无填充床单。菱格为默认绗缝，兼容的用户工艺参考可调整压线布局。',
  'sheet:flat':'床单：1张无填充连续薄布，顶面越过床垫边自然外垂，角部布量叠压、窄折边；无弹力角袋、接裙或填充压线。翻边仍是同一薄布，床垫厚度不属于床单。',
  'sheet:fitted':'床笠：1件无填充包覆物，薄顶面连接薄侧围，缝合角袋包住床垫，松紧底缘收在下面；顶面与侧围无绗缝，不生成下垂床裙。角袋保持安装，只自然露出可见底缘。',
  'sheet:quilted':'夹棉床笠：1件顶面轻薄夹棉的床笠，浅绗缝只压低顶面填充，侧围为无填充薄布，连接四角及松紧底缘；不把格内画成冬被仓，不把侧围画成夹棉裙。',
  'mat:ice':'冰丝席：1张无填充薄型柔软编织席，细密交织网纹、窄织带边，平铺床垫顶面；抬角形成小幅薄弧，无被子蓬松仓或长裙摆。不凭名称推断纤维比例。',
  'mat:rattan':'藤席：1张无填充紧密交织席，扁条经纬交错、表面细纹、边带连续；偏挺而薄，抬边为克制宽弧，不能揉成软布团，不推断天然或仿藤成分。',
  'mat:bamboo':'竹席：1张薄型连接竹条席，竹条自身保持直硬，弯曲只发生在条片之间真实连接处；纹理及穿线随条片固定，边带平直受承托，无软被翻折或填充。',
  'mattress:thin':'薄款绗缝垫：1张轻薄软夹棉垫平铺承托床垫顶面，压线浅、边窄；垫层与下方床垫分离。只轻抬小角，其余至少三分之二受承托，无松紧床笠侧围。',
  'mattress:padded':'加厚床褥垫：1张柔软可压缩床褥垫，填充属于垫子本身，缝处压低、仓内柔和隆起；宽弧弯角与承托阴影真实，无床裙、弹力角袋或硬弹簧侧墙。',
  'mattress:foam':'乳胶/海绵垫：1张均匀低矮支撑芯层垫，布套顶面连接短侧壁和底面；不画成蓬松填充仓。展示底面时同一垫稳立长边，不拆芯、不卷折，不捏造内部成分或剖面。',
  'blanket:fleece':'单层薄绒毯：1条无填充短密绒薄毯，细短绒与轻薄毯身分开表达，薄褶自然受重力、窄缝边；不变成厚双层毯、皮毛长簇或绗缝被芯。',
  'blanket:milk':'牛奶绒加厚毯：1条无填充高克重双面短密绒毯，绒向产生克制明暗，厚实毯身与圆润折边有重量。提花起伏仅在用户资料明确支持时出现，不把印花自动变成方格提花或刺绣。',
  'blanket:cloud':'拉舍尔双层毯：1条两层绒面复合的无填充厚毯，层间紧贴，无独立填充仓，重力形成宽软褶；所选默认四周缎边属于边饰，不把整条绒面变成亮缎。',
  'blanket:gauze':'纱布毯：1条无填充多层疏织纱布毯，细小经纬孔隙与自然水洗皱感，窄布边连接所有纱层；层数属于同一毯，不生成多条叠毯，无绒毛或被芯压线。',
  'sleepbag:travel':'旅行睡袋：1件无填充薄布隔脏内衬，上片覆盖、下片躺卧，等宽薄布只在两长边脚侧下半段缝合至中段；头侧两边自由敞开。隐形拉链仅脚端短边，枕袋在下片头端背面，1只素枕在下片下面。不是露营填充睡袋。',
  'pillow:standard':'枕套：只展示2只可拆枕套包覆的普通睡枕，填芯提供软体积与受压底部；侧面可见布宽随机位变化，不自动新建拼接侧围。不为了特写造拉链、开口或额外装饰枕。'
};
export function otherProductKey(v={}){
  const variant=v.product==='quilt'?(v.quiltSeason||(v.size?.includes('夏凉被')?'summer':'winter')):v.product==='sheet'?(v.sheetVariant||(v.size?.includes('夹棉')?'quilted':v.size?.includes('床笠')?'fitted':'flat')):v.product==='mat'?(['ice','rattan','bamboo'].includes(v.fabric)?v.fabric:v.matVariant||'ice'):v.product==='mattress'?v.mattressVariant||'thin':v.product==='blanket'?v.blanketVariant||'fleece':v.product==='sleepbag'?v.sleepbagVariant||'travel':'standard';
  return v.product+':'+variant;
}
export function otherProductPlacement(v={}){
  if(!otherProductStructures[otherProductKey(v)])return '';
  const hasB=!!(v.imageBBytes||v.imageB);
  const pillow=['quilt','sheet','mat','mattress','pillow'].includes(v.product)?'配套枕套各自正面A、反面'+(hasB?'B':'A')+'；普通睡枕2只，全景可见、细节可出画。':'';
  const panel=v.product==='sheet'?'整张床单或床笠的顶面、反面、侧围、角袋与折边全部用'+(hasB?'B':'A')+'。':v.product==='mattress'?'垫子顶面及全部侧围用A，实际底面用'+(hasB?'B':'A')+'。':v.product==='sleepbag'?'上片外面及下片躺卧面A，上片反面及下片底面'+(hasB?'B':'A')+'，背面枕袋沿用下片底面；枕芯保持素色。':v.product==='pillow'?'': '主体正面A，真实反面/底面'+(hasB?'B':'A')+'。';
  return panel+pillow+'包边跟随相邻实际布面；未上传B不新增素色协调面。翻折露出同一裁片的真实反面，压线、绒向和阴影不切换A/B。';
}
export function otherProductRule(v={},compact=false){
  const structure=otherProductStructures[otherProductKey(v)];
  if(!structure)return '';
  return '【单品分层规则 '+otherProductPromptVersion+'】'+structure+'【布面归属】'+otherProductPlacement(v)+(compact?'':'【材质与取景】先满足所选层数、软硬、连接和厚薄，质感参考只调整兼容的织纹/绒感/光泽，不复制花色，不将纱布或竹席改成绒毯。不同裁片独立取花，同片印花随形连续，不强制跨缝对花。主图突出单品整体与铺放，特写突出实际连接的表面或缝边；按当前镜头判断可见部件，不强露隐藏反面。场景参考与自动创意不能增加未选床品，原始A/B和当前款式始终优先。');
}
