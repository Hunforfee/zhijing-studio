// Let the image model recommend photography from the actual fabric images.
// Menu choices still control every dimension that was not delegated to AI.
import {displayLayouts,displayProps,displayLights,propsForScene,isTextileProp} from './recommendation-styling.mjs';
import {createSetShots,defaultSetCounts,normalizeSetOptions} from './shooting-set-plan.mjs';
import {isChildBed,childSettings,childProps,childLayouts} from './child-bed.mjs';
import {applyPortraitSpacePlan} from './portrait-space.mjs';
import {shuffleRecommendations as shuffled} from './recommendation-policy.mjs';
const settings=[
  ['暖白卧室','warm-white limewash wall, rounded upholstered headboard, sheer window at left'],
  ['原木自然','oak slat headboard, pale timber floor, linen curtain and side daylight'],
  ['雅致酒店','taupe upholstered headboard, dark bedside cabinet, restrained symmetrical room'],
  ['法式窗景','French wall mouldings, tall arched window, ivory carved wooden bed'],
  ['现代简约','flat greige wall, low platform bed, slim metal bedside table'],
  ['海景卧室','bright coastal bedroom, distant sea through a side window, pale woven accents'],
  ['庭院卧室','garden-facing glass door, wooden bed, leafy greenery outside only'],
  ['复古卧室','walnut bed, understated vintage cabinet, muted wall panelling'],
  ['纯净影棚','seamless warm-grey studio backdrop, simple bed frame, large softbox'],
  ['阁楼卧室','sloping ceiling, roof window, light timber bed frame'],
  ['城市窗景','large city-facing window, modern padded bed, concrete-toned wall'],
  ['乡居卧室','whitewashed country bedroom, painted wood bed, shuttered window'],
  ['新中式卧室','restrained Chinese-inspired wood lattice wall, simple walnut bed'],
  ['藤编卧室','woven cane headboard, cream plaster wall, diffuse window light'],
  ['拱门卧室','arched wall recess behind a low bed, stone-toned floor, side daylight'],
  ['书房卧室','small bookshelves beside the bed, calm painted wall, filtered daylight'],
  ['竹木卧室','bamboo wall screen, plain timber bed, softly lit neutral floor'],
  ['石纹卧室','subtle travertine wall, upholstered bed, broad neutral bounced light'],
  ['花园露台','sheltered dry garden terrace, full-sized wooden bed, diffuse shade'],
  ['窗边榻卧室','bright bay-window bedroom, simple padded bed, low window ledge']
];
const views=[
  ['整体主图','FRONTAL HERO: camera centered at the foot, about 1.3m high, horizontal sightline; entire product and both sides visible, fills 70-85% of the image; do not use an oblique three-quarter view'],
  ['左斜侧全景','left 40-degree three-quarter full-product view showing the front and left side'],
  ['右斜侧全景','right 40-degree three-quarter full-product view showing the front and right side'],
  ['高位俯拍','high oblique overhead view showing the printed surface and overall layout'],
  ['床尾近景','medium view from the foot end emphasizing the main product edge and its support'],
  ['床头近景','HEAD-END CLOSE VIEW: photograph only the upper third of the product from a steep 60-degree elevated diagonal; for a set, focus on its existing pillow pair and connected upper cover; foot end and lower two-thirds completely outside frame; headboard cropped'],
  ['面料特写','FABRIC MACRO: 85-100mm equivalent lens, close to a small continuous fabric area; printed cloth and visible weave fill 90% of the image, one shallow fold supplies depth; NO entire bed, headboard, room panorama or full pillows visible'],
  ['工艺细节','close-up of an existing selected edge finish or seam, connected to the main fabric; invent no closure'],
  ['左侧平视','TRUE LEFT PROFILE: camera perpendicular to the long side, azimuth 90 degrees from the foot, at mattress height around 0.55m; long side silhouette dominates, top surface only a narrow strip; head and foot lie at opposite image edges; NOT a three-quarter or front view'],
  ['右侧平视','right broadside medium-wide view at mattress height, show natural support and silhouette'],
  ['垂直俯视','STRICT VERTICAL OVERHEAD: camera directly above the mattress center, optical axis points straight down at 90 degrees; main product forms a rectangular plan view, bed sides nearly parallel; no horizon, upright headboard face, room walls or front perspective visible; NOT an elevated three-quarter bed view'],
  ['左床尾低机位','LOW FOOT-END VIEW: camera just 0.25-0.35m above floor at the left foot corner, looking slightly upward with a 50mm equivalent lens; lower hem/edge and bed base dominate foreground, upper product surface foreshortened into a thin band; no elevated view or whole-room panorama'],
  ['右床尾低机位','low right foot-end diagonal view; avoid ultrawide distortion and giant foreground motifs'],
  ['左侧表面近景','high left diagonal medium-close view of the central printed surface'],
  ['右侧表面近景','high right diagonal medium-close view of the central printed surface'],
  ['边角细节','medium-close view of a supported corner and the adjoining continuous fabric'],
  ['轮廓展示','medium-wide view with the product offset in the frame, showing its full outline and connected edges'],
  ['自然褶皱','medium-close diagonal view of shallow gravity-settled folds and uninterrupted motifs'],
  ['接缝与布面','macro-to-medium detail of an existing visible seam joining its real panels; show no invented seam'],
  ['空间远景','wide contextual view of the room with the full product still clearly readable and dominant']
];
// Sample without replacement. Balance camera families while randomizing both
// family order and individual viewpoints; no image index owns a fixed shot.
const cameraFamilies=[[0,1,2,16,19],[3,10],[11,12],[8,9],[6,7,18],[4,5,13,14,15,17]];
export function createRecommendationPlan(v,random=Math.random){
  if(v.generateSet||v.smartAngles)v=normalizeSetOptions(v);
  // Each selected scene receives a complete, independently randomized angle set.
  const selectedScenes=v.referenceScene?v.scenes?.slice(0,1):v.scenes;
  if(v.recommendAngle&&!v.recommendScene&&selectedScenes?.length>1)return selectedScenes.flatMap(scene=>createRecommendationPlan({...v,scenes:[scene]},random));
  const count=Math.max(1,Math.min(v.smartAngles?100:20,v.recommendCount||1));
  const child=isChildBed(v),scenes=shuffled(child?childSettings:settings,random);
  const layouts=shuffled(displayLayouts,random),props=shuffled(child?childProps:displayProps,random),lights=shuffled(displayLights,random);
  const families=cameraFamilies.map((members,family)=>({family,members:shuffled(members,random),used:0}));
  const setShots=v.generateSet||v.smartAngles?createSetShots(v.setCounts||defaultSetCounts,items=>shuffled(items,random),random,!!v.smartAngles):null;
  const plan=[];let previous=-1;
  for(let i=0;i<count;i++){
    if(families.every(f=>!f.members.length))for(const f of families){f.members=shuffled(cameraFamilies[f.family],random);f.used=0;}
    const available=families.filter(f=>f.members.length);
    const different=available.filter(f=>f.family!==previous);
    const candidates=different.length?different:available;
    const leastUsed=Math.min(...candidates.map(f=>f.used));
    const eligible=candidates.filter(f=>f.used===leastUsed);
    const chosen=eligible[Math.floor(random()*eligible.length)];
    plan.push({scene:[...scenes[child?0:i%scenes.length]],camera:[...views[chosen.members.pop()]],cameraFamily:chosen.family,styling:{pillowCount:child?1:2+Math.floor(random()*3),layout:child?childLayouts[Math.floor(random()*childLayouts.length)]:layouts[i%layouts.length],props:props[i%props.length],light:lights[i%lights.length],reverse:!!(v.imageBBytes||v.imageB)&&random()<0.5}});
    chosen.used++;previous=chosen.family;
  }
  const shots=applyPortraitSpacePlan(setShots?setShots.map((shot,i)=>({...plan[i],...shot})):plan,v,items=>shuffled(items,random));
  if(v.smartAngles){
    const mainIndices=shots.map((shot,i)=>shot.shotKind==='main'?i:-1).filter(i=>i>=0);
    const decorated=new Set(shuffled(mainIndices,random).slice(0,Math.ceil(mainIndices.length*0.8)));
    const textileIndices=new Set(shuffled([...decorated],random).slice(0,Math.ceil(decorated.size*0.5)));
    const scenePools=new Map();
    const propUse=new Map();
    for(let i=0;i<shots.length;i++){
      const scene=v.scenes?.[i%v.scenes.length],key=child?'child':scene;
      shots[i].selectedScene=scene;
      if(!scenePools.has(key))scenePools.set(key,shuffled(propsForScene(scene,child),random));
      let pool=scenePools.get(key);
      if(decorated.has(i))pool=pool.filter(prop=>isTextileProp(prop)===textileIndices.has(i));
      const useKey=key+':'+(decorated.has(i)?textileIndices.has(i):'hidden'),used=propUse.get(useKey)||0;
      propUse.set(useKey,used+1);
      shots[i].styling={...shots[i].styling,props:pool[used%pool.length],propsVisible:decorated.has(i)};
      if(decorated.has(i)&&/装饰抱枕/.test(shots[i].styling.props))shots[i].styling.pillowCount=Math.min(3,shots[i].styling.pillowCount);
    }
  }
  if(v.smartAngles)for(const shot of shots)if(shot.shotKind==='main')shot.camera[1]=shot.camera[1].replaceAll('PRODUCT',v.product).replace('show the complete main bedding outline with all duvet and bed-surface corners','show the complete selected '+v.product+' product outline and its actual components; do not add unselected main bedding');
  if(v.product==='pillowcore')for(const shot of shots){shot.styling.pillowCount=1;shot.camera[0]=shot.camera[0].replaceAll('枕套','枕芯');shot.camera[1]+='; PILLOW INSERT ADAPTATION: apply assigned axis, elevation and scale to the single pillow itself on a neutral support, not a full bedding set. Its short edge replaces bed foot, long edge replaces bed side, seam means its own shell seam, no hanging cloth. Full views retain the complete pillow contour; details inspect intact shell. Do not add bedding or invent fill layers.';}
  if(child)return shots.map(shot=>({...shot,childBed:true,styling:{...shot.styling,pillowCount:1,layout:shots[0].styling.layout,light:shots[0].styling.light,props:props[0]},camera:[shot.camera[0],shot.camera[1]+'; apply this camera to a realistic single CHILD BED, preserve this viewpoint and crop, adjust camera distance for its narrow mattress rather than expanding to adult bed proportions']}));
  return shots;
}
export function recommendationShot(v){
  const index=Math.max(0,v.recommendIndex||0);
  const plan=v.recommendationPlan||createRecommendationPlan({...v,recommendCount:Math.max(v.recommendCount||1,index+1)});
  return plan[index];
}
export function recommendationSections(v){
  if(!v.recommendScene&&!v.recommendAngle)return v;
  v={...v,recommendationPlan:v.recommendationPlan||createRecommendationPlan({...v,recommendCount:Math.max(v.recommendCount||1,(v.recommendIndex||0)+1)})};
  const index=v.recommendIndex||0,total=v.recommendationPlan.length;
  const shot=recommendationShot(v);
  const variation=`This is photograph ${index+1} of ${total}. Follow this shot's assigned brief, not a generic random variation. `;
  const sections={...v.promptSections};
  const settingContinuity=isChildBed(v)?'SCENE CONTINUITY: keep the same room architecture, bed frame, window position, furniture, background toys and light direction across this entire group; change camera viewpoint and crop only. ':'Each assigned setting must visibly differ in room architecture AND furniture/background layout; merely changing a cushion, lamp or exposure is insufficient. ';
  if(v.recommendScene)sections.scene=variation+'AI RECOMMENDED SETTING: '+shot.scene[1]+'. Adapt neutral decor to the original fabric colors and motif, without recoloring the product. '+settingContinuity+'Menu scene ID is a placeholder. For single small products use a realistic table or support within this environment. Preserve product craft and count; no extra bedding.';
  if(v.recommendAngle)sections.camera=variation+'AI RECOMMENDED CAMERA: '+shot.camera[1]+'. The assigned viewpoint, elevation and crop are REQUIRED, not optional inspiration. Rebuild the camera completely instead of reproducing the first product photograph composition. Product reference images establish fabric and construction ONLY. In a detail crop, other real components remain outside the frame; do not zoom out to show every component. For a standalone small product apply this geometry to its own support, without adding a bed or companion pillow. A clearly different viewpoint, subject scale or detail focus is required; micro-crops, mirroring and tiny pose shifts are insufficient. Keep original print, A/B panel identity, craft and count. No new hidden closures, lettering or watermarks.';
  return {...v,recommendStyling:shot.styling,recommendShotKind:shot.shotKind,recommendSceneName:v.recommendScene?shot.scene[0]:undefined,recommendAngleName:v.recommendAngle?shot.camera[0]:undefined,promptSections:sections};
}
export function compactRecommendationSections(v){
  if(!v.recommendScene&&!v.recommendAngle)return v;
  v=recommendationSections(v);
  const shot=recommendationShot(v),sections={...v.promptSections};
  const number=`photograph ${(v.recommendIndex||0)+1} of ${v.recommendationPlan.length}. `;
  if(v.recommendScene)sections.scene=number+'AI RECOMMENDED SETTING: '+shot.scene[1]+(isChildBed(v)?'. 同组保持相同房间、床架、窗位、家具、背景玩具与光线，只改变机位景别，不改产品花色工艺。':'. 按原花色协调环境；不同图改变房间与家具布局，不改产品花色工艺。');
  if(v.recommendAngle)sections.camera=number+'AI RECOMMENDED CAMERA: '+shot.camera[1]+'. 严格执行本图机位、高度、景别，不复刻首图构图；特写允许其他部件在画外。';
  return {...v,promptSections:sections};
}
