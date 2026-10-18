// 毯子（blanket）三个常见款式的结构契约与机位细化。
// 款式依据找家纺网「毛毯毯子」分类真实商品归纳：单层薄绒毯、牛奶绒加厚毯、拉舍尔双层毛毯。
export const blanketVariantNames={fleece:'单层薄绒毯',milk:'牛奶绒加厚毯',cloud:'拉舍尔双层毛毯',gauze:'纱布毯'};
export function blanketVariant(v={}){return blanketVariantNames[v.blanketVariant]?v.blanketVariant:'fleece'}

const structures={
  gauze:{
    zh:'仅1条无填充纱布毯：多层轻软疏织纱布，细小经纬网格、自然起皱肌理，窄布边缝线，轻盈柔软地随重力下垂；无绒毛、缎边、填充或分仓绗缝，不生成绒毯或被芯。',
    prompt:'Exactly ONE UNFILLED BLANKET, GAUZE style: several lightweight loosely woven gauze textile layers, fine open warp/weft structure with natural softly puckered crinkles, narrow fabric-bound sewn edge and soft gravity-settled drape. The layers belong to ONE blanket, not stacked separate blankets. No fleece, fur, velvet pile, satin band, raised jacquard checks, filling or quilted compartments.'
  },
  fleece:{
    zh:'仅1条无填充单层薄绒毯：单层短绒面料，轻软薄、可自然折叠，窄缝包边，表面哑光并带轻微柔光；不是加厚双层毯或填充被芯。',
    prompt:'Exactly ONE UNFILLED BLANKET, single-layer: one continuous layer of short dense velvet-flannel pile, light and softly flexible with a clean narrow sewn hem. Its thin body folds easily under its own weight. No double-layer bonding, no satin binding band, no filling, no quilted chambers. Surface is matte with only a gentle sheen.'
  },
  milk:{
    zh:'仅1条无填充牛奶绒加厚毯：高克重双面绒，密实短绒，绒向产生克制明暗，提花起伏仅在用户资料明确支持时出现，不默认添加格纹，毯身厚实挺括、折边圆润利落，宽而紧实的包边；不是单层薄毯或印花拉舍尔。',
    prompt:'Exactly ONE UNFILLED BLANKET, thick high-gram milk-fleece: dense short plush pile on both faces with restrained directional pile shading; raised jacquard relief only when explicitly supported by user textile evidence, never invent a check motif, substantial heavy body that holds crisp rounded folds, wide firm bound edge. No single-layer thin throw, no printed raschel pile, no filling or quilting.'
  },
  cloud:{
    zh:'仅1条无填充拉舍尔双层毛毯：两层绒面复合、中间无明显填充，厚重蓬松下垂感强，四周宽幅缎面包边，绒面平整可印花；不是单层薄毯或提花牛奶绒。',
    prompt:'Exactly ONE UNFILLED BLANKET, thick double-layer raschel cloud blanket: two plush layers bonded together with no loose filling, deep soft loft and heavy gravity-led drape, wide smooth satin bound edge on all four sides, level printed pile surface. No single-layer thin throw, no raised jacquard check, no quilted compartments.'
  }
};
export function blanketProductPrompt(v,zh=false){
  const item=structures[blanketVariant(v)];
  if(!item)return '';
  return (zh?item.zh:item.prompt)+(zh
    ?'毯子始终是一整条连续面料，花型直接印在毯身，不另铺床单、不增加枕头或第二条毯子。面料质感只改变与所选产品兼容的绒面长短、织纹和光泽，不改变选定的薄厚与层数。'
    :' The blanket is one continuous textile and the uploaded print sits on the blanket itself. Do not add a bedsheet, pillows, a duvet or a second blanket. Surface material may change compatible pile length, weave and sheen only; keep gauze woven without pile and plush variants visibly plush; it NEVER changes the selected thickness or layer count.');
}
// 按款式细化的结构描述，供各机位复用。
export function blanketSurface(v){
  const kind=blanketVariant(v);
  return {
    edge:kind==='gauze'?'narrow fabric-bound sewn gauze edge':kind==='cloud'?'wide smooth satin bound edge':kind==='milk'?'wide firm bound edge':'narrow flat sewn hem',
    surface:kind==='gauze'?'fine loosely woven warp/weft gauze texture with natural soft puckered crinkles and no pile':kind==='cloud'?'level printed plush pile with soft loft and heavy drape':kind==='milk'?'dense short pile with restrained directional shading, preserving uploaded motifs without invented check relief, crisp rounded folds':'short dense velvet-flannel pile with thin flexible body and shallow soft folds',
    body:kind==='gauze'?'lightweight multi-layer unfilled gauze cloth with soft gravity-led folds':kind==='cloud'?'thick double-layer loft with strong gravity-led drape':kind==='milk'?'substantial heavy body holding its own rounded folds':'light thin body that settles and folds easily under its own weight'
  };
}
export function blanketDirection(v,angle,common={}){
  const kind=blanketVariant(v),spec=structures[kind];
  if(!spec)return null;
  const {edge,surface,body}=blanketSurface(v);
  if(kind==='gauze'&&angle==='detail')common={name:'纱布织纹特写',zh:'中近景展示纱布细小疏织经纬纹、自然起皱和相连毯面，细节占50%～65%，不生成绒毛或填充格。',prompt:'GAUZE TEXTILE DETAIL: contextual medium-close 25-45-degree photo with 85-100 mm equivalent lens, actual fine loosely woven gauze warp/weft and naturally puckered crinkles, connected surrounding blanket visible, 50-65% coverage and useful editing margin. No detached swatch, fleece pile, exaggerated fibers or quilted filling.'};
  if(common?.prompt)return {...common,prompt:common.prompt+' SELECTED BLANKET: '+spec.prompt+' Show its '+edge+' and '+surface+'.',zh:common.zh+' '+(kind==='gauze'?'保持轻软多层纱布织纹与自然皱感，无绒毛。':kind==='cloud'?'保持双层厚重与缎面包边。':kind==='milk'?'保持高克重短绒与用户实际花型，不强添提花格纹。':'保持单层轻薄与窄缝包边。')};
  const views={
    detail:{name:'毯面绒感特写',zh:'中近景拍毯子自身绒面或所选织纹及浅软褶，细节占50%至65%，绒毛尺度真实，不生成填充格或巨型毛簇。',prompt:'BLANKET TEXTILE DETAIL: contextual close-up of this blanket actual '+surface+', 85-100 mm equivalent, 25-45-degree camera. Detail 50-65% with connected fabric visible; fiber scale realistic, no inflated fur tufts, no filled quilting compartments.'},
    low:{name:'低机位薄边',zh:'床尾低机位近水平拍摄完整毯子，展示包边和自然褶皱，不生成厚被芯或床垫侧围。',prompt:'BLANKET LOW EDGE: low foot-end near-horizontal camera around mattress-edge height, 40-55 mm lens. Complete ONE blanket 60-70% of frame showing its '+edge+' and '+body+'. No thick filled duvet, padded chambers or mattress sidewall substituted for the blanket.'},
    reverse:{name:'翻折看反面',zh:'毯子床头段宽幅松弛翻回，反面形成软而不规则的横带，前面保留下半部，褶皱自然压缩，不做硬三角或独立床尾巾。',prompt:'BLANKET REVERSE DISPLAY: turn the head-end of this SAME blanket back in one broad relaxed irregular band with soft uneven folds and real contact shadows. The front remains over the lower support. Show the '+edge+' at the turned edge. Never a filled duvet, rigid triangle, rolled tube, floating flap or separate runner.'},
    foot:{name:'毯子床尾近景',zh:'略俯拍毯子下半部与完整床尾宽度，包含真实包边和两端角部，下摆自然垂落。',prompt:'BLANKET FOOT HALF: slightly elevated 30-45-degree foot camera showing the lower HALF and FULL foot width, both real hem corners, the '+edge+' and the '+body+' of the hanging lower edge. Keep continuous blanket surface and editing margins.'},
    pillowclose:{name:'毯子包边特写',zh:'中近景拍毯子真实包边缝线、一角和相连毯面，细节占50%至65%，不生成枕头、拉链或绗缝格。',prompt:'BLANKET BINDING CLOSE-UP: the actual '+edge+', one true blanket corner and surrounding connected '+surface+', 30-45-degree camera, 70-85 mm lens, detail 50-65% with margins. No pillow, pillowcase, zipper or invented quilting.'},
    drape:{name:'毯子垂坠展示',zh:'床侧中近景拍至少半条长边，从床面到垂落毯身连续可见，褶皱受重力自然下垂，不悬空或形成硬纸角。',prompt:'BLANKET SIDE DRAPE: contextual view along at least HALF the long side, camera near mattress edge, 50-70 mm lens. Continuous cloth from support top to hanging hem showing '+body+', with coherent print perspective. No floating tips, hard paper corners, padded duvet edge or second blanket.'}
  };
  return views[angle]||null;
}
export function blanketAngleName(angle,fallback=''){
  return {detail:'毯面绒感特写',low:'低机位薄边',reverse:'翻折看反面',foot:'毯子床尾近景',pillowclose:'毯子包边特写',drape:'毯子垂坠展示'}[angle]||fallback;
}
