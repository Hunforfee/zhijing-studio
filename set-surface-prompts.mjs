import {setPromptData,enforceLayeredSet,layeredSetEdgeRule} from './set-layered-prompts.mjs';
export const setStructurePrompt=setPromptData.base.prompt;
export const compactSetStructurePrompt=setStructurePrompt;
export function setSeamMapRule(){return '';}
export function setPanelBoundaryRule(){return '';}
export function setSurfacePlacement(v){return v.product==='set'?layeredSetEdgeRule(v):'';}
// Final safety enforcement edits one product block, without trailing duplicate guards.
export function enforceSetPanelBoundaries(prompt,v){return v.product==='set'?enforceLayeredSet(prompt,v):prompt;}
