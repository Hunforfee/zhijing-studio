// Scheme C rearranges the existing controls; all image/AI/export handlers stay with their owners.
const $=id=>document.getElementById(id);
let current=null;
const header=document.querySelector('.toolbox-title');
const actions=document.createElement('div');actions.className='wf-heading-actions';
actions.innerHTML='<span class="wf-service-mark">AI 辅助创作</span><button type="button" id="wfSaveAsset" class="tt-secondary" disabled>保存到图库</button><button type="button" id="wfExport" class="tt-primary" disabled>导出作品 ↗</button>';
const stepHost=document.createElement('div');stepHost.className='wf-step-host';
header?.append(stepHost,actions);
$('wfExport')?.addEventListener('click',()=>{const button=current?.state.element.querySelector('#'+current.id+'Download');if(button&&!button.disabled)button.click();});
$('wfSaveAsset')?.addEventListener('click',()=>{const button=current?.state.element.querySelector('button[data-library-side=""]');if(button&&!button.disabled)button.click();});
const heading=(number,title)=>{const node=document.createElement('header');node.className='wf-section-heading';const badge=document.createElement('span');badge.textContent=number;const name=document.createElement('h2');name.textContent=title;node.append(badge,name);return node;};
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
export function mountToolWorkflow(tool,state,ai){
  const id=tool.id,panel=state.element,preview=panel.querySelector('.tt-preview'),settings=panel.querySelector('.tt-settings');
  panel.classList.add('wf-panel');
  const steps=document.createElement('nav');steps.className='wf-steps';steps.setAttribute('aria-label','创作流程');
  const labels=id==='copy'?[['填写商品信息','以真实资料为准'],['AI 整理表达','核对候选文案'],['精修并交付','复制或下载']]:[['加入参考素材','花型、面料与空间'],['AI 生成方案','对比与确认'],['精修并交付','保存、导出与继续处理']];
  labels.forEach(([name,note],index)=>{const button=document.createElement('button');button.type='button';button.dataset.wfStep=String(index+1);button.setAttribute('aria-label',name+'，'+note);button.title=name+' · '+note;button.innerHTML='<b>'+(index+1)+'</b><span>'+name+'<small>'+note+'</small></span>';steps.append(button);});
  const input=document.createElement('section');input.className='wf-input';input.setAttribute('aria-label',id==='copy'?'商品信息与创作方向':'参考素材与创作方向');input.append(heading('01',id==='copy'?'真实商品信息':'你的创作素材'));
  const files=panel.querySelector('#'+id+'Upload'),choose=panel.querySelector('#'+id+'Choose'),fileInfo=panel.querySelector('#'+id+'FileInfo');
  for(const node of [files,choose,fileInfo])if(node)input.append(node);
  if(choose)choose.textContent=['board','delivery'].includes(id)?'＋ 添加参考图片':'＋ 上传参考图片';
  if(id==='board')input.append($('boardList'));
  if(id==='copy')for(const node of [...settings.querySelectorAll(':scope>.tt-field')])input.append(node);
  if(ai?.card){input.append(ai.card);ai.card.querySelector('.tt-ai-upload')?.setAttribute('hidden','');}
  const hd=panel.querySelector('.tt-hd-ai'),hdResult=$('hdAIResult');
  if(id==='hd'&&hd){input.append(hd);hd.open=true;}
  const status=panel.querySelector('#'+id+'Status');if(status){status.classList.add('wf-operation-status');preview.querySelector('.tt-preview-head').after(status);}
  const side=document.createElement('aside');side.className='wf-side';side.setAttribute('aria-label','AI 候选与精修设置');
  const candidates=document.createElement('section');candidates.className='wf-candidates';candidates.append(heading('02',id==='copy'?'AI 文案候选':'AI 候选方案'));
  const count=document.createElement('span');count.className='wf-candidate-count';candidates.firstChild.append(count);
  const empty=document.createElement('div');empty.className='wf-candidate-empty';empty.innerHTML='<span aria-hidden="true">✧</span><strong>等待你的下一次灵感</strong><p>提交 AI 后在这里查看候选，确认后再用于作品。</p>';candidates.append(empty);
  const results=ai?.results||(id==='hd'?hdResult:null);if(results)candidates.append(results);
  const manual=document.createElement('details');manual.className='wf-manual';manual.open=true;
  const summary=document.createElement('summary');summary.innerHTML='<span><b>03</b> 精修与导出</span><span class="wf-chevron" aria-hidden="true">⌄</span>';manual.append(summary,settings);side.append(candidates,manual);
  const manualHeading=settings.querySelector(':scope>h2');if(manualHeading)manualHeading.textContent=id==='copy'?'基础文案整理':'精修设置';
  // Keep results in the right column and current artwork visible in the central canvas.
  panel.replaceChildren(input,preview,side);
  const artwork=$(id+'Canvas'),stage=preview.querySelector('.tt-stage');
  if(artwork&&stage&&artwork.parentElement===stage)artwork.classList.add('wf-fit-canvas');
  function fitArtwork(){
    if(!artwork||!stage||artwork.parentElement!==stage||stage.classList.contains('tt-pixel-zoom')||!artwork.width||!artwork.height)return;
    const style=getComputedStyle(stage),width=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=stage.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
    if(width>0&&height>0){const fitted=Math.min(width,height*artwork.width/artwork.height);artwork.style.setProperty('--wf-canvas-width',fitted+'px');}
  }
  if(stage&&typeof ResizeObserver==='function')new ResizeObserver(fitArtwork).observe(stage);
  let hadCandidates=false,scheduled=false,selectedStep=null;
  function refresh(){
    scheduled=false;const busy=!!state.busy||!!state.aiBusy,hasCandidates=!!results&&!results.hidden,adopted=hasCandidates&&(!!results?.classList.contains('is-adopted')||!!state.workflowAdopted);
    if(hasCandidates&&!hadCandidates){manual.open=false;selectedStep=2;}hadCandidates=hasCandidates;
    const sourceReady=id==='copy'?!!$('copyName')?.value.trim():!!$(id+'Empty')?.hidden;
    const phase=busy?2:selectedStep||(adopted?3:hasCandidates||sourceReady?2:1);
    for(const button of steps.querySelectorAll('button')){const step=Number(button.dataset.wfStep);if(button.disabled!==busy)button.disabled=busy;if(step===phase)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.classList.toggle('is-complete',step<phase);}
    if(empty.hidden!==hasCandidates)empty.hidden=hasCandidates;setText(count,busy?'处理中':hasCandidates?(adopted?'已采用':'待确认'):'');
    panel.dataset.workflowSource=String(sourceReady);panel.dataset.workflowBusy=String(busy);
    fitArtwork();
    if(current?.id===id){const download=$(id+'Download'),save=panel.querySelector('button[data-library-side=""]');$('wfExport').disabled=busy||!download||download.disabled;$('wfSaveAsset').disabled=busy||!save||save.disabled;$('wfSaveAsset').hidden=id==='copy';setText($('wfExport'),id==='copy'?'下载文案 ↗':'导出作品 ↗');}
  }
  function schedule(){if(!scheduled){scheduled=true;queueMicrotask(refresh);}}
  steps.addEventListener('click',event=>{const button=event.target.closest('[data-wf-step]');if(!button)return;const step=Number(button.dataset.wfStep);selectedStep=step;schedule();let target;if(step===1)target=id==='copy'?$('copyName'):choose;if(step===2)target=input.querySelector('textarea')||input.querySelector('.tt-ai-start,#hdAIStart');if(step===3){manual.open=true;target=settings.querySelector('input:not([type=file]),select,textarea,button');}if(target){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});target.focus({preventScroll:true});}});
  panel.addEventListener('change',event=>{if(event.target.matches('input[type=file]')){selectedStep=null;schedule();}});
  if(results)results.addEventListener('click',event=>{if(event.target.closest('.tt-ai-adopt,#hdAIAdopt')){manual.open=true;selectedStep=3;schedule();}});
  new MutationObserver(schedule).observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','class','width','height']});
  panel.addEventListener('input',schedule);state.onWorkflowChange=schedule;
  state.workflow={activate(){current={id,state};stepHost.replaceChildren(steps);refresh();},showManual(){manual.open=true;}};
  refresh();
}
