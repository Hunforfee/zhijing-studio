/* A photo and all edits descending from it occupy one original position. */
(() => {
  function splitPhotoVersions(items) {
    const byNumber=new Map(items.filter(x=>Number.isSafeInteger(x.number)).map(x=>[x.number,x]));
    const slots=new Map();
    function root(item){
      const seen=new Set();
      while(byNumber.has(item.parentNumber)&&!seen.has(item.number)){
        seen.add(item.number);item=byNumber.get(item.parentNumber);
      }
      return item;
    }
    items.forEach((item,index)=>{
      if(item.deletedAt)return;
      const source=root(item),key=source.number??source;
      if(!slots.has(key))slots.set(key,{order:source.number??index,items:[]});
      slots.get(key).items.push(item);
    });
    const current=[],replaced=[];
    for(const slot of [...slots.values()].sort((a,b)=>a.order-b.order)){
      slot.items.sort((a,b)=>(b.number??0)-(a.number??0));
      current.push(slot.items[0]);replaced.push(...slot.items.slice(1));
    }
    replaced.sort((a,b)=>(b.number??0)-(a.number??0));
    return {current,replaced};
  }
  globalThis.splitPhotoVersions=splitPhotoVersions;
})();
