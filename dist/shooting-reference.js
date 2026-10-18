function syncReferenceShootingControls(){
  if(typeof syncRecommendationControls==='function')syncRecommendationControls();
  const active=!!state.referenceUpload,scene=!!state.recommendScene||active&&state.referenceScene!==false,angle=!!state.recommendAngle||active&&state.referenceAngle!==false;
  $('shootingChoices').classList.toggle('reference-active',scene&&angle);$('shootingChoices').setAttribute('aria-disabled','false');
  for(const [selector,locked]of [['.group-scenes',scene],['.group-angles',angle]]){const group=document.querySelector('#shootingChoices '+selector);group.classList.toggle('reference-dimension-active',locked);group.setAttribute('aria-disabled','false');}

  document.querySelectorAll('[data-scene]').forEach(button=>button.disabled=(scene&&!(!active&&button.dataset?.scene==='childbed'))||state.busy);document.querySelectorAll('[data-angle]').forEach(button=>{button.disabled=angle||state.busy;button.title='';});
  $('referenceUploadBtn').disabled=state.busy;$('referenceUploadBtn').hidden=active;if($('referenceUploadedPanel'))$('referenceUploadedPanel').hidden=!active;$('removeReference').disabled=state.busy;$('addShootingReference').disabled=state.busy;$('referenceExtraImages').querySelectorAll('[data-reference-remove]').forEach(button=>button.disabled=state.busy);$('referenceScopeControls').hidden=!active;
  $('referenceScene').checked=state.referenceScene!==false;$('referenceAngle').checked=state.referenceAngle!==false;$('referenceScene').disabled=$('referenceAngle').disabled=state.busy;
  $('referenceModeHint').hidden=!active;if(active)$('referenceModeHint').textContent=referencePlanDescription(options());
}
let referenceUploadRevision=0;
function shootingReferenceItems(){return state.referenceUploads|| (state.referenceUpload?[{...state.referenceUpload,pattern:state.referencePattern}]:[]);}
function showShootingReference(item){if(!item)return;modal('<h2>拍摄参考图</h2><img id="referenceModalImage" class="reference-modal-image" alt="上传的拍摄参考图"><p class="subtle">'+referencePlanDescription(options())+'。产品花型使用 A/B 面，质感按当前设置生成。</p>');$('referenceModalImage').src=item.url;}
function renderReferenceControl(){
  const items=shootingReferenceItems(),item=items[0];
  document.querySelector('.shooting-reference-upload').classList.toggle('has-reference',!!item);
  $('referenceUploadInfo').hidden=!item;
  if(item)$('referenceUploadThumb').src=item.url;else $('referenceUploadThumb').removeAttribute('src');
  $('referenceExtraImages').innerHTML=items.slice(1).map((_,i)=>'<div class="reference-extra-tile"><button type="button" data-reference-preview="'+(i+1)+'" aria-label="放大参考图 '+(i+2)+'"><img alt="参考图 '+(i+2)+'"></button><button type="button" data-reference-remove="'+(i+1)+'" aria-label="移除参考图 '+(i+2)+'">×</button></div>').join('');
  $('referenceExtraImages').querySelectorAll('[data-reference-preview]').forEach(button=>{const item=items[Number(button.dataset.referencePreview)];button.querySelector('img').src=item.url;button.onclick=()=>showShootingReference(item);});
  $('referenceExtraImages').querySelectorAll('[data-reference-remove]').forEach(button=>{button.disabled=state.busy;button.onclick=()=>removeShootingReference(Number(button.dataset.referenceRemove));});
  $('addShootingReference').disabled=state.busy;
  syncReferenceShootingControls();
}
function removeShootingReference(index){
  if(state.busy)return;
  referenceUploadRevision++;
  const items=[...shootingReferenceItems()],removed=items.splice(index,1)[0];if(removed)URL.revokeObjectURL(removed.url);
  state.referenceUploads=items;state.referenceUpload=items[0]||null;state.referencePattern=items[0]?.pattern||null;
  if(!items.length)state.referenceScene=state.referenceAngle=true;
  renderReferenceControl();renderSelections();
}
function clearShootingReference(refresh=true){
  if(state.busy)return;referenceUploadRevision++;
  shootingReferenceItems().forEach(item=>URL.revokeObjectURL(item.url));
  state.referenceUploads=[];state.referenceUpload=null;state.referencePattern=null;state.referenceScene=state.referenceAngle=true;$('shootingReferenceFile').value='';renderReferenceControl();
  if(refresh){renderSelections();toast('已恢复按所选场景和角度生成');}
}
async function uploadShootingReference(input){
  if(state.busy)return toast('请等待当前生成完成');
  const files=input?.type?[input]:Array.from(input||[]);if(!files.length)return;
  if(shootingReferenceItems().length+files.length>8)return toast('最多上传 8 张参考图');
  if(files.some(file=>!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024))return toast('参考图请使用 10 MB 以内的 JPG、PNG 或 WEBP');
  const revision=++referenceUploadRevision,added=[];
  try{
    for(const file of files){const item={file,url:URL.createObjectURL(file)};added.push(item);const img=new Image();img.src=item.url;await img.decode();if(img.naturalWidth>16000||img.naturalHeight>16000)throw Error('参考图边长不能超过 16000 像素');item.pattern=img;}
    if(revision!==referenceUploadRevision||state.busy){added.forEach(item=>URL.revokeObjectURL(item.url));return;}
    const first=!state.referenceUpload;
    state.referenceUploads=[...shootingReferenceItems(),...added];state.referenceUpload=state.referenceUploads[0];state.referencePattern=state.referenceUpload.pattern;
    state.generateSet=false;state.setCountsExpanded=false;state.recommendScene=false;
    if(first){state.referenceScene=state.referenceAngle=true;state.recommendAngle=false;}
    $('shootingReferenceFile').value='';renderReferenceControl();renderSelections();toast('已上传 '+state.referenceUploads.length+' 张参考图');
  }catch(e){added.forEach(item=>URL.revokeObjectURL(item.url));toast(e.message||'参考图无法读取，请更换图片');}
}
function changeReferenceScope(){if(state.busy||!state.referenceUpload)return syncReferenceShootingControls();const scene=$('referenceScene').checked,angle=$('referenceAngle').checked;if(!scene&&!angle){syncReferenceShootingControls();return toast('请至少保留一项参考；取消全部可移除参考图')}state.referenceScene=scene;state.referenceAngle=angle;if(angle)state.recommendAngle=false;renderSelections();}
$('referenceScene').onchange=$('referenceAngle').onchange=changeReferenceScope;
$('referenceUploadBtn').onclick=$('addShootingReference').onclick=()=>$('shootingReferenceFile').click();
$('shootingReferenceFile').onchange=()=>uploadShootingReference($('shootingReferenceFile').files);
$('removeReference').onclick=()=>removeShootingReference(0);
const referenceDropArea=document.querySelector('.shooting-reference-upload');
referenceDropArea.ondragover=e=>{e.preventDefault();if(!state.busy)$('referenceUploadBtn').classList.add('drag')};referenceDropArea.ondragleave=()=>$('referenceUploadBtn').classList.remove('drag');referenceDropArea.ondrop=e=>{e.preventDefault();$('referenceUploadBtn').classList.remove('drag');uploadShootingReference(e.dataTransfer.files)};
$('referenceZoom').onclick=()=>showShootingReference(state.referenceUpload);
renderReferenceControl();

