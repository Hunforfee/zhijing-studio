// Display freedom is explicitly authorized only for system recommendations.
import {isChildBed,childProps} from './child-bed.mjs';
import {isSystemRecommendation} from './recommendation-policy.mjs';
export function creativeRecommendation(v){return isSystemRecommendation(v);}
const pillowProducts=new Set(['set','pillow','sheet','quilt','mat','mattress']);
export const displayLayouts=['错落叠靠，一只平放在床面中段','左右不对称，前景一只斜放','低矮横叠与侧靠组合','自然散放，保留舒展留白','床头侧靠与床尾单只呼应','沿床侧形成松弛对角线','一只平放，其余松弛交叠','前后层次错落，避免整齐排队','一只反面平放床面前段，其余靠在床侧形成松弛层次','两只低矮交叠，另一只斜靠窗侧床头','一只沿床面横放，其他以不同朝向散放','床头留空一侧，枕头分散在床面上半部'];
export const displayProps=['小陶瓶与一枝花','无文字封面的书与陶杯','低矮托盘与简洁香薰','花枝与小型木质边几','一盏简洁台灯与陶器','藤编小篮与绿植','无文字画册与小花瓶','少量果实与素雅陶盘','床边木凳上一册翻开的无文字画册和小陶杯','窗台一枝绿叶与床面边缘轻放的耳机','一只织篮与搭在椅背的素色小围巾','床面边缘一册书，床头柜上低矮花枝','矮几上玻璃水杯与一小碟果实','床侧简洁落地灯与一幅无文字小画'];
export const scenePropPools={warm:['哑光陶瓶与低矮花枝','原色陶杯与无文字书册','石色托盘与小陶器'],natural:['浅木托盘与陶杯','藤编小篮与一枝绿叶','无文字书册与亚麻色陶瓶'],hotel:['床头柜上玻璃花瓶与低矮花枝','深木托盘与素色陶杯','无文字画册与小金属台灯'],studio:['床台侧边低矮哑光几何陶器','床台侧边小石色托盘','床台侧边低矮干花配陶瓶'],outdoor:['木凳上的陶杯与书册','干燥平台上的藤篮与陶瓶','木质托盘与少量果实'],terrace:['浅色托盘与玻璃水杯','素色陶瓶与低矮花枝','小藤篮与无文字书册'],minimal:['几何陶器与无文字画册','简洁金属灯与素色托盘','绿叶与低矮玻璃瓶'],french:['小玻璃花瓶与疏松花枝','浅色陶盘与无文字画册','克制复古小灯与陶杯'],kids:['无文字绘本与毛绒玩具','圆角木玩具与收纳篮','小布偶与无文字绘本']};
export function propsForScene(scene,child=false){return [...(child?childProps:scenePropPools[scene]||displayProps),...(child?textileProps.kids.filter(x=>!x.includes('抱枕')):textileProps[scene]||textileProps.warm)];}
const textileProps={
 warm:['床侧一只素色亚麻装饰抱枕','床尾一角松放一小段薄针织毯','床边木凳上折叠的小纱布毯'],
 natural:['床面侧边一只细织纹装饰抱枕','椅背搭一条轻薄针织小毯','木凳上折叠的小纱布毯'],
 hotel:['床侧一只低调长条装饰抱枕','床尾一角轻搭小型素色薄毯','床边长凳上松放的小针织毯'],
 studio:['床面边缘一只小型素色装饰抱枕','床台侧边折叠的小型薄毯','床尾一角松放的小纱布毯'],
 outdoor:['干燥床面侧边一只织纹装饰抱枕','床边木凳上的小针织毯','床尾一角轻搭的薄纱布小毯'],
 terrace:['床侧一只亚麻装饰抱枕','露台椅背搭一条素色薄毯','床边干燥木凳上的小纱布毯'],
 minimal:['床侧一只几何轮廓素色装饰抱枕','床尾一角松放的小型薄毯','床边椅背上的细针织小毯'],
 french:['床侧一只细织纹长条装饰抱枕','床边椅背搭一条柔软薄毯','床尾一角小幅轻搭的纱布毯'],
 kids:['床侧小型圆形布艺装饰抱枕','床边收纳篮里的轻薄儿童小毯','床边小凳上的柔软纱布小毯']
};
export function isTextileProp(prop=''){return /装饰抱枕|小毯|薄毯|纱布毯/.test(prop);}
export function allowsTextileAccent(v={}){return !!(!isChildBed(v)&&v.smartAngles&&v.recommendShotKind==='main'&&v.recommendStyling?.propsVisible&&isTextileProp(v.recommendStyling?.props));}
export const displayLights=['柔和侧窗光，浅淡接触阴影','纱帘漫射光，细腻布面层次','温柔斜射晨光，中性白平衡','柔和逆光与正面补光','宽幅侧光，强调褶皱质感','阴天散射光，通透自然','窗影轻落背景，主体花色准确','柔和顶侧光，克制明暗层次'];
export function recommendationStylingRule(v,compact=false){
  if(!creativeRecommendation(v))return '';
  if(v.product==='pillowcore')return '【枕芯随机陈列】仅1只枕芯，按本张随机机位与光线在中性承托上平放、斜放或轻靠，定型内芯不可翻折。正A背B，仅A双面A；不添加配套枕套、第二只枕芯、被子或装饰抱枕。';
  const s={...(v.recommendStyling||{})},pillows=pillowProducts.has(v.product);
  if(isChildBed(v)){s.props=(v.smartAngles?propsForScene('kids',true):childProps).includes(s.props)?s.props:childProps[0];s.layout=(s.layout||'自然错落陈列')+'，按儿童床宽适度安排，保留单人床清晰轮廓';}
  const currentScene=v.recommendationPlan?.[v.recommendIndex||0]?.selectedScene||v.scenes?.[(v.recommendIndex||0)%v.scenes.length];
  if(currentScene==='studio'&&!v.recommendScene)s.props=(s.props||'低矮哑光几何陶器')+'，仅置于影棚床台侧边，不添加家具窗景绿植';
  const count=isChildBed(v)?1:Number.isFinite(Number(s.pillowCount))&&Number(s.pillowCount)>0?Math.min(4,Math.max(1,Math.floor(Number(s.pillowCount)))):'2至4';
  const layout=isChildBed(v)?(v.recommendStyling?.layout||'唯一睡枕自然平放于儿童床头'):s.layout||'自然错落、斜靠、平放或交叠，不局限整齐床头摆放';
  const face=isChildBed(v)?(s.reverse?'唯一睡枕可真实翻到反面朝镜头':'唯一睡枕自然展示正面或侧面'):s.reverse?'一只枕套真实翻到反面朝镜头，其余可展示正面':'枕套可正面、侧面或真实反面混合展示';
  const visibility=s.propsVisible===true?'本图必须在构图内清晰可见1至3件协调小道具，不能全部裁掉。':s.propsVisible===false?'本图以床品为主，道具可留画外，细节机位不拉远。':'';
  const panelReminder=v.product==='set'?'':'；每只仍正A背B，仅A时双面A，翻面不交换裁片';
  const accents=allowsTextileAccent(v)?'本图允许所分配的小型装饰抱枕或小毯作为摄影道具，独立于商品主体与同款枕套；不替代或新增主被、床单等售卖件。装饰抱枕最多1只且小于睡枕；小毯仅小幅搭一角或置于床边，覆盖主体不超过10%，不遮A/B分界、外沿工艺与主要花型，不铺成第二床被子。不使用杯子杯托代替本图指定道具。':'不铺额外被毯，不把场景陈列当售卖件。';
  const rule='【系统推荐创意陈列】'+(pillows?'本图陈列'+count+'只同款枕套包覆的枕头；'+layout+'。'+face+panelReminder+'。额外同款枕套是摄影陈列，不改变售卖规格。':'不新增主售床品。')+'道具：'+(s.props||'少量协调的花枝、陶器或书籍')+'。'+visibility+'；光线：'+(s.light||'柔和自然光')+'。道具材质造型匹配所选场景；从床品原花色提取1至2种呼应色或中性色，繁密花型配素净道具、简洁花型可配一件轻点缀，不改变床品颜色。根据原花色选择协调色调，主体清晰，留白与层次平衡；道具1至3件，集中在床边、窗台或床面边缘作视觉呼应，不遮挡主要花型和工艺；'+accents+'枕头自然受重力承托、软压接触、朝向高低错落，避免整齐床头排队、悬浮和刻意几何堆叠。遵守当前场景机位，特写不为容纳全部枕套道具拉远。主床品数量、尺寸、工艺、花色保持。';
  if(v.generateSet)return rule+' 套图每张按自己的随机陈列拍摄，可改变枕套数量、摆放、反面展示、道具和光线；全景展示完整床品，细节只按指定部件取景，不强行容纳全部部件。';
  if(compact)return '【系统推荐创意陈列】'+(pillows?'本图'+count+'只同款睡枕；'+layout+'；'+face+panelReminder+'。':'主售床品不增加。')+'道具：'+(s.props||'少量协调花枝或书籍')+'。'+visibility+'光线：'+(s.light||'柔和自然光')+'。道具1至3件，匹配场景与原花色，繁密花型配素净道具，不遮主要花型和工艺。'+(allowsTextileAccent(v)?'允许指定装饰抱枕或小毯：抱枕最多1只、小于睡枕；小毯只搭一角或置床边，覆盖主体≤10%，不遮A/B分界，不替代主售件，不换成杯子杯托。':'不铺额外被毯。')+'主体花色、结构、工艺保持；枕头有真实承托，细节不为道具拉远。';
  return rule+' EDITORIAL STYLING: compose a tasteful textile campaign photograph with intentional negative space, natural asymmetry, tactile folds and restrained accents. The assigned display may change pillow count, placement and visible front/reverse faces between shots. Never copy the first photograph pillow arrangement or prop layout. Keep all main bedding components and original print/craft intact; supporting props must complement, not compete with, the textile.';
}
export function normalizeRecommendationDisplay(prompt,v){
  if(!creativeRecommendation(v))return prompt;
  let result=prompt;
  if(allowsTextileAccent(v)){
    // Relax only accessory prohibitions on an assigned smart main image.
    // Main product counts, A/B identity and all detail shots remain protected.
    result=result.replace(/No duvet, blanket or second topper/g,'No duvet or second topper')
      .replace(/No duvet, blanket, second sheet or topper/g,'No duvet, second sheet or topper')
      .replace(/No duvet, blanket or second quilt/g,'No duvet or second quilt')
      .replace(/No (?:pillow or additional bedding|pillow or pillows)/g,'No additional main bedding')
      .replace(/Do not add a bedsheet, pillows, a duvet or a second blanket/g,'Do not add a bedsheet, sleeping pillows, a duvet or a second main blanket')
      .replace(/不增加被子、毛毯或第二张垫子/g,'不增加被子或第二张垫子')
      .replace(/不增加其他床品或拼花/g,'不增加其他主售床品或拼花')
      .replace(/不增加其他花型、素色协调面或床品/g,'不增加主体花型、素色协调面或主售床品')
      .replace(/不另铺床单、不增加枕头或第二条毯子/g,'不另铺床单、不增加睡枕或第二条主毯');
  }
  if(pillowProducts.has(v.product)){
    // Remove conflicting legacy display instructions, retaining sewn-panel,
    // material and selected-craft guards. Manual photography is untouched.
    result=result.replace(/Keep exactly two pillows resting front-side toward the camera with naturally compressed bases; do not force a pillow reversal simply to demonstrate B\. /g,'');
    result=result.replace(/Pillow pair stays at the head of the bed in every view;[^.]*\./g,'');
    result=result.replace(/REQUIRED (?:MATCHING|MAT|HEAD-END) PILLOW PAIR/g,'RECOMMENDED PILLOW DISPLAY').replace(/This required pair takes precedence over any old generic instruction to exclude pillows\./g,'Use the recommended display arrangement.');
    result=result.replace(/keep both clearly recognizable|Keep both recognizable/g,'Keep the visible styled pillows recognizable').replace(/Both pillowcases|Both mat pillowcase FRONTS|Both mat pillowcases/g,m=>m.replace('Both','All'));
    result=result.replace(/(?:exactly )?(?:the required )?(?:pair of matching pillowcases|matching pillowcase pair) at the head of the bed/g,'styled matching pillowcases in their assigned positions');
    result=result.replace(/two head pillows/g,'assigned display pillows').replace(/CAMERA COMPOSITION AND PILLOW-PLACEMENT reference/g,'CAMERA COMPOSITION reference').replace(/relevant pillow arrangement/g,'current recommended pillow arrangement').replace(/including both pillowcases/g,'including all styled pillowcases');
    result=result.replace(/both sleeping pillows/g,'visible display pillows').replace(/No extra cushions or separate runner/g,'No separate runner').replace(/extra cushions, duvet or blanket/g,'duvet or blanket').replace(/extra cushions or add a duvet/g,'a duvet').replace(/extra duvet, sheet, topper or decorative cushion/g,'extra duvet, sheet or topper');
    result=result.replace(/Never force two pillows into a corner\/hem detail or put them at the foot\./g,'Detail crops may exclude styled pillows.');
    result=result.replace(/resting naturally at the head of the bed/g,'resting naturally in the assigned display').replace(/not a reason to add an extra duvet, bed sheet, topper or third cushion/g,'not a reason to add an extra duvet, bed sheet or topper');
    result=result.replace(/(?:exactly (?:TWO|two)|the supplied two|two matching|two included|two|TWO) (pillowcases|pillows|low-profile rectangular sleeping pillows|standard rectangular sleeping pillows)/g,'styled $1');
    result=result.replace(/existing pillow pair|pillow pair|BOTH pillowcase FRONTS|Both pillowcase FRONTS/g,m=>m.includes('FRONTS')?'All pillowcase FRONTS':'styled pillows');
    result=result.replace(/EXACT FOUR-PIECE A\/B/g,'PER-COMPONENT A/B');
    result=result.replace(/Exactly the selected four-piece construction, no extra pillow or blanket\./g,'Selected main bedding construction, no extra blanket.');
    result=result.replace(/两只(?:睡眠)?枕套/g,'每只枕套').replace(/(?:仅|只生成所选)?2只(?:套有枕套的枕头|装有枕芯的枕套|配套枕套包覆的枕头|同材质席枕套)/g,'陈列用同款枕套包覆的枕头');
    result=result.replace(/全景床头保留[^；]+；/g,'枕套按推荐方案陈列；');
  }
  result=result.replace(/Hotel luxury must come from furniture, not extra pillows, bed runners or altered bedding./g,'Hotel furniture remains the scene anchor; use assigned matching pillow display, no bed runner or altered bedding.').replace(/No bedroom furniture, windows, curtains, plants, scenery or decorative props./g,'No bedroom furniture, windows, curtains, plants or scenery. Only the assigned restrained studio accent is permitted.');
  result=result.replace(/No people, added lettering, logos or extra decorative pillows\./g,'No people, added lettering or logos.');
  result=result.replace(/Do not copy decorative accessories or additional pillows from styling references\./g,'Use the current recommended styling, not the reference arrangement.');
  result=result.replace(/不增加人物、标题或额外抱枕/g,'不增加人物或标题').replace(/不添抱枕、额外被子/g,'不添额外被子').replace(/不添抱枕被子/g,'不添额外被子');
  result=result.replace(/Preserve product craft and count; no extra bedding\./g,'Preserve the main product construction and craft; pillow display follows the recommended styling.').replace(/Keep original print, A\/B panel identity, craft and count\./g,'Keep original print, A/B panel identity and craft; pillow display follows the recommended styling.');
  result=result.replace(/(?<!main bedding )component count/g,'main bedding component count');
  result=result.replace(/总数保持四件/g,'售卖规格保持四件，摄影陈列可增加同款枕套');
  return result;
}
export function applyRecommendationStyling(prompt,v,compact=false){
  if(!creativeRecommendation(v))return prompt;
  const result=normalizeRecommendationDisplay(prompt,v);
  const rule=recommendationStylingRule(v,compact);
  return result.includes(rule)?result:result+' '+rule;
}
