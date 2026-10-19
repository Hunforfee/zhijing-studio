import {specLines} from './ecommerce-core.js';
const font='"Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
function round(ctx,x,y,w,h,r=12){ctx.beginPath();ctx.roundRect(x,y,Math.max(0,w),Math.max(0,h),r);}
function panel(ctx,x,y,w,h,color,r=12){ctx.fillStyle=color;round(ctx,x,y,w,h,r);ctx.fill();}
function photo(ctx,image,x,y,w,h){if(!image)return;const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,s=Math.min(w/iw,h/ih),dw=iw*s,dh=ih*s;ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function lines(ctx,text,width){const rows=[];let row='';for(const c of String(text)){if(c==='\n'){rows.push(row);row='';continue;}if(row&&ctx.measureText(row+c).width>width){rows.push(row);row='';}row+=c;}rows.push(row);return rows;}
function block(ctx,text,x,y,w,h,size,color,weight=400){if(!text)return;let actual=size,rows;do{ctx.font=weight+' '+actual+'px '+font;rows=lines(ctx,text,w);if(rows.length*actual*1.5<=h)break;actual-=2;}while(actual>14);ctx.fillStyle=color;ctx.textBaseline='top';const leading=actual*1.5;rows.forEach((row,i)=>{if((i+1)*leading<=h+1)ctx.fillText(row,x,y+i*leading);});}
function arrow(ctx,x1,y1,x2,y2,color,size=8){ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();const angle=Math.atan2(y2-y1,x2-x1);for(const [x,y,a]of [[x1,y1,angle],[x2,y2,angle+Math.PI]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a-.45)*size,y+Math.sin(a-.45)*size);ctx.lineTo(x+Math.cos(a+.45)*size,y+Math.sin(a+.45)*size);ctx.closePath();ctx.fill();}ctx.restore();}
export function artworkSize(design){const [rw,rh]=design.ratio.split(':').map(Number),edge=Number(design.edge);return {width:Math.round(edge*rw/Math.max(rw,rh)),height:Math.round(edge*rh/Math.max(rw,rh))};}
export function renderCommerce(canvas,{tool,facts,images,design,variant,sizeCopy={},skuLabels={}}){
  if(tool==='sku'){const source=images[variant?.imageIndex??0]?.image||images[0]?.image;canvas.width=source?.naturalWidth||source?.width||1;canvas.height=source?.naturalHeight||source?.height||1;if(source)canvas.getContext('2d').drawImage(source,0,0);return {width:canvas.width,height:canvas.height};}
  const {width:W,height:H}=artworkSize(design);canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.fillStyle=design.background;ctx.fillRect(0,0,W,H);ctx.textBaseline='top';
  const M=W*.055,ink=design.ink,accent=design.accent,landscape=W>H*1.2;
  const source=images[variant?.imageIndex??0]?.image||images[0]?.image;
  const brand=facts.brand||'PRODUCT COLLECTION';
  block(ctx,brand,M,H-M*.66,W-M*2,M*.6,Math.max(13,W*.012),accent,500);
  if(facts.code)block(ctx,facts.code,W*.64,H-M*.66,W*.3,M*.6,Math.max(13,W*.012),accent);
  if(tool==='marketing'){
    const headline=design.headline||facts.name||'把日常，铺成喜欢。',subline=design.subline,badge=design.badge||facts.campaign;
    if(design.layout==='split'){
      panel(ctx,M,H*.08,W*.53,H*.79,'#ffffff',W*.012);photo(ctx,source,M+W*.015,H*.1,W*.5,H*.75);
      block(ctx,headline,W*.64,H*.18,W*.3,H*.3,W*.058,ink,600);
      block(ctx,subline,W*.64,H*.51,W*.3,H*.17,W*.025,ink);
      if(facts.price){block(ctx,'¥ '+facts.price,W*.64,H*.73,W*.3,H*.1,W*.055,accent,600);}
      block(ctx,badge,W*.64,H*.65,W*.3,H*.06,W*.018,accent,500);
    }else if(design.layout==='catalog'){
      panel(ctx,M,H*.055,W-M*2,H*.64,'#ffffff',W*.012);photo(ctx,source,M+W*.015,H*.07,W-M*2-W*.03,H*.61);
      block(ctx,headline,M,H*.73,facts.price?W*.62:W-M*2,H*.1,W*.05,ink,600);
      block(ctx,subline,M,H*.84,W*.65,H*.075,W*.022,ink);
      block(ctx,badge,W*.69,H*.84,W*.25,H*.065,W*.018,accent,500);
      if(facts.price)block(ctx,'¥ '+facts.price,W*.74,H*.74,W*.2,H*.08,W*.045,accent,600);
    }else{
      block(ctx,headline,M,H*.055,W-M*2,H*.115,Math.min(W*.065,H*.09),ink,600);
      block(ctx,subline,M,H*.18,W-M*2,H*.07,Math.min(W*.025,H*.04),ink);
      const photoY=subline ? .26 : .20,photoH=.82-photoY;
      panel(ctx,M,H*photoY,W-M*2,H*photoH,'#ffffff',W*.012);photo(ctx,source,M+W*.015,H*(photoY+.015),W-M*2-W*.03,H*(photoH-.03));
      ctx.fillStyle=accent;ctx.fillRect(M,H*.86,W*.045,3);
      block(ctx,badge,M+W*.065,H*.846,W*.55,H*.055,W*.02,accent,500);
      if(facts.price)block(ctx,'¥ '+facts.price,W*.72,H*.843,W*.23,H*.07,W*.047,accent,600);
    }
  }else if(tool==='size'){
    block(ctx,sizeCopy.title||'尺寸怎么选',M,H*.045,W-M*2,H*.075,Math.min(W*.055,H*.075),ink,600);
    block(ctx,sizeCopy.intro||[facts.name,variant?.name||'规格说明'].filter(Boolean).join(' · '),M,H*.13,W-M*2,H*.06,Math.min(W*.025,H*.035),ink);
    const dx=M,dy=H*.24,dw=landscape?W*.42:W*.59,dh=H*.32;
    ctx.strokeStyle=accent;ctx.lineWidth=Math.max(2,W*.003);round(ctx,dx+dw*.13,dy,dw*.76,dh*.86,W*.012);ctx.stroke();
    ctx.globalAlpha=.10;panel(ctx,dx+dw*.13,dy+dh*.25,dw*.76,dh*.61,accent,4);ctx.globalAlpha=1;
    if(['四件套','床单','床笠'].includes(facts.category))for(let i=0;i<Math.min(4,variant?.pillowCount||0);i++){const count=Math.min(4,variant.pillowCount);round(ctx,dx+dw*(.19+i*.64/count),dy+dh*.08,dw*.54/count,dh*.14,W*.006);ctx.stroke();}
    if(variant?.bedWidth){arrow(ctx,dx+dw*.13,dy+dh*.98,dx+dw*.89,dy+dh*.98,accent,W*.009);block(ctx,'床宽 '+variant.bedWidth+' cm',dx+dw*.14,dy+dh*1.03,dw*.8,H*.04,W*.023,ink);}
    const diagramSize=facts.category==='枕芯'&&variant?.pillowWidth&&variant.pillowLength?variant.pillowWidth+' × '+variant.pillowLength+' cm':['床单','床笠'].includes(facts.category)&&variant?.sheetWidth&&variant.sheetLength?variant.sheetWidth+' × '+variant.sheetLength+' cm':variant?.coverWidth&&variant.coverLength?variant.coverWidth+' × '+variant.coverLength+' cm':'';
    if(diagramSize)block(ctx,diagramSize,dx+dw*.2,dy+dh*.45,dw*.64,dh*.2,W*.022,ink,500);
    const rows=specLines(variant,facts.category),tx=landscape?W*.56:W*.67,tw=landscape?W*.38:W*.28;
    rows.slice(0,7).forEach(([name,value],i)=>{block(ctx,name,tx,dy+i*H*.055,tw,H*.025,W*.017,accent,500);block(ctx,value,tx,dy+i*H*.055+H*.024,tw,H*.03,W*.021,ink);});
    block(ctx,'尺寸示意 · 以填写的标注数值为准',M,H*.68,W-M*2,H*.035,W*.018,accent);
    const tips=(sizeCopy.tips||[]).slice(0,4);tips.forEach((tip,i)=>block(ctx,'· '+tip,M,H*.74+i*H*.045,W-M*2,H*.042,Math.min(W*.021,H*.03),ink));
  }
  return {width:W,height:H};
}
