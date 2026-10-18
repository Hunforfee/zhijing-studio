import {pickRecommendation,shuffleRecommendations} from './recommendation-policy.mjs';
export const defaultSetCounts={main:10,pillow:2,duvet:1,sheet:1,detail:1};
export function normalizeSetOptions(v){
  if(v.smartAngles!=null&&typeof v.smartAngles!=='boolean')throw Error('智能角度选项无效');
  if(v.generateSet!=null&&typeof v.generateSet!=='boolean')throw Error('生成套图选项无效');
  if(!v.generateSet&&!v.smartAngles)return v;
  if(v.generateSet&&v.product!=='set')throw Error('全景与枕套、被套、床单套图适用于四件套');
  const setCounts={...(v.smartAngles?{main:15,pillow:2,duvet:2,sheet:2,detail:0}:defaultSetCounts),...v.setCounts};
  if(v.setCounts!=null&&(typeof v.setCounts!=='object'||Array.isArray(v.setCounts)))throw Error('套图数量设置无效');
  for(const key of Object.keys(defaultSetCounts))if(!Number.isSafeInteger(setCounts[key])||setCounts[key]<0||setCounts[key]>(v.smartAngles?100:20))throw Error('请填写有效的非负整数数量');
  const recommendCount=Object.keys(defaultSetCounts).reduce((n,key)=>n+setCounts[key],0);
  if(recommendCount<1||recommendCount>(v.smartAngles?100:20))throw Error(v.smartAngles?'智能角度总数应为 1 至 100 张':'套图总数应为 1 至 20 张');
  return {...v,setCounts,recommendAngle:true,recommendCount,...(v.smartAngles?{recommendScene:false}:{} )};
}
const fullViews=[
  ['正面全景','centered foot-end frontal view, camera 1.2m high'],
  ['左前全景','left foot corner 35-degree diagonal, camera 1.1m high'],
  ['右前全景','right foot corner 35-degree diagonal, camera 1.1m high'],
  ['左侧全景','true left broadside, perpendicular to bed long side, camera at mattress height'],
  ['右侧全景','true right broadside, perpendicular to bed long side, camera at mattress height'],
  ['垂直俯视全景','strict vertical overhead, optical axis 90 degrees down, rectangular mattress plan view'],
  ['高位左俯全景','high left diagonal from 2.5m, downward 55-degree tilt'],
  ['高位右俯全景','high right diagonal from 2.5m, downward 55-degree tilt'],
  ['低位左前全景','low left foot corner, camera 0.3m above floor, slight upward tilt'],
  ['低位右前全景','low right foot corner, camera 0.3m above floor, slight upward tilt'],
  ['床尾平视全景','straight foot-end camera at mattress height, horizontal sightline'],
  ['窗侧全景','left side near foot, 65-degree azimuth and gentle downward tilt'],
  ['右侧斜俯全景','right side near foot, 65-degree azimuth and gentle downward tilt'],
  ['左后全景','from left head corner toward foot, 45-degree diagonal, headboard naturally cropped'],
  ['右后全景','from right head corner toward foot, 45-degree diagonal, headboard naturally cropped'],
  ['空间全景','doorway contextual view, corrected verticals, full bedding dominant'],
  ['高位正面全景','centered foot-end elevated 2m, downward 35-degree tilt'],
  ['左侧低位全景','left broadside from 0.35m, soft upward sightline'],
  ['右侧低位全景','right broadside from 0.35m, soft upward sightline'],
  ['高位床头全景','high head-end view toward foot, bedding outline visible, headboard outside frame']
];
// Main images mix catalog, room-context and relaxed lifestyle compositions.
// Category ordering stays fixed; viewpoint family and geometry are sampled anew.
const roomViews=[
 ['门口留白远景','from doorway, eye level 1.5m, bed offset left, show floor, side cabinet and window; product occupies 50-60%'],
 ['窗侧空间远景','from opposite window corner, 35-degree diagonal, 1.4m high; product occupies 55-65%, curtains and airy room visible'],
 ['高位空间远景','high room corner at 2.2m with 35-degree downward tilt; bed occupies 55-65%, generous surrounding floor'],
 ['床尾退后远景','step back beyond foot, 50mm equivalent, bed occupies 55-65%, show bed sides and selected scene architecture'],
 ['床侧环境远景','from room side, near broadside, 1.2m high, bed occupies 55-65%, quiet negative space on one side'],
 ['前景层次远景','wide diagonal, 40mm equivalent, small out-of-focus chair edge at outer frame only; unobstructed bedding occupies 60-70%'],
 ['低位空间远景','from distant left foot corner, 0.7m high, bed occupies 60-70%, visible side table and wall; corrected proportions'],
 ['右侧留白远景','distant right corner at 1.6m, bed placed off center, 60% product coverage with restrained background context']
];
const relaxedViews=[
 ['随手斜俯主图','standing beside left foot corner, downward 50-degree handheld-style perspective; bedding occupies 80-90%, relaxed asymmetric framing, headboard may be cropped'],
 ['窗边松弛主图','right bedside standing view, downward 40-degree tilt; pillows and broad upper bedding surface occupy 80%, foot can leave frame'],
 ['床尾生活主图','off-center foot-end view at 1.4m, downward 30-degree tilt, bedding fills 80%; gently rumpled cover and scattered display pillows'],
 ['床头侧俯主图','from left head-side looking diagonally toward foot, downward 45-degree tilt; broad connected bedding fills 85%, headboard outside frame'],
 ['右侧随性主图','near right bedside at 1.3m, downward 35-degree tilt; broad print and pillow arrangement in diagonal layers, naturally cropped bed corners'],
 ['自然晨起主图','from foot-left at 1.7m, downward 55-degree tilt; soft loose cover folds and coherent turned-back reverse, connected bedding fills 80-90%'],
 ['床面错落主图','standing at window side, downward 60-degree oblique; styled pillows on upper and middle bed with broad continuous cover, avoid symmetry'],
 ['坐姿左侧生活主图','seated at left bedside, camera 0.85m high, downward 15-degree tilt; broad bedding fills 75-85%, intimate casual framing, headboard partly outside frame'],
 ['右床头回望主图','from right head corner looking toward foot, downward 35-degree tilt, connected bedding fills 80%; near pillows softly overlap in foreground, normal bed proportions'],
 ['俯身随拍主图','leaning over left middle bedside at 1.65m, downward 65-degree tilt; broad surface fills 85%, loose asymmetric crop and clear original print, no full-room requirement'],
 ['侧前松弛主图','left middle bedside at 1.1m, downward 25-degree tilt; broad bedding scene fills 80%, headboard partially cropped, gentle tactile folds']
];
function smartMainShots(count,shuffle,random){
 const axis=([name,brief])=>/垂直俯视/.test(name)?'overhead':/床头|左后|右后/.test(name)?'head':/低位/.test(name)?'low':/左/.test(name)||/left/.test(brief)?'left':/右/.test(name)||/right/.test(brief)?'right':/正面|床尾/.test(name)?'front':'context';
 const pools=[fullViews,roomViews,relaxedViews].map((pool,i)=>shuffle(pool).map(camera=>({camera,family:['catalog','context','lifestyle'][i],axis:axis(camera)})));
 const selected=[],used=new Set(),axisUse={};
 function take(view){selected.push(view);used.add(view.camera[0]);axisUse[view.axis]=(axisUse[view.axis]||0)+1;}
 // Randomized coverage prevents a batch from sampling only diagonal views.
 const required=shuffle(['left','right','front','overhead','head','low']);
 for(const direction of required.slice(0,count>=10?6:Math.min(count,3))){const source=count>=10&&direction==='head'?pools[2]:pools[0];const choices=source.filter(v=>v.axis===direction&&!used.has(v.camera[0]));if(choices.length)take(choices[0]);}
 while(selected.length<count){
  const contextCount=selected.filter(v=>v.family==='context').length,lifestyleCount=selected.filter(v=>v.family==='lifestyle').length;
  const framing=count>=10&&contextCount<2?'context':count>=10&&lifestyleCount<Math.ceil(count*0.3)?'lifestyle':contextCount<=lifestyleCount?'context':'lifestyle';
  let pool=pools[framing==='context'?1:2].filter(v=>!used.has(v.camera[0]));
  if(!pool.length)pool=pools.flat().filter(v=>!used.has(v.camera[0]));
  if(!pool.length){used.clear();for(let i=0;i<pools.length;i++)pools[i]=shuffle(pools[i]);pool=pools.flat();}
  const minimum=Math.min(...pool.map(v=>axisUse[v.axis]||0));take(shuffle(pool.filter(v=>(axisUse[v.axis]||0)===minimum))[0]);
 }
 const overviewCount=Math.max(1,Math.round(count*0.2));
 const overviewViews=new Set([...shuffle(selected.filter(v=>v.family==='context')),...shuffle(selected.filter(v=>v.family==='catalog'))].slice(0,overviewCount));
 return shuffle(selected).map(view=>{
 const camera=overviewViews.has(view)?[view.camera[0],view.camera[1].replace(/(?:40|50)mm equivalent|normal corrected lens/g,'28–35mm equivalent corrected wide-angle lens').replace(/(?:50-60|55-65|60-70|70-80|75-85|80-90|60)%/g,'40-50%')]:view.camera;
 const brief=view.family==='catalog'?'FULL BEDDING VIEW: show the complete main bedding outline with all duvet and bed-surface corners; use a corrected lens and editing margins.':view.family==='context'?'ROOM CONTEXT MAIN IMAGE: show the complete selected PRODUCT product outline and its actual components; reveal more of the user-selected scene, with bedding clearly readable, never tiny.':'RELAXED LIFESTYLE MAIN IMAGE: show a broad connected area of the selected PRODUCT product and its actual components, not a component detail or macro. Bed edges and headboard may naturally leave frame; do not force every corner into frame. Follow gravity for loose folds; never shrink the bed to fit.';
 const geometry={left:'Camera is physically on the BED LEFT long side when standing at the foot looking toward the head. Show that left side receding toward the head; the right long side is hidden. Do not reuse a right-side view or mirror the fabric.',right:'Camera is physically on the BED RIGHT long side when standing at the foot looking toward the head. Show that right side receding toward the head; the left long side is hidden. Do not reuse a left-side view or mirror the fabric.',overhead:'Optical axis is vertically downward at 90 degrees, mattress is a rectangle in plan view; NO upright headboard face or room horizon.',head:'Camera is near the head looking TOWARD THE FOOT; foot is background and near pillows foreground. Headboard is behind the camera or cropped, never a foot-to-head composition.',front:'Camera is centered at the foot looking straight toward the head. Bed side edges are symmetric, not an oblique three-quarter shot.',low:'Camera is close to floor: bed base and hanging edge in foreground, top strongly foreshortened. Do not replace this with an eye-level diagonal.',context:'Use the assigned room-context perspective and subject coverage; physically move the camera rather than only changing accessories.'}[view.axis];
 const overview=overviewViews.has(view)?' COMPLETE BEDDING OVERVIEW: 28–35mm校正广角；距离比近景主图增加约40%，俯视升高；完整床品占40-50%，两侧外缘、床尾与睡枕全入画，四周留边，保持真实比例，禁止裁切或缩床。':'';
 return {shotKind:'main',mainFraming:view.family,cameraAxis:view.axis,fullProductOverview:overviewViews.has(view),camera:[camera[0],camera[1]+'. '+brief+' GEOMETRY CONTRACT: '+geometry+' Use corrected proportions, no fisheye or exaggerated foreground. Preserve original print scale, panel identity and selected craft; do not add unselected main bedding.'+overview]};
 });
}
const detailViews={
  pillow:['枕套细节',['own original print and supported volume','selected outer edge craft and real joining seam','actual reverse panel, without inventing an opening','softly compressed corner and adjoining face']],
  duvet:['被套细节',['own printed front and natural folds','actual turned-back reverse and connected front','selected outer edge craft and real joining seam','soft draping corner, excluding the separate sheet']],
  sheet:['床单细节',['own continuous bed-surface fabric and weave','own selected hem or fitted corner construction','own side drape or fitted sidewall, following selected subtype','own supported corner and continuous print']],
  detail:['其他细节',['fabric weave and original motif','selected visible seam and connected original cloth','soft contact shadow and shallow gravity-settled fold','visible edge finish with adjoining continuous fabric']]
};
const detailGeometry=['left diagonal, 25-degree elevation','right diagonal, 55-degree elevation','strict vertical overhead, 90-degree downward axis','low left profile, camera near the visible cloth edge','low right profile, camera near the visible cloth edge','head-side close view, downward 40-degree tilt','foot-side close view, downward 65-degree tilt','broadside close view, almost horizontal sightline'];
const detailCrops=['tight detail fills 85%, no whole pillow or bed','medium-close detail fills 70%, show connected adjoining fabric','macro detail fills 95%, show textile texture and shallow fold'];
export function createSetShots(counts,shuffle=shuffleRecommendations,random=Math.random,smart=false){
  const shots=smart?smartMainShots(counts.main,shuffle,random):shuffle(fullViews).slice(0,counts.main).map(camera=>({shotKind:'main',camera:[camera[0],camera[1]+'. FULL BEDDING VIEW: show the complete main bedding outline with all duvet and bed-surface corners; use a corrected lens and editing margins. Do not substitute a detail crop.']}));
  for(const key of ['duvet','sheet','pillow','detail']){
    const [label,focus]=detailViews[key],pool=shuffle(focus.flatMap(f=>detailGeometry.map(g=>({focus:f,geometry:g}))));
    for(let i=0;i<counts[key];i++){
      const choice=pool[i%pool.length],crop=pickRecommendation(detailCrops,random);
      shots.push({shotKind:key,camera:[label+(counts[key]>1?' '+(i+1):''),'COMPONENT DETAIL: '+key+'; focus on '+choice.focus+'. '+choice.geometry+'; '+crop+', background softly blurred. Show only this real component; other bedding may remain outside frame. No detached invented swatch, full-bed panorama or invented closure.']});
    }
  }
  return shots;
}
