import {setPromptData,layeredSetDetails,layeredSetSpecification} from './set-layered-prompts.mjs';
// Approved dictionary: one source for both providers and inspection.
export const setDetailRules=setPromptData.groups.flatMap(g=>g.options.map(o=>({...o,group:g.name,detail:o.prompt})));
export function selectedSetDetails(v){return layeredSetDetails(v);}
export function setSpecificationPrompt(v){return layeredSetSpecification(v);}
export function setCraftConstraint(v){return v.product==='set'?layeredSetSpecification(v):'';}
export function setProductPrompt(){return setPromptData.base.prompt;}
export function setCameraConstruction(){return '';}
export function craftReviewKeys(v,angle){
  if(v.product!=='set'||angle==='detail')return [];
  return selectedSetDetails(v).filter(rule=>!['plain','pillow-plain','standard'].includes(rule.id)).filter(rule=>rule.group==='被套工艺'?angle!=='pillowclose':rule.group==='枕套工艺'?['front','top','side','pillowclose','foldright','foldleft'].includes(angle):['front','top','side','drape','foot','low'].includes(angle)).map(rule=>({key:rule.group==='被套工艺'?'duvetCraft':rule.group==='枕套工艺'?'pillowCraft':'sheetCraft',id:rule.id,requirement:rule.detail}));
}
