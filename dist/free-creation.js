import {freeCreationModes,freeCreationRatios} from './free-creation-policy.js';
const paths={spark:'M4 20l4-1L20 7l-3-3L5 16zM14 7l3 3M5 3v5M2.5 5.5h5M19 15v6M16 18h6',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',image:'M3 3h18v18H3zM3 16l5-5 5 5 3-4 5 7M8 7h.01',scene:'M3 3h18v18H3zM3 14h18M12 3v18M6 18h3',light:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',cleanup:'m4 17 9-13 7 5-9 13H7zM9 10l8 6M3 22h18',detail:'m12 3 9 9-9 9-9-9zM8 12h8M12 8v8',extend:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M9 12h6m-3-3v6',select:'M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5',clock:'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9m0 4v6l4 2',download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4'};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
const modeIcons={custom:'spark',scene:'scene',light:'light',cleanup:'cleanup',detail:'detail',extend:'extend'};
const workspace=document.getElementById('workspace');
if(workspace&&!document.getElementById('freeCreationWorkspace'))mount();

function mount(){
  const section=document.createElement('section');section.id='freeCreationWorkspace';section.className='free-creation-workspace';section.setAttribute('aria-label','自由创作');
  section.innerHTML=`<div class="fc-main"><header class="fc-header"><span class="fc-header-icon">${svg('spark')}</span><div><h2>自由创作</h2><p>从一张图片开始，让灵感自由生长</p></div><button type="button" id="fcRecords" class="fc-soft-button">${svg('clock')}创作记录</button></header>
    <div class="fc-toolbar"><div class="fc-view-tabs" role="group" aria-label="图片对比"><button type="button" id="fcViewCurrent" aria-pressed="true">当前版本</button><button type="button" id="fcViewOriginal" aria-pressed="false">原图对比</button></div><span id="fcDimensions"></span><button type="button" id="fcSelect" class="fc-soft-button" aria-pressed="false">${svg('select')}框选修改</button><button type="button" id="fcClearRegion" class="fc-text-button" hidden>取消框选</button><button type="button" id="fcZoom" class="fc-text-button">100%</button><a id="fcDownload" class="fc-download" download hidden>${svg('download')}下载图片</a></div>
    <div id="fcStage" class="fc-stage"><div id="fcEmpty" class="fc-empty"><span class="fc-empty-mark">${svg('spark')}</span><span class="fc-eyebrow">YOUR IMAGE, YOUR IDEAS</span><h3>把一张图，改成你想要的样子</h3><p>换一个场景，调整一束光，或只修改一个细节。<br>原图与每次编辑都会保留，随时继续创作。</p><button type="button" id="fcEmptyUpload" class="fc-primary">${svg('upload')}上传图片，开始创作</button><small>支持 JPG、PNG、WebP · 单张不超过 10 MB</small><div class="fc-empty-notes"><span>保留产品花型</span><span>框选局部修改</span><span>原图随时对比</span></div></div><div id="fcImagePlane" class="fc-image-plane" hidden><img id="fcImage" alt="自由创作图片预览" draggable="false"><div id="fcSelection" class="fc-selection" hidden><span>修改区域</span></div></div></div>
    <div class="fc-preview-note"><span id="fcPreviewNote">上传你的产品照片，或从已有作品中导入</span><span id="fcVersionCount"></span></div><div id="fcVersions" class="fc-versions" aria-label="原图与编辑版本"></div></div>
  <aside class="fc-rail" aria-labelledby="fcSettingsTitle"><header class="fc-rail-header"><span>${svg('spark')}</span><h2 id="fcSettingsTitle">创作设置</h2><small>一次专注一个想法</small></header><div class="fc-settings-scroll">
    <section class="fc-settings-section"><h3><b>01</b>选择创作图片</h3><input type="file" id="fcUploadFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="fcUpload" class="fc-upload">${svg('upload')}<span id="fcUploadLabel">上传原图<small>也可以拖入图片到左侧画布</small></span></button><button type="button" id="fcImport" class="fc-import">${svg('image')}从图片作品导入</button><div id="fcSourceInfo" class="fc-source-info" hidden></div></section>
    <section class="fc-settings-section"><h3><b>02</b>这次想改什么</h3><div class="fc-modes" role="group" aria-label="创作方式">${freeCreationModes.map((mode,index)=>`<button type="button" data-free-mode="${mode.id}" aria-pressed="${index===0}">${svg(modeIcons[mode.id])}<span>${mode.name}<small>${mode.hint}</small></span></button>`).join('')}</div></section>
    <section class="fc-settings-section fc-prompt-section"><h3><b>03</b>描述你的想法<button type="button" id="fcExample" class="fc-text-button">填入示例</button></h3><textarea id="fcPrompt" maxlength="3000" placeholder="写清楚改哪里、改成什么，以及哪些内容需要保留。例如：只将背景换成原木卧室，保留床品的熊猫花型、宽边和配色。"></textarea><div class="fc-inspiration" aria-label="灵感示例"><button type="button" data-inspiration="morning">晨光卧室</button><button type="button" data-inspiration="white">干净白底</button><button type="button" data-inspiration="props">清理杂物</button></div><input type="file" id="fcReferenceFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="fcReferenceButton" class="fc-reference-button">＋ 添加参考图 <span>选填</span></button><div id="fcReference" class="fc-reference" hidden><img alt="辅助参考图"><span></span><button type="button" id="fcRemoveReference" aria-label="移除参考图">×</button></div><p class="fc-field-note">参考图只用于你描述的部分，例如场景、光线或配色。</p></section>
    <section class="fc-settings-section fc-product-locks"><h3>产品保留</h3><label><input id="fcLockPattern" type="checkbox" checked>保留花型与配色</label><label><input id="fcLockCraft" type="checkbox" checked>保留结构与工艺</label><small>需要换色或改工艺时，请在要求中明确说明。</small></section>
  </div><footer class="fc-action-area"><div class="fc-ratio-row"><label for="fcRatio">图片比例</label><select id="fcRatio">${Object.entries(freeCreationRatios).map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select></div><p id="fcRegionHint" class="fc-region-hint" hidden>已框选：只修改选中区域，框外保留原图。</p><button type="button" id="fcGenerate" class="fc-primary" disabled>${svg('spark')}生成修改图</button><button type="button" id="fcCancel" class="fc-stop" hidden>停止编辑</button><p id="fcStatus" class="fc-status" role="status" aria-live="polite">沿用当前图片服务，点击生成后按服务计费。</p></footer></aside>
  <dialog id="fcLibraryDialog" class="fc-library-dialog"><header><div><h2 id="fcLibraryTitle">创作记录</h2><p id="fcLibraryNote"></p></div><button type="button" id="fcLibraryClose" aria-label="关闭">×</button></header><div id="fcLibraryGrid" class="fc-library-grid"></div></dialog>`;
  const video=document.getElementById('videoDesignWorkspace');if(video)video.after(section);else workspace.append(section);
  if(!video){const observer=new MutationObserver(()=>{const next=document.getElementById('videoDesignWorkspace');if(next){next.after(section);observer.disconnect();}});observer.observe(workspace,{childList:true});}
  const $=id=>document.getElementById(id);
  let doc=null,version='original',mode='custom',region=null,reference=null,submitting=false,selecting=false,compare=false,zoom='fit',timer,revision=0,pendingOperation=null,followOutput=true,lastExample='',ratioBeforeSelection='3:4';
  const currentVersion=()=>doc?.versions.find(item=>item.id===version)||doc?.versions[0];
  const active=()=>doc?.operations.find(operation=>['queued','running'].includes(operation.status));
  const busy=()=>submitting||!!active();
  const status=message=>$('fcStatus').textContent=message;
  async function request(url,data){
    let reply;try{reply=await fetch(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch{throw Error('无法连接自由创作服务，请检查网络后重试');}
    let value;try{value=await reply.json();}catch{}
    if(!reply.ok){const message=value?.error?.message||value?.error||value?.message||value?.msg;throw Error(typeof message==='string'&&!/bad gateway/i.test(message)?message.slice(0,300):reply.status===413?'图片总量超过服务器上传限制，请减少图片大小后重试':`自由创作服务暂时不可用（HTTP ${reply.status}），请稍后重试`);}
    if(!value||typeof value!=='object')throw Error('服务器未返回有效结果，请检查部署状态');return value;
  }
  function controls(){
    const locked=busy();for(const id of ['fcUpload','fcImport','fcReferenceButton','fcRemoveReference','fcRatio','fcLockPattern','fcLockCraft','fcPrompt','fcExample'])$(id).disabled=locked;
    section.querySelectorAll('[data-free-mode],[data-inspiration]').forEach(button=>button.disabled=locked);
    $('fcRatio').disabled=locked||!!region;$('fcGenerate').disabled=locked||!doc||!$('fcPrompt').value.trim();$('fcGenerate').textContent=submitting?'正在提交…':active()?.status==='queued'?'已加入编辑队列':active()?'正在编辑图片…':'生成修改图';
    $('fcCancel').hidden=!active();$('fcCancel').disabled=submitting;$('fcSelect').disabled=!doc||locked||compare||mode==='extend';$('fcSelect').setAttribute('aria-pressed',String(selecting));$('fcZoom').disabled=!doc;
    $('fcViewCurrent').disabled=!doc;$('fcViewOriginal').disabled=!doc||doc.versions.length<2;$('fcViewCurrent').setAttribute('aria-pressed',String(!compare));$('fcViewOriginal').setAttribute('aria-pressed',String(compare));
    $('fcClearRegion').hidden=!region;$('fcClearRegion').disabled=locked;$('fcRegionHint').hidden=!region;$('fcImagePlane').classList.toggle('is-selecting',selecting);
    if(doc){$('fcUploadLabel').firstChild.textContent='上传新图片';$('fcSourceInfo').hidden=false;$('fcSourceInfo').textContent=doc.title+' · '+(currentVersion()?.label||'原图');}
  }
  function clearRegion(){const hadRegion=!!region;region=null;selecting=false;$('fcSelection').hidden=true;if(hadRegion)$('fcRatio').value=ratioBeforeSelection;controls();}
  function drawRegion(){const box=$('fcSelection');box.hidden=!region||compare;if(region&&!compare){box.style.left=region.x*100+'%';box.style.top=region.y*100+'%';box.style.width=region.width*100+'%';box.style.height=region.height*100+'%';}}
  function fit(){
    if(!doc)return;const item=compare?doc.versions[0]:currentVersion(),stage=$('fcStage');if(!item)return;
    const scale=zoom==='fit'?Math.min((stage.clientWidth-40)/item.width,(stage.clientHeight-40)/item.height):1;
    $('fcImagePlane').style.width=Math.max(1,item.width*scale)+'px';$('fcImagePlane').style.height=Math.max(1,item.height*scale)+'px';drawRegion();
  }
  function render(){
    controls();$('fcEmpty').hidden=!!doc;$('fcImagePlane').hidden=!doc;if(!doc)return;
    const item=compare?doc.versions[0]:currentVersion();if($('fcImage').getAttribute('src')!==item.url)$('fcImage').src=item.url;
    $('fcDimensions').textContent=item.width+' × '+item.height;$('fcPreviewNote').textContent=region?'拖动重新框选修改范围；框外内容保持原样':compare?'正在对比最初上传的原图':item.id==='original'?'原图已保存，选择任务并描述你的想法':'基于 '+item.label+' 继续编辑；原图与其他版本仍然保留';
    $('fcVersionCount').textContent=(doc.versions.length-1)+' 个编辑版本';$('fcVersions').replaceChildren();
    for(const entry of doc.versions){const button=document.createElement('button');button.type='button';button.className='fc-version';button.setAttribute('aria-pressed',String(entry.id===version));const image=document.createElement('img');image.src=entry.url;image.alt=entry.label;const caption=document.createElement('span');caption.textContent=entry.label;const small=document.createElement('small');small.textContent=entry.parent?'基于 '+(doc.versions.find(item=>item.id===entry.parent)?.label||'原图'):'始终保留';button.append(image,caption,small);button.onclick=()=>{version=entry.id;compare=false;followOutput=false;clearRegion();render();};$('fcVersions').append(button);}
    $('fcDownload').hidden=false;$('fcDownload').href=item.url;$('fcDownload').download='自由创作-'+doc.title+'-'+item.label+'.png';fit();
  }
  function schedulePoll(){clearTimeout(timer);if(doc&&active())timer=setTimeout(poll,1500);}
  function settleOperation(){
    const operation=doc?.operations.find(item=>item.id===pendingOperation);
    if(operation&&!['queued','running'].includes(operation.status)){
      if(operation.status==='done'&&followOutput&&doc.versions.some(item=>item.id===operation.id)){version=operation.id;compare=false;clearRegion();}
      status(operation.message);pendingOperation=null;
    }else if(active())status(active().message);
  }
  async function poll(){
    const id=doc?.id,stamp=revision;if(!id)return;
    try{
      const value=await request('/api/free/documents/'+id);if(stamp!==revision||doc?.id!==id)return;
      doc=value.document;settleOperation();
      render();schedulePoll();
    }catch(error){if(stamp===revision){status(error.message+'，正在保留任务并重试查询');timer=setTimeout(poll,3500);}}
  }
  function remember(){try{localStorage.setItem('zhijing-free-document',doc.id);}catch{}}
  function useDocument(value){revision++;clearTimeout(timer);doc=value;version=doc.versions.at(-1).id;compare=false;reference=null;$('fcReference').hidden=true;$('fcReferenceButton').hidden=false;zoom='fit';$('fcZoom').textContent='100%';pendingOperation=active()?.id||null;followOutput=true;clearRegion();remember();render();schedulePoll();}
  async function normalizedImage(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('请使用 10 MB 以内的 JPG、PNG 或 WebP');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();if(image.naturalWidth>16000||image.naturalHeight>16000)throw Error('图片尺寸过大，请缩小后再上传');
      const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const result=canvas.toDataURL('image/png');if(result.length>13.9*1024*1024)throw Error('图片转换后过大，请缩小尺寸再试');return result;
    }finally{URL.revokeObjectURL(url);}
  }
  async function upload(file){
    if(busy()||!file)return;submitting=true;controls();status('正在保存原图…');
    try{const image=await normalizedImage(file),value=await request('/api/free/documents',{image,title:file.name.replace(/\.[^.]+$/,'').slice(0,160)});useDocument(value.document);status('原图已保存。选择任务，写下你想改的内容。');}
    catch(error){status(error.message);}finally{submitting=false;render();}
  }
  function chooseMode(id){
    mode=id;const item=freeCreationModes.find(mode=>mode.id===id);section.querySelectorAll('[data-free-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.freeMode===id)));
    if(! $('fcPrompt').value.trim()||$('fcPrompt').value===lastExample){$('fcPrompt').value=id==='custom'?'':item.example;lastExample=$('fcPrompt').value;}
    if(id==='extend'&&region)clearRegion();controls();
  }
  async function library(kind){
    $('fcLibraryTitle').textContent=kind==='history'?'从图片作品导入':'自由创作记录';$('fcLibraryNote').textContent='正在读取…';$('fcLibraryGrid').replaceChildren();$('fcLibraryDialog').showModal();
    try{
      const value=await request(kind==='history'?'/api/history':'/api/free/documents');const items=kind==='history'?(value.images||[]).filter(image=>!image.detailPage&&!image.deletedAt):value.documents;
      $('fcLibraryNote').textContent=items.length?kind==='history'?'选择图片创建独立创作，原作品保留。':'每份记录包含原图与全部编辑版本。':'暂无记录，可先上传一张图片。';
      for(const item of items){
        const button=document.createElement('button');button.type='button';const image=document.createElement('img'),text=document.createElement('span'),small=document.createElement('small');
        image.loading='lazy';image.alt='';image.src=kind==='history'?item.url:item.versions.at(-1).url;text.textContent=kind==='history'?'图片 #'+item.number:item.title;small.textContent=kind==='history'?'导入自由创作':(item.versions.length-1)+' 个编辑版本';button.append(image,text,small);
        button.onclick=async()=>{button.disabled=true;let ownsLock=false;try{
          if(busy())throw Error('请先等待当前编辑完成或停止任务');
          submitting=true;ownsLock=true;controls();
          if(kind==='history'){
            const local=new URL(item.url,location.href);if(local.origin!==location.origin||!/^\/generated\/[a-f0-9-]{36}\/\d+(?:-repair-[12])?\.(png|jpg|webp)$/.test(local.pathname))throw Error('图片来源无效');
            const response=await fetch(local.pathname,{mode:'same-origin'});if(!response.ok)throw Error('原作品无法读取');const blob=await response.blob();const image=await normalizedImage(new File([blob],'作品-'+item.number+'.png',{type:blob.type}));
            useDocument((await request('/api/free/documents',{image,title:'作品 #'+item.number})).document);
          }else useDocument((await request('/api/free/documents/'+item.id)).document);
          $('fcLibraryDialog').close();status(active()?.message||'已打开，选择一个版本继续编辑。');
        }catch(error){$('fcLibraryNote').textContent=error.message;button.disabled=false;}finally{if(ownsLock){submitting=false;controls();}}};
        $('fcLibraryGrid').append(button);
      }
    }catch(error){$('fcLibraryNote').textContent=error.message;}
  }
  for(const id of ['fcUpload','fcEmptyUpload'])$(id).onclick=()=>$('fcUploadFile').click();
  $('fcUploadFile').onchange=event=>{const file=event.target.files[0];event.target.value='';void upload(file);};
  $('fcStage').ondragover=event=>{event.preventDefault();if(!busy())$('fcStage').classList.add('is-dragover');};$('fcStage').ondragleave=()=>$('fcStage').classList.remove('is-dragover');$('fcStage').ondrop=event=>{event.preventDefault();$('fcStage').classList.remove('is-dragover');void upload(event.dataTransfer.files[0]);};
  $('fcRecords').onclick=()=>library('records');$('fcImport').onclick=()=>library('history');$('fcLibraryClose').onclick=()=>$('fcLibraryDialog').close();
  section.querySelectorAll('[data-free-mode]').forEach(button=>button.onclick=()=>chooseMode(button.dataset.freeMode));
  $('fcExample').onclick=()=>{$('fcPrompt').value=freeCreationModes.find(item=>item.id===mode).example;lastExample=$('fcPrompt').value;controls();$('fcPrompt').focus();};$('fcPrompt').oninput=controls;
  const inspiration={morning:'将背景换成有晨光的原木卧室，窗帘与绿植克制搭配，保留产品花色、比例和工艺。',white:'将背景换成干净的暖白色影棚，保留主体完整轮廓与自然接触阴影，真实呈现花型和质感。',props:'只清理画面中多余的杂物，移除指定物件后自然补全背景，保留床品及原有家具。'};
  section.querySelectorAll('[data-inspiration]').forEach(button=>button.onclick=()=>{chooseMode(button.dataset.inspiration==='props'?'cleanup':'scene');$('fcPrompt').value=inspiration[button.dataset.inspiration];lastExample=$('fcPrompt').value;controls();});
  $('fcReferenceButton').onclick=()=>$('fcReferenceFile').click();$('fcReferenceFile').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file||busy())return;submitting=true;controls();try{const image=await normalizedImage(file);reference={image,name:file.name};$('fcReference').querySelector('img').src=image;$('fcReference').querySelector('span').textContent=file.name;$('fcReference').hidden=false;$('fcReferenceButton').hidden=true;}catch(error){status(error.message);}finally{submitting=false;controls();}};
  $('fcRemoveReference').onclick=()=>{reference=null;$('fcReference').hidden=true;$('fcReferenceButton').hidden=false;};
  $('fcViewCurrent').onclick=()=>{compare=false;render();};$('fcViewOriginal').onclick=()=>{compare=true;selecting=false;render();};$('fcZoom').onclick=()=>{zoom=zoom==='fit'?'100':'fit';$('fcZoom').textContent=zoom==='fit'?'100%':'适应画布';fit();};$('fcImage').onload=fit;
  $('fcSelect').onclick=()=>{selecting=!selecting;$('fcImagePlane').classList.toggle('is-selecting',selecting);controls();if(selecting)status('在图片上拖动，框选这次要修改的区域。');};$('fcClearRegion').onclick=()=>{clearRegion();render();};
  let start=null;
  function point(event){const box=$('fcImagePlane').getBoundingClientRect();return {x:Math.min(1,Math.max(0,(event.clientX-box.left)/box.width)),y:Math.min(1,Math.max(0,(event.clientY-box.top)/box.height))};}
  $('fcImagePlane').onpointerdown=event=>{if(!selecting||busy()||compare)return;event.preventDefault();start=point(event);region=null;drawRegion();$('fcImagePlane').setPointerCapture(event.pointerId);};
  $('fcImagePlane').onpointermove=event=>{if(!start)return;const end=point(event);region={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};drawRegion();};
  const finishSelection=()=>{if(!start)return;start=null;if(!region||region.width<.02||region.height<.02){region=null;drawRegion();status('框选区域太小，请重新拖动选择。');return;}if($('fcRatio').value!=='source')ratioBeforeSelection=$('fcRatio').value;$('fcRatio').value='source';selecting=false;$('fcImagePlane').classList.remove('is-selecting');render();};$('fcImagePlane').onpointerup=finishSelection;$('fcImagePlane').onpointercancel=()=>{start=null;clearRegion();};
  $('fcGenerate').onclick=async()=>{
    if(busy()||!doc||!$('fcPrompt').value.trim())return;
    const targetId=doc.id,intent={sourceVersion:version,mode,prompt:$('fcPrompt').value,ratio:$('fcRatio').value,lockPattern:$('fcLockPattern').checked,lockCraft:$('fcLockCraft').checked,region:region?{...region}:null,referenceImage:reference?.image};
    submitting=true;followOutput=true;controls();status('正在提交编辑要求…');
    try{
      const service=await request('/api/status');if(!service.configured)throw Error('请先在左侧设置中连接图片编辑服务');if(!['sub2api','openai','compatible'].includes(service.provider))throw Error('自由创作需要支持参考图编辑的图片服务，请在设置中切换接口');
      const value=await request('/api/free/documents/'+targetId+'/edit',intent);
      doc=value.document;pendingOperation=value.operationId;status(active()?.message||'编辑任务已提交');settleOperation();render();schedulePoll();
    }catch(error){status(error.message);}finally{submitting=false;controls();}
  };
  $('fcCancel').onclick=async()=>{if(!doc||submitting)return;submitting=true;controls();try{doc=(await request('/api/free/documents/'+doc.id+'/cancel',{})).document;status(doc.operations.at(-1)?.message||'原图和已有版本已保留');settleOperation();clearTimeout(timer);render();}catch(error){status(error.message);}finally{submitting=false;controls();}};
  new ResizeObserver(fit).observe($('fcStage'));window.addEventListener('pagehide',()=>clearTimeout(timer));
  let previous;try{previous=localStorage.getItem('zhijing-free-document');}catch{}
  const initialRevision=revision;
  request('/api/status').then(value=>{if(value.shared)$('fcImport').hidden=true;}).catch(()=>{});
  if(previous&&/^[a-f0-9-]{36}$/.test(previous))request('/api/free/documents/'+previous).then(value=>{if(revision===initialRevision&&!doc&&!submitting){useDocument(value.document);status(active()?.message||'已恢复上次的自由创作。');}}).catch(()=>{});
  render();window.dispatchEvent(new Event('resize'));if(location.hash==='#freeCreationWorkspace')requestAnimationFrame(()=>section.scrollIntoView({block:'start'}));
}
