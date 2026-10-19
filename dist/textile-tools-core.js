export const textileTools = [
  {id:'hd',name:'AI 花型高清处理',short:'AI高清',icon:'hd',tag:'修复与放大',description:'AI 辅助修复压缩噪点与模糊边缘，对比确认后放大导出。',note:'先核对 AI 候选中的花型与笔触，再采用并放大。本机放大不等同于恢复真实细节。'},
  {id:'extract',name:'AI 花型提取',short:'AI提取',icon:'crop',tag:'实拍转花稿',description:'选取面料区域，交给 AI 辅助去除褶皱光影、整理平面花稿。',note:'先拖动四角选择面料；AI 整理后对比原稿再采用，遮挡处与细小纹样需人工核对。'},
  {id:'recolor',name:'AI 花型配色',short:'AI配色',icon:'palette',tag:'三套配色提案',description:'AI 结合花型与风格给出三套配色，选中后直接换色并精修。',note:'AI 色卡用于视觉设计参考，不代表实物色号或印染标准；应用后仍可逐色调整。'},
  {id:'repeat',name:'AI 四方连续',short:'AI连续',icon:'grid',tag:'接缝修补',description:'把循环接缝移到中央，由 AI 辅助修补后检查平铺效果。',note:'仅合并接缝附近的修补区域，保留其余原稿。采用前请检查花型变化与四边接缝。'},
  {id:'board',name:'AI 灵感搭配',short:'AI搭配',icon:'board',tag:'选款提案',description:'AI 分析面料与空间，建议主次排序、色卡和搭配说明。',note:'上传 1–6 张图片，确认 AI 建议后生成可精修的搭配板；图片顺序与版式仍可调整。'},
  {id:'delivery',name:'AI 上架适配',short:'AI上架',icon:'download',tag:'交付建议',description:'AI 根据商品图片与用途推荐尺寸、比例及格式，再批量处理。',note:'每批最多 20 张、总计 100 MB。先确认建议参数，再处理并打包下载。'},
  {id:'copy',name:'AI 商品文案',short:'AI文案',icon:'text',tag:'真实卖点表达',description:'AI 根据你填写的真实商品信息撰写标题、卖点与介绍。',note:'不从照片推测成分、认证或功能承诺；AI 提案经你确认后采用，也可手动整理基础文案。'}
];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const rgbToHex=rgb=>'#'+rgb.slice(0,3).map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,'0')).join('').toUpperCase();
export function hexToRgb(value){if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('请选择有效的六位颜色');return [1,3,5].map(index=>parseInt(value.slice(index,index+2),16));}
const distance=(a,b)=>a.reduce((sum,value,index)=>sum+(value-b[index])**2,0);

export function extractPalette(data,count=6){
  count=clamp(Math.round(count),2,10);const bins=new Map(),step=Math.max(1,Math.floor(data.length/4/20000));
  for(let index=0;index<data.length;index+=4*step){if(data[index+3]<128)continue;const rgb=[data[index],data[index+1],data[index+2]],key=rgb.map(value=>value>>4).join(',');const bin=bins.get(key)||{sum:[0,0,0],weight:0};bin.weight++;rgb.forEach((value,i)=>bin.sum[i]+=value);bins.set(key,bin);}
  const points=[...bins.values()].map(bin=>({rgb:bin.sum.map(value=>value/bin.weight),weight:bin.weight})).sort((a,b)=>b.weight-a.weight);
  if(!points.length)throw Error('图片没有可分析的不透明颜色');
  const centers=[points[0].rgb];
  while(centers.length<Math.min(count,points.length)){
    let best=null,score=0;for(const point of points){const candidate=Math.min(...centers.map(center=>distance(point.rgb,center)))*Math.sqrt(point.weight);if(candidate>score){score=candidate;best=point.rgb;}}
    if(!best||score<1)break;centers.push(best);
  }
  let groups;
  for(let iteration=0;iteration<12;iteration++){
    groups=centers.map(()=>({sum:[0,0,0],weight:0}));
    for(const point of points){let nearest=0;centers.forEach((center,i)=>{if(distance(point.rgb,center)<distance(point.rgb,centers[nearest]))nearest=i;});const group=groups[nearest];group.weight+=point.weight;point.rgb.forEach((value,i)=>group.sum[i]+=value*point.weight);}
    groups.forEach((group,i)=>{if(group.weight)centers[i]=group.sum.map(value=>value/group.weight);});
  }
  const total=groups.reduce((sum,group)=>sum+group.weight,0);
  return centers.map((rgb,i)=>({hex:rgbToHex(rgb),rgb:rgb.map(Math.round),percent:groups[i].weight/total*100})).filter((_,i)=>groups[i].weight).sort((a,b)=>b.percent-a.percent);
}

