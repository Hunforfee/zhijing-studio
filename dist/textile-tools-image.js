import {safeFileName} from './textile-tools-core.js';
export function canvas(width,height){const element=document.createElement('canvas');element.width=width;element.height=height;return element;}
export async function loadImage(file,maxEdge=2048){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片');
  if(file.size>10*1024*1024)throw Error('单张图片请控制在 10 MB 以内');
  const url=URL.createObjectURL(file),image=new Image();
  try{image.src=url;await image.decode();if(image.naturalWidth>16000||image.naturalHeight>16000||image.naturalWidth*image.naturalHeight>64e6)throw Error('原图过大，请先缩小到 6400 万像素以内');const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight)),result=canvas(Math.max(1,Math.round(image.naturalWidth*scale)),Math.max(1,Math.round(image.naturalHeight*scale)));result.getContext('2d').drawImage(image,0,0,result.width,result.height);return {canvas:result,name:file.name,originalWidth:image.naturalWidth,originalHeight:image.naturalHeight};}
  catch(error){if(error.message.includes('原图过大'))throw error;throw Error('无法读取图片，请换一张有效的 JPG、PNG 或 WebP');}finally{URL.revokeObjectURL(url);}
}
export function putPixels(target,image){target.width=image.width;target.height=image.height;target.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);return target;}
export function pixels(source){return source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);}
export function canvasEdgeDifference(source){const context=source.getContext('2d'),pairs=[[context.getImageData(0,0,1,source.height).data,context.getImageData(source.width-1,0,1,source.height).data],[context.getImageData(0,0,source.width,1).data,context.getImageData(0,source.height-1,source.width,1).data]];let sum=0,count=0;for(const [a,b]of pairs)for(let index=0;index<a.length;index+=4)for(let channel=0;channel<3;channel++){sum+=Math.abs(a[index+channel]-b[index+channel]);count++;}return sum/count/255*100;}
export function drawFit(context,image,x,y,width,height,contain=false){
  const scale=(contain?Math.min:Math.max)(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
  context.save();context.beginPath();context.rect(x,y,width,height);context.clip();context.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);context.restore();
}
export function wrapText(context,text,x,y,maxWidth,lineHeight,maxLines=5){let row='',line=0;for(const char of String(text)){if(char==='\n'||context.measureText(row+char).width>maxWidth){context.fillText(row,x,y+line*lineHeight);line++;row='';if(line>=maxLines)return;}if(char!=='\n')row+=char;}if(line<maxLines)context.fillText(row,x,y+line*lineHeight);}
export function imageBlob(source,type='image/png',quality=.9){return new Promise((resolve,reject)=>source.toBlob(blob=>{if(!blob)return reject(Error('图片无法导出，请减小尺寸后重试'));if(blob.type!==type)return reject(Error('浏览器不支持该导出格式，请选择 PNG 或 JPG'));resolve(blob);},type,quality));}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=safeFileName(name);link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();return copied;}}
