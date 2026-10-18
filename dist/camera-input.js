async function prepareCameraReferences(opt){
  if(opt.recommendAngle||opt.childBed)return undefined;
  if((opt.referenceGuided&&opt.referenceAngle!==false)||!['set','quilt','sheet','mat','mattress','blanket','sleepbag','pillowcore'].includes(opt.product))return undefined;
  const guide=typeof cameraTools==='object'&&cameraTools?cameraTools:await import('/camera-contract.js');
  const atlas=guide.cameraAtlasFor(opt);if(!atlas)return undefined;
  const image=new Image();image.src='/assets/'+atlas.file;
  try{await image.decode()}catch{throw Error('角度示例尚未加载完成，请刷新后重试')}
  const cellWidth=image.naturalWidth/(atlas.cols||4),cellHeight=image.naturalHeight/(atlas.rows||3),references={};
  for(const angle of opt.angles){const cell=guide.cameraCellFor(opt,angle);if(cell==null)throw Error('拍摄角度参考无效');const canvas=document.createElement('canvas');canvas.width=canvas.height=384;canvas.getContext('2d').drawImage(image,(cell%4)*cellWidth,Math.floor(cell/4)*cellHeight,cellWidth,cellHeight,0,0,384,384);references[angle]=canvas.toDataURL('image/png');}
  return references;
}
