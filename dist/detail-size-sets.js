import {normalizeDetailSizes} from './detail-size-policy.js';

export function presetSizeSets(){
 return [
  {name:'方案1',dimensions:[[200,230],[245,250],[48,74]]},
  {name:'方案2',dimensions:[[220,240],[245,270],[48,74]]},
  {name:'方案3',dimensions:[[150,200],[180,230],[48,74]]}
 ].map(x=>({...x,selected:false}));
}
export function confirmedSizeSets(sets){
 return normalizeDetailSizes(sets.filter(x=>x.selected).flatMap(x=>['被套','床单','枕套'].map((part,i)=>({part:x.name+' · '+part,dimensions:x.dimensions[i].map(Number)}))));
}
export function createSizeSetEditor({host,onChange,isDisabled}){
 let sets=presetSizeSets(),customIndex=0;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 function render(){
  host.replaceChildren();const columns=el('div',null,'detail-size-set-columns');for(const text of ['', '被套','床单','枕套','cm'])columns.append(el('span',text));host.append(columns);
  for(const set of sets){
   const card=el('div',null,'detail-size-set'),head=el('div',null,'detail-size-set-heading'),label=el('label'),check=el('input');
   check.type='checkbox';check.checked=set.selected;check.setAttribute('aria-label','选用'+set.name);
   check.onchange=()=>{set.selected=check.checked;card.classList.toggle('is-selected',set.selected);onChange();};
   label.append(check);head.append(label);
   if(set.custom){const remove=el('button','×');remove.type='button';remove.className='detail-size-set-remove';remove.setAttribute('aria-label','删除'+set.name);remove.onclick=()=>{sets=sets.filter(x=>x!==set);render();onChange();};head.append(remove);}
   card.append(head);card.classList.toggle('is-selected',set.selected);
   for(const [i,part] of ['被套','床单','枕套'].entries()){
    const row=el('div',null,'detail-size-set-row');row.style.gridColumn=String(i+2);
    for(let d=0;d<2;d++){
     if(d)row.append(el('span','×'));
     const input=el('input');input.type='number';input.min='0.1';input.max='1000';input.step='0.1';input.value=set.dimensions[i][d];input.placeholder=d?'宽':'长';input.setAttribute('aria-label',set.name+part+(d?'宽':'长')+'，厘米');
     input.oninput=()=>{set.dimensions[i][d]=input.value;set.selected=true;check.checked=true;card.classList.add('is-selected');onChange();};row.append(input);
    }
    card.append(row);
   }
   host.append(card);
  }
  const add=el('button','＋ 自定义整套尺寸','outline-button detail-size-set-add');add.type='button';add.disabled=sets.length>=10;
  add.onclick=()=>{if(sets.length>=10||isDisabled())return;sets.push({name:'自定义'+(++customIndex),dimensions:[['',''],['',''],['','']],custom:true,selected:true});render();onChange();host.querySelector('.detail-size-set:last-of-type input[type=number]')?.focus();};host.append(add);
  host.querySelectorAll('input,button').forEach(n=>{n.disabled=n.disabled||isDisabled();});
 }
 return {render,reset(){sets=presetSizeSets();customIndex=0;},get sizes(){return confirmedSizeSets(sets);}};
}
