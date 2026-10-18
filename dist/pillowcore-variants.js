const pillowcoreProductVariants=[
  {
    "id": "fiber",
    "name": "纤维枕（羽丝绒）",
    "group": "柔软填充",
    "hint": "柔软蓬松 · 圆润边角",
    "zh": "纤维填充枕，柔软矩形鼓包，中心饱满、边缘渐薄、底部受压；羽丝绒是纤维款名称，不画羽毛",
    "en": "FIBER-FILLED pillow: soft rectangular loft, full center, tapered rounded edges and gravity-compressed base; imitation-down fiber is NOT feathers",
    "spec": "仅1只纤维枕（羽丝绒）。纤维填充枕，柔软矩形鼓包，中心饱满、边缘渐薄、底部受压；羽丝绒是纤维款名称，不画羽毛。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "soy",
    "name": "大豆纤维枕",
    "group": "柔软填充",
    "hint": "柔和蓬松 · 连续壳布",
    "zh": "大豆纤维类填充枕，柔和矩形轮廓与适中蓬松，完整壳布；不生成黄豆颗粒或额外植物装饰",
    "en": "SOY-FIBER blend style: moderately lofted soft rectangular shell; no visible soybeans or botanical decorations",
    "spec": "仅1只大豆纤维枕。大豆纤维类填充枕，柔和矩形轮廓与适中蓬松，完整壳布；不生成黄豆颗粒或额外植物装饰。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "down",
    "name": "羽绒 / 羽毛枕",
    "group": "柔软填充",
    "hint": "轻盈软塌 · 自然承托",
    "zh": "羽绒或羽毛类填充枕，轻盈柔软、松弛下陷、圆润薄边，完整防绒壳布；不露羽毛，不虚构绒含量或分仓",
    "en": "DOWN/FEATHER-filled style: soft yielding loft and rounded thin edges within an intact shell; no escaping feathers, invented down percentage or internal chambers",
    "spec": "仅1只羽绒 / 羽毛枕。羽绒或羽毛类填充枕，轻盈柔软、松弛下陷、圆润薄边，完整防绒壳布；不露羽毛，不虚构绒含量或分仓。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "latex",
    "name": "乳胶枕",
    "group": "定型支撑",
    "hint": "一体定型 · 高低波浪轮廓",
    "zh": "乳胶一体定型高低波浪枕，两条不同高度的长边与中间浅凹，保持弹性实芯轮廓，外罩贴合；孔洞仅在用户提供裸芯参考时呈现",
    "en": "LATEX molded contour: unequal-height long ridges and a shallow central cradle; cohesive elastic core, close-fitting cover, not a loose puff; holes only when an explicit bare-core reference confirms them",
    "spec": "仅1只乳胶枕。乳胶一体定型高低波浪枕，两条不同高度的长边与中间浅凹，保持弹性实芯轮廓，外罩贴合；孔洞仅在用户提供裸芯参考时呈现。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "memory",
    "name": "记忆棉枕",
    "group": "定型支撑",
    "hint": "慢回弹款 · 连续曲面",
    "zh": "记忆棉一体高低波浪枕，柔和连续曲面、清楚高低边和中间凹槽，受压局部下陷；不画散棉鼓包或乳胶孔洞",
    "en": "MEMORY-FOAM molded contour: continuous curved surface, high/low long edges and central cradle, local compression; no loose fiber puff or invented latex perforations",
    "spec": "仅1只记忆棉枕。记忆棉一体高低波浪枕，柔和连续曲面、清楚高低边和中间凹槽，受压局部下陷；不画散棉鼓包或乳胶孔洞。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "gel",
    "name": "凝胶复合枕",
    "group": "定型支撑",
    "hint": "复合定型 · 完整外罩",
    "zh": "凝胶复合定型枕，记忆棉式连续曲面与完整贴合外罩；凝胶层藏于壳内，不自行加蓝色凝胶、液体或透明剖面",
    "en": "GEL-COMPOSITE contour pillow with cohesive foam geometry and intact fitted cover; gel is internal, no invented blue panel, liquid or transparent cutaway",
    "spec": "仅1只凝胶复合枕。凝胶复合定型枕，记忆棉式连续曲面与完整贴合外罩；凝胶层藏于壳内，不自行加蓝色凝胶、液体或透明剖面。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "buckwheat",
    "name": "荞麦枕",
    "group": "颗粒与复合",
    "hint": "低蓬松 · 稳定颗粒承托",
    "zh": "荞麦壳填充枕，偏低矩形、紧实稳固而非羽绒鼓包，真实微小不均匀起伏，完整壳布不露颗粒",
    "en": "BUCKWHEAT-HULL filled pillow: low stable rectangular volume, subtle granular settling under intact cloth, not a fluffy down puff; no exposed hulls",
    "spec": "仅1只荞麦枕。荞麦壳填充枕，偏低矩形、紧实稳固而非羽绒鼓包，真实微小不均匀起伏，完整壳布不露颗粒。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "cassia",
    "name": "决明子枕",
    "group": "颗粒与复合",
    "hint": "颗粒填充款 · 克制起伏",
    "zh": "决明子颗粒类枕，低到中等蓬松、紧实矩形，壳布完整且局部轻微颗粒起伏；不臆造颗粒比例、分区或药用效果",
    "en": "CASSIA-SEED style pillow: low-to-medium firm rectangular volume, slight granular settling beneath intact cloth; no invented seed ratio, partitions or medical claims",
    "spec": "仅1只决明子枕。决明子颗粒类枕，低到中等蓬松、紧实矩形，壳布完整且局部轻微颗粒起伏；不臆造颗粒比例、分区或药用效果。以所选结构为准，A/B只用于壳布。"
  },
  {
    "id": "adjustable",
    "name": "可调节复合枕",
    "group": "颗粒与复合",
    "hint": "复合填充 · 高度按参考",
    "zh": "可调节复合填充枕，默认完整适中蓬松矩形；多芯、可拆层和调节开口仅依明确产品参考，不自动加拉链、剖切或爆炸图",
    "en": "ADJUSTABLE COMPOSITE pillow: intact moderately lofted rectangle by default; multiple cores, removable layers and adjustment closures ONLY when explicitly confirmed; no invented zipper, cutaway or exploded view",
    "spec": "仅1只可调节复合枕。可调节复合填充枕，默认完整适中蓬松矩形；多芯、可拆层和调节开口仅依明确产品参考，不自动加拉链、剖切或爆炸图。以所选结构为准，A/B只用于壳布。"
  }
];
function currentPillowcoreVariant(){return pillowcoreProductVariants.find(v=>v.id===state.pillowcoreVariant)||pillowcoreProductVariants[0]}
function pillowcoreSpecification(){return currentPillowcoreVariant().spec}
const pillowcoreVariantPanel=document.createElement('section');pillowcoreVariantPanel.id='pillowcoreVariantPanel';pillowcoreVariantPanel.className='set-variant-flyout quilt-variant-flyout pillowcore-variant-flyout';pillowcoreVariantPanel.hidden=true;pillowcoreVariantPanel.setAttribute('aria-labelledby','pillowcoreVariantTitle');
pillowcoreVariantPanel.innerHTML='<div class="set-variant-heading"><div><h2 id="pillowcoreVariantTitle">枕芯</h2><p>选择枕芯款式 · 默认纤维枕</p></div><button type="button" class="set-variant-close" aria-label="收起枕芯分类">×</button></div><div class="set-variant-options"><h3>常见款式</h3><div class="set-variant-grid" role="group" aria-label="枕芯款式"></div></div><div class="set-variant-footer"><span id="pillowcoreVariantSelected"></span><button type="button" class="set-variant-done">完成选择</button></div>';
document.body.append(pillowcoreVariantPanel);
function renderPillowcoreVariantControl(){const trigger=document.querySelector('[data-product="pillowcore"]');if(trigger){trigger.classList.add('has-pillowcore-variants');trigger.setAttribute('aria-expanded',String(!pillowcoreVariantPanel.hidden));trigger.setAttribute('aria-controls','pillowcoreVariantPanel');trigger.title=currentPillowcoreVariant().name+' · 点击展开枕芯款式';renderChosenProductLabel(trigger,'枕芯',currentPillowcoreVariant().name);}if(state.product==='pillowcore'){$('partsHint').textContent='1 只'+currentPillowcoreVariant().name+' · '+currentPillowcoreVariant().hint;document.querySelector('.group-angles .group-purpose').textContent=currentPillowcoreVariant().name+'构图 · 可多选 · 结构示意';}pillowcoreVariantPanel.querySelector('#pillowcoreVariantSelected').textContent='已选：'+currentPillowcoreVariant().name;}
function closePillowcoreVariants(returnFocus=false){pillowcoreVariantPanel.hidden=true;renderPillowcoreVariantControl();if(returnFocus)document.querySelector('[data-product="pillowcore"]')?.focus()}
function placePillowcoreVariants(){placeProductSubmenu(pillowcoreVariantPanel,document.querySelector('[data-product="pillowcore"]'),640,440);}
function selectPillowcoreVariant(id){if(state.busy||state.product!=='pillowcore'||!pillowcoreProductVariants.some(v=>v.id===id))return;(state.productVariantChoices??={}).pillowcore=true;state.pillowcoreVariant=id;if(state.fabricMode!=='selected'&&state.textureSource!=='upload'){state.fabric='cotton';updateFabric();}pillowcoreVariantPanel.querySelectorAll('[data-pillowcore-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pillowcoreVariant===id)));renderPillowcoreVariantControl();renderSelections();if(typeof closePillowcoreVariants==='function')closePillowcoreVariants(true);}
function openPillowcoreVariants(){if(state.busy||state.product!=='pillowcore')return;const grid=pillowcoreVariantPanel.querySelector('.set-variant-grid');grid.replaceChildren();let group='';for(const item of pillowcoreProductVariants){if(item.group!==group){group=item.group;const h=document.createElement('h3');h.textContent=group;h.style.gridColumn='1 / -1';grid.append(h);}const b=document.createElement('button');b.type='button';b.className='set-variant-option pillowcore-variant-option';b.dataset.pillowcoreVariant=item.id;b.setAttribute('aria-pressed',String(currentPillowcoreVariant().id===item.id));const picture=document.createElement('span');picture.className='product-variant-preview';picture.style.backgroundImage="url('/assets/pillowcore-"+item.id+"-angles.svg')";picture.setAttribute('role','img');picture.setAttribute('aria-label',item.name+'结构示意');const name=document.createElement('strong');name.textContent=item.name;const hint=document.createElement('small');hint.textContent=item.hint;b.append(picture,name,hint);b.addEventListener('click',()=>selectPillowcoreVariant(item.id));grid.append(b)}pillowcoreVariantPanel.hidden=false;placePillowcoreVariants();renderPillowcoreVariantControl();}
pillowcoreVariantPanel.querySelector('.set-variant-close').onclick=()=>closePillowcoreVariants(true);pillowcoreVariantPanel.querySelector('.set-variant-done').onclick=()=>closePillowcoreVariants(true);
document.addEventListener('click',e=>{const product=e.target.closest('[data-product]');if(product&&!state.busy){if(product.dataset.product==='pillowcore'){if(pillowcoreVariantPanel.hidden)openPillowcoreVariants();else closePillowcoreVariants()}else closePillowcoreVariants();renderPillowcoreVariantControl();return;}if(e.target.closest('#resetBtn')&&!state.busy)state.pillowcoreVariant='fiber';if(!pillowcoreVariantPanel.contains(e.target))closePillowcoreVariants();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pillowcoreVariantPanel.hidden)closePillowcoreVariants(true);if(e.key==='ArrowDown'&&e.target.closest('[data-product="pillowcore"]')&&!state.busy){e.preventDefault();openPillowcoreVariants();pillowcoreVariantPanel.querySelector('[aria-pressed=true]')?.focus();}});
window.addEventListener('resize',()=>closePillowcoreVariants());window.addEventListener('scroll',e=>{if(!pillowcoreVariantPanel.contains(e.target))closePillowcoreVariants()},{passive:true,capture:true});
new MutationObserver(renderPillowcoreVariantControl).observe($('products'),{childList:true});new MutationObserver(()=>{if(state.busy)closePillowcoreVariants();renderPillowcoreVariantControl()}).observe($('generateBtn'),{attributes:true,attributeFilter:['disabled']});renderPillowcoreVariantControl();
