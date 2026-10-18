// A selected front view establishes the four-piece set before other views.
// Reference-controlled cameras keep their original single selected angle.
import {normalizeSetOptions} from './shooting-set-plan.mjs';
export function shootingPairs(v){
  v=normalizeSetOptions(v);
  if(v.recommendScene||v.recommendAngle){
    const scenes=v.recommendScene?['warm']:v.referenceScene?v.scenes.slice(0,1):v.scenes,angles=v.recommendAngle?['front']:v.angles;
    if(v.recommendAngle&&!v.recommendScene)return scenes.flatMap(scene=>Array.from({length:v.recommendCount||1},()=>({scene,angle:'front'})));
    const pairs=scenes.flatMap(scene=>angles.map(angle=>({scene,angle})));
    return Array.from({length:v.recommendCount||1},(_,i)=>({...pairs[i%pairs.length]}));
  }
  const scenes=v.referenceScene?v.scenes.slice(0,1):v.scenes;
  let angles=v.referenceAngle?v.angles.slice(0,1):[...v.angles];
  if(v.product==='set'&&!v.referenceAngle&&angles.includes('front'))angles=['front',...angles.filter(a=>a!=='front')];
  return scenes.flatMap(scene=>angles.map(angle=>({scene,angle})));
}
