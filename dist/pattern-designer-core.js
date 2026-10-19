export const patternMotifs=Object.freeze({flower:'小雏菊',petal:'六瓣花',leaf:'枝叶',dot:'圆点',diamond:'菱形',image:'上传元素'});
export const repeatFactors=Object.freeze({straight:[1,1],halfdrop:[2,1],brick:[1,2],mirror:[2,2]});
const color=value=>/^#[a-f\d]{6}$/i.test(value);
const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
export const xmlEscape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
export function newPatternDocument(){return {version:1,id:globalThis.crypto.randomUUID(),name:'我的家纺花稿',widthCm:32,heightCm:32,dpi:300,repeat:'straight',background:'#F5F2E7',transparent:false,palette:['#889979','#C3AB84','#D6B8A7','#EFE7CF'],seed:'spring-01',elements:[]};}
export function validatePatternProject(value){
  if(!value||value.version!==1||typeof value.id!=='string'||value.id.length>80||typeof value.name!=='string'||value.name.length>80)throw Error('工程格式或版本不受支持');
  if(!finite(value.widthCm,1,150)||!finite(value.heightCm,1,150)||![72,150,300,600].includes(value.dpi)||!Object.hasOwn(repeatFactors,value.repeat)||!color(value.background)||typeof value.transparent!=='boolean')throw Error('画稿尺寸、颜色或连续方式无效');
  if(!Array.isArray(value.palette)||value.palette.length!==4||value.palette.some(item=>!color(item))||typeof value.seed!=='string'||value.seed.length>40)throw Error('画稿配色或随机种子无效');
  if(!Array.isArray(value.elements)||value.elements.length>120)throw Error('每张花稿最多 120 个图层');
  const assets=value.assets||{},assetKeys=Object.keys(assets);if(assetKeys.length>40)throw Error('图片素材过多，请分开保存工程');
  let bytes=0;for(const key of assetKeys){const asset=assets[key];if(key.length>80||typeof asset!=='string'||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(asset))throw Error('工程只能包含内嵌的 PNG、JPG 或 WebP 图片');bytes+=asset.length;}if(bytes>32*1024*1024)throw Error('工程图片总量超过限制，请减少素材');
  const seen=new Set();for(const item of value.elements){if(!item||typeof item.id!=='string'||item.id.length>80||seen.has(item.id)||typeof item.name!=='string'||item.name.length>80||!Object.hasOwn(patternMotifs,item.type))throw Error('图层信息无效');seen.add(item.id);
    for(const [key,min,max]of [['x',0,1],['y',0,1],['size',.005,2],['aspect',.05,20],['rotation',-36000,36000],['opacity',0,1]])if(!finite(item[key],min,max))throw Error('图层位置、尺寸或透明度无效');
    if(!color(item.color)||!color(item.secondary)||['visible','locked','flipX','flipY'].some(key=>typeof item[key]!=='boolean'))throw Error('图层颜色或状态无效');
    if(item.type==='image'&&(!Object.hasOwn(assets,item.assetId)||typeof item.assetId!=='string'))throw Error('图片图层缺少素材');
    if(item.size*value.widthCm/item.aspect>value.heightCm*2.000001)throw Error('元素高度不能超过基础花回的两倍，请缩小元素后调整花回');
  }
  const copy=JSON.parse(JSON.stringify(value));delete copy.ai;return copy;
}
export function patternResolution(doc){
  const [fx,fy]=repeatFactors[doc.repeat],width=Math.round(doc.widthCm*doc.dpi/2.54*fx),height=Math.round(doc.heightCm*doc.dpi/2.54*fy);
  if(width>8192||height>8192||width*height>32*1024*1024)throw Error(`当前循环导出为 ${width} × ${height} px，超过 8192 边长或 3200 万像素限制；请减小花回尺寸或 DPI`);
  return {width,height,widthCm:doc.widthCm*fx,heightCm:doc.heightCm*fy,dpi:doc.dpi};
}
export function seededRandom(seed){let state=2166136261;for(const char of String(seed)){state^=char.charCodeAt(0);state=Math.imul(state,16777619);}return ()=>{state+=0x6D2B79F5;let value=state;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return ((value^(value>>>14))>>>0)/4294967296;};}
export function makeMotif(type,doc){if(!Object.hasOwn(patternMotifs,type)||type==='image')throw Error('请选择有效花卉元素');const aspect=type==='leaf'?.62:1;return {id:globalThis.crypto.randomUUID(),name:patternMotifs[type],type,x:.5,y:.5,size:Math.max(.005,Math.min(type==='leaf'?.18:.13,doc.heightCm/doc.widthCm*aspect)),aspect,rotation:0,color:doc.palette[0],secondary:doc.palette[1],opacity:1,visible:true,locked:false,flipX:false,flipY:false};}
export function scatterElements(elements,seed){const random=seededRandom(seed),placed=[];return elements.map(item=>{if(item.locked)return {...item};let x,y;for(let attempt=0;attempt<90;attempt++){x=random();y=random();if(placed.every(point=>{const dx=Math.min(Math.abs(point[0]-x),1-Math.abs(point[0]-x)),dy=Math.min(Math.abs(point[1]-y),1-Math.abs(point[1]-y));return Math.hypot(dx,dy)>.12;}))break;}placed.push([x,y]);return {...item,x,y,rotation:Math.round(random()*360)};});}
export function motifSVG(item){
  const a=item.color,b=item.secondary;
  if(item.type==='flower')return Array.from({length:9},(_,i)=>`<ellipse cx="0" cy="-.27" rx=".105" ry=".23" fill="${a}" transform="rotate(${i*40})"/>`).join('')+`<circle r=".13" fill="${b}"/><circle r=".05" fill="${a}" opacity=".35"/>`;
  if(item.type==='petal')return Array.from({length:6},(_,i)=>`<path d="M0 0C-.24-.12-.25-.5 0-.48C.25-.5.24-.12 0 0Z" fill="${a}" transform="rotate(${i*60})"/>`).join('')+`<circle r=".1" fill="${b}"/>`;
  if(item.type==='leaf')return `<path d="M-.13.49Q.1-.05.02-.49" fill="none" stroke="${b}" stroke-width=".022"/>`+[-.3,-.03,.24].map((y,i)=>`<path d="M0 ${y+.13}Q${i%2?'.42':'.38'} ${y+.08} .25 ${y-.12}Q.04 ${y-.19} 0 ${y+.13}Z" fill="${a}"/><path d="M.01 ${y+.08}Q-.39 ${y-.01}-.25 ${y-.21}Q-.04 ${y-.25}.01 ${y+.08}Z" fill="${a}"/>`).join('');
  if(item.type==='dot')return `<circle r=".43" fill="${a}"/>`;
  if(item.type==='diamond')return `<path d="M0-.48.42 0 0 .48-.42 0Z" fill="${a}"/><path d="M0-.26.22 0 0 .26-.22 0Z" fill="${b}"/>`;
  return '';
}
export function patternBaseSVG(doc,assets={}){
  const w=1000,h=1000*doc.heightCm/doc.widthCm;
  const shapes=doc.elements.filter(item=>item.visible).map(item=>{const width=item.size*w,height=width/item.aspect;return [-1,0,1].flatMap(ox=>[-1,0,1].map(oy=>`<g opacity="${item.opacity}" transform="translate(${(item.x+ox)*w} ${(item.y+oy)*h}) rotate(${item.rotation}) scale(${width*(item.flipX?-1:1)} ${height*(item.flipY?-1:1)})">${item.type==='image'?`<image href="${assets[item.assetId]||''}" x="-.5" y="-.5" width="1" height="1" preserveAspectRatio="none"/>`:motifSVG(item)}</g>`)).join('');}).join('');
  return {width:w,height:h,markup:(!doc.transparent?`<rect width="${w}" height="${h}" fill="${doc.background}"/>`:'')+shapes};
}
export function buildPatternSVG(doc,assets={}){
  const base=patternBaseSVG(doc,assets),[fx,fy]=repeatFactors[doc.repeat],w=base.width,h=base.height;
  const cell=(x,y,flipX=false,flipY=false)=>`<use href="#cell" transform="translate(${x+(flipX?w:0)} ${y+(flipY?h:0)}) scale(${flipX?-1:1} ${flipY?-1:1})"/>`;
  let content=cell(0,0);
  if(doc.repeat==='halfdrop')content+=cell(w,-h/2)+cell(w,h/2);
  if(doc.repeat==='brick')content+=cell(-w/2,h)+cell(w/2,h);
  if(doc.repeat==='mirror')content+=cell(w,0,true)+cell(0,h,false,true)+cell(w,h,true,true);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.widthCm*fx}cm" height="${doc.heightCm*fy}cm" viewBox="0 0 ${w*fx} ${h*fy}"><title>${xmlEscape(doc.name)}</title><desc>织景可编辑花稿 · ${doc.dpi} DPI 目标分辨率 · RGB 配色</desc><defs><clipPath id="cellClip"><rect width="${w}" height="${h}"/></clipPath><g id="cell" clip-path="url(#cellClip)">${base.markup}</g></defs>${content}</svg>`;
}
export function buildPatternPrompt(doc,prompt){if(typeof prompt!=='string'||!prompt.trim()||prompt.length>1200)throw Error('请填写 1–1200 字花型要求');return `Create a professional flat 2D textile print artwork using image 1 as the working pattern draft. User authorizes redesigned motifs and layout according to the following brief. No bedroom, no bedding mockup, no fabric folds, no shadows, no text or logos. Show print artwork only with even color and consistent motif language. Make opposite edges repeat continuously; do not add a frame. Palette reference: ${doc.palette.join(', ')}. Intended base repeat: ${doc.widthCm} × ${doc.heightCm} cm. Brief: ${prompt.trim()}. This is a creative draft; exact seamlessness will be checked in the repeat preview.`;}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function pngWithDpi(input,dpi){
  const bytes=new Uint8Array(input);if(bytes.length<33||[137,80,78,71,13,10,26,10].some((value,i)=>bytes[i]!==value)||!finite(dpi,1,1200))throw Error('PNG 或 DPI 无效');
  const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);view.setUint32(8,Math.round(dpi/.0254));view.setUint32(12,Math.round(dpi/.0254));chunk[16]=1;view.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts=[bytes.subarray(0,8)];let offset=8,inserted=false;
  while(offset<bytes.length){if(offset+12>bytes.length)throw Error('PNG 数据不完整');const length=new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0),end=offset+12+length;if(end>bytes.length)throw Error('PNG 数据不完整');const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(type!=='pHYs')parts.push(bytes.subarray(offset,end));if(type==='IHDR'&&!inserted){parts.push(chunk);inserted=true;}offset=end;}
  const output=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let cursor=0;for(const part of parts){output.set(part,cursor);cursor+=part.length;}return output;
}
