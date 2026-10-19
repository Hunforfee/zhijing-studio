(() => {
  if (typeof state === 'undefined' || !globalThis.patternMaterials) return;
  const host=document.querySelector('#patternSection .fabric-toolbar');if(!host)return;
  const client=()=>import('/library-client.js?v=20261019-library1');
  const uuid=/^[a-f0-9-]{36}$/;
  const toolbar=document.createElement('div');toolbar.className='wl-toolbar';
  toolbar.innerHTML='<button type="button" id="workspaceChooseAsset">从素材库选取</button><button type="button" id="workspaceSaveProduct" disabled>保存当前商品</button><a href="/library">管理素材 ↗</a><p id="workspaceLibraryStatus" role="status" aria-live="polite"></p>';host.append(toolbar);
  const status=(message,error=false)=>{document.getElementById('workspaceLibraryStatus').textContent=message;document.getElementById('workspaceLibraryStatus').dataset.error=String(error);};
  const dialog=document.createElement('dialog');dialog.className='wl-dialog';dialog.id='workspaceLibraryDialog';dialog.setAttribute('aria-labelledby','workspaceLibraryTitle');
  dialog.innerHTML='<header><div><h2 id="workspaceLibraryTitle">选用花型或商品</h2><p>单独选 A / B 面保留当前设置；应用整款会恢复已保存的产品与工艺。</p></div><button type="button" data-close aria-label="关闭素材库">×</button></header><div class="wl-filter"><input type="search" id="workspaceLibrarySearch" placeholder="搜索名称、款号或系列" aria-label="搜索素材"><select id="workspaceLibraryKind" aria-label="素材类型"><option value="">全部素材</option><option value="pattern">花型</option><option value="product">商品</option></select><button type="button" id="workspaceLibraryRefresh">刷新</button></div><p id="workspaceLibraryListStatus" role="status"></p><div class="wl-grid" id="workspaceLibraryGrid"></div><a class="wl-manage" href="/library">进入我的花型 / 商品库 ↗</a>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  let assets=[],loading=false,saving=false;
  const request=async(url)=>{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});let value;try{value=await response.json();}catch{throw Error('素材服务暂时无法读取，请稍后刷新');}if(!response.ok)throw Error(value.error||'素材读取失败');return value;};
  function validAsset(asset){return asset&&uuid.test(asset.id)&&typeof asset.name==='string'&&asset.imageUrl==='/api/library/assets/'+asset.id+'/image'&&(!asset.hasB||asset.imageBUrl==='/api/library/assets/'+asset.id+'/imageB');}
  function recipe(){
    const value={product:state.product,fabric:state.fabric,fabricMode:state.fabricMode,duvetCraft:chosenDuvetVariant,sheetStyle:chosenSheetVariant,pillowCraft:chosenPillowVariant};
    for(const key of ['quiltSeason','sheetVariant','mattressVariant','blanketVariant','sleepbagVariant','matVariant','pillowcoreVariant'])if(typeof state[key]==='string'&&state[key])value[key]=state[key];
    value.productVariantChoices=Object.fromEntries(Object.entries(state.productVariantChoices||{}).filter(([,v])=>typeof v==='boolean'));return value;
  }
  function snapshot(){return {revision:globalThis.patternMaterials.revision(),a:state.upload,b:state.uploadB,recipe:JSON.stringify(recipe()),textureSource:state.textureSource,textureUpload:state.textureUpload,texturePattern:state.texturePattern};}
  function current(snapshot,includeRecipe=false){return snapshot.revision===globalThis.patternMaterials.revision()&&snapshot.a===state.upload&&snapshot.b===state.uploadB&&(!includeRecipe||snapshot.recipe===JSON.stringify(recipe())&&snapshot.textureSource===state.textureSource&&snapshot.textureUpload===state.textureUpload&&snapshot.texturePattern===state.texturePattern);}
  function controls(){document.getElementById('workspaceSaveProduct').disabled=!!state.busy||!!state.libraryApplying||saving||!state.upload;document.getElementById('workspaceChooseAsset').disabled=!!state.busy||!!state.libraryApplying;}
  function render(){
    const grid=document.getElementById('workspaceLibraryGrid'),query=document.getElementById('workspaceLibrarySearch').value.trim().toLowerCase(),kind=document.getElementById('workspaceLibraryKind').value;grid.replaceChildren();
    const shown=assets.filter(asset=>(!kind||asset.kind===kind)&&(!query||[asset.name,asset.code,asset.collection,asset.description,...(asset.tags||[])].some(value=>String(value||'').toLowerCase().includes(query))));
    for(const asset of shown){const card=document.createElement('article'),image=document.createElement('img');image.src=asset.thumbnailUrl==='/api/library/assets/'+asset.id+'/thumbnail'?asset.thumbnailUrl:asset.imageUrl;image.alt=asset.name;image.loading='lazy';const title=document.createElement('strong');title.textContent=asset.name;const info=document.createElement('small');info.textContent=[asset.code,asset.collection,asset.width+' × '+asset.height].filter(Boolean).join(' · ');const actions=document.createElement('div');
      for(const [side,label]of [['A','用作 A 面'],['B','用作 B 面'],...(asset.kind==='product'?[['pair','应用整款']]:[])]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=!!state.busy||!!state.libraryApplying;button.dataset.libraryAsset=asset.id;button.dataset.librarySide=side;button.onclick=()=>void apply(asset.id,side);actions.append(button);}card.append(image,title,info,actions);grid.append(card);
    }
    if(!shown.length){const empty=document.createElement('p');empty.className='wl-empty';empty.textContent=loading?'正在读取素材…':assets.length?'没有匹配的素材。':'还没有保存的素材。可上传花稿入库，或将当前 A/B 面保存为商品。';grid.append(empty);}
  }
  async function refresh(){if(loading)return;loading=true;render();try{const value=await request('/api/library/assets');assets=(value.assets||[]).filter(validAsset);document.getElementById('workspaceLibraryListStatus').textContent='已保存 '+assets.length+' 项；选用不会自动生成或分析。';}catch(error){document.getElementById('workspaceLibraryListStatus').textContent=error.message;}finally{loading=false;render();}}
  async function getFile(asset,useB=false){const url=useB&&asset.hasB?asset.imageBUrl:asset.imageUrl,response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('素材原图无法读取，原有花型保留');const blob=await response.blob();if(blob.type!=='image/png'||blob.size>32*1024*1024)throw Error('素材须为32 MB以内的 PNG');return new File([blob],asset.name+(useB?'_B':'_A')+'.png',{type:'image/png'});}
  async function prepareRecipe(value){
    if(!value)return null;const catalog=(await request('/api/product-recognition/catalog')).products,item=catalog.find(p=>p.id===value.product);if(!item)throw Error('这款商品的产品类别已不可用，请单独选用花型');
    const fields=value.product==='set'?{duvetCraft:value.duvetCraft,sheetStyle:value.sheetStyle,pillowCraft:value.pillowCraft}:{variant:value[{quilt:'quiltSeason',sheet:'sheetVariant',mattress:'mattressVariant',blanket:'blanketVariant',sleepbag:'sleepbagVariant',mat:'matVariant',pillowcore:'pillowcoreVariant'}[value.product]]};
    for(const group of item.groups)if(fields[group.key]&&!group.choices.some(choice=>choice.id===fields[group.key]))throw Error('保存的商品工艺已不可用，请单独选用花型');
    const definition=products.find(p=>p.id===value.product);if(value.fabric&&!definition?.fabrics.includes(value.fabric))throw Error('保存的面料选项已不可用，请单独选用花型');
    return ()=>{if(!applyProductRecognitionSelection(value.product,fields,catalog))return;if(typeof clearTextureReference==='function')clearTextureReference(false);state.textureSource='library';if(value.fabric)state.fabric=value.fabric;state.fabricMode=value.fabricMode||'selected';Object.assign(state.productVariantChoices,value.productVariantChoices||{});renderOptions();renderSelections();};
  }
  async function apply(id,side,{savedPair=null}={}){
    if(state.busy||state.libraryApplying)return status('请等待当前处理完成后再应用素材。',true);if(!uuid.test(id)||!['A','B','pair'].includes(side))return;
    const original=snapshot();state.libraryApplying=true;updateCount();controls();render();status('正在读取原始花稿…');
    try{const asset=(await request('/api/library/assets/'+id)).asset;if(!validAsset(asset))throw Error('素材记录无效');const applyRecipe=side==='pair'?await prepareRecipe(asset.recipe):null,files={};
      if(side==='pair'){files.A=await getFile(asset);files.B=asset.hasB?await getFile(asset,true):null;}else{files[side]=await getFile(asset,side==='B');const other=side==='A'?'B':'A',cached=other==='A'?savedPair?.a:savedPair?.b;if(!(other==='A'?state.upload:state.uploadB)&&validSavedPattern(cached))files[other]=new File([cached.blob],cached.name||other+'面.png',{type:cached.blob.type,lastModified:cached.lastModified||Date.now()});}
      const metadata={};for(const key of Object.keys(files))metadata[key]=side!=='pair'&&key!==side?(key==='A'?savedPair?.a:savedPair?.b)?.metadata||{}:{assetId:id,name:asset.name,print:asset.print};
      await globalThis.patternMaterials.replace(files,{metadata,isCurrent:()=>current(original,side==='pair'),onCommit:()=>applyRecipe?.()});
      if(dialog.open)dialog.close();const message=side==='pair'?'已应用商品「'+asset.name+'」；请核对产品与工艺后开始拍摄。':'已将「'+asset.name+'」用作 '+side+' 面；另一面与拍摄设置保留。';status(message);toast(message);
      const url=new URL(location.href);if(url.searchParams.get('asset')===id){url.searchParams.delete('asset');url.searchParams.delete('side');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
    }catch(error){status(error.message||'素材应用失败，原设置保留',true);}finally{state.libraryApplying=false;updateCount();controls();render();}
  }
  async function pngBlob(file){if(file.type==='image/png')return file;const url=URL.createObjectURL(file),image=new Image();try{image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>64e6)throw Error('图片过大，无法保存');const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>32*1024*1024)throw Error('原尺寸PNG超过32 MB，请先缩小后另存');return blob;}finally{URL.revokeObjectURL(url);}}
  document.getElementById('workspaceSaveProduct').onclick=async()=>{if(!state.upload||saving||state.busy)return;const source=snapshot(),a=state.upload,b=state.uploadB,settings=recipe();saving=true;controls();try{const [blob,imageB]=await Promise.all([pngBlob(a.file),b?pngBlob(b.file):null]);if(!current(source,true))throw Error('当前花型或设置已变化，请重新保存');const {saveAssetDialog}=await client();const asset=await saveAssetDialog({blob,imageB,name:'我的'+(products.find(p=>p.id===settings.product)?.name||'商品'),kind:'product',recipe:settings,print:a.metadata?.print,source:'产品拍摄 · 用户保存的 A/B 面与产品工艺'});if(asset){status('商品已保存，可从素材库重复选用。');assets=[];}}catch(error){status(error.message,true);}finally{saving=false;controls();}};
  document.getElementById('workspaceChooseAsset').onclick=()=>{dialog.showModal();void refresh();};document.getElementById('workspaceLibrarySearch').oninput=render;document.getElementById('workspaceLibraryKind').onchange=render;document.getElementById('workspaceLibraryRefresh').onclick=refresh;
  for(const id of ['uploadInfo','uploadInfoB','generateBtn']){const target=document.getElementById(id);if(target)new MutationObserver(controls).observe(target,{attributes:true,attributeFilter:['hidden','disabled']});}
  function navigation(){const nav=document.getElementById('workspaceNavLinks');if(!nav)return false;if(!nav.querySelector('a[href="/library"]')){const link=document.createElement('a');link.href='/library';link.title=link.ariaLabel='我的花型与商品库';link.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 14h8M8 17h5M8 1v6M16 1v6"/></svg><span>素材库</span>';nav.append(link);}return true;}
  if(!navigation()){const observer=new MutationObserver(()=>{if(navigation())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
  controls();
  const url=new URL(location.href),requested=url.searchParams.get('asset'),side=url.searchParams.get('side')||'A',entry=snapshot();
  if(requested&&uuid.test(requested)&&['A','B','pair'].includes(side))void(async()=>{try{
    await loadLastPatterns();if(!current(entry,side==='pair')||state.busy)return status('当前设置已更新，请在素材库中点击选用。');
    if(!state.busy)await apply(requested,side,{savedPair:side!=='pair'?lastPatternPair:null});
  }catch(error){status(error.message,true);}})();
})();
