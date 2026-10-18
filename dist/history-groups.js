import {splitPhotoVersions} from './image-versions.js?v=20261011-latest-versions1';
export function groupHistoryImages(images) {
  const byNumber=new Map(images.map(image=>[image.number,image]));
  const batchKey=image=>image.batchId||image.jobId||image.url?.split('/')[2]||String(image.number);
  function original(image){
    const seen=new Set();
    while(byNumber.has(image.parentNumber)&&!seen.has(image.number)){
      seen.add(image.number);image=byNumber.get(image.parentNumber);
    }
    return image;
  }
  const groups=new Map();
  for(const image of images){
    const source=original(image),id=batchKey(source);
    if(!groups.has(id))groups.set(id,{id,images:[],original:source,latestNumber:0});
    const group=groups.get(id);group.images.push(image);group.latestNumber=Math.max(group.latestNumber,image.number);
  }
  return [...groups.values()].map(group=>{
    const versions=group.original.detailPage?null:splitPhotoVersions(group.images);if(versions)group.images=[...versions.current,...versions.replaced,...group.images.filter(x=>x.deletedAt).sort(compareHistoryImages)];else group.images.sort(compareHistoryImages);
    const originals=group.images.filter(image=>!isEditedImage(image)).sort((a,b)=>a.number-b.number);
    const original=originals[0]||group.original;
    return {...group,original,cover:group.images[0],createdAt:original.createdAt};
  }).sort((a,b)=>b.latestNumber-a.latestNumber);
}

export function isEditedImage(image){return image.kind==='edited'||!!image.parentNumber;}
export function compareHistoryImages(a,b){
  const aEdited=isEditedImage(a),bEdited=isEditedImage(b);
  return aEdited!==bEdited?(aEdited?-1:1):aEdited?b.number-a.number:a.number-b.number;
}
