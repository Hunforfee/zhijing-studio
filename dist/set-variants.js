const setVariants=[
  {id:'standard',name:'床单款',group:'床单款式',hint:'床侧和床尾自然下垂，不塞入床垫',spec:'普通平床单：床侧、床尾自然下垂，柔软重力褶皱，不塞床垫、不收紧，无床裙接缝'},
  {id:'fitted',name:'床笠款',group:'床单款式',hint:'床笠包住床垫，四角贴合',spec:'床笠替代平床单：四角弹力贴合包住床垫，无床单垂边'},
  {id:'skirt',name:'床裙款',group:'床单款式',hint:'床面连着三侧自然下垂裙边',spec:'连体床裙替代平床单：三侧自然下垂，不另加床单'},
  {id:'pleated-skirt',name:'百褶床裙款',group:'床单款式',hint:'床裙有规律褶裥，整齐垂落',spec:'百褶连体床裙替代平床单：三侧规律竖褶垂落，不另加床单'},
  {id:'ruffle-skirt',name:'荷叶床裙款',group:'床单款式',hint:'床裙下摆带柔软荷叶边',spec:'荷叶连体床裙替代平床单：裙摆下缘单层柔软荷叶边，不另加床单'},
  {id:'coverlet',name:'床罩款',group:'床单款式',hint:'床面与侧垂片有清晰接缝',spec:'合体床罩替代平床单：上平面与三侧垂片有接缝，角部整齐不抽褶'},
  {id:'plain',name:'简约工艺',group:'被套工艺',hint:'常规细缝边，不增加装饰边',spec:'被套简约细缝边，无埋绳、宽边或花边'},
  {id:'piping',name:'埋绳款',group:'被套工艺',hint:'被套外缘细圆绳线',spec:'被套外缘单圈细圆埋绳，贴合接缝不悬空、不做宽边'},

  {id:'wide-flange',name:'宽边款',group:'被套工艺',hint:'保留原主体尺寸，左右与床尾加宽边，床头不加',spec:'被套外缘4至6厘米平整单层宽边，有内侧压线、不填充不抽褶'},
  {id:'narrow-flange',name:'窄边款',group:'被套工艺',hint:'左右与床尾细窄平边，床头不加',spec:'被套外缘1至2厘米平整窄边，有细压线，不凸起埋绳'},
  {id:'binding',name:'撞色包边款',group:'被套工艺',hint:'平整窄布条包裹边缘',spec:'被套外缘平整撞色窄布包边，不嵌圆绳，不覆盖主体花型'},
  {id:'ruffle',name:'荷叶边款',group:'被套工艺',hint:'被套边缘柔软抽褶',spec:'被套外缘单层柔软抽褶荷叶边，不改变所选床单款式'},
  {id:'lace',name:'蕾丝边款',group:'被套工艺',hint:'局部细窄镂空蕾丝装饰',spec:'被套外缘细窄镂空蕾丝，不改变主体花型，不做全件透明蕾丝'},
  {id:'scallop',name:'波浪边款',group:'被套工艺',hint:'连续圆弧边缘，平整不抽褶',spec:'被套外缘连续圆弧波浪边，细包缝、平整不抽褶，不做荷叶边'},
  {id:'pillow-plain',name:'简约工艺',group:'枕套工艺',hint:'常规细缝边，干净利落',spec:'两只枕套简约细缝边，无埋绳、宽边或花边'},
  {id:'pillow-piping',name:'埋绳款',group:'枕套工艺',hint:'枕套外缘一圈细圆绳线',spec:'两只枕套外缘单圈细圆埋绳，贴合枕芯、不做宽边'},

  {id:'pillow-wide-flange',name:'宽边款',group:'枕套工艺',hint:'保留枕套原主体尺寸，每边向外额外加4～6厘米宽边',spec:'两只枕套外缘4至6厘米单层平整宽边，内侧压线、边缘无填充'},
  {id:'pillow-narrow-flange',name:'窄边款',group:'枕套工艺',hint:'1～2 厘米细窄平边',spec:'两只枕套外缘1至2厘米平整窄边，细压线、不加凸起埋绳'},
  {id:'pillow-binding',name:'撞色包边款',group:'枕套工艺',hint:'窄布条包边，衬出轮廓',spec:'两只枕套外缘撞色窄布条包边，配色取原花型、不盖主体印花'},
  {id:'pillow-ruffle',name:'荷叶边款',group:'枕套工艺',hint:'柔软抽褶，轻盈自然',spec:'两只枕套外缘单层柔软抽褶荷叶边，无硬挺多层花边'},
  {id:'pillow-lace',name:'蕾丝边款',group:'枕套工艺',hint:'细窄镂空蕾丝边',spec:'两只枕套外缘细窄镂空蕾丝，主体不透明且保留原花型'},
  {id:'pillow-scallop',name:'波浪边款',group:'枕套工艺',hint:'连续圆弧轮廓，平整不抽褶',spec:'两只枕套外缘连续圆弧波浪边，细包缝、平整不抽褶'}
];
let chosenSheetVariant='standard',chosenDuvetVariant='plain',chosenPillowVariant='pillow-plain',pillowCraftManuallySelected=false;
function selectedSetPart(group){const id=group==='床单款式'?chosenSheetVariant:group==='被套工艺'?chosenDuvetVariant:chosenPillowVariant;return setVariants.find(v=>v.id===id&&v.group===group)}
function currentSetVariant(){return {name:chosenSheetVariant==='standard'&&chosenDuvetVariant==='plain'&&chosenPillowVariant==='pillow-plain'?'普通四件套':'被套'+selectedSetPart('被套工艺').name+' + '+selectedSetPart('床单款式').name+' + 枕套'+selectedSetPart('枕套工艺').name}}
function setVariantSpecification(){return '三组同时满足：'+selectedSetPart('被套工艺').spec+'；'+selectedSetPart('床单款式').spec+'；'+selectedSetPart('枕套工艺').spec+'。各工艺仅作用所属部件，互不沿用。'}
const variantPanel=document.createElement('section');variantPanel.id='setVariantPanel';variantPanel.className='set-variant-flyout';variantPanel.hidden=true;variantPanel.setAttribute('aria-labelledby','setVariantTitle');
variantPanel.innerHTML='<div class="set-variant-heading"><div><h2 id="setVariantTitle">四件套</h2><p>每组选择一项，可同时搭配 · 默认普通四件套</p></div><button type="button" class="set-variant-close" aria-label="收起四件套分类">×</button></div><div class="set-variant-options"></div><div class="set-variant-footer"><span id="setVariantSelected"></span><button type="button" class="set-variant-done">完成选择</button></div>';
document.body.append(variantPanel);
function renderSetVariantControl(){globalThis.syncCraftUploads?.();const trigger=document.querySelector('[data-product="set"]');if(trigger){trigger.setAttribute('aria-expanded',String(!variantPanel.hidden));trigger.setAttribute('aria-controls','setVariantPanel');trigger.classList.add('has-set-variants');trigger.title=currentSetVariant().name+' · 点击展开四件套分类';renderChosenProductLabel(trigger,'四件套',currentSetVariant().name==='普通四件套'?'普通款':'被套'+selectedSetPart('被套工艺').name+' · '+selectedSetPart('床单款式').name+' · 枕套'+selectedSetPart('枕套工艺').name);}if(state.product==='set'){const id=chosenSheetVariant;const part=id==='fitted'?'床笠':['skirt','pleated-skirt','ruffle-skirt'].includes(id)?'床裙':id==='coverlet'?'床罩':'床单';$('partsHint').textContent='1 件被套 + 1 件'+part+' + 2 只枕套'+(chosenDuvetVariant!=='plain'?' · 被套'+selectedSetPart('被套工艺').name:'')+(chosenPillowVariant!=='pillow-plain'?' · 枕套'+selectedSetPart('枕套工艺').name:'');}variantPanel.querySelector('#setVariantSelected').textContent='已选：'+currentSetVariant().name;}
function closeSetVariants(returnFocus=false){variantPanel.hidden=true;renderSetVariantControl();if(returnFocus)document.querySelector('[data-product="set"]')?.focus()}
function placeSetVariants(){placeProductSubmenu(variantPanel,document.querySelector('[data-product="set"]'),730,440);}
function selectSetVariant(id){if(state.busy)return;const item=setVariants.find(v=>v.id===id);if(!item)return;(state.productVariantChoices??={}).set=true;if(item.group==='床单款式')chosenSheetVariant=id;else if(item.group==='被套工艺'){chosenDuvetVariant=id;if(!pillowCraftManuallySelected)chosenPillowVariant='pillow-'+id;}else{chosenPillowVariant=id;pillowCraftManuallySelected=true;}variantPanel.querySelectorAll('[data-set-variant]').forEach(button=>{const item=setVariants.find(v=>v.id===button.dataset.setVariant);button.setAttribute('aria-pressed',String(item.id===selectedSetPart(item.group).id));});renderSetVariantControl();}
function openSetVariants(){if(state.busy||state.product!=='set')return;const content=variantPanel.querySelector('.set-variant-options');content.replaceChildren();for(const [index,group]of ['被套工艺','床单款式','枕套工艺'].entries()){const card=document.createElement('section');card.className='set-craft-group set-craft-'+['duvet','sheet','pillow'][index];const header=document.createElement('div');header.className='set-craft-header';const title=document.createElement('div');const heading=document.createElement('h3');heading.id='setCraftHeading'+index;heading.textContent=group;card.setAttribute('aria-labelledby',heading.id);const hint=document.createElement('p');hint.className='set-craft-description';hint.textContent=['决定被套的边缘工艺','决定床单的铺设款式','决定两只枕套的边缘工艺'][index];title.append(heading,hint);const choice=document.createElement('span');choice.className='set-craft-choice';choice.textContent='每组选一项';header.append(title,choice);const grid=document.createElement('div');grid.className='set-variant-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label',group);for(const item of setVariants.filter(v=>v.group===group)){const button=document.createElement('button');button.type='button';button.className='set-variant-option';button.dataset.setVariant=item.id;button.setAttribute('aria-pressed',String(item.id===selectedSetPart(group).id));button.textContent=item.name;button.title=item.hint;button.addEventListener('click',()=>selectSetVariant(item.id));grid.append(button)}card.append(header,grid);content.append(card)}variantPanel.hidden=false;placeSetVariants();renderSetVariantControl();}
const craftUploads=new Map(),craftUploadPanel=document.createElement('div');
craftUploadPanel.id='craftUploadPanel';craftUploadPanel.className='craft-upload-panel';craftUploadPanel.hidden=true;
document.querySelector('#uploadBtnB').closest('.upload-cell').after(craftUploadPanel);
function selectedCraftUploads(){
  if(state.product!=='set')return [];
  const kinds=new Map();
  for(const group of ['被套工艺','床单款式','枕套工艺']){const part=selectedSetPart(group);if(['plain','pillow-plain','standard'].includes(part.id))continue;const kind=part.id.replace(/^pillow-/,'');if(!kinds.has(kind))kinds.set(kind,{kind,name:part.name,groups:[]});kinds.get(kind).groups.push(group);}
  return [...kinds.values()];
}
function renderCraftUploads(){
  const selected=selectedCraftUploads();craftUploadPanel.hidden=!selected.length;
  const signature=selected.map(ref=>ref.kind+ref.groups.join()).join('|');
  if(craftUploadPanel.dataset.selection===signature){craftUploadPanel.querySelectorAll('button,input').forEach(el=>el.disabled=!!state.busy);return;}
  craftUploadPanel.dataset.selection=signature;craftUploadPanel.replaceChildren();
  for(const ref of selected){
    const cell=document.createElement('div');cell.className='craft-upload-cell';
    const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;file.disabled=!!state.busy;
    const button=document.createElement('button');button.type='button';button.className='upload-box craft-upload-button';button.disabled=!!state.busy;button.setAttribute('aria-label','上传'+ref.name.replace(/款$/,'')+'图');
    const title=document.createElement('strong');title.textContent=ref.name.replace(/款$/,'')+'图';
    const hint=document.createElement('small');hint.textContent=ref.groups.join(' · ')+' · 选填';button.append(title,hint);
    const uploaded=craftUploads.get(ref.kind);
    if(uploaded){const img=document.createElement('img');img.src=uploaded.url;img.alt=ref.name.replace(/款$/,'')+'图';button.prepend(img);hint.textContent='已上传 · 点击更换';}
    button.onclick=()=>file.click();file.onchange=()=>uploadCraftStyle(ref,file.files[0]);
    button.ondragover=e=>{e.preventDefault();};button.ondrop=e=>{e.preventDefault();void uploadCraftStyle(ref,e.dataTransfer.files[0]);};
    cell.append(file,button);
    if(uploaded){const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='移除';remove.disabled=!!state.busy;remove.setAttribute('aria-label','移除'+ref.name.replace(/款$/,'')+'图');remove.onclick=()=>{if(state.busy)return;URL.revokeObjectURL(uploaded.url);craftUploads.delete(ref.kind);craftUploadPanel.dataset.selection='';renderCraftUploads();};cell.append(remove);}
    craftUploadPanel.append(cell);
  }
  const note=document.createElement('p');note.className='subtle craft-upload-note';note.textContent='参考工艺细节与边饰颜色，主体花型仍用 A/B 面；未上传使用默认方案。';craftUploadPanel.append(note);
}
async function uploadCraftStyle(ref,file){
  if(state.busy||!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)return toast('款式图请使用 10 MB 以内的 JPG、PNG 或 WEBP');
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();if(img.naturalWidth>16000||img.naturalHeight>16000)throw Error('款式图边长不能超过 16000 像素');if(state.busy)throw Error('正在提交任务，请稍后上传');const canvas=document.createElement('canvas'),scale=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/png');if(data.length>14*1024*1024)throw Error('款式图过大，请压缩后上传');const previous=craftUploads.get(ref.kind);if(previous)URL.revokeObjectURL(previous.url);craftUploads.set(ref.kind,{url,data});craftUploadPanel.dataset.selection='';renderCraftUploads();toast(ref.name.replace(/款$/,'')+'图已上传');}catch(error){URL.revokeObjectURL(url);toast(error.message||'款式图无法读取');}
}
globalThis.getCraftReferences=()=>Object.fromEntries(selectedCraftUploads().filter(ref=>craftUploads.has(ref.kind)).map(ref=>[ref.kind,craftUploads.get(ref.kind).data]));
globalThis.syncCraftUploads=renderCraftUploads;
document.addEventListener('click',e=>{if(e.target.closest('#resetBtn')&&!state.busy){for(const item of craftUploads.values())URL.revokeObjectURL(item.url);craftUploads.clear();craftUploadPanel.dataset.selection='';renderCraftUploads();}});
variantPanel.querySelector('.set-variant-close').onclick=()=>closeSetVariants(true);
variantPanel.querySelector('.set-variant-done').onclick=()=>closeSetVariants(true);
document.addEventListener('click',e=>{const product=e.target.closest('[data-product]');if(product&&!state.busy){if(product.dataset.product==='set'){if(variantPanel.hidden)openSetVariants();else closeSetVariants()}else closeSetVariants();renderSetVariantControl();return;}if(e.target.closest('#resetBtn')&&!state.busy){chosenSheetVariant='standard';chosenDuvetVariant='plain';chosenPillowVariant='pillow-plain';pillowCraftManuallySelected=false;closeSetVariants()}else if(!variantPanel.contains(e.target))closeSetVariants();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!variantPanel.hidden)closeSetVariants(true);if(e.key==='ArrowDown'&&e.target.closest('[data-product="set"]')){e.preventDefault();openSetVariants();variantPanel.querySelector('[aria-pressed=true]')?.focus()}});
window.addEventListener('resize',()=>closeSetVariants());window.addEventListener('scroll',e=>{if(!variantPanel.contains(e.target))closeSetVariants()},{passive:true,capture:true});
new MutationObserver(()=>{if(state.busy)closeSetVariants();renderSetVariantControl()}).observe($('generateBtn'),{attributes:true,attributeFilter:['disabled']});
new MutationObserver(renderSetVariantControl).observe($('products'),{childList:true});renderSetVariantControl();
