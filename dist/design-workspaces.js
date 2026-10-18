(() => {
 const root=document.documentElement,workspace=document.getElementById('workspace'),creation=document.getElementById('creationPanel'),images=document.getElementById('results');
 if(!workspace||!creation||!images)return;
 // Keep existing controls and handlers; move nodes instead of making copies.
 document.querySelector('[data-scheme="B"]')?.click();
 try{localStorage.setItem('zhijing-ui-scheme','B');}catch{}
 root.dataset.uiScheme='B';document.body.classList.add('paired-design-workspaces');
 creation.querySelector('.panel-title h2').textContent='拍摄设置';
 const shootingLink=document.querySelector('.workspace-nav-links a[href="#creationPanel"]');
 if(shootingLink){shootingLink.title='拍摄设置';shootingLink.setAttribute('aria-label','拍摄设置');shootingLink.querySelector('span').textContent='拍摄';}
 const imageWorkspace=document.createElement('section');imageWorkspace.id='imageDesignWorkspace';imageWorkspace.className='design-workspace image-design-workspace';imageWorkspace.setAttribute('aria-label','图片设计与拍摄设置');
 images.before(imageWorkspace);imageWorkspace.append(images,creation);
 const reopen=document.querySelector('.scheme-reopen-settings');if(reopen){reopen.title='展开拍摄设置';reopen.setAttribute('aria-label','展开拍摄设置');reopen.querySelector('span:last-child').textContent='拍摄设置';imageWorkspace.append(reopen);}
 const syncImages=()=>imageWorkspace.classList.toggle('image-workspace-closed',images.classList.contains('workspace-section-collapsed'));
 new MutationObserver(syncImages).observe(images,{attributes:true,attributeFilter:['class']});syncImages();
 shootingLink?.addEventListener('click',()=>{if(images.classList.contains('workspace-section-collapsed'))images.querySelector('.workspace-section-header button')?.click();if(root.classList.contains('settings-rail-collapsed'))reopen?.click();});
 const navBottom=document.querySelector('.workspace-nav-bottom');
 if(navBottom){
  const icons={promptAdminLink:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',settingsBtn:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',helpBtn:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>'};
  for(const [id,name] of [['promptAdminLink','提示词'],['settingsBtn','设置'],['helpBtn','帮助']]){const entry=document.getElementById(id);if(!entry)continue;entry.className='workspace-utility-entry';entry.title=id==='promptAdminLink'?'提示词后台':id==='settingsBtn'?'生成服务设置':'使用说明';entry.setAttribute('aria-label',entry.title);entry.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+icons[id]+'</svg><span>'+name+'</span>';navBottom.append(entry);}
  const connect=document.getElementById('connectBtn');if(connect){connect.className='workspace-service-status';navBottom.append(connect);const badge=document.getElementById('serviceBadge');const sync=()=>{connect.title=badge.textContent;connect.setAttribute('aria-label',badge.textContent);};new MutationObserver(sync).observe(badge,{childList:true,subtree:true,characterData:true});sync();}
  document.getElementById('workspaceNavSettings')?.remove();
 }
 const scheme=document.querySelector('.ui-scheme-switch');if(scheme){const parking=document.createElement('div');parking.hidden=true;parking.append(scheme);workspace.append(parking);}
 document.querySelector('#workspace>.topbar')?.remove();
 function prepareDetail(){
  const detail=document.getElementById('detailPageModule'),compose=detail?.querySelector('.detail-compose-area');
  if(!detail||!compose||document.getElementById('detailDesignWorkspace'))return false;
  const pair=document.createElement('section');pair.id='detailDesignWorkspace';pair.className='design-workspace detail-design-workspace';pair.setAttribute('aria-label','详情设计与详情设置');detail.before(pair);pair.append(detail);
  const rail=document.createElement('aside');rail.id='detailSettingsPanel';rail.className='detail-settings-rail';rail.setAttribute('aria-labelledby','detailSettingsTitle');
  rail.innerHTML='<header class="settings-rail-header"><span class="settings-rail-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg></span><h2 id="detailSettingsTitle">详情设置</h2><button type="button" id="collapseDetailSettings" aria-expanded="true" aria-controls="detailSettingsBody">收起 →</button></header><div id="detailSettingsBody" class="detail-settings-body"></div>';
  pair.append(rail);rail.querySelector('#detailSettingsBody').append(compose);
  const materials=compose.querySelector('.detail-compose-materials'),upload=materials.querySelector('.detail-tools'),queue=materials.querySelector('#detailQueue'),inputs=materials.querySelector('.detail-design-inputs'),sizes=compose.querySelector('#detailSizes'),generation=document.getElementById('detailGenerate').closest('.detail-tools');
  function group(index,title,nodes){const section=document.createElement('section');section.className='detail-settings-section';const heading=document.createElement('h3');heading.innerHTML='<b>'+index+'</b> '+title;section.append(heading,...nodes.filter(Boolean));return section;}
  materials.prepend(group('01','商品素材',[upload,queue]));materials.append(group('02','设计要求',[inputs]));
  const sizesGroup=group('03','商品尺寸',[sizes]);sizesGroup.classList.add('detail-settings-sizes');compose.append(sizesGroup);
  compose.append(group('04','准备生成',[generation]));
  const placeholder=document.createElement('div');placeholder.className='detail-design-empty';placeholder.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg><h3>从商品图片开始，设计完整详情页</h3><p>在右侧添加素材、填写产品特征并确认尺寸，生成后可在这里预览和编辑。</p>';detail.querySelector('.detail-page-body').prepend(placeholder);
  const result=document.getElementById('detailResult');
  const syncResult=()=>{const hasResult=!!result.querySelector('.detail-slice');detail.dataset.detailResults=String(hasResult);placeholder.hidden=hasResult;};
  new MutationObserver(syncResult).observe(result,{childList:true,subtree:true});syncResult();
  const detailReopen=document.createElement('button');detailReopen.id='reopenDetailSettings';detailReopen.className='paired-reopen-settings';detailReopen.type='button';detailReopen.setAttribute('aria-label','展开详情设置');detailReopen.innerHTML='<span aria-hidden="true">←</span><span>详情设置</span>';pair.append(detailReopen);
  function collapse(value){pair.classList.toggle('detail-settings-collapsed',value);rail.inert=value;rail.querySelector('#collapseDetailSettings').setAttribute('aria-expanded',String(!value));(value?detailReopen:rail.querySelector('#collapseDetailSettings')).focus();}
  rail.querySelector('#collapseDetailSettings').onclick=()=>collapse(true);detailReopen.onclick=()=>collapse(false);
  const sync=()=>pair.classList.toggle('detail-workspace-closed',!detail.open);detail.addEventListener('toggle',sync);sync();
  window.dispatchEvent(new Event('resize'));return true;
 }
 if(!prepareDetail()){const observer=new MutationObserver(()=>{if(prepareDetail())observer.disconnect();});observer.observe(workspace,{childList:true,subtree:true});}
})();
