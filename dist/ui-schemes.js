(() => {
  const root = document.documentElement;
  const saved = (() => { try { return localStorage.getItem('zhijing-ui-scheme'); } catch { return null; } })();
  const bar = document.createElement('div');
  bar.className = 'ui-scheme-switch';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', '界面方案对比');
  bar.innerHTML = '<button type="button" data-scheme="A" title="完整恢复原版界面">方案 A</button><button type="button" data-scheme="B" title="图片与详情在左，拍摄设置在右">方案 B</button>';
  document.querySelector('.top-actions').prepend(bar);
  const collapse = document.createElement('button');
  collapse.type = 'button'; collapse.id = 'schemeCollapseSettings';
  collapse.className = 'scheme-collapse-settings'; collapse.textContent = '收起 →';
  collapse.setAttribute('aria-controls', 'creationPanel');collapse.setAttribute('aria-expanded', 'true');
  document.querySelector('#creationPanel .config-actions').append(collapse);
  const reopen = document.createElement('button');
  reopen.type = 'button';reopen.className = 'scheme-reopen-settings';reopen.title = '展开拍摄设置';
  reopen.setAttribute('aria-label', '展开拍摄设置');reopen.setAttribute('aria-controls', 'creationPanel');
  reopen.innerHTML = '<span aria-hidden="true">←</span><span>拍摄设置</span>';
  document.body.append(reopen);
  function setSettingsCollapsed(value) {
    root.classList.toggle('settings-rail-collapsed', value);
    collapse.setAttribute('aria-expanded', String(!value));
    document.getElementById('creationPanel').inert = value;
    portals.forEach(p => p.dialog.close());
    if(value) reopen.focus();else collapse.focus();
    window.dispatchEvent(new Event('resize'));
  }
  collapse.onclick = () => setSettingsCollapsed(true);
  reopen.onclick = () => setSettingsCollapsed(false);
  const portals = [];
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'scheme-modal-backdrop';modalBackdrop.hidden = true;
  document.body.append(modalBackdrop);
  function syncModalBackdrop(){
    modalBackdrop.hidden = root.dataset.uiScheme !== 'B' || !document.querySelector('.scheme-picker-dialog[open], [class*="variant-flyout"]:not([hidden])');
  }
  const modalObserver = new MutationObserver(syncModalBackdrop);
  modalObserver.observe(root,{attributes:true,attributeFilter:['data-ui-scheme']});
  document.querySelectorAll('[class*="variant-flyout"]').forEach(p=>modalObserver.observe(p,{attributes:true,attributeFilter:['hidden']}));
  const reusePatterns = document.getElementById('restoreLastPatterns');
  const reuseMarker = document.createComment('方案 A 上次花型按钮原位置');
  reusePatterns.before(reuseMarker);
  const textureField = document.querySelector('.texture-choice-field');
  const textureRow = document.createElement('div');
  textureRow.className = 'scheme-texture-controls';
  textureRow.innerHTML = '<button type="button" class="scheme-texture-library" aria-haspopup="true" aria-controls="fabricPickerPanel"><span><strong>面料库</strong><small></small></span><span aria-hidden="true">⌄</span></button><button type="button" class="scheme-texture-upload"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6"/></svg><span>上传参考</span></button>';
  const texturePanel = textureField.querySelector('.texture-source-panel');
  texturePanel.before(textureRow);
  const libraryEntry = textureRow.querySelector('.scheme-texture-library');
  const uploadEntry = textureRow.querySelector('.scheme-texture-upload');
  const fabricSelect = document.getElementById('fabric');
  libraryEntry.onclick = () => {
    document.getElementById('textureLibraryBtn').click();
    document.getElementById('fabricPickerTrigger').click();
  };
  uploadEntry.onclick = () => document.getElementById('textureUploadBtn').click();
  function syncTextureEntries() {
    const name = fabricSelect.selectedOptions[0]?.textContent || '点击选择';
    textureRow.querySelector('small').textContent = name;
    libraryEntry.title = '点击选择面料质感：' + name;
    libraryEntry.disabled = fabricSelect.disabled;
    libraryEntry.setAttribute('aria-expanded', document.getElementById('fabricPickerTrigger').getAttribute('aria-expanded') || 'false');
    uploadEntry.disabled = document.getElementById('textureUploadBtn').disabled;
    const uploaded = !document.getElementById('textureUploadInfo').hidden;
    const text = uploaded ? '更换参考' : '上传参考';
    if(uploadEntry.querySelector('span').textContent !== text) uploadEntry.querySelector('span').textContent = text;
  }
  new MutationObserver(syncTextureEntries).observe(texturePanel, {subtree:true, attributes:true, attributeFilter:['hidden','disabled','aria-expanded'],childList:true});
  fabricSelect.addEventListener('change', syncTextureEntries);
  syncTextureEntries();
  function picker(section, content, title, summary) {
    const marker = document.createComment('方案 A 原始位置');
    content.before(marker);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'scheme-picker';
    button.setAttribute('aria-haspopup', 'dialog');
    const label = document.createElement('span');
    const arrow = document.createElement('span'); arrow.textContent = '⌄'; arrow.setAttribute('aria-hidden', 'true');
    button.append(label, arrow); section.append(button);
    const dialog = document.createElement('dialog');
    dialog.className = 'scheme-picker-dialog';
    modalObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
    dialog.dataset.picker = section === document.querySelector('.group-product') ? 'product' : 'shooting';
    const heading = document.createElement('header');
    const h = document.createElement('h2'); h.textContent = title; h.id = 'scheme-picker-' + portals.length;
    dialog.setAttribute('aria-labelledby', h.id);
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '完成';
    close.onclick = () => dialog.close(); heading.append(h, close); dialog.append(heading);
    document.body.append(dialog);
    button.onclick = () => { portals.forEach(p => p.dialog.close()); dialog.show(); if(dialog.dataset.picker === 'product') showProductDetails(); close.focus(); };
    document.addEventListener('pointerdown', e => {
      if (!dialog.open || dialog.contains(e.target) || button.contains(e.target)) return;
      // Product craft menus and scene previews are part of the active picker.
      if (dialog.dataset.picker === 'product' && e.target.closest('.set-variant-flyout, .mat-variant-flyout, [class*="variant-flyout"], #craftUploadPanel')) return;
      if (dialog.dataset.picker === 'shooting' && e.target.closest('.scene-hover-preview, #angleImagePreview')) return;
      dialog.close();
    }, true);
    dialog.addEventListener('keydown', e => { if(e.key === 'Escape') { dialog.close(); button.focus(); } });
    dialog.addEventListener('click', e => { if(e.target === dialog) {const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();} });
    const refresh = () => {const text = summary(); if(label.textContent !== text) label.textContent = text;};
    const observer = new MutationObserver(refresh);
    observer.observe(content, {subtree:true, childList:true, attributes:true, characterData:true});
    content.addEventListener('input', refresh); content.addEventListener('change', refresh);
    portals.push({marker, content, dialog}); refresh();
  }
  const product = document.querySelector('.group-product');
  picker(product, product.querySelector('.compact-body'), '选择产品与款式', () => {
    const selected = document.querySelector('#products .selected');
    const variant=selected?.querySelector('small')?.textContent;
    return selected ? [selected.querySelector('strong')?.textContent || selected.textContent, variant === '点击展开分类' ? '' : variant].filter(Boolean).join(' · ') : '选择产品与款式';
  });
  const shooting = document.getElementById('shootSection');
  picker(shooting, shooting.querySelector('.shooting-plan-horizontal'), '场景与拍摄角度', () => {
    const n = document.querySelectorAll('#scenes .selected, #moreScenes .selected').length;
    return (n ? n + ' 个场景' : '选择场景') + ' · 角度与参考图';
  });
  const productPortal = portals[0];
  const productLayout = document.createElement('div');productLayout.className = 'scheme-product-layout';
  const productDetails = document.createElement('div');productDetails.className = 'scheme-product-details';
  productLayout.append(productDetails);productPortal.dialog.append(productLayout);productPortal.host = productLayout;
  const embeddedPanels = [...document.querySelectorAll('.set-variant-flyout')].map(panel => {
    const marker = document.createComment('方案 A 产品分类原位置');panel.before(marker);
    return {panel,marker};
  });
  new MutationObserver(() => {
    embeddedPanels.forEach(({panel}) => {
      const options=[...panel.querySelectorAll('.set-variant-option')];
      panel.dataset.optionDensity=options.length>8?'compact':options.length<=3?'few':'normal';
      options.forEach(option=>{const hint=option.querySelector('small');if(hint&&!option.title)option.title=hint.textContent;});
    });
  }).observe(productDetails,{childList:true,subtree:true});
  function activateProductDetails(trigger){
    const panelId=trigger.getAttribute('aria-controls');
    embeddedPanels.forEach(({panel}) => {
      if(panel.id === panelId) panel.dataset.embeddedActive='true';
      else delete panel.dataset.embeddedActive;
    });
  }
  productPortal.dialog.addEventListener('click', e => {
    const trigger=e.target.closest('#products [data-product]');
    if(trigger) activateProductDetails(trigger);
  }, true);
  function showProductDetails(){
    const trigger=document.querySelector('#products .selected') || document.querySelector('#products [data-product="set"]');
    if(!trigger)return;
    const panel=document.getElementById(trigger.getAttribute('aria-controls'));
    if(panel)panel.hidden=true;
    activateProductDetails(trigger);trigger.click();
  }
  const textureMarker=document.createComment('方案 A 面料质感原位置');textureField.before(textureMarker);
  const fabricPanel=document.getElementById('fabricPickerPanel');
  const fabricPanelMarker=document.createComment('方案 A 面料库原位置');fabricPanel.before(fabricPanelMarker);
  const productEntry=product.querySelector(':scope>.scheme-picker');
  const productEntryMarker=document.createComment('方案 A 产品入口原位置');productEntry.before(productEntryMarker);
  const combinedRow=document.createElement('div');combinedRow.className='scheme-product-texture-row';product.append(combinedRow);
  const textureEntry=document.createElement('button');textureEntry.type='button';textureEntry.className='scheme-texture-entry';textureEntry.setAttribute('aria-haspopup','dialog');textureEntry.innerHTML='<span><strong>面料质感</strong><small>默认</small></span><span aria-hidden="true">⌄</span>';
  combinedRow.append(textureEntry);
  const textureDialog=document.createElement('dialog');textureDialog.className='scheme-picker-dialog';textureDialog.dataset.picker='texture';textureDialog.setAttribute('aria-labelledby','schemeTextureTitle');
  textureDialog.innerHTML='<header><h2 id="schemeTextureTitle">选择面料质感</h2><button type="button">完成</button></header>';
  document.body.append(textureDialog);modalObserver.observe(textureDialog,{attributes:true,attributeFilter:['open']});
  textureDialog.querySelector('header button').onclick=()=>textureDialog.close();
  textureEntry.onclick=()=>{portals.forEach(p=>p.dialog.close());textureDialog.show();textureDialog.querySelector('header button').focus();};
  document.addEventListener('pointerdown',e=>{if(textureDialog.open&&!textureDialog.contains(e.target)&&!textureEntry.contains(e.target)&&!e.target.closest('#fabricTexturePreview'))textureDialog.close();},true);
  textureDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){textureDialog.close();textureEntry.focus();}});
  textureDialog.addEventListener('click',e=>{if(e.target.closest('[data-fabric]'))document.getElementById('textureLibraryBtn').click();},true);
  function syncTextureSummary(){
    const uploaded=document.getElementById('textureCustomBtn').getAttribute('aria-pressed')==='true'&&!document.getElementById('textureUploadInfo').hidden;
    const label=uploaded?'已上传参考':fabricSelect.selectedOptions[0]?.textContent||'默认';
    if(textureEntry.querySelector('small').textContent!==label)textureEntry.querySelector('small').textContent=label;
    textureEntry.disabled=fabricSelect.disabled;
  }
  new MutationObserver(syncTextureSummary).observe(texturePanel,{subtree:true,attributes:true,attributeFilter:['hidden','aria-pressed','disabled'],childList:true});
  fabricSelect.addEventListener('change',syncTextureSummary);syncTextureSummary();
  function apply(scheme) {
    textureDialog.close();
    for(const p of portals) {
      p.dialog.close();
      if(scheme === 'B') {if(p.host)p.host.prepend(p.content);else p.dialog.append(p.content);}
      else p.marker.after(p.content);
    }
    root.dataset.uiScheme = scheme;
    if(scheme==='B'){combinedRow.prepend(productEntry);textureDialog.append(textureField,fabricPanel);}
    else{productEntryMarker.after(productEntry);textureMarker.after(textureField);fabricPanelMarker.after(fabricPanel);}
    embeddedPanels.forEach(({panel,marker}) => {
      panel.hidden=true;delete panel.dataset.embeddedActive;
      if(scheme === 'B'){panel.dataset.embeddedProduct='true';productDetails.append(panel);}
      else{delete panel.dataset.embeddedProduct;marker.after(panel);}
    });
    if(scheme === 'B') document.getElementById('fabricGroupTitle').append(reusePatterns);
    else reuseMarker.after(reusePatterns);
    document.getElementById('creationPanel').inert = scheme === 'B' && root.classList.contains('settings-rail-collapsed');
    bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scheme === scheme)));
    try {localStorage.setItem('zhijing-ui-scheme', scheme);} catch {}
    window.dispatchEvent(new Event('resize'));
  }
  bar.onclick = e => {const b=e.target.closest('[data-scheme]');if(b) apply(b.dataset.scheme);};
  apply(saved === 'A' ? 'A' : 'B');
})();
