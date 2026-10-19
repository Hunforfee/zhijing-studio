import {safeFileName} from './textile-tools-core.js';
import {imageLimits,validateImageSize,imageHeader,printMetadata,setPrintMetadata,resizedPrintMetadata,pngWithPrintMetadata} from './textile-print-metadata.js';
export {printMetadata,setPrintMetadata,resizedPrintMetadata};
export function canvas(width,height){validateImageSize(width,height);const element=document.createElement('canvas');element.width=width;element.height=height;return element;}
export function canvasFile(source,name='花型.png'){validateImageSize(source.width,source.height);const file=new File([],name,{type:'image/png'});file.sourceCanvas=source;file.printMetadata=printMetadata(source);return file;}
export async function loadImage(file,maxEdge=2048){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片');
  if(file.size>imageLimits.bytes)throw Error('单张工作素材请控制在 32 MB 以内');
  if(maxEdge!==Infinity&&(!Number.isFinite(maxEdge)||maxEdge<=0))throw Error('工作尺寸限制无效');
  if(file.sourceCanvas instanceof HTMLCanvasElement){const source=file.sourceCanvas;validateImageSize(source.width,source.height);const scale=Math.min(1,maxEdge/Math.max(source.width,source.height)),target=canvas(Math.max(1,Math.round(source.width*scale)),Math.max(1,Math.round(source.height*scale)));target.getContext('2d').drawImage(source,0,0,target.width,target.height);setPrintMetadata(target,resizedPrintMetadata(file.printMetadata||printMetadata(source),source,target));return {canvas:target,name:file.name,originalWidth:source.width,originalHeight:source.height,printMetadata:printMetadata(target)};}
  const header=imageHeader(await file.arrayBuffer());
  const url=URL.createObjectURL(file),image=new Image();
  try{image.src=url;await image.decode();validateImageSize(image.naturalWidth,image.naturalHeight);const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight)),result=canvas(Math.max(1,Math.round(image.naturalWidth*scale)),Math.max(1,Math.round(image.naturalHeight*scale)));result.getContext('2d').drawImage(image,0,0,result.width,result.height);setPrintMetadata(result,resizedPrintMetadata(file.printMetadata||header.printMetadata,{width:image.naturalWidth,height:image.naturalHeight},result));return {canvas:result,name:file.name,originalWidth:image.naturalWidth,originalHeight:image.naturalHeight,printMetadata:printMetadata(result)};}
  catch(error){if(/原图|限制|尺寸无效/.test(error.message))throw error;throw Error('无法读取图片，请换一张有效的 JPG、PNG 或 WebP');}finally{URL.revokeObjectURL(url);}
}
export function putPixels(target,image){target.width=image.width;target.height=image.height;target.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);return target;}
export function pixels(source){return source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);}
export function canvasEdgeDifference(source){const context=source.getContext('2d'),pairs=[[context.getImageData(0,0,1,source.height).data,context.getImageData(source.width-1,0,1,source.height).data],[context.getImageData(0,0,source.width,1).data,context.getImageData(0,source.height-1,source.width,1).data]];let sum=0,count=0;for(const [a,b]of pairs)for(let index=0;index<a.length;index+=4)for(let channel=0;channel<3;channel++){sum+=Math.abs(a[index+channel]-b[index+channel]);count++;}return sum/count/255*100;}
export function drawFit(context,image,x,y,width,height,contain=false){
  const scale=(contain?Math.min:Math.max)(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
  context.save();context.beginPath();context.rect(x,y,width,height);context.clip();context.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);context.restore();
}
export function wrapText(context,text,x,y,maxWidth,lineHeight,maxLines=5){let row='',line=0;for(const char of String(text)){if(char==='\n'||context.measureText(row+char).width>maxWidth){context.fillText(row,x,y+line*lineHeight);line++;row='';if(line>=maxLines)return;}if(char!=='\n')row+=char;}if(line<maxLines)context.fillText(row,x,y+line*lineHeight);}
export async function imageBlob(source,type='image/png',quality=.9){validateImageSize(source.width,source.height);const print=printMetadata(source);const blob=await new Promise((resolve,reject)=>source.toBlob(blob=>{if(!blob)return reject(Error('图片无法导出，请减小尺寸后重试'));if(blob.type!==type)return reject(Error('浏览器不支持该导出格式，请选择 PNG 或 JPG'));resolve(blob);},type,quality));return type==='image/png'&&print?new Blob([pngWithPrintMetadata(await blob.arrayBuffer(),print)],{type}):blob;}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=safeFileName(name);link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();return copied;}}
