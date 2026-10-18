export const detailGroupKey=item=>item?.detailGroupId||item?.batchId||item?.jobId;
export function splitDetailVersions(items){
 const latest=new Map();
 const visible=items.filter(x=>!x.deletedAt).slice().sort((a,b)=>b.number-a.number);
 for(const item of visible){const key=detailGroupKey(item)+'/'+(item.detailSliceIndex??0);if(!latest.has(key))latest.set(key,item);}
 const current=[...latest.values()].sort((a,b)=>(a.detailSliceIndex??0)-(b.detailSliceIndex??0));
 const numbers=new Set(current.map(x=>x.number));
 return {current,replaced:visible.filter(x=>!numbers.has(x.number))};
}
