function productSubmenuPlacement(rect,preferredWidth,height,viewportWidth,viewportHeight,minimumSide=360){
  const margin=12,gap=10,maxHeight=Math.max(0,viewportHeight-margin*2);
  let width=Math.min(preferredWidth,viewportWidth-margin*2),left=rect.right+gap,beside=true;
  const rightRoom=viewportWidth-left-margin;
  if(rightRoom>=minimumSide)width=Math.min(width,rightRoom);
  else if(rect.left>=width+margin+gap)left=rect.left-width-gap;
  else{beside=false;left=rect.left+(rect.width-width)/2;}
  left=Math.max(margin,Math.min(left,viewportWidth-width-margin));
  const shownHeight=Math.min(height,maxHeight),desiredTop=beside?rect.top+(rect.height-shownHeight)/2:rect.bottom+8;
  const top=Math.max(margin,Math.min(desiredTop,viewportHeight-shownHeight-margin));
  return {width,left,top,maxHeight};
}
function placeProductSubmenu(panel,trigger,preferredWidth=590,minimumSide=360){
  if(!trigger)return;
  if(document.documentElement.dataset.uiScheme==='B'){
    const width=Math.min(preferredWidth,innerWidth-32),maxHeight=innerHeight-40;
    panel.style.width=width+'px';panel.style.maxHeight=maxHeight+'px';
    panel.style.left=Math.max(16,(innerWidth-width)/2)+'px';
    panel.style.top=Math.max(20,(innerHeight-Math.min(panel.offsetHeight,maxHeight))/2)+'px';
    panel.setAttribute('role','dialog');return;
  }
  const menu=document.getElementById('products')||trigger,rect=menu.getBoundingClientRect();
  let point=productSubmenuPlacement(rect,preferredWidth,0,innerWidth,innerHeight,minimumSide);
  panel.style.width=point.width+'px';panel.style.maxHeight=point.maxHeight+'px';
  point=productSubmenuPlacement(rect,preferredWidth,panel.offsetHeight,innerWidth,innerHeight,minimumSide);
  panel.style.left=point.left+'px';panel.style.top=point.top+'px';
}
