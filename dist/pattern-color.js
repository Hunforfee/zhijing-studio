// Pixel-based palette; no model guesses or recoloring of the uploaded reference.
export function extractPalette(rgba,limit=5){
  const bins=new Map();let total=0;
  for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<128)continue;const rgb=[rgba[i],rgba[i+1],rgba[i+2]],key=rgb.map(v=>v>>4).join(',');let b=bins.get(key);if(!b){b={count:0,sum:[0,0,0]};bins.set(key,b)}b.count++;rgb.forEach((v,j)=>b.sum[j]+=v);total++}
  if(!total)return [];
  const groups=[];
  for(const b of [...bins.values()].sort((a,b)=>b.count-a.count)){
    const rgb=b.sum.map(v=>v/b.count);const nearby=groups.find(g=>Math.hypot(...g.sum.map((v,j)=>v/g.count-rgb[j]))<28);
    if(nearby){nearby.count+=b.count;b.sum.forEach((v,j)=>nearby.sum[j]+=v)}else groups.push({...b,sum:[...b.sum]});
  }
  return groups.sort((a,b)=>b.count-a.count).filter((g,i)=>i<2||g.count/total>=0.01).slice(0,limit).map(g=>({hex:'#'+g.sum.map(v=>Math.round(v/g.count).toString(16).padStart(2,'0')).join(''),percent:Math.round(g.count/total*100)}));
}
export function colorConstraint(palette,notes=''){
  if(!palette.length)return notes;
  return `Authoritative fabric palette from source pixels: ${palette.map(c=>c.hex+' '+c.percent+'%').join(',')}. Keep these colors and motif shapes; no new motifs, no recoloring, neutral light, no warm filter. Client: ${notes}`;
}
