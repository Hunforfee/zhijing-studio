// Child-bed intent survives recommendation placeholders and provider templates.
export function isChildBed(v={}){return v.childBed===true||v.scenes?.includes('childbed');}
export const childSettings=[
  ['奶油童房','cream children bedroom, low rounded single child bed, small oak bookshelf'],
  ['原木童房','natural pine single child bed, warm timber floor, child-height open shelving'],
  ['窗边童床','single child bed beside a broad window, sheer curtains, low reading bench'],
  ['浅蓝童房','muted powder-blue wall, white single child bed, small rounded nightstand'],
  ['鼠尾草童房','soft sage wall, oak single child bed, woven storage basket'],
  ['桃粉童房','restrained blush wall, cream single child bed, scalloped wall niche'],
  ['阁楼童房','bright attic children room, roof window, low single child bed'],
  ['阅读角童房','single child bed adjoining a child-height reading nook and book ledges'],
  ['拱窗童房','arched window, pale wood single child bed, neutral linen curtains'],
  ['现代童房','clean geometric color-block wall, rounded low single child bed'],
  ['森林童房','subtle woodland wall decoration, pale oak single child bed, soft daylight'],
  ['云朵童房','simple non-lettered cloud wall decoration, white single child bed'],
  ['藤编童房','low single child bed with cane headboard, cream wall and textured rug'],
  ['乡居童房','white painted single child bed, shuttered window and low timber shelf'],
  ['榻式童房','low raised single child-bed platform, built-in drawers and soft wall padding'],
  ['画室童房','single child bed, a small drawing desk in background, simple unlettered framed art'],
  ['阳光童房','single child bed, broad side window, muted warm yellow wall niche'],
  ['格栅童房','single child bed with low wood slat headboard, small child-height storage unit'],
  ['侘寂童房','single child bed, warm textured plaster wall, minimal rounded furniture'],
  ['游戏角童房','single child bed beside a tidy floor play corner, wooden toy shelf']
];
export const childProps=['小书架上的无字绘本与木玩具','床边矮柜上的小型毛绒玩具','少量木质积木与收纳篮','背景墙上的无字童趣画与小地毯','床边绘本篮与柔软圆形地毯','矮书架上的木质小车','小型布偶与浅色布艺收纳箱','背景中的儿童画桌与无字画框'];
export const childLayouts=['一只睡枕自然平放于床头偏左','一只睡枕松弛斜靠床头偏右','一只睡枕横放床面上半部','一只睡枕略偏中心自然侧靠'];
export function createChildScenePlan(count,random=Math.random){
 const scene=childSettings[Math.floor(random()*childSettings.length)];return Array.from({length:count},()=>[...scene]);
}
export function childBedRule(v,compact=false){
  if(!isChildBed(v))return '';
  const assigned=v.recommendationPlan?.[v.recommendIndex||0]?.scene||v.childScenePlan?.[v.recommendIndex||0]||childSettings[0];
  if(compact)return '【儿童床展示】真实CHILD BED儿童单人床，宽80–100cm、长180–200cm，低床架圆角家具；不用成人双人床、婴儿围栏或玩具床。所有产品按儿童床承托，保留原A/B花色、颜色、款式工艺，不增卡通花型或未选床品。'+(['set','quilt'].includes(v.product)?'被套规格固定150×200cm。':'')+'床单四边及床尾全部压入床垫下方，不露床单垂边；仍是独立布片，不新增松紧角袋床裙，被套可自然覆盖。只陈列一只睡枕，无第二睡枕、装饰抱枕或枕堆；特写可留枕在画外。儿童陈列优先成人模板，售卖规格不变。本组环境：'+assigned[0]+'。同组所有图片保持同一个房间、床架、窗位、家具、玩具和光线方向，仅改变机位景别，下组再随机。少量绘本木玩具放背景，不盖商品；按分配机位裁切，细节不为露枕拉远，不拍床单垂边。';
  return '【儿童床展示】本次所有产品都在儿童单人床上展示：床宽约80–100cm，床长约180–200cm，低床架、圆角家具；不是成人双人床、婴儿围栏床或缩成枕头大小的玩具床。床头与枕套保持真实比例。'+
    '所选产品按儿童床展示比例适配，成人床尺寸文字不决定本场景床宽；保留款式结构、工艺、原A/B花色及颜色，不替换成卡通花型，不添加未选床品。小件与旅行睡袋也以儿童床为承托，不能改用成人床或桌面。'+
    (['set','quilt'].includes(v.product)?'本场景被套规格固定150×200cm，保持真实比例，不能扩成成人200×230cm被套。':'')+
    '床单四边及床尾全部压入床垫下方，床垫侧面以下不露床单、床单垂边或散落余布；床单仍是独立布片，不把压入造型改成新增松紧、角袋或缝接床裙。床面被套可自然覆盖，但不得把被套垂边误当床单。此儿童陈列规则优先于模板中的床单外垂要求。'+
    '只陈列一只睡枕及其枕套，不添加第二只睡枕、装饰抱枕或枕头堆叠；特写可将唯一睡枕留在画外，不为露枕拉远。儿童场景陈列优先于成人模板枕头数量，售卖套装规格与所选工艺不变。'+
    '本图童趣环境：'+assigned[0]+'，'+assigned[1]+'。采用儿童尺度家具与柔和童趣造型，环境色调呼应原花型，同组所有图片保持同一个房间、床架、窗户位置、家具布局、背景玩具和光线方向，只改变摄影机位与景别；下一组再随机选择童房。'+
    (compact?'摄影按所选机位景别，全景保留窄床单枕比例，细节展示原花型织纹工艺，不为露枕拉远，不拍床单垂边。':'摄影以床尾正面、左右35–55度斜侧、单侧轮廓、垂直俯视、床头唯一枕套近景与被套花型/缝边特写为主；实际机位按用户选择或随机分配，不按序号固定。全景突出窄床尺度、儿童床品与单枕比例，采用自然透视，背景书架玩具可虚化；细节展示原图案、织纹与所选工艺，不为展示房间或枕头拉远，不拍床单悬垂细节。')+
    '推荐场景限儿童卧室，少量绘本、木玩具或布偶放在背景，不盖住商品；机位、俯视、侧视及特写仍按所选或分配方案，细节裁切不强行露出整床。'+
    (compact?'':'This child-bed requirement overrides adult-size furniture, adult-room settings and tabletop supports in earlier templates or references. Preserve product construction and uploaded prints; use a realistic single CHILD BED, never a full-sized adult double bed. No people, invented cartoon motifs, candles or alcohol props.');
}
export function applyChildBedDisplay(prompt,v,compact=false){
  const rule=childBedRule(v,compact);if(!rule)return prompt;
  // Remove only the legacy furniture/support commands that contradict this mode.
  const base=prompt.replace(/不塞床底/g,'床单全部压入床垫下方').replace(/床面部件是一张独立薄型平床单，从床垫顶面连续越过边缘，在床框及床腿外侧自然下垂，角部余布形成松弛叠褶/g,'床面部件是一张独立薄型平床单，四边和床尾全部压入床垫下方，床侧以下不露余布').replace(/90[-–]120\s*cm/g,'80–100cm').replace(/(?:exactly\s+)?(?:two|TWO|both|BOTH)\s+(?:matching\s+|included\s+|removable\s+|standard rectangular sleeping\s+|low-profile rectangular sleeping\s+)?(pillows|pillowcases)/g,(_,kind)=>kind==='pillows'?'one pillow':'one pillowcase').replace(/pillow pair|pair of matching pillowcases|pair of pillows/gi,'single matching pillow').replace(/两只(?:睡眠)?枕套|(?:两|2)只(?:配套枕套包覆的枕头|枕头|枕套)/g,'一只枕套包覆的睡枕').replace(/2至4只|[2-4]只同款(?:枕套包覆的枕头|睡枕)/g,'一只同款睡枕').replace(/full-sized (?:wooden )?bed/g,'single child bed').replace(/standard double bed/g,'single child bed')
    .replace(/without adding a bed or pillow/g,'using the selected child bed as support, without adding unselected bedding')
    .replace(/For single small products use a realistic table or support within this environment\./g,'For small products use the child mattress as their support.');
  return base.includes(rule)?base:base+' '+rule;
}
