import {selectedSetDetails} from './set-product-prompts.mjs';
export function craftReferenceSpecs(v){
  const references=new Map();
  for(const rule of selectedSetDetails(v)){
    if(['plain','pillow-plain','standard'].includes(rule.id))continue;
    const kind=rule.id.replace(/^pillow-/,'');
    if(!references.has(kind))references.set(kind,{kind,file:'dist/assets/crafts/'+kind+'.png',groups:[]});
    references.get(kind).groups.push(rule.group);
  }
  return [...references.values()].map(ref=>({...ref,bytes:v.craftReferenceBytes?.[ref.kind]||null}));
}
export function craftReferenceInstruction(v,start){
  if(v.product==='set')return craftReferenceSpecs(v).map((ref,i)=>' Image '+(start+i)+' is '+(ref.bytes?'the USER CRAFT STYLE':'a CONSTRUCTION-ONLY schematic')+' for '+ref.groups.join(' / ')+' ('+ref.kind+'). '+(ref.bytes?'Use visible edge appearance, proportions and decorative-edge color/material; these override default decorative widths and colors, not selected component topology or main-panel print. Do not infer measured dimensions.':'Use component seam location and filled-versus-flat geometry only; ignore schematic color, labels and illustrative proportions.')+' Never copy its room, camera, main-body pattern or pillow display. Edge coverage and added outer dimensions follow Size specification, even if this image shows a different number of decorated sides. Apply only to these selected components.').join(' ');
  return craftReferenceSpecs(v).map((ref,i)=>{
    const topology=ref.kind.includes('flange')?' COMPONENT TOPOLOGY: duvet flanges on left, right and foot ONLY; the head short edge is a plain fine seam with NO flange, even on the folded-back head panel. Pillowcases retain FOUR flanged edges. Follow only the diagram for the selected component. This head-edge restriction overrides uploaded craft photos and older generated images. Original body stays unchanged: duvet outer (W+2b) x (L+b); pillow outer (W+2b) x (L+2b).':'';
    return (ref.bytes?` Image ${start+i} is the USER CRAFT STYLE reference for ${ref.groups.join(' and ')} (${ref.kind}). Use the visible construction, edge proportions, seam details, decorative edge color and material ONLY for these selected components. Uploaded craft appearance overrides system default edge widths, colors and schematic styling. Preserve the selected craft category and original filled-body dimensions. Apply original A/B prints to the main panels; only the actual decorative edge may take its color/material from this style photo. Never copy its main-body print, room, camera, text or extra bedding. Do not invent hidden details or infer exact dimensions from an unscaled photo. For wide flanges add the flat unfilled edge OUTSIDE the original body without shrinking it. This craft reference takes priority over conflicting default craft descriptions or earlier generated edges; main A/B panel assignments remain locked.`:` Image ${start+i} is a CONSTRUCTION-ONLY schematic for ${ref.groups.join(' and ')} (${ref.kind}). Use its seam placement, outer silhouette and filled-versus-unfilled geometry ONLY on those selected components. This is not a fabric, color, room or camera source. Apply original uploaded A/B to the real cloth surfaces; ignore schematic gray, labels, drawing style and illustrative proportions. Use the selected target dimensions. Render a photograph, never a diagram or inset. Selected craft geometry overrides incompatible plain edges in camera examples or earlier generated images.`)+topology;
  }).join('');
}
