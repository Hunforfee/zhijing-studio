// Presentation only: generation prompts, inputs and task state remain owned by their modules.
(() => {
  const panel=document.createElement('dialog');
  panel.id='contextHelpDialog';panel.className='zh-help-dialog';
  panel.setAttribute('aria-labelledby','contextHelpTitle');panel.setAttribute('popover','auto');
  panel.innerHTML='<header><h2 id="contextHelpTitle"></h2><button type="button" class="zh-help-close" aria-label="关闭帮助">×</button></header><div id="contextHelpContent"></div>';
  document.body.append(panel);
  const title=panel.querySelector('h2'),content=panel.querySelector('#contextHelpContent');
  const bindings=new Map();let active=null,scheduled=false,showTimer,hideTimer,restoringFocus=false;
  const hoverPointer=matchMedia('(hover: hover) and (pointer: fine)');
  const isOpen=()=>panel.open||panel.matches(':popover-open');
  const clearTimers=()=>{clearTimeout(showTimer);clearTimeout(hideTimer);};
  const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const one=(selector,root=document)=>root.querySelector(selector);
  const costs=/计费|费用|收费/;
  const explanatory=nodes=>nodes.filter(node=>!node.matches('[role="status"],[aria-live],input,textarea,select,progress')&&!costs.test(node.textContent));
  function position(){
    if(!isOpen()||!active?.button.isConnected)return;
    const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
    const offsetX=viewport?.offsetLeft||0,offsetY=viewport?.offsetTop||0,gap=12;
    panel.style.width=Math.min(420,width-gap*2)+'px';panel.style.maxHeight=Math.max(100,height-gap*2)+'px';
    const bounds=active.button.getBoundingClientRect(),size=panel.getBoundingClientRect();
    const left=width<=600?gap:Math.max(gap,Math.min(bounds.right-size.width,width-size.width-gap));
    const top=width<=600?height-size.height-gap:bounds.bottom+8+size.height<=height-gap?bounds.bottom+8:Math.max(gap,bounds.top-size.height-8);
    panel.style.left=offsetX+left+'px';panel.style.top=offsetY+top+'px';
  }
  function finish(previous,restoreFocus=false){
    previous?.button.setAttribute('aria-expanded','false');previous?.button.removeAttribute('aria-describedby');
    if(panel.parentElement!==document.body)document.body.append(panel);
    if(restoreFocus&&previous?.button.isConnected){restoringFocus=true;try{previous.button.focus({preventScroll:true});}finally{restoringFocus=false;}}
  }
  function close(restoreFocus=false){
    clearTimers();const previous=active,hadFocus=panel.contains(document.activeElement);active=null;
    if(panel.matches(':popover-open'))panel.hidePopover();if(panel.open)panel.close();
    finish(previous,restoreFocus||hadFocus||previous?.mode==='modal');
  }
  function open(binding,mode='pinned'){
    clearTimers();
    if(active?.button===binding.button&&isOpen()){
      if(mode!=='hover'&&mode!=='focus')active.mode=mode;
      return;
    }
    close();active={...binding,mode};title.textContent=binding.title;content.replaceChildren();
    const notes=[...binding.sources.filter(node=>!node.hidden&&!node.closest('[hidden]')).map(node=>node.textContent.trim()),...binding.extra()].filter(Boolean);
    for(const text of [...new Set(notes)]){const paragraph=document.createElement('p');paragraph.textContent=text;content.append(paragraph);}
    if(!content.childNodes.length){const paragraph=document.createElement('p');paragraph.textContent='选择所需选项后继续操作；当前结果和处理状态会显示在页面上。';content.append(paragraph);}
    // A helper opened from another dialog must stay inside that active modal's subtree.
    (binding.button.closest('dialog')||document.body).append(panel);
    binding.button.setAttribute('aria-expanded','true');binding.button.setAttribute('aria-describedby',content.id);
    if(mode==='modal'){panel.showModal();panel.querySelector('button').focus({preventScroll:true});}
    else{
      const previousFocus=document.activeElement;panel.showPopover();
      // A dialog used as a popover may focus its close button. Hover must never move focus.
      if(document.activeElement!==previousFocus){restoringFocus=true;try{if(previousFocus===document.body||previousFocus===document.documentElement)document.activeElement?.blur();else previousFocus?.focus({preventScroll:true});}finally{restoringFocus=false;}}
    }
    position();
  }
  const stillReading=()=>active&&(active.button.matches(':hover')||panel.matches(':hover')||active.button===document.activeElement||panel.contains(document.activeElement));
  function deferClose(){clearTimeout(showTimer);clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(active&&['hover','focus'].includes(active.mode)&&!stillReading())close();},220);}
  panel.querySelector('button').onclick=()=>close(true);
  const nativeClose=()=>{if(isOpen()||!active)return;const previous=active,hadFocus=panel.contains(document.activeElement);active=null;clearTimers();finish(previous,hadFocus||previous.mode==='modal');};
  panel.addEventListener('close',nativeClose);panel.addEventListener('toggle',nativeClose);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen()){event.preventDefault();event.stopPropagation();close(true);}},true);
  panel.addEventListener('pointerenter',()=>clearTimeout(hideTimer));panel.addEventListener('pointerleave',deferClose);
  panel.addEventListener('focusin',()=>clearTimeout(hideTimer));panel.addEventListener('focusout',deferClose);
  panel.addEventListener('click',event=>{if(event.target!==panel)return;const rect=panel.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();});
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
  function bind(key,heading,label,sources=[],extra=[]){
    if(!heading||heading.closest('button,a'))return;
    sources=explanatory(sources);let binding=bindings.get(key);
    if(binding?.heading!==heading){binding?.button.remove();binding=null;}
    if(!binding){
      const button=document.createElement('button');button.type='button';button.className='zh-help-trigger';button.textContent='?';button.dataset.helpTopic=key;
      button.setAttribute('aria-label',label+'帮助');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');
      binding={heading,button,title:label,sources,extra:()=>extra};bindings.set(key,binding);
      button.addEventListener('pointerenter',event=>{
        if(!hoverPointer.matches||event.pointerType==='touch')return;
        clearTimers();showTimer=setTimeout(()=>{if(button.isConnected&&button.matches(':hover'))open(binding,'hover');},180);
      });
      button.addEventListener('pointerleave',deferClose);
      button.addEventListener('focus',()=>{if(!restoringFocus&&button.matches(':focus-visible'))open(binding,'focus');});
      button.addEventListener('blur',deferClose);
      button.onclick=event=>{event.preventDefault();event.stopPropagation();if(active?.button===button&&['pinned','modal'].includes(active.mode)&&isOpen())close(true);else open(binding,hoverPointer.matches?'pinned':'modal');};
    }
    for(const previous of binding.sources)if(!sources.includes(previous))previous.classList.remove('zh-help-source');
    binding.sources=sources;binding.extra=typeof extra==='function'?extra:()=>extra;
    if(binding.button.parentElement!==heading)heading.append(binding.button);
    for(const source of sources)source.classList.add('zh-help-source');
  }
  const originalPlaceholder=id=>document.getElementById(id)?.dataset.helpPlaceholder||'';
  function compactPlaceholder(id,text){const field=document.getElementById(id);if(field&&!field.dataset.helpPlaceholder&&field.getAttribute('placeholder')){field.dataset.helpPlaceholder=field.getAttribute('placeholder');field.setAttribute('placeholder',text);}}
  function scan(){
    scheduled=false;
    bind('product',one('#productGroupTitle'),'产品与工艺',all('#partsHint'),['先选择产品类别，再确认各部件的款式与工艺。生成以当前所选设置为准。']);
    bind('fabric',one('#fabricGroupTitle'),'花型与面料',all('.texture-choice-tip,#fabricHint,#patternRule,.texture-custom-note'),['A 面用于正面花型；B 面为选填，具体部件归属以当前产品规则为准。每面最多 8 张，首张为主图，其余用于补充细节。PNG / JPG / WebP，每张不超过 32 MB。']);
    bind('shooting',one('#shootingGroupTitle'),'场景与角度',[],['场景支持多选，智能角度按每个场景的数量安排。参考场景与参考角度可独立选择；参考角度启用时，智能角度会关闭。']);
    bind('custom-scene',one('#customSceneTitle'),'我的场景',all('.custom-scene-help'));
    bind('photo-notes',one('label[for="notes"]'),'补充要求',[],()=>['只需描述本次需要特别调整的内容，已有产品与工艺设置不必重复。',originalPlaceholder('notes')]);
    bind('workspace-library',one('#workspaceLibraryTitle'),'选用花型或商品',all('#workspaceLibraryDialog>header p'),['单独选用一面会替换该面的主图和补充图，另一面保留。整款仅包含保存的主 A/B 图、产品工艺与面料库选项，不包含补充图、上传质感参考、场景和镜头。']);
    bind('detail',one('#detailSettingsTitle'),'详情设计',[],()=>['上传商品图片，填写已确认的材质、尺寸与特点，再设置详情张数。不要填写无法确认的规格或功效。',originalPlaceholder('detailPrompt')]);
    bind('detail-edit',one('#detailEditTitle'),'编辑详情切片',[],()=>[originalPlaceholder('detailEditPrompt')]);
    bind('video',one('#videoSettingsTitle'),'视频创作',all('.video-spec-note'),()=>['先策划并核对分镜，再生成画面与视频。稳定运镜移动镜头、保持床品静止；AI 动态仍可能产生形变。',originalPlaceholder('videoBrief')]);
    bind('free-creation',one('#fcSettingsTitle'),'自由创作',all('.fc-rail-header>small,.fc-field-note,.fc-product-locks>small'),()=>['可上传原图，或从已有作品导入；支持原图对比与框选修改。',originalPlaceholder('fcPrompt')]);
    bind('commerce-tool',one('#ecTitle'),'家纺电商工具',[],['营销、SKU、尺寸导购与核对共用同一份商品资料。填写资料与本机排版不会自动调用 AI。AI 只在点击后提出候选，确认采用才会改变作品。']);
    bind('commerce-profile',one('#ecProfileTitle'),'商品资料与规格',[],['商品图最多6张，每张32MB，整组64MB。请按真实花色对应图片；尺寸单位为cm，适用床宽与被套宽度是不同字段。可用CSV模板批量填写规格。资料与原图保存于当前浏览器，不自动上传分析。']);
    bind('commerce-ai',one('#ecAITitle'),'AI创作与辅助核对',[],['点击AI按钮时，将最多6张缩小后的参考图及已填写的商品资料交给当前配置服务。采用候选前原稿保留，失败不会自动重试。商品核对为辅助意见，需要逐项人工判断，图片不能证明成分、功效或实物尺寸。']);
    bind('commerce-edit',one('#ecEditTitle'),'精修与导出',[],['文字、配色和版式可调整，商品主体使用上传原图。默认3:4，导出为所选像素尺寸的合成图，不是放大原始素材。SKU与尺寸导购可按全部规格打包，价格和尺寸来自已填资料。']);
    bind('tool',one('#toolTitle'),'使用当前工具',all('#toolDescription,#toolFootnote,.toolbox-sidebar>p'));
    for(const settings of all('.tt-settings')){
      const id=settings.closest('[data-tool]')?.dataset.tool||settings.parentElement.id;
      bind('manual-'+id,one(':scope>h2',settings),'精修与导出',all(':scope>.tt-help:not(#hdDimensions)',settings));
    }
    for(const card of all('.tt-ai-card')){
      const id=card.closest('[data-tool]')?.dataset.tool||card.closest('.tt-panel')?.id||card.parentElement.parentElement.id;
      bind('tool-ai-'+id,one('h2',card),'AI 辅助说明',all('.tt-ai-note',card),['上传素材后，可修改创作方向。AI 候选需要确认采用，才能进入后续精修与导出。']);
    }
    bind('hd-ai',one('.tt-hd-ai>summary'),'AI 高清修复',all('.tt-hd-ai>.tt-help'),()=>[originalPlaceholder('hdAIIntent')]);
    bind('designer-ai',one('.pd-ai-brief h1'),'AI 花型设计',all('.pd-ai-intro,.pd-ai-brief>p.tt-help'),()=>[originalPlaceholder('pdAIPrompt')]);
    for(const [index,group]of all('.pd-group').entries()){
      const notes=all(':scope>p.tt-help:not(#pdResolution)',group);if(notes.length)bind('designer-group-'+index,one(':scope>h2,:scope>summary',group),'设计操作说明',notes);
    }
    bind('designer-canvas',one('.pd-toolbar'),'画布操作',all('.pd-tip'));
    bind('designer-print',one('.pd-right>.pd-group>summary'),'花回与印花导出',all('.pd-production-note'),['花回尺寸与 DPI 决定 PNG 导出的像素大小；半落位、镜像等方式会影响完整循环单元。当前实际尺寸仍显示在参数下方。']);
    bind('scene',one('#ssSettingsTitle'),'创建拍摄场景',all('.ss-reference>p,.ss-note'),()=>['输入房间、家具与光线，或添加空间参考；生成后确认保存，即可用于产品拍摄。',originalPlaceholder('ssBrief')]);
    for(const [index,dialog]of all('dialog.lib-save-dialog').entries())bind('library-save-'+index,one('h2',dialog),'保存到图库',all('form>p:not([role="status"]),.lib-save-note',dialog).filter(node=>!node.classList.contains('lib-save-metric')));
    for(const [id,placeholder]of Object.entries({notes:'描述本次特别要求（选填）',detailPrompt:'填写产品特点和设计要求（选填）',detailEditPrompt:'描述当前切片要修改的地方',videoBrief:'描述内容方向与镜头要求',fcPrompt:'描述改哪里、改成什么',pdAIPrompt:'描述花卉、配色与排布风格',ssBrief:'描述房间、家具和光线',hdAIIntent:'描述需要重点修复的细节（选填）'}))compactPlaceholder(id,placeholder);
    if(one('#productGroupTitle [data-help-topic="product"]'))for(const node of all('#creationGroups .group-purpose'))node.classList.add('zh-help-source');
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
  new MutationObserver(records=>{if(records.some(record=>!panel.contains(record.target)))schedule();}).observe(document.body,{childList:true,subtree:true});
  scan();
})();