export function recolorPixels(source,mappings,{tolerance=45,preserveLight=true}={}){
  tolerance=clamp(Number(tolerance)||1,1,180);const output=new Uint8ClampedArray(source),changes=mappings.filter(map=>map.from.toUpperCase()!==map.to.toUpperCase()).map(map=>({from:hexToRgb(map.from),to:hexToRgb(map.to)}));
  if(!changes.length)return output;
  for(let index=0;index<source.length;index+=4){if(!source[index+3])continue;const pixel=[source[index],source[index+1],source[index+2]];let nearest=null,error=Infinity;
    for(const mapping of changes){const current=Math.sqrt(distance(pixel,mapping.from));if(current<error){nearest=mapping;error=current;}}
    if(error>tolerance)continue;
    const strength=1-Math.max(0,(error/tolerance-.65)/.35),brightness=preserveLight?(pixel[0]*.2126+pixel[1]*.7152+pixel[2]*.0722)-(nearest.from[0]*.2126+nearest.from[1]*.7152+nearest.from[2]*.0722):0;
    for(let channel=0;channel<3;channel++)output[index+channel]=clamp(pixel[channel]*(1-strength)+(nearest.to[channel]+brightness)*strength,0,255);
  }
  return output;
}

export function validateQuad(points){
  if(!Array.isArray(points)||points.length!==4||points.some(point=>!Array.isArray(point)||point.length!==2||point.some(value=>!Number.isFinite(value)||value<0||value>1)))throw Error('请把四个角放在图片范围内');
  let area=0;
  for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=.00001)throw Error('四个角需按左上、右上、右下、左下排列，不能交叉');area+=a[0]*b[1]-a[1]*b[0];}
  if(area/2<.005)throw Error('选区太小，请扩大面料区域');return points;
}
export function projectiveTransform(points){
  validateQuad(points);const corners=[[0,0],[1,0],[1,1],[0,1]],matrix=[];
  corners.forEach(([u,v],i)=>{const [x,y]=points[i];matrix.push([u,v,1,0,0,0,-u*x,-v*x,x],[0,0,0,u,v,1,-u*y,-v*y,y]);});
  for(let col=0;col<8;col++){let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;if(Math.abs(matrix[pivot][col])<1e-10)throw Error('无法校正这个选区，请重新选角');[matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];const scale=matrix[col][col];for(let i=col;i<9;i++)matrix[col][i]/=scale;for(let row=0;row<8;row++)if(row!==col){const amount=matrix[row][col];for(let i=col;i<9;i++)matrix[row][i]-=matrix[col][i]*amount;}}
  const h=matrix.map(row=>row[8]);return (u,v)=>{const denominator=h[6]*u+h[7]*v+1;return [(h[0]*u+h[1]*v+h[2])/denominator,(h[3]*u+h[4]*v+h[5])/denominator];};
}
function sample(data,width,height,x,y,output,index){
  x=clamp(x,0,width-1);y=clamp(y,0,height-1);const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,width-1),y1=Math.min(y0+1,height-1),dx=x-x0,dy=y-y0;
  for(let channel=0;channel<4;channel++){const top=data[(y0*width+x0)*4+channel]*(1-dx)+data[(y0*width+x1)*4+channel]*dx,bottom=data[(y1*width+x0)*4+channel]*(1-dx)+data[(y1*width+x1)*4+channel]*dx;output[index+channel]=top*(1-dy)+bottom*dy;}
}
export function rectifyPixels(source,points,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<16||height<16||width>2048||height>2048)throw Error('导出宽高应为 16–2048 像素');const project=projectiveTransform(points),output=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const [u,v]=project(x/(width-1),y/(height-1));sample(source.data,source.width,source.height,u*(source.width-1),v*(source.height-1),output,(y*width+x)*4);}
  return {data:output,width,height};
}
export function repeatPixels(source,mode='mirror',size=1024){
  if(!['mirror','straight','halfdrop'].includes(mode)||![512,1024,2048].includes(Number(size)))throw Error('请选择有效的连续方式和尺寸');
  const width=Number(size),height=Math.max(16,Math.round(width*source.height/source.width*(mode==='halfdrop'?.5:1)));
  if(height>4096||width*height>8388608)throw Error('图片过于狭长，请先提取接近方形的花型区域');
  const output=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let u=(x+.5)/width,v=(y+.5)/height;
    if(mode==='mirror'){u=u<=.5?u*2:2-u*2;v=v<=.5?v*2:2-v*2;}
    else if(mode==='halfdrop'){const column=u>=.5?1:0;u=(u*2)%1;v=(v+column*.5)%1;}
    sample(source.data,source.width,source.height,u*(source.width-1),v*(source.height-1),output,(y*width+x)*4);
  }
  return {data:output,width,height};
}
export function edgeDifference(image){let sum=0,count=0;for(let y=0;y<image.height;y++)for(let c=0;c<3;c++){sum+=Math.abs(image.data[(y*image.width)*4+c]-image.data[(y*image.width+image.width-1)*4+c]);count++;}for(let x=0;x<image.width;x++)for(let c=0;c<3;c++){sum+=Math.abs(image.data[x*4+c]-image.data[((image.height-1)*image.width+x)*4+c]);count++;}return sum/count/255*100;}
export function deliveryDimensions(width,height,maxEdge=1600,ratio='source',upscale=false){
  if(!Number.isFinite(maxEdge)||maxEdge<320||maxEdge>4096)throw Error('最长边应为 320–4096 像素');
  const ratios={source:width/height,'1:1':1,'3:4':.75,'4:3':4/3,'9:16':9/16,'16:9':16/9};if(!ratios[ratio])throw Error('请选择有效比例');const aspect=ratios[ratio];
  const edge=upscale?maxEdge:Math.min(maxEdge,Math.max(width,height));
  return {width:Math.max(1,Math.round(aspect>=1?edge:edge*aspect)),height:Math.max(1,Math.round(aspect>=1?edge/aspect:edge))};
}
export const safeFileName=value=>(String(value||'织景').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,70)||'织景');
export function createProductCopy(value){
  const field=(name,limit)=>{const text=String(value[name]||'').trim();if(text.length>limit)throw Error('填写内容过长，请精简后再生成');return text;};
  const name=field('name',40);if(!name)throw Error('请先填写商品名称');
  const product=field('product',30),material=field('material',80),size=field('size',100),craft=field('craft',100),features=field('features',300),audience=field('audience',40),tone=field('tone',20);
  const facts=[material&&'面料信息：'+material,size&&'尺寸信息：'+size,craft&&'工艺细节：'+craft,...features.split(/[\n；;]/).map(text=>text.trim()).filter(Boolean)].filter(Boolean);
  const titles=[name,[name,material,craft].filter(Boolean).join('｜').slice(0,100),[name,audience&&'适合'+audience,product].filter(Boolean).join(' · ').slice(0,100)];
  const introduction=tone==='social'?`给日常换一个喜欢的模样。\n今天想分享的是「${name}」。`:tone==='live'?`这一款是「${name}」，我们按商品信息逐项看：`:`${name}\n${product?'商品类别：'+product:''}`;
  const body=[introduction,...facts,audience&&'适用人群 / 场景：'+audience].filter(Boolean).join('\n');
  const bullets=facts.length?facts:['花型、颜色与款式请结合商品图片确认。'];
  return {titles,bullets,body,text:'标题参考\n'+titles.map((title,i)=>(i+1)+'. '+title).join('\n')+'\n\n商品信息与卖点\n'+bullets.map(item=>'· '+item).join('\n')+'\n\n商品介绍\n'+body};
}
