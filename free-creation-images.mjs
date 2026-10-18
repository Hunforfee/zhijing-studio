import {PNG} from 'pngjs';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
export function decodeFreePng(bytes,maxBytes=25*1024*1024){
  if(!Buffer.isBuffer(bytes)||bytes.length<33||bytes.length>maxBytes||!bytes.subarray(0,8).equals(signature))throw Error('图片必须是有效的 PNG，且不超过大小限制');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<1||height<1||width>8192||height>8192||width*height>16*1024*1024)throw Error('图片尺寸过大，请缩小后上传');
  try{return PNG.sync.read(bytes,{checkCRC:true});}catch{throw Error('图片数据不完整，请重新上传');}
}
export function freeImageData(value){
  if(typeof value!=='string'||value.length>14*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('请上传 10 MB 以内的有效图片');
  const bytes=Buffer.from(value.slice(value.indexOf(',')+1),'base64'),image=decodeFreePng(bytes,10*1024*1024);
  return {bytes,width:image.width,height:image.height};
}
export function preserveOutsideRegion(sourceBytes,resultBytes,region){
  const source=decodeFreePng(sourceBytes),result=decodeFreePng(resultBytes);
  const output=new PNG({width:source.width,height:source.height});source.data.copy(output.data);
  const left=Math.floor(region.x*source.width),top=Math.floor(region.y*source.height);
  const right=Math.min(source.width,Math.ceil((region.x+region.width)*source.width)),bottom=Math.min(source.height,Math.ceil((region.y+region.height)*source.height));
  const feather=Math.max(1,Math.min(12,Math.round(Math.min(right-left,bottom-top)*.05)));
  // Resample the returned full frame, blending only inside the selected rectangle.
  // Pixels outside it are copied byte-for-byte from the decoded source.
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const rx=Math.max(0,Math.min(result.width-1,(x+.5)*result.width/source.width-.5)),ry=Math.max(0,Math.min(result.height-1,(y+.5)*result.height/source.height-.5));
    const x0=Math.floor(rx),y0=Math.floor(ry),x1=Math.min(x0+1,result.width-1),y1=Math.min(y0+1,result.height-1),dx=rx-x0,dy=ry-y0;
    const fade=Math.min(1,(x-left+1)/feather,(right-x)/feather,(y-top+1)/feather,(bottom-y)/feather),target=(y*source.width+x)*4;
    for(let channel=0;channel<4;channel++){
      const a=result.data[(y0*result.width+x0)*4+channel]*(1-dx)+result.data[(y0*result.width+x1)*4+channel]*dx;
      const b=result.data[(y1*result.width+x0)*4+channel]*(1-dx)+result.data[(y1*result.width+x1)*4+channel]*dx;
      output.data[target+channel]=Math.round(source.data[target+channel]*(1-fade)+(a*(1-dy)+b*dy)*fade);
    }
  }
  return PNG.sync.write(output);
}
