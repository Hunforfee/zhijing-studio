import {canvas,drawFit,pixels,putPixels,loadImage} from './textile-tools-image.js';
export function imageThumbnail(source,maxEdge=768){const scale=Math.min(1,maxEdge/Math.max(source.width,source.height)),target=canvas(Math.max(1,Math.round(source.width*scale)),Math.max(1,Math.round(source.height*scale)));target.getContext('2d').drawImage(source,0,0,target.width,target.height);return target.toDataURL('image/png');}
export function offsetPattern(source,reverse=false){const width=source.width,height=source.height,x=Math.floor(width/2)*(reverse?-1:1),y=Math.floor(height/2)*(reverse?-1:1),target=canvas(width,height),context=target.getContext('2d');for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)context.drawImage(source,x+ox*width,y+oy*height);return target;}
export function repairedPattern(reference,candidate){
  const scaled=canvas(reference.width,reference.height);drawFit(scaled.getContext('2d'),candidate,0,0,scaled.width,scaled.height,false);
  const original=pixels(reference),generated=pixels(scaled),output=new Uint8ClampedArray(original.data),w=reference.width,h=reference.height;
  // Preserve the outer border and all pixels outside the central seam cross.
  // Moving the accepted repair back places that repaired cross on the tile edges.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=(x+.5)/w,v=(y+.5)/h,d=Math.min(Math.abs(u-.5),Math.abs(v-.5)),cross=Math.max(0,Math.min(1,(.14-d)/.035)),border=Math.max(0,Math.min(1,Math.min(u,v,1-u,1-v)/.07)),amount=cross*border;if(!amount)continue;const index=(y*w+x)*4;for(let c=0;c<3;c++)output[index+c]=original.data[index+c]*(1-amount)+generated.data[index+c]*amount;}
  const target=canvas(w,h);putPixels(target,{width:w,height:h,data:output});return offsetPattern(target,true);
}
export async function imageFromResult(url){if(!/^\/api\/free\/documents\/[a-f0-9-]{36}\/images\/(?:original|[a-f0-9-]{36})$/.test(url))throw Error('图片结果地址无效');const response=await fetch(url);if(!response.ok)throw Error('AI 结果暂时无法读取，请再次检查任务');return (await loadImage(new File([await response.blob()],'AI结果.png',{type:'image/png'}),4096)).canvas;}
