// Explicit user-requested craft checks using only the local synthetic test print.
import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const base='http://127.0.0.1:4173';
const variants=runInNewContext((await readFile('dist/set-variants.js','utf8')).split('const variantPanel=')[0]+';setVariants');
const image='data:image/png;base64,'+(await readFile('测试花型.png')).toString('base64');
const cases=variants.filter(v=>v.group==='被套工艺').map(v=>({craft:v.id,sheet:'standard',pillow:'pillow-'+v.id})).concat(variants.filter(v=>v.group==='床单款式'&&v.id!=='standard').map(v=>({craft:'plain',sheet:v.id,pillow:'pillow-plain'})));
const results=[];
for(const c of cases){
  const size='三组同时满足：'+[c.craft,c.sheet,c.pillow].map(id=>variants.find(v=>v.id===id).spec).join('；')+'。各工艺仅作用所属部件，互不沿用。';
  const response=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({product:'set',fabric:'cotton',fabricMode:'auto',size,scenes:['warm'],angles:['front'],scale:100,direction:0,repeat:'tile',plainSheet:false,ratio:'1:1',notes:'工艺测试：正面全景保留床尾、被套侧边与两个枕套的自然可见外缘，花型来自测试图。',image})});
  if(!response.ok)throw Error('Local job submission failed '+response.status);
  const {id}=await response.json();console.log('START',JSON.stringify({...c,id}));
  let job;do{await new Promise(r=>setTimeout(r,2000));job=await(await fetch(base+'/api/jobs/'+id)).json();}while(job.status==='running');
  results.push({...c,id,status:job.status,error:job.error,results:job.results});
  await writeFile('.craft-live-check-results.json',JSON.stringify(results,null,2));console.log('FINISH',JSON.stringify(results.at(-1)));
  if(job.status!=='done')break;
}
