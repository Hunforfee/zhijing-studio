const views=[
 ['正面竖幅空间主图','front','centered foot-end, camera level at 1.3m, look straight toward head'],
 ['左前竖幅空间主图','left','distant left foot corner, camera level at 1.4m, 30-degree diagonal toward head'],
 ['右前竖幅空间主图','right','distant right foot corner, camera level at 1.4m, 30-degree diagonal toward head'],
 ['窗侧竖幅空间主图','context','opposite window corner, camera level at 1.5m, gentle 25-degree diagonal toward head']
];
export function applyPortraitSpacePlan(shots,v,shuffle){
 if(v.ratio!=='3:4'||v.referenceAngle)return shots;
 const main=shots.map((s,i)=>s.shotKind==='main'?i:-1).filter(i=>i>=0);
 const count=Math.ceil(main.length*0.5);
 const preferred=main.filter(i=>!['overhead','head'].includes(shots[i].cameraAxis));
 const chosen=[...shuffle(preferred),...shuffle(main.filter(i=>!preferred.includes(i)))].slice(0,count);
 const pool=shuffle(views);
 return shots.map((shot,i)=>{
  const index=chosen.indexOf(i);if(index<0)return shot;
  const [name,axis,geometry]=pool[index%pool.length];
  return {...shot,portraitSpace:true,fullProductOverview:true,mainFraming:'context',cameraAxis:axis,camera:[name,geometry+'. COMPLETE BEDDING OVERVIEW: 3:4竖幅空间主图，28–35mm校正广角。所选PRODUCT主体完整置画面中下部，四周留边；上方35–45%展示真实墙窗、天花与光影，不加空白。平视退远，不俯拍、裁切、拉大前景或缩床，保留原花型工艺。']};
 });
}
