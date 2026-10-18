export async function runBatchImageEdit(numbers,edit,onProgress=()=>{},shouldStop=()=>false){
 const queue=[...new Set(numbers)];let completed=0;
 for(const number of queue){if(shouldStop())return {completed,total:queue.length,stopped:true};onProgress(completed,queue.length,number);if(await edit(number)!==true)return {completed,total:queue.length,failedNumber:number,stopped:shouldStop()};completed++;}
 return {completed,total:queue.length,stopped:shouldStop()};
}
