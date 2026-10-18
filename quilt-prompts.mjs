import {matchingPillowRule} from './dist/camera-contract.js';
export const quiltSeasonPrompts={
  winter:'WINTER DUVET INSERT: exactly one thick, softly lofted filled quilt, not a duvet cover or four-piece set. In the absence of a compatible user construction reference, use generously filled broad square quilted compartments with slight compression along seams, softly domed chambers and a narrow stitched binding. Thickness must read clearly at the edge and turnover, with compressible rounded folds and weight resting on the mattress. Avoid balloon-like overinflation, hard slabs, thin summer padding or a flat single-layer sheet. Do not infer a down, wool or synthetic filling type without evidence. The uploaded pattern belongs to the shell, never overlaid as a separate cover.',
  summer:'LIGHTWEIGHT SUMMER QUILT: exactly one thin, lightly filled, low-loft quilt, not a duvet cover or four-piece set. Default fine small diamond quilting (compatible user construction references may change the stitch layout), shallow soft creases, thin narrow binding and light flexible folds. It rests close to the mattress and falls naturally with little bulk. The filling is subtly present but never thick puffy winter chambers or a bare single-layer bedsheet. Preserve recognizable sewn quilting at a plausible scale. The uploaded pattern belongs to the shell, never overlaid as a separate cover.'
};
export function quiltSeason(v){return v.quiltSeason||(v.size?.includes('夏凉被')?'summer':'winter')}
export function quiltProductPrompt(v){const season=quiltSeason(v);return matchingPillowRule({...v,product:'quilt'})+quiltSeasonPrompts[season]+' SEASON PRIORITY: the selected season controls filling loft, quilted construction, edge thickness and fold radius; a chosen surface texture changes only shell weave, nap and sheen, never the seasonal filling thickness. No additional bedding-set sheet or second quilt. Include the required matching pillowcase pair at the head of the bed. A plain supporting mattress/bed belongs to the setting. Use uploaded A on front, uploaded B on reverse if supplied, otherwise A on both. Any styling or master reference is subordinate to this season and uploaded print identity.'}
export function quiltCameraPrompt(v,angle){
  if(v.product!=='quilt')return '';
  const winter=quiltSeason(v)==='winter';
  const thickness=winter?'winter-loft domed chambers, narrow binding and softly compressible thick edge':'summer-low-loft shallow quilting, narrow binding and very thin flexible edge';
  const views={
    side:'Show one complete quilt from front-left three-quarter; visible top, foot and right-draped edge must belong to the same quilt.',
    front:'Center one quilt on the bed in a frontal symmetrical frame; display the foot edge and its seasonal thickness with the matching pillowcase pair at the head.',
    top:'True overhead 90-degree view of one complete rectangular quilt, all four bound edges and the quilting layout visible; no diagonal room perspective.',
    detail:'Contextual medium-close photograph of the quilt shell weave, print and an actual quilting seam with compressed stitching. Keep filling volume appropriate to the season; do not replace it with a detached fabric swatch.',
    left:'Camera beside the left long side of the bed; left edge is closest and the quilt side profile is visible.',
    right:'Camera beside the right long side of the bed; right edge is closest and the quilt side profile is visible.',
    low:'Lens close to mattress height, looking across the near bound edge. Emphasize '+thickness+'. Do not enlarge the thickness beyond the selected season.',
    wide:'Wide environmental view: bed and one selected quilt remain clearly identifiable, with meaningful visible room or selected outdoor setting; never add a second quilt or extra bedding props.',
    reverse:'Turn back the head-end of this same quilt across its width in a broad relaxed irregular band; front remains over lower bed, reverse is exposed only within the turnover. Show '+thickness+'. No triangular flap, rigid straight cuff, rolled tube or upright wall. Keep the matching pillowcase pair at the head, above the turnover.',
    foot:'Contextual crop of the lower half and full foot width, foot binding, one true corner and quilting; headboard and pillows remain outside frame.',
    pillowclose:'EDGE BINDING CLOSE-UP replaces pillowcase close-up for quilt products: photograph this quilt own continuous narrow sewn binding, stitch detail and '+thickness+'. The matching pillows remain at the head outside this detail crop; no pillowcase opening or invented zipper on the quilt.',
    drape:'Contextual medium-close view of at least half of the quilt own side edge falling naturally from the mattress under gravity, showing '+thickness+' and connected front/reverse surfaces where physically revealed; no dangling separate runner.'
  };
  return ' QUILT-SPECIFIC CAMERA: '+views[angle];
}
