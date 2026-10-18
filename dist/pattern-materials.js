(() => {
 const MAX=8,lists={A:[],B:[]};let revision=0,controller,timer,pending=Promise.resolve(),settlePending=null,observations={},restoring=false,automaticTexture=null;
 $('fabric').addEventListener('change',()=>{automaticTexture=null;});
 const nativeUpload={A:upload,B:uploadBack};
 const ids=side=>side==='A'?{input:'upload',button:'uploadBtn',info:'uploadInfo',remove:'removeUpload'}:{input:'uploadB',button:'uploadBtnB',info:'uploadInfoB',remove:'removeUploadB'};
 const statusBox=document.createElement('div');statusBox.className='pattern-material-status';statusBox.hidden=true;statusBox.setAttribute('role','status');
 const statusText=document.createElement('span'),retry=document.createElement('button');retry.type='button';retry.textContent='重新分析';retry.onclick=()=>scheduleAnalysis();statusBox.append(statusText,retry);
 document.querySelector('#patternSection .fabric-toolbar').append(statusBox);
 const manager=document.createElement('dialog');manager.className='pattern-material-manager';manager.setAttribute('aria-labelledby','patternMaterialManagerTitle');manager.innerHTML='<header><div><h2 id="patternMaterialManagerTitle"></h2><p>主图用于花型；补充图用于匹配花型、工艺与质感。每面最多8张。</p></div><button type="button" data-close>完成</button></header><div class="pattern-material-list"></div><button type="button" class="pattern-material-add">＋ 继续添加图片</button>';
 document.body.append(manager);let managing='A';manager.querySelector('[data-close]').onclick=()=>manager.close();manager.querySelector('.pattern-material-add').onclick=()=>$(ids(managing).input).click();
 manager.addEventListener('click',e=>{if(e.target===manager){const r=manager.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)manager.close();}});
 const manageButtons={};
 for(const side of ['A','B']){
  const id=ids(side),input=$(id.input),button=$(id.button),info=$(id.info);
  input.multiple=true;button.title='可多选或拖入：花型、工艺细节、质感细节，每面最多8张';button.querySelector('small').textContent=side==='A'?'点击或拖入多张图片':'选填 · 支持多张图片';
  const count=document.createElement('button');count.type='button';count.className='pattern-material-count';count.hidden=true;count.setAttribute('aria-label','管理'+side+'面图片');count.onclick=e=>{e.stopPropagation();managing=side;renderManager();manager.showModal();};info.append(count);manageButtons[side]=count;
  const extras=document.createElement('div');extras.className='pattern-material-miniatures';info.append(extras);
  input.onchange=async()=>{await add(side,[...input.files]);input.value='';};
  button.ondragover=e=>{e.preventDefault();button.classList.add('drag');};button.ondragleave=()=>button.classList.remove('drag');button.ondrop=async e=>{e.preventDefault();button.classList.remove('drag');await add(side,[...e.dataTransfer.files]);};
  $(id.remove).addEventListener('click',()=>{if(state.busy)return;clearSide(side);refresh();scheduleAnalysis();});
 }
 function invalidate(){revision++;clearTimeout(timer);controller?.abort();controller=null;settlePending?.();settlePending=null;observations={};}
 async function waitCurrent(){for(;;){const current=pending;await current;if(current===pending)return;}}
 function clearSide(side){lists[side].forEach(item=>URL.revokeObjectURL(item.url));lists[side]=[];invalidate();}
 async function decode(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('请上传10 MB以内的PNG、JPG或WEBP图片');
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode();if(image.naturalWidth>16000||image.naturalHeight>16000)throw Error('图片边长不能超过16000像素');return {file,url,image};}catch(error){URL.revokeObjectURL(url);throw error;}
 }
 async function add(side,files){
  if(state.busy)return toast('请等待当前任务提交完成');if(!files.length)return;
  const original=lists[side];if(original.length+files.length>MAX)return toast('每面最多8张图片，请先管理或移除已有图片');
  const loaded=[];try{for(const file of files)loaded.push(await decode(file));if(state.busy||lists[side]!==original)throw Error('素材已变化，请重新添加');
   invalidate();lists[side]=[...original,...loaded];if(!original.length)await nativeUpload[side](lists[side][0].file);
   refresh();await rememberLastPatterns();scheduleAnalysis();
  }catch(error){loaded.forEach(item=>URL.revokeObjectURL(item.url));toast(error.message||'图片无法读取');}
 }
 async function syncPrimary(side){
  if(lists[side].length)await nativeUpload[side](lists[side][0].file);
  else $(ids(side).remove).onclick();
  refresh();await rememberLastPatterns();scheduleAnalysis();
 }
 function refresh(){
  for(const side of ['A','B']){
   const {button,info}=ids(side),n=lists[side].length;manageButtons[side].hidden=!n;manageButtons[side].textContent=n+' 张 · 管理';
   if(n)$(button).querySelector('strong').textContent='＋ '+side+'面 · 继续添加';
   const mini=$(info).querySelector('.pattern-material-miniatures');mini.replaceChildren();
   lists[side].slice(1,4).forEach(item=>{const image=document.createElement('img');image.src=item.url;image.alt=side+'面补充图片';mini.append(image);});
  }
  if(manager.open)renderManager();
 }
 function renderManager(){
  manager.querySelector('h2').textContent=managing+'面花型与细节 · '+lists[managing].length+' / '+MAX;
  const box=manager.querySelector('.pattern-material-list');box.replaceChildren();
  lists[managing].forEach((item,index)=>{
   const card=document.createElement('section'),image=document.createElement('img');image.src=item.url;image.alt=item.file.name;card.append(image);
   const name=document.createElement('strong');name.textContent=index===0?'主花型':('补充图 '+index);card.append(name);
   const file=document.createElement('small');file.textContent=item.file.name;file.title=item.file.name;card.append(file);
   const actions=document.createElement('div');if(index){const primary=document.createElement('button');primary.type='button';primary.textContent='设为主图';primary.onclick=async()=>{if(state.busy)return;invalidate();const chosen=lists[managing].splice(index,1)[0];lists[managing].unshift(chosen);await syncPrimary(managing);};actions.append(primary);}
   const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.onclick=async()=>{if(state.busy)return;invalidate();const old=lists[managing].splice(index,1)[0];URL.revokeObjectURL(old.url);await syncPrimary(managing);};actions.append(remove);card.append(actions);box.append(card);
  });manager.querySelector('.pattern-material-add').disabled=lists[managing].length>=MAX||state.busy;
 }
 function imageData(item){const c=document.createElement('canvas');let scale=Math.min(1,1200/Math.max(item.image.naturalWidth,item.image.naturalHeight)),data;do{c.width=Math.max(1,Math.round(item.image.naturalWidth*scale));c.height=Math.max(1,Math.round(item.image.naturalHeight*scale));c.getContext('2d').drawImage(item.image,0,0,c.width,c.height);data=c.toDataURL('image/png');scale*=.8;}while(data.length>850000&&Math.max(c.width,c.height)>300);return data;}
 function scheduleAnalysis(){
  invalidate();const count=lists.A.length+lists.B.length,hasMulti=count>1;
  if(!hasMulti){statusBox.hidden=true;pending=Promise.resolve();return;}
  statusBox.hidden=false;statusText.textContent='已上传 '+count+' 张 · 准备分析花型、工艺与质感';retry.hidden=true;
  let resolvePending;pending=new Promise(resolve=>{resolvePending=resolve;settlePending=resolve;});
  const key=revision;timer=setTimeout(async()=>{
   if(key!==revision){resolvePending();return;}controller=new AbortController();statusText.textContent='正在分析 '+count+' 张图片…';
   try{const images={A:lists.A.map(imageData),B:lists.B.map(imageData)};
    const requestedProduct=state.product;
    const r=await fetch('/api/pattern-materials/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,product:requestedProduct}),signal:controller.signal});const data=await r.json();if(key!==revision)return;if(!r.ok)throw Error(data.error||'分析暂不可用');
    if(!state.busy&&data.product===state.product&&!state.productVariantChoices?.[state.product]){
     const fields=Object.fromEntries(Object.entries(data.craftChoices||{}).filter(([,v])=>v?.id).map(([k,v])=>[k,v.id]));
     if(Object.keys(fields).length&&applyProductRecognitionSelection(state.product,fields,data.catalog)){state.productVariantChoices[state.product]=false;}
    }
    if(!state.busy&&state.textureSource==='library'&&(state.fabricMode==='auto'||automaticTexture===state.fabric)&&data.textureChoice?.id&&products.find(x=>x.id===state.product)?.fabrics.includes(data.textureChoice.id)){
     state.fabric=data.textureChoice.id;state.fabricMode='selected';automaticTexture=state.fabric;renderOptions();renderSelections();
    }
    observations=data.observations||{};statusText.textContent='已分析 '+count+' 张 · 花型、工艺与质感将共同参考';statusBox.title=Object.entries(observations).map(([side,x])=>side+'面：'+[x.pattern,x.craft,x.texture,x.uncertain].filter(Boolean).join('；')).join('\n');retry.hidden=false;
   }catch(error){if(key===revision&&error.name!=='AbortError'){statusText.textContent='分析未完成 · 生成时仍会参考全部图片';statusBox.title=error.message;retry.hidden=false;}}
   finally{resolvePending();}
  },600);
 }
 globalThis.patternMaterials={
  ready:waitCurrent,
  storage:()=>Object.fromEntries(['A','B'].map(side=>[side,lists[side].map(x=>({blob:x.file,name:x.file.name,lastModified:x.file.lastModified}))])),
  async restore(saved){
   restoring=true;try{for(const side of ['A','B']){const oldUpload=side==='A'?state.upload:state.uploadB;const source=saved?.[side]?.length?saved[side].slice(0,MAX).map(x=>new File([x.blob],x.name,{type:x.blob.type,lastModified:x.lastModified})):oldUpload?[oldUpload.file]:[];const loaded=[];try{for(const file of source)loaded.push(await decode(file));}catch(e){loaded.forEach(x=>URL.revokeObjectURL(x.url));throw e;}clearSide(side);lists[side]=loaded;if(loaded.length)await nativeUpload[side](loaded[0].file);}refresh();scheduleAnalysis();}finally{restoring=false;}
  },
  async payload(){await waitCurrent();return {patternMaterials:{A:lists.A.slice(1).map(imageData),B:lists.B.slice(1).map(imageData),observations}};}
 };
 $('resetBtn').addEventListener('click',()=>{if(state.busy)return;clearSide('A');clearSide('B');refresh();scheduleAnalysis();});
 // Restore operations call the existing primary upload handlers, then restore all saved materials.
 document.addEventListener('click',e=>{if(e.target.closest('#restoreLastPatterns'))manager.close();});
 refresh();
})();