function anglePreviewPlacement(rect,width,height,viewportWidth,viewportHeight){
  const margin=12,gap=12;
  let left=rect.right+gap;
  if(left+width>viewportWidth-margin)left=rect.left-width-gap;
  left=Math.max(margin,Math.min(left,Math.max(margin,viewportWidth-width-margin)));
  const top=Math.max(margin,Math.min(rect.top+(rect.height-height)/2,Math.max(margin,viewportHeight-height-margin)));
  return {left,top};
}

// Delegation survives thumbnail rerenders; only the hovered atlas cell is shown.
(() => {
  const list=document.getElementById('angles');if(!list)return;
  const preview=document.createElement('div');preview.id='angleImagePreview';preview.className='angle-hover-preview';preview.hidden=true;preview.setAttribute('role','tooltip');
  const canvas=document.createElement('canvas'),title=document.createElement('strong'),note=document.createElement('small');
  canvas.setAttribute('role','img');note.textContent='构图示例 · 实际花型以你的上传图片为准';preview.append(canvas,title,note);document.body.append(preview);
  const images=new Map();let active=null,timer=null,revision=0;
  function hide(){revision++;clearTimeout(timer);timer=null;if(active?.getAttribute('aria-describedby')===preview.id)active.removeAttribute('aria-describedby');active=null;preview.hidden=true;}
  async function show(card,ticket){
    const photo=card.querySelector('.angle-photo');if(!photo)return;
    const {previewSrc,previewCols,previewRows,previewCell}=photo.dataset,cols=Number(previewCols),rows=Number(previewRows),cell=Number(previewCell);
    if(!/^\/assets\/[\w.-]+\.(?:png|jpe?g|webp)$/i.test(previewSrc||'')||!Number.isInteger(cols)||cols<1||cols>4||!Number.isInteger(rows)||rows<1||rows>5||!Number.isInteger(cell)||cell<0||cell>=cols*rows)return;
    try{
      if(!images.has(previewSrc)){const image=new Image();image.src=previewSrc;images.set(previewSrc,image.decode().then(()=>image).catch(error=>{images.delete(previewSrc);throw error}));}
      const image=await images.get(previewSrc);if(ticket!==revision||active!==card||!card.isConnected)return;
      const w=image.naturalWidth/cols,h=image.naturalHeight/rows;canvas.width=Math.round(w);canvas.height=Math.round(h);canvas.getContext('2d').drawImage(image,(cell%cols)*w,Math.floor(cell/cols)*h,w,h,0,0,canvas.width,canvas.height);
      title.textContent=(card.querySelector('.angle-caption')?.textContent||'拍摄角度').replace(/✓/g,'').trim();canvas.setAttribute('aria-label',title.textContent+'完整构图预览');
      const width=Math.max(32,Math.min(330,innerWidth-24,innerHeight-110));preview.style.width=width+'px';preview.hidden=false;
      const point=anglePreviewPlacement(card.getBoundingClientRect(),preview.offsetWidth,preview.offsetHeight,innerWidth,innerHeight);preview.style.left=point.left+'px';preview.style.top=point.top+'px';card.setAttribute('aria-describedby',preview.id);
    }catch{if(ticket===revision)hide();}
  }
  function request(card,immediate=false){if(!list.classList.contains('show-angle-examples')||!card||!list.contains(card)||active===card)return;hide();active=card;const ticket=revision;timer=setTimeout(()=>show(card,ticket),immediate?0:130);}
  list.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const card=event.target.closest('.angle-card');if(card&&event.relatedTarget?.closest?.('.angle-card')!==card)request(card);});
  list.addEventListener('pointerout',event=>{const card=event.target.closest('.angle-card');if(card===active&&event.relatedTarget?.closest?.('.angle-card')!==card)hide();});
  list.addEventListener('focusin',event=>request(event.target.closest('.angle-card'),true));
  list.addEventListener('focusout',event=>{if(event.target.closest('.angle-card')===active)hide();});
  window.addEventListener('scroll',hide,{capture:true,passive:true});window.addEventListener('resize',hide,{passive:true});
  document.addEventListener('pointerdown',hide,{capture:true});document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  new MutationObserver(()=>{if(active&&!active.isConnected)hide();}).observe(list,{childList:true});
})();
