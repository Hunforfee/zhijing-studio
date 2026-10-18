export function sizeParts(category='auto'){
 if(category==='set')return [{name:'被套',presets:[[200,230],[220,240],[150,200]]},{name:'床单',presets:[[240,245],[245,270],[180,230]]},{name:'枕套',presets:[[48,74],[50,80]]}];
 const kind=category.split(':')[0],name={mat:'席面',quilt:'被子',sheet:category==='sheet:flat'?'床单':'床笠',mattress:'床垫',blanket:'毯子',sleepbag:'睡袋',pillowcore:'枕芯'}[kind];
 if(!name)return [{name:'商品',presets:[]}];
 const presets=kind==='pillowcore'?[[48,74],[40,60],[30,50]]:kind==='quilt'?[[150,200],[200,230],[220,240]]:kind==='blanket'?[[150,200],[180,200],[200,230]]:kind==='sleepbag'?[[80,210],[100,210]]:kind==='sheet'&&category==='sheet:flat'?[[180,230],[240,245],[245,270]]:[[90,200],[150,200],[180,200]];
 return [{name,presets,...(['mattress','sheet'].includes(kind)&&category!=='sheet:flat'?{height:true}:{})},...(kind==='mat'?[{name:'枕席',presets:[[48,74]]}]:[])];
}
export function normalizeDetailSizes(sizes=[]){
 if(!Array.isArray(sizes)||sizes.length>30)throw Error('最多添加30条尺寸');
 const result=[];
 for(const s of sizes){if(!s||typeof s.part!=='string'||!s.part.trim()||s.part.length>20||/[\x00-\x1f<>]/.test(s.part)||!Array.isArray(s.dimensions)||s.dimensions.length<2||s.dimensions.length>3||!s.dimensions.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1000))throw Error('尺寸需填写有效的长、宽及可选高度（厘米）');
  const item={part:s.part.trim(),dimensions:[...s.dimensions]};if(!result.some(x=>x.part===item.part&&x.dimensions.join(',')===item.dimensions.join(',')))result.push(item);
 }
 return result;
}
export function sizeDescription(sizes){return normalizeDetailSizes(sizes).map(s=>s.part+' '+s.dimensions.join('×')+' cm').join('；');}
