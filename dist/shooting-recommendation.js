// Restore this switch when the user asks to bring back “自选角度”.
const CUSTOM_SHOOTING_ANGLES_ENABLED=false;
const defaultShootingSetCounts={main:15,duvet:2,sheet:2,pillow:2};
const shootingSetKeys=Object.keys(defaultShootingSetCounts);
function shootingSetTotal(counts=state.setCounts||defaultShootingSetCounts){return shootingSetKeys.reduce((n,key)=>n+counts[key],0);}
function smartDetailSupported(key){return key==='pillow'?['set','mat','sheet','mattress','pillowcore'].includes(state.product):key==='duvet'?['set','quilt'].includes(state.product):key==='sheet'?['set','sheet'].includes(state.product):true;}
function syncRecommendationControls(){
  if(!CUSTOM_SHOOTING_ANGLES_ENABLED&&!state.referenceUpload)state.recommendAngle=true;
  state.recommendScene=false;state.generateSet=false;
  const referenceAngleLocked=!!state.referenceUpload&&state.referenceAngle!==false;if(referenceAngleLocked)state.recommendAngle=false;
  $('setCount_pillow').closest('label').querySelector('span').textContent=state.product==='pillowcore'?'枕芯细节':'枕套细节';
  const box=document.querySelector('.shooting-recommendation');box.hidden=false;
  const referenceAngles=$('angleGroupTitle')?.closest?.('.group-angles');if(referenceAngles)referenceAngles.hidden=!CUSTOM_SHOOTING_ANGLES_ENABLED||!state.referenceUpload||state.referenceAngle!==false||!!state.angleMenuOpened;
  const smart=!!state.recommendAngle,counts={...defaultShootingSetCounts,...state.setCounts};
  delete counts.detail;
  for(const key of shootingSetKeys)if(!smartDetailSupported(key))counts[key]=0;
  state.setCounts=counts;if(smart)state.recommendCount=shootingSetTotal(counts);
  $('chooseSmartAngles').setAttribute('aria-pressed',String(smart));$('chooseCustomAngles').setAttribute('aria-pressed',String(!smart));
  $('chooseSmartAngles').disabled=$('chooseCustomAngles').disabled=!!state.busy||referenceAngleLocked;
  $('chooseSmartAngles').title=referenceAngleLocked?'取消参考角度后可选择智能角度':'';
  $('shootingSetOptions').hidden=!smart;
  const customEntry=$('chooseCustomAngles').closest?.('.angle-custom-entry');if(customEntry)customEntry.hidden=!CUSTOM_SHOOTING_ANGLES_ENABLED||!!state.referenceUpload&&state.referenceAngle!==false;
  $('anglePickerDialog').hidden=!CUSTOM_SHOOTING_ANGLES_ENABLED||smart||(!!state.referenceUpload&&state.referenceAngle!==false)||!state.angleMenuOpened;
  $('shootingSetSummary').textContent='';
  refreshLastAngleCountsButton();
  $('defaultAngleCounts').disabled=$('clearAngleCounts').disabled=!!state.busy||referenceAngleLocked||!smart;
  for(const key of shootingSetKeys){$('setCount_'+key).value=counts[key];$('setCount_'+key).disabled=state.busy||referenceAngleLocked||!smartDetailSupported(key);}
  box.classList.toggle('is-active',smart);
  if(typeof syncAnglePickerSummary==='function')syncAnglePickerSummary();
}
$('chooseSmartAngles').onclick=()=>{
  if(state.busy||state.referenceUpload&&state.referenceAngle!==false)return;
  state.angleMenuOpened=true;state.recommendAngle=true;state.recommendScene=false;state.generateSet=false;
  state.setCounts=state.setCounts||{...defaultShootingSetCounts};state.recommendCount=shootingSetTotal();state.mode='ai';
  renderSelections();
};
function chooseCustomShootingAngles(){
  if(!CUSTOM_SHOOTING_ANGLES_ENABLED||state.busy)return;
  state.angleMenuOpened=true;state.recommendAngle=false;state.recommendScene=false;state.generateSet=false;renderSelections();
  syncAnglePickerSummary();
}
$('chooseCustomAngles').onclick=chooseCustomShootingAngles;
for(const key of shootingSetKeys){
  const control=$('setCount_'+key);
  function saveCount(commit){
    if(state.busy||!smartDetailSupported(key))return syncRecommendationControls();
    const n=Number(control.value),counts={...(state.setCounts||defaultShootingSetCounts),[key]:n},total=shootingSetTotal(counts);
    if(control.value===''||!Number.isInteger(n)||n<0||n>100||total<1||total>100){if(commit){toast('每类可填非负整数，每个场景合计为 1 至 100 张');syncRecommendationControls();}return;}
    state.setCounts=counts;if(state.recommendAngle)state.recommendCount=total;
    $('shootingSetSummary').textContent='';updateCount();
  }
  control.oninput=()=>saveCount(false);control.onchange=()=>saveCount(true);
}
const LAST_ANGLE_COUNTS_KEY='zhijing.lastSmartAngleCounts.v1';
function readLastAngleCounts(){try{const counts=JSON.parse(localStorage.getItem(LAST_ANGLE_COUNTS_KEY));return counts&&shootingSetKeys.every(key=>Number.isSafeInteger(counts[key])&&counts[key]>=0&&counts[key]<=100)&&shootingSetTotal(counts)>0&&shootingSetTotal(counts)<=100?Object.fromEntries(shootingSetKeys.map(key=>[key,counts[key]])):null;}catch{return null;}}
function refreshLastAngleCountsButton(){const button=$('applyLastAngleCounts');button.disabled=!!state.busy||!readLastAngleCounts();button.title=readLastAngleCounts()?'填入上次智能拍摄使用的数量':'智能生成一次后可应用上次数量';}
function rememberSmartAngleCounts(){if(!state.recommendAngle||state.referenceUpload)return;try{localStorage.setItem(LAST_ANGLE_COUNTS_KEY,JSON.stringify(state.setCounts||defaultShootingSetCounts));}catch{}refreshLastAngleCountsButton();}
$('applyLastAngleCounts').onclick=()=>{if(state.busy)return;const counts=readLastAngleCounts();if(!counts)return toast('还没有上次的智能拍摄数量');state.setCounts={...counts};syncRecommendationControls();updateCount();toast('已应用上次生成数量');};
$('defaultAngleCounts').onclick=()=>{if(state.busy||!state.recommendAngle||state.referenceUpload&&state.referenceAngle!==false)return;state.setCounts={...defaultShootingSetCounts};syncRecommendationControls();updateCount();};
$('clearAngleCounts').onclick=()=>{if(state.busy||!state.recommendAngle||state.referenceUpload&&state.referenceAngle!==false)return;state.setCounts=Object.fromEntries(shootingSetKeys.map(key=>[key,0]));syncRecommendationControls();updateCount();};
syncRecommendationControls();
// Angle choices live in a dedicated dialog; the main workspace keeps its height.
function syncAnglePickerSummary(){
  if(typeof availableAngles!=='function')return;
  const selected=availableAngles().filter(a=>state.angles.includes(a.id)),recommended=!!state.recommendAngle,reference=!!state.referenceUpload&&state.referenceAngle!==false;
  $('angleSelectionCount').textContent=recommended?'AI 安排':reference?'沿用参考':'已选 '+selected.length+' 个';
  $('angleSelectionSummary').textContent=recommended?'系统自动安排差异化构图':reference?'沿用上传图片的角度':selected.length?selected.slice(0,2).map(a=>a.name).join('、')+(selected.length>2?' 等 '+selected.length+' 个':''):'尚未选择角度';
  $('anglePickerSelected').textContent=recommended?'当前由 AI 安排角度':reference?'当前沿用参考图角度':'已选 '+selected.length+' 个角度';
  $('anglePickerHint').textContent=recommended?'点击自选角度后，可手动选择':reference?'取消参考角度后，可手动选择':'可多选，点击即可保存';
}
$('openAnglePicker').onclick=chooseCustomShootingAngles;
$('closeAnglePicker').onclick=$('confirmAnglePicker').onclick=()=>{state.angleMenuOpened=false;syncRecommendationControls();$('chooseCustomAngles').focus();};
$('toggleAngleExamples').onclick=()=>{
  const expanded=$('toggleAngleExamples').getAttribute('aria-expanded')!=='true';
  $('toggleAngleExamples').setAttribute('aria-expanded',String(expanded));
  $('toggleAngleExamples').textContent=expanded?'收起示例图':'查看示例图';
  $('angles').classList.toggle('show-angle-examples',expanded);
};

// One angle family: smart counts and custom choices share the same narrow frame.
if(typeof document.createElement==='function'){
const angleFamily=document.createElement('div');angleFamily.className='angle-family';
const recommendation=document.querySelector('.shooting-recommendation'),angleColumn=recommendation.parentElement;
angleColumn.insertBefore(angleFamily,recommendation);angleFamily.append(recommendation,$('chooseCustomAngles').closest('.angle-custom-entry'));
const smartHeader=document.createElement('div');smartHeader.className='smart-angle-header';
const smartChoice=$('chooseSmartAngles'),lastCounts=$('applyLastAngleCounts');smartChoice.parentElement.replaceWith(smartHeader);const countActions=document.createElement('div');countActions.className='smart-angle-actions';countActions.append($('defaultAngleCounts'),lastCounts,$('clearAngleCounts'));smartHeader.append(smartChoice,countActions);
$('shootingSetOptions').querySelector('.smart-count-heading').hidden=true;
const smartModule=document.createElement('div');smartModule.className='smart-angle-module';
recommendation.insertBefore(smartModule,smartHeader);smartModule.append(smartHeader,$('shootingSetOptions'));


}
