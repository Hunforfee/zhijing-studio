import {splitPhotoVersions} from './image-versions.js?v=20261011-latest-versions1';
import {splitDetailVersions} from './detail-slice-versions.js';

export const IMAGE_DOWNLOAD_FOLDERS=['最新作品','历史版本'];
export const DETAIL_DOWNLOAD_FOLDERS=['最新作品','历史版本'];
const safeName=value=>String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'')||'图片';
const extension=item=>item.canvas?'png':(/\.(png|jpe?g|webp)(?:[?#]|$)/i.exec(item.url||'')?.[1]||'png');

export function createImageDownloadPlan(items,{detail=false,grouped=true,nameFor}={}){
  const seen=new Set();
  const visible=items.filter(item=>{
    if(item.reference||item.deletedAt)return false;
    const key=item.url||item;
    if(seen.has(key))return false;seen.add(key);return true;
  });
  if(!visible.length)return [];
  const folders=detail?DETAIL_DOWNLOAD_FOLDERS:IMAGE_DOWNLOAD_FOLDERS;
  const current=new Set((detail?splitDetailVersions(visible):splitPhotoVersions(items)).current);
  const entries=grouped?folders.map(folder=>({path:folder+'/',directory:true})):[];
  const used=new Set();
  for(const [index,item] of visible.entries()){
    const folder=current.has(item)?folders[0]:folders[1];
    const base=safeName(nameFor?nameFor(item,index):detail?
      String((item.detailSliceIndex??index)+1).padStart(2,'0')+'_'+(item.detailSliceTitle||'详情')+'_图片'+item.number:
      '图片_'+(item.number??String(index+1).padStart(2,'0')));
    const prefix=grouped?folder+'/':'';let file=base+'.'+extension(item),suffix=1;
    while(used.has(prefix+file))file=base+'_'+(++suffix)+'.'+extension(item);
    used.add(prefix+file);
    entries.push({path:prefix+file,item});
  }
  return entries;
}

function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}

export async function buildImageArchive(entries,readBytes){
  if(entries.length>65535)throw Error('图片数量过多，请分组下载');
  const chunks=[],central=[],encoder=new TextEncoder();let offset=0;
  for(const entry of entries){
    const bytes=entry.directory?new Uint8Array():new Uint8Array(await readBytes(entry.item));
    const name=encoder.encode(entry.path),crc=crc32(bytes);
    const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);
    lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
    const header=new Uint8Array(46+name.length),cv=new DataView(header.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);
    cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);
    cv.setUint32(38,entry.directory?0x10:0,true);cv.setUint32(42,offset,true);header.set(name,46);
    chunks.push(local,bytes);central.push(header);offset+=local.length+bytes.length;
  }
  const end=new Uint8Array(22),view=new DataView(end.buffer);
  view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);
  view.setUint32(12,central.reduce((sum,header)=>sum+header.length,0),true);view.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}

export async function downloadImageArchive(items,fileName,options={}){
  const entries=createImageDownloadPlan(items,options);if(!entries.length)return;
  const blob=await buildImageArchive(entries,async item=>{
    if(item.canvas){const png=await new Promise(resolve=>item.canvas.toBlob(resolve,'image/png'));if(!png)throw Error('图片导出失败，请重试');return png.arrayBuffer();}
    const response=await fetch(item.url);if(!response.ok)throw Error('图片下载失败，请重试');return response.arrayBuffer();
  });
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=fileName;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
