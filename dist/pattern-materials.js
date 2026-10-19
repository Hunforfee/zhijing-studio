(() => {
 const MAX=8,lists={A:[],B:[]};let revision=0;
 const nativeUpload={A:upload,B:uploadBack};
 const ids=side=>side==='A'?{input:'upload',button:'uploadBtn',info:'uploadInfo',remove:'removeUpload'}:{input:'uploadB',button:'uploadBtnB',info:'uploadInfoB',remove:'removeUploadB'};
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
  $(id.remove).addEventListener('click',()=>{if(state.busy)return;clearSide(side);refresh();});
 }
 function clearSide(side){revision++;lists[side].forEach(item=>URL.revokeObjectURL(item.url));lists[side]=[];}
 async function decode(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>32*1024*1024)throw Error('请上传32 MB以内的PNG、JPG或WEBP图片');
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode();if(image.naturalWidth>16000||image.naturalHeight>16000||image.naturalWidth*image.naturalHeight>64e6)throw Error('图片不能超过16000像素边长或6400万像素');return {file,url,image};}catch(error){URL.revokeObjectURL(url);throw error;}
 }
 async function add(side,files){
  if(state.busy)return toast('请等待当前任务提交完成');if(!files.length)return;revision++;
  const original=lists[side];if(original.length+files.length>MAX)return toast('每面最多8张图片，请先管理或移除已有图片');
  const loaded=[];try{for(const file of files)loaded.push(await decode(file));if(state.busy||lists[side]!==original)throw Error('素材已变化，请重新添加');
   revision++;lists[side]=[...original,...loaded];if(!original.length)await nativeUpload[side](lists[side][0].file);
   refresh();await rememberLastPatterns();
  }catch(error){loaded.forEach(item=>URL.revokeObjectURL(item.url));toast(error.message||'图片无法读取');}
 }
 async function syncPrimary(side){
  revision++;
  if(lists[side].length){await nativeUpload[side](lists[side][0].file);const primary=side==='A'?state.upload:state.uploadB;if(primary)primary.metadata=lists[side][0].metadata;}
  else $(ids(side).remove).onclick();
  refresh();await rememberLastPatterns();
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
   const actions=document.createElement('div');if(index){const primary=document.createElement('button');primary.type='button';primary.textContent='设为主图';primary.onclick=async()=>{if(state.busy)return;const chosen=lists[managing].splice(index,1)[0];lists[managing].unshift(chosen);await syncPrimary(managing);};actions.append(primary);}
   const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.onclick=async()=>{if(state.busy)return;const old=lists[managing].splice(index,1)[0];URL.revokeObjectURL(old.url);await syncPrimary(managing);};actions.append(remove);card.append(actions);box.append(card);
  });manager.querySelector('.pattern-material-add').disabled=lists[managing].length>=MAX||state.busy;
 }
 function imageData(item){const c=document.createElement('canvas');let scale=Math.min(1,1200/Math.max(item.image.naturalWidth,item.image.naturalHeight)),data;do{c.width=Math.max(1,Math.round(item.image.naturalWidth*scale));c.height=Math.max(1,Math.round(item.image.naturalHeight*scale));c.getContext('2d').drawImage(item.image,0,0,c.width,c.height);data=c.toDataURL('image/png');scale*=.8;}while(data.length>850000&&Math.max(c.width,c.height)>300);return data;}
 globalThis.patternMaterials={
  ready:()=>Promise.resolve(),
  revision:()=>revision,
  storage:()=>Object.fromEntries(['A','B'].map(side=>[side,lists[side].map(x=>({blob:x.file,name:x.file.name,lastModified:x.file.lastModified,metadata:x.metadata}))])),
  async replace(files,{metadata={},isCurrent=()=>true,onCommit=()=>{}}={}){
   if(state.busy)throw Error('请等待当前生成结束后再应用花型');
   const prepared={};
   try{for(const side of ['A','B'])if(Object.hasOwn(files,side))prepared[side]=files[side]===null?null:await decode(files[side]);
    if(state.busy||!isCurrent())throw Error('花型设置已变化，本次应用已取消');
   }catch(error){Object.values(prepared).forEach(item=>{if(item)URL.revokeObjectURL(item.url);});throw error;}
   for(const side of ['A','B'])if(Object.hasOwn(prepared,side)){
    clearSide(side);const item=prepared[side],id=ids(side),old=side==='A'?state.upload:state.uploadB;
    if(old?.url)URL.revokeObjectURL(old.url);
    if(!item){$(id.remove).onclick();continue;}
    if(side==='A')globalThis.cancelProductRecognition?.();
    item.metadata=metadata[side]||{};lists[side]=[item];
    const value={file:item.file,url:item.url,metadata:item.metadata};
    if(side==='A'){state.upload=value;state.pattern=item.image;}else{state.uploadB=value;state.patternB=item.image;}
    $(side==='A'?'uploadThumb':'uploadThumbB').src=item.url;
    $(side==='A'?'uploadName':'uploadNameB').textContent=item.file.name;
    $(side==='A'?'uploadName':'uploadNameB').title=item.file.name;
    $(side==='A'?'uploadDimensions':'uploadDimensionsB').textContent=item.image.naturalWidth+' × '+item.image.naturalHeight;
    $(id.info).hidden=false;$(id.input).value='';
   }
   onCommit();refresh();renderSelections();await rememberLastPatterns();return true;
  },
  async restore(saved){
   revision++;for(const side of ['A','B']){const oldUpload=side==='A'?state.upload:state.uploadB;const records=saved?.[side]?.length?saved[side].slice(0,MAX):oldUpload?[{blob:oldUpload.file,name:oldUpload.file.name,metadata:oldUpload.metadata}]:[];const loaded=[];try{for(const record of records){const item=await decode(new File([record.blob],record.name,{type:record.blob.type,lastModified:record.lastModified}));item.metadata=record.metadata;loaded.push(item);}}catch(e){loaded.forEach(x=>URL.revokeObjectURL(x.url));throw e;}clearSide(side);lists[side]=loaded;if(loaded.length){await nativeUpload[side](loaded[0].file);const primary=side==='A'?state.upload:state.uploadB;if(primary)primary.metadata=loaded[0].metadata;}}refresh();
  },
  async payload(){return {patternMaterials:{A:lists.A.slice(1).map(imageData),B:lists.B.slice(1).map(imageData)}};}
 };
 $('resetBtn').addEventListener('click',()=>{if(state.busy)return;clearSide('A');clearSide('B');refresh();});
 // Restore operations call the existing primary upload handlers, then restore all saved materials.
 document.addEventListener('click',e=>{if(e.target.closest('#restoreLastPatterns'))manager.close();});
 refresh();
})();
