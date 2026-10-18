// Use the very same photograph as the scene chip; never substitute another room.
(() => {
  const list=document.getElementById('scenes');if(!list)return;
  const preview=document.createElement('div');preview.id='sceneImagePreview';preview.className='scene-hover-preview';preview.hidden=true;preview.setAttribute('role','tooltip');
  const photo=document.createElement('img'),caption=document.createElement('strong');
  preview.append(photo,caption);document.body.append(preview);
  let ticket=0,current=null,timer;
  function hide(){ticket++;clearTimeout(timer);preview.hidden=true;if(current)current.removeAttribute('aria-describedby');current=null;}
  function place(button){
    const width=Math.min(240,innerWidth-24),height=width+40,r=button.getBoundingClientRect();
    if(!button.isConnected||r.bottom<=0||r.top>=innerHeight){hide();return false;}
    let left=r.right+12;if(left+width>innerWidth-12)left=r.left-width-12;
    preview.style.width=width+'px';preview.style.left=Math.max(12,Math.min(left,innerWidth-width-12))+'px';
    preview.style.top=Math.max(12,Math.min(r.top+(r.height-height)/2,innerHeight-height-12))+'px';return true;
  }
  function show(button){
    if(button===current)return;
    hide();const thumb=button.querySelector('.scene-mini-thumb');if(!thumb)return;
    current=button;const turn=++ticket;
    timer=setTimeout(async()=>{
      const name=button.querySelector('.scene-label').textContent.replace('✓','').trim();
      caption.textContent=name;photo.alt=name+'实景预览';photo.src=thumb.src;
      try{await photo.decode();}catch{if(turn===ticket)hide();return;}
      if(turn!==ticket||!button.isConnected)return;
      if(!place(button))return;
      button.setAttribute('aria-describedby',preview.id);preview.hidden=false;
    },160);
  }
  list.addEventListener('pointerover',e=>{const button=e.target.closest('[data-scene]');if(button)show(button);});
  list.addEventListener('pointerleave',hide);
  list.addEventListener('focusin',e=>{const button=e.target.closest('[data-scene]');if(button)show(button);});
  list.addEventListener('focusout',hide);
  document.addEventListener('pointerdown',hide,true);
  document.addEventListener('scroll',()=>{if(current&&!preview.hidden)place(current);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  window.addEventListener('resize',hide);
})();
