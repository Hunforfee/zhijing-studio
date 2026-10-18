(() => {
  const section=document.createElement('section');section.id='history';section.className='image-history';
  section.innerHTML='<div class="history-toolbar"><div class="history-record-heading"><strong id="historyGroupTitle">生成记录</strong><small id="historyCount"></small></div></div>'+
    '<p id="historyMessage" class="history-status" role="status" aria-live="polite"></p><div id="historyGrid" class="history-record-list"></div><button type="button" id="moreHistory" class="outline-button" hidden>加载更多记录</button>'+
    '<div id="historyViewer" class="history-viewer" hidden><div id="historyDetailBar" class="history-detail-bar"><button type="button" id="historyBack" class="outline-button" hidden>← 返回记录</button><strong id="historyDetailTitle"></strong><button type="button" id="refreshHistory" class="outline-button">↻ 刷新</button><form id="historyLookupForm"><label for="historyLookup">编号</label><input id="historyLookup" type="number" min="1" step="1" required placeholder="输入编号"><button type="submit" class="outline-button">查看</button></form><button type="button" id="historyDetailCurrent" class="outline-button">当前生成</button></div><div class="history-preview"><div class="history-hero"><button id="historyZoom" type="button" class="history-large-image" aria-label="放大当前历史图片"><img id="historySelectedImage" alt="当前历史图片"></button><div id="historyHeroCompare" class="hero-compare" hidden><div class="hero-compare-toolbar"><button type="button" id="historyCompareRootBtn" class="outline-button" hidden>⇔ 对比原图</button><button type="button" id="historyComparePrevBtn" class="outline-button" hidden>⇔ 对比上一版</button><button type="button" id="historyHeroCompareExit" class="outline-button" hidden>✕ 退出对比</button></div><div class="hero-compare-panes"><figure><img id="historyCompareBeforeImg" alt="修改前图片"><figcaption id="historyCompareBeforeLabel"></figcaption></figure><figure><img id="historyCompareAfterImg" alt="当前图片"><figcaption id="historyCompareAfterLabel"></figcaption></figure></div></div></div><div class="history-preview-footer"><span id="historySelectedInfo"></span><a id="historyDownload" download>↓ 下载</a></div></div>'+
    '<div class="history-side"><div class="history-gallery-toolbar"><strong id="historyGalleryCount"></strong><button id="historyGroupDownload" type="button" class="outline-button">↓ 下载全部</button></div><div id="historyFilmstrip" class="history-filmstrip" role="group" aria-label="本组图片"></div>'+
    '<form id="historyEditForm" class="history-editor current-image-editor"><div class="history-editor-heading current-editor-heading"><h3>编辑当前图片</h3><input id="historyNumber" type="hidden"></div><label for="historyPrompt" class="sr-only">修改要求</label><textarea id="historyPrompt" required maxlength="2000" rows="5" placeholder="写下修改要求，可参考场景、颜色或细节。修改后另存新图，原图保留。"></textarea><div class="history-edit-actions"><button id="historyEditBtn" class="primary" type="submit">生成修改图</button><button type="button" id="historyCancel" class="outline-button" hidden>停止</button></div><p id="historyEditStatus" class="history-status" role="status" aria-live="polite"></p></form></div></div>';
  const workspace=$('results');workspace.classList.add('works-area');
  const currentView=document.createElement('div');currentView.id='currentWorksView';currentView.className='current-results-view';
  while(workspace.firstChild)currentView.append(workspace.firstChild);
  const worksHeader=document.createElement('header');worksHeader.className='works-header';
  worksHeader.innerHTML='<div class="works-heading"><div class="works-title-row"></div><div class="works-caption"></div></div><div class="works-actions"><div class="works-switch" role="group" aria-label="作品视图"><button type="button" id="currentWorksBtn" aria-pressed="true">当前生成</button><button type="button" id="historyRecordsBtn" aria-pressed="false">◷ 生成记录</button></div></div>';
  worksHeader.querySelector('.works-title-row').append(currentView.querySelector('#resultTitle'),currentView.querySelector('.result-meta'));
  worksHeader.querySelector('.works-caption').append(currentView.querySelector('#resultSubtitle'));
  worksHeader.querySelector('.works-actions').prepend(currentView.querySelector('#downloadAll'));
  const worksActions=worksHeader.querySelector('.works-actions');
  worksHeader.hidden=true;
  currentView.querySelector('.result-header').remove();
  const historyHeading=section.querySelector('.history-record-heading');historyHeading.classList.add('works-history-heading');worksHeader.prepend(historyHeading);
  section.hidden=true;workspace.append(worksHeader,currentView);
  const historyDialog=document.createElement('dialog');historyDialog.id='historyDialog';historyDialog.setAttribute('aria-labelledby','historyDialogTitle');
  historyDialog.innerHTML='<header class="history-dialog-header"><button type="button" id="historyDialogBack" class="outline-button" hidden>← 返回记录</button><h2 id="historyDialogTitle">生成记录</h2><button type="button" id="historyDialogClose" class="history-dialog-close" aria-label="关闭生成记录">×</button></header><div id="historyDialogBody"><div id="historyDetailHost" hidden></div></div>';
  document.body.append(historyDialog);const dialogBody=$('historyDialogBody'),detailHost=$('historyDetailHost');dialogBody.prepend(section);
  let pageScroll=0,pageOverflow='',opener=null,listScroll=0,detailOpen=false;
  function navigationLocked(){return editing||globalThis.detailPages?.historyBusy?.();}
  function leaveDetail(){if(detailOpen){globalThis.detailPages?.leaveHistory?.();detailOpen=false;detailHost.hidden=true;}}
  function closeHistory(){if(changing||navigationLocked())return toast('请等待编辑完成或先停止编辑');leaveDetail();historyDialog.close();document.body.style.overflow=pageOverflow;window.scrollTo({top:pageScroll,behavior:'instant'});opener?.focus?.({preventScroll:true});topLink.setAttribute('aria-pressed','false');}
  $('historyDialogClose').onclick=closeHistory;historyDialog.addEventListener('cancel',event=>{event.preventDefault();closeHistory();});
  historyDialog.addEventListener('click',event=>{if(event.target!==historyDialog)return;const r=historyDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeHistory();});
  function showGroupHeader(title){historyDialog.classList.add('is-viewing');$('historyDialogTitle').textContent=title;$('historyDialogBack').hidden=false;}
  function openDetailGroup(items){if(navigationLocked())return toast('请等待编辑完成');if(!globalThis.detailPages)return toast('详情页正在准备，请稍后重试');if(!globalThis.detailPages.canOpenHistory())return toast('请等待详情任务完成');if(!activeGroup)listScroll=dialogBody.scrollTop;const group=groups.find(g=>g.images.some(r=>r.number===items[0]?.number));activeGroup=group||null;selectedNumber=items[0]?.number;section.hidden=true;detailHost.hidden=false;detailOpen=true;showGroupHeader('商品详情页 · '+items.length+' 张');globalThis.detailPages.openGroup(items,detailHost);dialogBody.scrollTop=0;}

  const historyToolbar=section.querySelector('.history-toolbar'),historyDetailBar=$('historyDetailBar');
  historyToolbar.prepend(historyHeading);
  $('historyDetailCurrent').hidden=true;
  function placeControls(list){const target=list?historyToolbar:historyDetailBar;target.append($('refreshHistory'),$('historyLookupForm'));}
  function scrollToWorksTop(){dialogBody.scrollTop=0;}
  const currentEditor=document.createElement('form');currentEditor.id='currentEditForm';currentEditor.className='current-image-editor';currentEditor.hidden=true;
  currentEditor.innerHTML='<div class="current-editor-heading"><h3>编辑当前图片</h3><span id="currentEditNumber" hidden></span></div><label for="currentEditPrompt" class="sr-only">修改要求</label><textarea id="currentEditPrompt" required maxlength="2000" rows="3" placeholder="写下修改要求，可参考场景、颜色或细节。修改后另存新图，原图保留。"></textarea><div class="history-edit-actions"><button type="submit" id="currentEditBtn" class="primary">生成修改图</button><button type="button" id="currentEditCancel" class="outline-button" hidden>停止编辑</button></div><p id="currentEditStatus" class="history-status" role="status" aria-live="polite"></p>';
  currentView.querySelector('.gallery-browser').append(currentEditor);
  const heroCompare=document.createElement('div');heroCompare.id='heroCompare';heroCompare.className='hero-compare';heroCompare.hidden=true;
  heroCompare.innerHTML='<div class="hero-compare-toolbar"><button type="button" id="compareRootBtn" class="outline-button" hidden>⇔ 对比原图</button><button type="button" id="comparePrevBtn" class="outline-button" hidden>⇔ 对比上一版</button><button type="button" id="heroCompareExit" class="outline-button" hidden>✕ 退出对比</button></div><div class="hero-compare-panes"><figure><img id="heroCompareBeforeImg" alt="修改前图片"><figcaption id="heroCompareBeforeLabel"></figcaption></figure><figure><img id="heroCompareAfterImg" alt="当前图片"><figcaption id="heroCompareAfterLabel"></figcaption></figure></div>';
  currentView.querySelector('.hero-frame').append(heroCompare);let heroCompareActive=false;
  function exitHeroCompare(){heroCompareActive=false;heroCompare.classList.remove('is-active');$('heroCompareExit').hidden=true;}
  function showHeroCompare(before,label){const t=compareTargets;if(!before||!t.current)return;$('heroCompareBeforeImg').src=before.url;$('heroCompareBeforeLabel').textContent=label;$('heroCompareAfterImg').src=t.current.url;$('heroCompareAfterLabel').textContent='#'+t.current.number+' 当前';heroCompareActive=true;heroCompare.classList.add('is-active');$('heroCompareExit').hidden=false;}
  $('compareRootBtn').onclick=()=>showHeroCompare(compareTargets.root,compareTargets.root?'#'+compareTargets.root.number+' 修改前原图':'');
  $('comparePrevBtn').onclick=()=>showHeroCompare(compareTargets.prev,compareTargets.prev?'#'+compareTargets.prev.number+' 上一版':'');
  $('heroCompareExit').onclick=exitHeroCompare;
  const compareTargets={root:null,prev:null,current:null};
  const historyCompareTargets={root:null,prev:null,current:null};
  const historyHeroCompare=$('historyHeroCompare');let historyHeroCompareActive=false;
  function exitHistoryHeroCompare(){historyHeroCompareActive=false;historyHeroCompare.classList.remove('is-active');$('historyHeroCompareExit').hidden=true;}
  function showHistoryHeroCompare(before,label){const t=historyCompareTargets;if(!before||!t.current)return;$('historyCompareBeforeImg').src=before.url;$('historyCompareBeforeLabel').textContent=label;$('historyCompareAfterImg').src=t.current.url;$('historyCompareAfterLabel').textContent='#'+t.current.number+' 当前';historyHeroCompareActive=true;historyHeroCompare.classList.add('is-active');$('historyHeroCompareExit').hidden=false;}
  $('historyCompareRootBtn').onclick=()=>{const t=historyCompareTargets;if(t.root&&t.current)showHistoryHeroCompare(t.root,'#'+t.root.number+' 修改前原图');};
  $('historyComparePrevBtn').onclick=()=>{const t=historyCompareTargets;if(t.prev&&t.current)showHistoryHeroCompare(t.prev,'#'+t.prev.number+' 上一版');};
  $('historyHeroCompareExit').onclick=exitHistoryHeroCompare;
  const galleryHeader=currentView.querySelector('.gallery-browser-title'),gallerySummary=document.createElement('div');gallerySummary.className='gallery-title-summary';
  // The work views are now attached: document lookups can safely find their nodes.
  const elapsed=$('jobElapsed'),stop=$('cancelBtn'),banner=$('jobBanner'),count=$('galleryCount'),title=galleryHeader.querySelector('strong');
  elapsed.hidden=true;
  elapsed.setAttribute('aria-live','off');
  title?.remove();
  gallerySummary.append(stop,count);galleryHeader.append(gallerySummary,worksActions);$('jobMessage').after(elapsed);galleryHeader.after(banner);
  const link=document.createElement('a');link.className='nav';link.href='#results';link.textContent='◷ 生成记录';document.querySelector('.sidebar nav').append(link);
  const topLink=$('historyRecordsBtn');
  let historyKind="image",images=[],trash=[],groups=[],visible=5,editing=false,changing=false,trashMode=false,jobId=null,activeGroup=null,selectedNumber=null,groupImages,shared=!!state.service?.shared,currentEditNumber=null;
  const kindSwitch=document.createElement('div');kindSwitch.className='works-switch history-kind-switch';kindSwitch.setAttribute('role','group');kindSwitch.setAttribute('aria-label','生成记录类型');kindSwitch.innerHTML='<button type="button" data-history-kind="image" aria-pressed="true">图片</button><button type="button" data-history-kind="detail" aria-pressed="false">详情页</button>';historyToolbar.prepend(kindSwitch);
  const modeSwitch=document.createElement('div');modeSwitch.className='works-switch history-mode-switch';modeSwitch.setAttribute('role','group');modeSwitch.setAttribute('aria-label','记录与回收站');modeSwitch.innerHTML='<button type="button" data-history-mode="records">生成记录</button><button type="button" data-history-mode="trash">回收站</button>';historyToolbar.append(modeSwitch);
  async function switchHistory(kind,deleted){if(navigationLocked())return toast('请等待编辑完成');leaveDetail();historyKind=kind;trashMode=deleted;activeGroup=null;selectedNumber=null;visible=5;listScroll=0;dialogBody.scrollTop=0;await refresh();}
  kindSwitch.querySelectorAll('button').forEach(b=>b.onclick=()=>switchHistory(b.dataset.historyKind,trashMode));modeSwitch.querySelectorAll('button').forEach(b=>b.onclick=()=>switchHistory(historyKind,b.dataset.historyMode==='trash'));
  window.openGenerationHistory=async(kind='image',deleted=false)=>{historyKind=kind;trashMode=deleted;visible=5;await showHistory();};
  let batchRunning=false,batchStop=false;
  const batchViews={current:{enabled:false,selected:new Set()},history:{enabled:false,selected:new Set()}};
  function batchPool(view){return globalThis.splitPhotoVersions(view==='current'?state.results:activeGroup?.images||[]).current.filter(item=>!item.reference&&Number.isSafeInteger(item.number));}
  function installBatchEditor(view,form){
    const heading=form.querySelector(view==='current'?'.current-editor-heading':'.history-editor-heading');
    const toggle=document.createElement('button');toggle.type='button';toggle.className='batch-edit-toggle';toggle.id=view+'BatchToggle';toggle.textContent='批量编辑';toggle.setAttribute('aria-expanded','false');heading.append(toggle);
    const panel=document.createElement('div');panel.className='batch-edit-panel';panel.id=view+'BatchPanel';panel.hidden=true;
    panel.innerHTML='<div class="batch-edit-tools"><button type="button" data-pick="original">选最新作品</button><button type="button" data-pick="all">全选</button><button type="button" data-pick="clear">清空</button><span class="batch-edit-count"></span></div>';
    heading.after(panel);
    toggle.onclick=()=>{if(editing||state.busy)return;batchViews[view].enabled=!batchViews[view].enabled;renderBatchEditor(view);};
    panel.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{if(editing||state.busy)return;const mode=button.dataset.pick;batchViews[view].selected=new Set(mode==='clear'?[]:batchPool(view).filter(item=>mode==='all'||mode==='original').map(item=>item.number));renderBatchEditor(view);});
  }
  function batchThumbnailList(view){return $(view==='current'?'thumbnails':'historyFilmstrip');}
  function renderBatchEditor(view){
    const mode=batchViews[view],panel=$(view+'BatchPanel'),toggle=$(view+'BatchToggle');if(!panel)return;
    const form=$(view==='current'?'currentEditForm':'historyEditForm');form.querySelector('h3').textContent=mode.enabled?'批量编辑本组图片':view==='current'?'编辑当前图片':'编辑当前图片';
    toggle.disabled=state.busy||state.generating;toggle.textContent=mode.enabled?'单张编辑':'批量编辑';toggle.setAttribute('aria-expanded',String(mode.enabled));panel.hidden=!mode.enabled;
    $(view==='current'?'currentEditBtn':'historyEditBtn').textContent=mode.enabled?'批量生成修改图':'生成修改图';
    const pool=batchPool(view),valid=new Set(pool.map(item=>item.number));mode.selected=new Set([...mode.selected].filter(number=>valid.has(number)));
    panel.querySelector('.batch-edit-count').textContent='已选 '+mode.selected.size+' 张';panel.querySelectorAll('[data-pick]').forEach(button=>button.disabled=state.busy);
    const list=batchThumbnailList(view);list.classList.toggle('batch-picking',mode.enabled);
    list.querySelectorAll(view==='current'?'.thumbnail':'.history-frame').forEach(button=>{
      const number=view==='current'?state.results[Number(button.dataset.resultIndex)]?.number:Number(button.dataset.imageNumber),selectable=mode.enabled&&valid.has(number);
      button.classList.toggle('batch-selected',selectable&&mode.selected.has(number));button.disabled=mode.enabled&&!valid.has(number)||editing;
      let check=button.querySelector('.batch-thumb-check');if(selectable&&!check){check=document.createElement('span');check.className='batch-thumb-check';check.setAttribute('aria-hidden','true');(button.querySelector('.thumb-picture')||button).append(check);}
      if(check){check.hidden=!selectable;check.textContent=mode.selected.has(number)?'✓':'';}
      if(selectable){if(!button.dataset.batchOriginalLabel)button.dataset.batchOriginalLabel=button.getAttribute('aria-label')||'';button.setAttribute('role','checkbox');button.setAttribute('aria-checked',String(mode.selected.has(number)));button.setAttribute('aria-label','批量编辑图片 #'+number);}
      else{button.removeAttribute('role');button.removeAttribute('aria-checked');if(button.dataset.batchOriginalLabel)button.setAttribute('aria-label',button.dataset.batchOriginalLabel);}
    });
  }
  function installBatchThumbnailPicking(view){batchThumbnailList(view).addEventListener('click',event=>{
    if(event.target.closest('.add-to-detail')||!batchViews[view].enabled)return;const button=event.target.closest(view==='current'?'.thumbnail':'.history-frame');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();if(editing||state.busy)return;
    const number=view==='current'?state.results[Number(button.dataset.resultIndex)]?.number:Number(button.dataset.imageNumber);if(!batchPool(view).some(item=>item.number===number))return;
    const chosen=batchViews[view].selected;if(chosen.has(number))chosen.delete(number);else chosen.add(number);renderBatchEditor(view);
  },true);}
  installBatchEditor('current',currentEditor);installBatchEditor('history',$('historyEditForm'));installBatchThumbnailPicking('current');installBatchThumbnailPicking('history');
  const editTimers={},editProgress={};
  function renderEditProgress(view){
    const p=editProgress[view],label=$(view==='current'?'currentEditForm':'historyEditForm').querySelector('.edit-elapsed');if(!p||!label)return;
    const seconds=Math.floor(((p.finished||Date.now())-p.start)/1000);
    label.querySelector('.edit-progress-count').textContent=p.completed+'/'+p.total;
    label.querySelector('.edit-progress-state').textContent=p.phase;
    label.querySelector('.edit-progress-time').textContent='用时 '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    label.style.setProperty('--edit-progress',Math.min(100,p.completed/p.total*100)+'%');
    label.classList.toggle('is-running',!p.finished);label.classList.toggle('is-complete',p.completed===p.total);
    const bar=label.querySelector('.edit-progress-track');bar.setAttribute('aria-valuenow',p.completed);bar.setAttribute('aria-valuemax',p.total);
  }
  function setEditProgress(view,completed,total){Object.assign(editProgress[view],{completed,total});renderEditProgress(view);}
  function startEditClock(view,total=1){
    editProgress[view]={completed:0,total,start:Date.now(),phase:'编辑中'};
    const heading=$(view==='current'?'currentEditForm':'historyEditForm').querySelector('h3').parentElement;
    let label=heading.querySelector('.edit-elapsed');if(!label){label=document.createElement('div');label.className='edit-elapsed';label.innerHTML='<div class="edit-progress-line"><span class="edit-progress-dot"></span><span class="edit-progress-state"></span><strong class="edit-progress-count"></strong><span class="edit-progress-time"></span></div><div class="edit-progress-track" role="progressbar" aria-label="已完成编辑图片数" aria-valuemin="0"><i></i></div>';heading.append(label);}
    clearInterval(editTimers[view]);renderEditProgress(view);editTimers[view]=setInterval(()=>renderEditProgress(view),1000);
  }
  function stopEditClock(view){clearInterval(editTimers[view]);const p=editProgress[view];if(p){p.finished=Date.now();p.phase=p.completed===p.total?'已完成':batchStop?'已停止':'已结束';renderEditProgress(view);}}
  function stopBatchPicking(view){
    if(!batchRunning)return;
    batchStop=true;
    batchViews[view].enabled=false;
    batchViews[view].selected.clear();
    for(const target of ['current','history']){batchViews[target].enabled=false;batchViews[target].selected.clear();renderBatchEditor(target);}
    document.querySelectorAll('.thumbnail,.history-frame').forEach(button=>button.disabled=false);
    $('previousImage').disabled=state.selected===0;$('nextImage').disabled=state.selected===state.results.length-1;
  }
  async function editBatch(view,prompt){
    if(editing||(state.busy&&!state.generating))return toast('请等待当前编辑完成');
    const numbers=[...batchViews[view].selected],pool=new Set(batchPool(view).map(item=>item.number));
    if(!numbers.length||numbers.some(number=>!pool.has(number)))return toast('请勾选本组需要修改的图片');
    if(!prompt||prompt.length>2000)return toast('请填写修改要求');
    if(editReferences[view].loading)return toast('参考图正在读取，请稍候');
    const status=$(view==='current'?'currentEditStatus':'historyEditStatus'),cancel=$(view==='current'?'currentEditCancel':'historyCancel');
    batchRunning=true;batchStop=false;startEditClock(view,numbers.length);lock(true);cancel.hidden=false;cancel.textContent='停止批量编辑';
    try{const {runBatchImageEdit}=await import('/batch-image-edit.js');const result=await runBatchImageEdit(numbers,number=>editImage(number,prompt,view,true),(done,total,number)=>{setEditProgress(view,done,total);status.textContent='';},()=>batchStop);
      setEditProgress(view,result.completed,result.total);const detail=status.textContent;status.textContent='已完成 '+result.completed+' / '+result.total+' 张'+(result.stopped?'，已停止后续编辑。':result.failedNumber?'，#'+result.failedNumber+' 编辑未完成：'+detail:'，原图保留。');
      if(result.completed)editReferences[view].clear();
    }catch(error){status.textContent=error.message;}
    finally{stopEditClock(view);for(const target of ['current','history']){batchViews[target].enabled=false;batchViews[target].selected.clear();}batchRunning=false;lock(false);jobId=null;cancel.hidden=true;cancel.disabled=false;cancel.textContent=view==='current'?'停止编辑':'停止';renderBatchEditor(view);}
  }

  function editReference(form,prefix,promptId){
    let data=null,loading=false,version=0;
    const box=document.createElement('div');box.className='edit-reference';
    box.innerHTML='<input type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="edit-reference-row"><button type="button" class="outline-button">＋ 上传参考图（选填）</button><button type="button" class="outline-button edit-reference-remove" hidden>移除</button></div><div class="edit-reference-preview" hidden><img alt="二次编辑参考图"><span></span></div>';
    form.insertBefore(box,$(promptId).previousElementSibling);
    const input=box.querySelector('input'),upload=box.querySelector('button'),remove=box.querySelector('.edit-reference-remove'),preview=box.querySelector('.edit-reference-preview'),img=preview.querySelector('img'),name=preview.querySelector('span');
    input.id=prefix+'EditReferenceFile';upload.setAttribute('aria-label',prefix==='current'?'上传当前编辑参考图':'上传历史编辑参考图');
    function clear(){version++;data=null;loading=false;input.value='';img.removeAttribute('src');preview.hidden=true;remove.hidden=true;upload.textContent='＋ 上传参考图（选填）';}
    upload.onclick=()=>{if(state.busy)return toast('请等待当前任务完成');input.click();};remove.onclick=clear;
    input.onchange=async()=>{
      const file=input.files[0];if(!file)return;if(state.busy){input.value='';return;}
      const attempt=++version;loading=true;
      try{
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的 PNG、JPG 或 WebP 图片');
        const bitmap=await createImageBitmap(file);const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const result=canvas.toDataURL('image/png');
        if(result.length>14*1024*1024)throw Error('参考图过大，请使用尺寸较小的图片');
        if(attempt!==version)return;data=result;img.src=result;name.textContent=file.name;preview.hidden=false;remove.hidden=false;upload.textContent='更换参考图';
      }catch(error){if(attempt===version){input.value='';toast(error.message||'无法读取参考图，请换一张图片');}}
      finally{if(attempt===version)loading=false;}
    };
    return {clear,get data(){return data;},get loading(){return loading;},lock(value){input.disabled=value;upload.disabled=value;remove.disabled=value;}};
  }
  const editReferences={current:editReference(currentEditor,'current','currentEditPrompt'),history:editReference($('historyEditForm'),'history','historyPrompt')};
  const trashButton=document.createElement('button');trashButton.type='button';trashButton.id='historyTrashBtn';trashButton.className='outline-button';trashButton.textContent='回收站';worksActions.append(trashButton);
  const emptyTrashRow=document.createElement('div');emptyTrashRow.id='emptyTrashRow';emptyTrashRow.hidden=true;historyToolbar.append(emptyTrashRow);
  const emptyTrashButton=document.createElement('button');emptyTrashButton.type='button';emptyTrashButton.id='historyEmptyTrashBtn';emptyTrashButton.className='outline-button history-delete';emptyTrashButton.textContent='清空回收站';emptyTrashButton.hidden=true;emptyTrashRow.append(emptyTrashButton);
  const deleteSelected=document.createElement('button');deleteSelected.type='button';deleteSelected.className='photo-button current-image-delete history-image-delete';deleteSelected.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg><span>删除</span>';deleteSelected.setAttribute('aria-label','删除当前历史图片');deleteSelected.title='删除当前图片（移入回收站）';$('historyZoom').closest('.history-hero').append(deleteSelected);deleteSelected.onclick=()=>changeArchive({number:selectedNumber},false);
  const heroDownload=$('historyDownload');heroDownload.className='history-image-download';heroDownload.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></svg><span>下载</span>';heroDownload.setAttribute('aria-label','下载当前历史图片');heroDownload.title='下载当前图片';$('historyZoom').closest('.history-hero').append(heroDownload);
  const deleteCurrent=document.createElement('button');deleteCurrent.type='button';deleteCurrent.className='photo-button current-image-delete';deleteCurrent.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>删除</span>';deleteCurrent.setAttribute('aria-label','删除当前图片');deleteCurrent.title='删除当前图片（移入回收站）';deleteCurrent.hidden=true;
  const currentDownload=$('downloadOne');const currentHero=currentDownload.closest('.hero-frame');currentDownload.classList.add('current-image-download');currentDownload.innerHTML=heroDownload.innerHTML;currentDownload.title='下载当前图片';currentHero.append(currentDownload,deleteCurrent);deleteCurrent.onclick=()=>changeArchive({number:state.results[state.selected]?.number},false);
  const currentCompareToolbar=heroCompare.querySelector('.hero-compare-toolbar');
  function positionCurrentHeroActions(){
    const frameWidth=currentHero.getBoundingClientRect().width;
    const toolbar=currentCompareToolbar.getBoundingClientRect();
    const inset=window.matchMedia('(max-width:650px)').matches?12:16;
    const compareWidth=heroCompare.hidden||heroCompareActive?0:toolbar.width;
    const actionWidth=currentDownload.getBoundingClientRect().width+(deleteCurrent.hidden?0:deleteCurrent.getBoundingClientRect().width+8);
    const wrap=compareWidth>0&&compareWidth+8+actionWidth>frameWidth-inset*2;
    currentHero.style.setProperty('--hero-action-offset',(compareWidth&&!wrap?compareWidth+8:0)+'px');
    currentHero.style.setProperty('--hero-action-drop',(wrap?toolbar.height+8:0)+'px');
  }
  if(typeof ResizeObserver==='function'){
    const heroToolbarObserver=new ResizeObserver(positionCurrentHeroActions);
    heroToolbarObserver.observe(currentHero);heroToolbarObserver.observe(currentCompareToolbar);
  }
  async function changeArchive(target,restore){
    if(editing||changing||state.busy)return toast('请等待当前任务完成');
    changing=true;
    try{
      const response=await fetch('/api/history/'+(restore?'restore':'delete'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(target)}),data=await response.json();
      if(!response.ok)throw Error(data.error||'操作失败');
      if(!restore){const removed=new Set(data.images.map(image=>image.number)),selected=state.results[state.selected];state.results=state.results.filter(image=>!removed.has(image.number));if(!state.results.length)state.results=referenceEntries();state.selected=Math.max(0,state.results.indexOf(selected));renderResults();}
      await refresh();window.dispatchEvent(new Event('archive-updated'));toast(restore?'图片已还原':'已移入回收站，可随时还原');
    }catch(error){toast(error.message);}finally{changing=false;}
  }
  trashButton.onclick=async()=>{if(editing||state.busy)return toast('请等待当前任务完成');historyKind='image';trashMode=true;await showHistory();};
  emptyTrashButton.onclick=()=>{
    if(editing||changing||state.busy)return toast('请等待当前任务完成');
    if(!trash.length)return toast('回收站已经是空的');
    modal('<h2>清空回收站？</h2><p>将永久删除回收站里的 '+trash.length+' 张图片及对应文件，此操作无法恢复；未删除的生成记录不受影响。</p><div class="empty-trash-actions"><button type="button" class="outline-button" id="emptyTrashCancel">取消</button><button type="button" class="outline-button history-delete" id="emptyTrashConfirm">确认清空</button></div>');
    $('emptyTrashCancel').onclick=()=>$('modal').close();
    $('emptyTrashConfirm').onclick=async()=>{
      if(editing||changing||state.busy)return toast('请等待当前任务完成');
      changing=true;$('emptyTrashConfirm').disabled=true;
      try{
        const response=await fetch('/api/history/empty-trash',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();
        if(!response.ok)throw Error(data.error||'清空失败');
        $('modal').close();toast('回收站已清空，共删除 '+(data.purged||0)+' 张');
        trash=data.trash||[];trashMode=false;await refresh();window.dispatchEvent(new Event('archive-updated'));
      }catch(error){toast(error.message);$('emptyTrashConfirm').disabled=false;}
      finally{changing=false;}
    };
  };
  function syncCurrentEditor(){
    Object.values(editReferences).forEach(reference=>reference.lock(state.busy));
    const source=state.results[state.selected],available=!shared&&!source?.reference&&Number.isSafeInteger(source?.number);
    currentEditor.hidden=!available;trashButton.hidden=shared;deleteCurrent.hidden=!available;deleteCurrent.disabled=state.busy;if(!available){heroCompare.hidden=true;heroCompareActive=false;heroCompare.classList.remove('is-active');}
    if(!available){positionCurrentHeroActions();return;}
    if(currentEditNumber!==source.number){currentEditNumber=source.number;if(!editing&&!batchViews.current.enabled){$('currentEditPrompt').value='';$('currentEditStatus').textContent='';editReferences.current.clear();}exitHeroCompare();}
    $('currentEditNumber').textContent='';
    compareTargets.current=source;
    const byNumber=new Map();
    for(const item of [...images,...state.results])if(Number.isSafeInteger(item?.number)&&!byNumber.has(item.number))byNumber.set(item.number,item);
    compareTargets.prev=byNumber.get(source.parentNumber)||null;
    const seen=new Set();let chain=source;
    while(Number.isSafeInteger(chain.parentNumber)&&byNumber.has(chain.parentNumber)&&!seen.has(chain.number)){seen.add(chain.number);chain=byNumber.get(chain.parentNumber);}
    compareTargets.root=chain!==source&&chain!==compareTargets.prev?chain:null;
    $('compareRootBtn').hidden=!compareTargets.root;
    $('comparePrevBtn').hidden=!compareTargets.prev;
    // 只改过一次时上一版就是原图，按钮直接叫「对比原图」；多轮修改才区分「原图 / 上一版」。
    const prevIsOriginal=compareTargets.prev&&!(Number.isSafeInteger(compareTargets.prev.parentNumber)&&byNumber.get(compareTargets.prev.parentNumber));
    $('comparePrevBtn').textContent=prevIsOriginal?'⇔ 对比原图':'⇔ 对比上一版';
    heroCompare.hidden=!compareTargets.root&&!compareTargets.prev&&!heroCompareActive;
    positionCurrentHeroActions();
    $('currentEditBtn').disabled=editing;$('currentEditPrompt').disabled=editing;$('historyEditBtn').disabled=editing;
    currentEditor.setAttribute('aria-busy',String(editing));renderBatchEditor('current');renderBatchEditor('history');
    const previewLocked=editing&&!(batchRunning&&batchStop);
    document.querySelectorAll('.thumbnail,.history-frame').forEach(button=>button.disabled=previewLocked);
    $('previousImage').disabled=previewLocked||state.selected===0;$('nextImage').disabled=previewLocked||state.selected===state.results.length-1;
  }
  window.syncCurrentImageEditor=syncCurrentEditor;
  function showCurrent(){currentView.hidden=false;$('currentWorksBtn').setAttribute('aria-pressed','true');}
  async function showHistory(){if(navigationLocked())return toast('请等待编辑完成');leaveDetail();activeGroup=null;selectedNumber=null;listScroll=0;section.hidden=false;
    if(!historyDialog.open){pageScroll=window.scrollY;pageOverflow=document.body.style.overflow;opener=document.activeElement;historyDialog.showModal();document.body.style.overflow='hidden';}
    topLink.setAttribute('aria-pressed','true');await refresh();dialogBody.scrollTop=0;}
  $('currentWorksBtn').onclick=showCurrent;topLink.onclick=()=>{historyKind='image';trashMode=false;showHistory();};$('historyDetailCurrent').onclick=closeHistory;link.onclick=event=>{event.preventDefault();historyKind='image';trashMode=false;showHistory();};
  window.showCurrentGeneration=showCurrent;
  function groupTitle(group){const cover=group.original;if(cover.detailPage)return '商品详情页';const product=products.find(p=>p.id===cover.product)?.name;return cover.kind==='edited'?'图片编辑':cover.kind==='preview'?(product||'产品')+' · 结构示意':product?product+' · 生成作品':'生成作品';}
  function dateLabel(value){return new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replaceAll('/','.');}
  function render(){
    kindSwitch.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.historyKind===historyKind)));$('historyCount').textContent=groups.length+' 组 · '+(trashMode?trash:images).filter(x=>!!x.detailPage===(historyKind==='detail')).length+' 张';trashButton.textContent='回收站'+(trash.length?' · '+trash.length:'');modeSwitch.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.historyMode==='trash')===trashMode)));$('historyLookupForm').hidden=trashMode;emptyTrashButton.hidden=!trashMode||!trash.length||!!activeGroup||shared;emptyTrashRow.hidden=emptyTrashButton.hidden;emptyTrashButton.disabled=editing;$('historyGrid').replaceChildren();
    for(const group of groups.slice(0,visible)){
      const article=document.createElement('article');article.className='history-record';
      const header=document.createElement('div');header.className='history-record-top';const time=document.createElement('time');time.dateTime=group.createdAt;time.textContent=dateLabel(group.createdAt);
      const latest=group.images.reduce((a,b)=>b.number>a.number?b:a);
      const open=document.createElement('button');open.type='button';open.className='record-open';open.textContent='打开本组 · '+group.images.length+' 张 ↗';open.setAttribute('aria-label','打开生成批次，'+group.images.length+' 张，默认查看图片 #'+latest.number);open.onclick=()=>{if(editing)return toast('请等待编辑完成');if(group.original.detailPage){openDetailGroup(group.images);return;}select(latest.number);};header.append(time,open);
      open.hidden=trashMode;
      const groupAction=document.createElement('button');groupAction.type='button';groupAction.className='outline-button history-group-action';groupAction.textContent=trashMode?'还原本组':'删除本组';groupAction.setAttribute('aria-label',groupAction.textContent+'，图片 #'+group.cover.number+' 所在组');groupAction.onclick=()=>changeArchive({groupId:group.id},trashMode);header.append(groupAction);
      if(!trashMode){for(const [label,action] of [['下载本组',()=>globalThis.detailPages?.downloadGroup(group.images)],...(group.original.detailPage?[]:[['整组加入详情',()=>globalThis.detailPages?.addGroup(globalThis.splitPhotoVersions(group.images).current)]])]){const b=document.createElement('button');b.type='button';b.className='outline-button';b.textContent=label;b.onclick=action;header.append(b);}}

      const metadata=document.createElement('div');metadata.className='history-record-meta';const name=document.createElement('strong');name.textContent=groupTitle(group);metadata.append(name);
      const cover=group.original;const versions=globalThis.splitPhotoVersions(group.images),latestNumbers=new Set(versions.current.map(x=>x.number));const tags=[versions.replaced.length?'最新作品 '+versions.current.length+' 张 · 历史版本 '+versions.replaced.length+' 张':null,cover.model,cover.ratio,cover.fabric&&fabrics[cover.fabric]?.[0],cover.referenceGuided?'参考图生成':null].filter(Boolean);for(const text of tags){const tag=document.createElement('span');tag.textContent=text;metadata.append(tag);}
      const photos=document.createElement('div');photos.className='history-record-photos';
      for(const item of group.images.slice(0,4)){
        const frame=document.createElement('div');frame.className='history-record-photo';const button=document.createElement('button');button.type='button';button.className='record-picture';button.dataset.deleted=String(trashMode);button.setAttribute('aria-label','查看记录图片 #'+item.number);const img=document.createElement('img');img.src=item.url;img.alt='生成图片 #'+item.number;img.loading='lazy';button.append(img);button.onclick=()=>{if(editing)return toast('请等待编辑完成');select(item.number);};
        const label=document.createElement('span');label.className='record-image-number';label.textContent=(latestNumbers.has(item.number)?'最新作品 ':'历史版本 ')+'#'+item.number;const download=document.createElement('a');download.className='record-download';download.href=item.url;download.download='织景_图片'+item.number+'.'+item.url.split('.').at(-1);download.setAttribute('aria-label','下载图片 #'+item.number);download.textContent='↓';frame.append(button,label,download);photos.append(frame);
      }
      for(const [index,frame] of [...photos.children].entries()){
        const item=group.images[index],action=document.createElement('button');action.type='button';action.className='record-trash-action';action.textContent=trashMode?'还原':'删除';action.setAttribute('aria-label',(trashMode?'还原':'删除')+'图片 #'+item.number);action.onclick=()=>changeArchive({number:item.number},trashMode);frame.append(action);
        if(trashMode)frame.querySelector('.record-picture').onclick=()=>{modal('<h2>回收站图片 #'+item.number+'</h2><img class="large-preview" alt="回收站图片">');$('modalContent').querySelector('img').src=item.url;};
      }
      if(group.images.length>4){const more=document.createElement('button');more.type='button';more.className='record-more';more.textContent='+'+(group.images.length-4)+' 张';more.onclick=()=>{if(trashMode){visible=groups.length;group.images.slice(4).forEach(item=>{const frame=document.createElement('div');frame.className='history-record-photo';const img=document.createElement('img');img.src=item.url;img.alt='回收站图片 #'+item.number;img.style.cssText='width:100%;height:100%;object-fit:cover';const restore=document.createElement('button');restore.type='button';restore.className='record-trash-action';restore.textContent='还原 #'+item.number;restore.onclick=()=>changeArchive({number:item.number},true);frame.append(img,restore);photos.insertBefore(frame,more);});more.remove();}else select(group.images[4].number);};photos.append(more);}
      article.append(header,metadata,photos);$('historyGrid').append(article);
    }
    $('moreHistory').hidden=!!activeGroup||visible>=groups.length;
  }
  function showGroups(){
    if(navigationLocked())return toast('请等待编辑完成');leaveDetail();section.hidden=true;activeGroup=null;exitHistoryHeroCompare();historyDialog.classList.remove('is-viewing');$('historyDialogBack').hidden=true;$('historyDialogTitle').textContent=trashMode?'回收站':'生成记录';placeControls(true);section.hidden=false;$('historyGrid').hidden=false;$('historyViewer').hidden=true;$('historyBack').hidden=true;$('historyGroupTitle').textContent=trashMode?'回收站':'生成记录';$('moreHistory').hidden=visible>=groups.length;$('historyMessage').textContent=trashMode?(trash.length?'删除的图片保留在这里，还原后返回原生成组。':'回收站为空。'):(images.length?'':'完成生成后，图片会自动收纳在这里。');dialogBody.scrollTop=listScroll;
  }
  function select(number){
    const image=images.find(r=>r.number===number);
    if(image&&historyKind!==(image.detailPage?'detail':'image')){historyKind=image.detailPage?'detail':'image';groups=groupImages([...images,...trash]).map(group=>({...group,images:group.images.filter(item=>!item.deletedAt&&!!item.detailPage===(historyKind==='detail'))})).filter(group=>group.images.length).map(group=>({...group,cover:group.images[0]}));render();}
    if(image?.detailPage){const pool=[...images].filter(x=>x.detailPage&&(x.detailGroupId||x.batchId||x.jobId)===(image.detailGroupId||image.batchId||image.jobId));openDetailGroup(pool);return true;}if(!image){$('historyMessage').textContent='找不到图片 #'+number+'，请检查编号或刷新历史。';return false;}
    const opening=$('historyViewer').hidden;if(opening&&!activeGroup)listScroll=dialogBody.scrollTop;leaveDetail();section.hidden=false;
    const changed=selectedNumber!==number;selectedNumber=number;activeGroup=groups.find(g=>g.images.some(r=>r.number===number));
    $('historyGrid').hidden=true;$('moreHistory').hidden=true;$('historyViewer').hidden=false;$('historyBack').hidden=false;
    showGroupHeader(groupTitle(activeGroup)+' · '+activeGroup.images.length+' 张');placeControls(false);
    $('historyGalleryCount').textContent=activeGroup.images.length+' 张';
    const detailTitle=groupTitle(activeGroup)+' · '+activeGroup.images.length+' 张';$('historyGroupTitle').textContent=detailTitle;$('historyDetailTitle').textContent=detailTitle;$('historyMessage').textContent='';
    $('historyNumber').value=String(number);$('historyLookup').value=String(number);$('historySelectedImage').onload=()=>{$('historyZoom').style.aspectRatio=$('historySelectedImage').naturalWidth+'/'+$('historySelectedImage').naturalHeight;};$('historySelectedImage').src=image.url;$('historySelectedImage').alt='历史图片 #'+number;
    $('historySelectedInfo').textContent='#'+number+(image.parentNumber?' · 修改自 #'+image.parentNumber:'');$('historyDownload').href=image.url;$('historyDownload').download='织景_图片'+number+'.'+image.url.split('.').at(-1);
    historyCompareTargets.current=image;
    const pool=new Map();for(const item of images)if(Number.isSafeInteger(item.number)&&!pool.has(item.number))pool.set(item.number,item);
    historyCompareTargets.prev=pool.get(image.parentNumber)||null;
    const chainSeen=new Set();let chainImage=image;
    while(Number.isSafeInteger(chainImage.parentNumber)&&pool.has(chainImage.parentNumber)&&!chainSeen.has(chainImage.number)){chainSeen.add(chainImage.number);chainImage=pool.get(chainImage.parentNumber);}
    historyCompareTargets.root=chainImage!==image&&chainImage!==historyCompareTargets.prev?chainImage:null;
    const historyPrevIsOriginal=historyCompareTargets.prev&&!(Number.isSafeInteger(historyCompareTargets.prev.parentNumber)&&pool.get(historyCompareTargets.prev.parentNumber));
    $('historyCompareRootBtn').hidden=!historyCompareTargets.root;
    $('historyComparePrevBtn').hidden=!historyCompareTargets.prev;
    $('historyComparePrevBtn').textContent=historyPrevIsOriginal?'⇔ 对比原图':'⇔ 对比上一版';
    historyHeroCompare.hidden=!historyCompareTargets.root&&!historyCompareTargets.prev&&!historyHeroCompareActive;
    if(changed&&!editing){$('historyPrompt').value='';$('historyEditStatus').textContent='';editReferences.history.clear();exitHistoryHeroCompare();}
    $('historyFilmstrip').replaceChildren();
    const versions=globalThis.splitPhotoVersions(activeGroup.images);for(const edited of [false,true]){const entries=edited?versions.replaced:versions.current;if(!entries.length)continue;const heading=document.createElement('div');heading.className='image-subgroup-heading';heading.textContent=(edited?'历史版本':'最新作品')+' · '+entries.length+' 张';$('historyFilmstrip').append(heading);for(const item of entries){const button=document.createElement('button');button.type='button';button.className='history-frame';button.dataset.imageNumber=String(item.number);button.disabled=editing&&!(batchRunning&&batchStop);button.setAttribute('aria-label','查看图片 #'+item.number);button.setAttribute('aria-pressed',String(item.number===number));const img=document.createElement('img');img.src=item.url;img.alt='';img.loading='lazy';button.append(img);button.onclick=()=>select(item.number);$('historyFilmstrip').append(button);}}$('historyFilmstrip').classList.toggle('many-images',activeGroup.images.length>20);renderBatchEditor('history');
    if(opening)scrollToWorksTop();
    return true;
  }
  async function refresh(){
    if(historyDialog.open&&!activeGroup)listScroll=dialogBody.scrollTop;
    try{
      const statusResponse=await fetch('/api/status');if(!statusResponse.ok)throw Error('本地服务未响应');const service=await statusResponse.json();shared=!!service.shared;syncCurrentEditor();if(shared){section.hidden=true;link.hidden=true;topLink.hidden=true;showCurrent();return;}
      if(!groupImages)groupImages=(await import('/history-groups.js?v=20261011-latest-versions1')).groupHistoryImages;
      const response=await fetch('/api/history');const data=await response.json();if(!response.ok)throw Error(data.error||'历史读取失败');images=data.images;trash=data.trash||[];groups=groupImages([...images,...trash]).map(group=>({...group,images:group.images.filter(image=>(trashMode?image.deletedAt:!image.deletedAt)&&!!image.detailPage===(historyKind==='detail'))})).filter(group=>group.images.length).map(group=>({...group,cover:group.images[0]}));render();syncCurrentEditor();
      if(activeGroup&&selectedNumber){const remaining=groups.find(g=>g.id===activeGroup.id);if(remaining){activeGroup=remaining;const number=remaining.images.some(x=>x.number===selectedNumber)?selectedNumber:remaining.images[0].number;if(detailOpen){selectedNumber=number;globalThis.detailPages?.updateHistory?.(remaining.images);showGroupHeader('商品详情页 · '+remaining.images.length+' 张');}else select(number);}else if(!navigationLocked())showGroups();}else if(!navigationLocked())showGroups();
    }catch(e){$('historyMessage').textContent='无法读取历史图片：'+e.message;}
  }
  window.refreshImageHistory=refresh;
  $('refreshHistory').onclick=refresh;$('moreHistory').onclick=()=>{visible+=5;render();};$('historyBack').onclick=showGroups;$('historyDialogBack').onclick=showGroups;
  $('historyLookupForm').onsubmit=event=>{event.preventDefault();if(editing)return toast('请等待编辑完成');select(Number($('historyLookup').value));};
  $('historyGroupDownload').onclick=()=>globalThis.detailPages?.downloadGroup(activeGroup?.images||[]);
  $('historyNumber').onchange=()=>{if(!select(Number($('historyNumber').value)))$('historyNumber').value=String(selectedNumber);};
  $('historyZoom').onclick=()=>{const list=activeGroup?.images?.length?activeGroup.images:(images||[]);const index=list.findIndex(r=>r.number===selectedNumber);if(index<0)return;globalThis.openImageViewer?.(list.map(r=>({src:()=>r.url,title:'图片 #'+r.number})),index)};
  $('historyCancel').onclick=async()=>{stopBatchPicking('history');if(!jobId)return;try{const response=await fetch('/api/jobs/'+jobId+'/cancel',{method:'POST'});if(!response.ok)throw Error('停止失败');$('historyEditStatus').textContent='正在停止编辑…';}catch(e){$('historyEditStatus').textContent=e.message;}};
  function lock(value){editing=value;state.busy=value;updateCount();for(const id of ['historyEditBtn','historyNumber','historyPrompt','historyLookup','historyBack','currentWorksBtn','historyRecordsBtn','historyEmptyTrashBtn'])$(id).disabled=value;document.querySelectorAll('.history-frame,.thumbnail').forEach(button=>button.disabled=value);$('previousImage').disabled=value||state.selected===0;$('nextImage').disabled=value||state.selected===state.results.length-1;syncCurrentEditor();}
  async function editImage(number,prompt,view,batch=false){
    if(!batch&&(editing||(state.busy&&!state.generating)))return toast('请等待生成队列或编辑完成');
    if(editReferences[view].loading)return toast('参考图正在读取，请稍候');
    if(!Number.isSafeInteger(number)||number<1||!prompt||prompt.length>2000)return toast('请输入有效图片编号及 1–2000 字的修改要求');
    const status=$(view==='current'?'currentEditStatus':'historyEditStatus'),cancel=$(view==='current'?'currentEditCancel':'historyCancel');
    if(!batch){startEditClock(view);lock(true);}status.textContent='';
    try{
      const referenceImage=editReferences[view].data;
      const response=await fetch('/api/history/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number,prompt,...(referenceImage?{referenceImage}:{})})});const data=await response.json();if(!response.ok)throw Error(data.error||'编辑提交失败');jobId=data.id;cancel.hidden=false;
      let misses=0;
      while(true){
        await new Promise(resolve=>setTimeout(resolve,1500));let job;
        try{const result=await fetch('/api/jobs/'+jobId);if(!result.ok)throw Error('无法读取编辑进度');job=await result.json();misses=0;}
        catch(e){if(++misses<=3){status.textContent='连接暂时中断，正在重试…';continue;}throw Error('进度连接中断，请稍后刷新生成记录查看结果，避免重复提交。');}
        status.textContent=['running','queued'].includes(job.status)?'':job.message;if(editProgress[view]){editProgress[view].phase=job.status==='queued'?'排队中':'编辑中';renderEditProgress(view);}if(job.status==='running'||job.status==='queued')continue;if(job.error)throw Error(job.error);
        if(job.results.length){
          const result=job.results[0];
          await refresh();
          const resultGroup=groups.find(group=>group.images.some(item=>item.number===result.number));
          const belongsToCurrent=resultGroup?.images.some(item=>state.results.some(current=>current.number===item.number));
          if(view==='current'||belongsToCurrent){
            const image=new Image();image.src=result.url;
            try{await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);state.results.push({...result,ai:true,canvas});const versions=globalThis.splitPhotoVersions(state.results);state.results=[...versions.current,...versions.replaced];state.selected=state.results.findIndex(item=>item.number===result.number);renderResults();}
            catch{throw Error('新图 #'+result.number+' 已保存，但预览未加载。请在生成记录中查看，避免重复提交。');}
          }
          if(view==='history')select(result.number);
          if(!batch)editReferences[view].clear();
          status.textContent=(result.editMode==='reference-redraw'?'参考原图重绘完成，花色与细节可能变化。':'')+'已保存新图 #'+result.number+'，原图 #'+number+' 保留。';if(editProgress[view])setEditProgress(view,editProgress[view].completed+1,editProgress[view].total);if(!batch)toast('修改完成');return true;
        }else if(job.status==='cancelled'){status.textContent='已停止编辑，原图保留。';}
        break;
      }
    }catch(e){status.textContent=e.message;return false;}
    finally{if(!batch){stopEditClock(view);lock(false);cancel.hidden=true;}jobId=null;cancel.disabled=false;}
  };
  $('historyEditForm').onsubmit=event=>{event.preventDefault();const number=Number($('historyNumber').value);if(number!==selectedNumber||!images.some(r=>r.number===number))return toast('请先核对待修改的图片');return batchViews.history.enabled?editBatch('history',$('historyPrompt').value.trim()):editImage(number,$('historyPrompt').value.trim(),'history');};
  currentEditor.onsubmit=event=>{event.preventDefault();const source=state.results[state.selected];if(shared||source?.reference||source?.number!==currentEditNumber)return toast('请先选中已生成的图片');return batchViews.current.enabled?editBatch('current',$('currentEditPrompt').value.trim()):editImage(source.number,$('currentEditPrompt').value.trim(),'current');};
  $('currentEditCancel').onclick=async()=>{stopBatchPicking('current');if(!jobId)return;const button=$('currentEditCancel');button.disabled=true;try{const response=await fetch('/api/jobs/'+jobId+'/cancel',{method:'POST'});if(!response.ok)throw Error('停止失败');$('currentEditStatus').textContent='正在停止编辑…';}catch(e){$('currentEditStatus').textContent=e.message;button.disabled=false;}};
  syncCurrentEditor();
  refresh();
})();
