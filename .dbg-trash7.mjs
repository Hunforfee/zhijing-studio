import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import http from 'node:http';
import {createServer} from './server.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-dbg7-'));
const server=createServer({outputDir,service:{provider:'compatible',apiKey:'k',baseUrl:'https://example.test/v1',model:'m'},stylingReferencePaths:[],fetchImpl:async()=>Response.json({data:[{b64_json:png.toString('base64')}]}),});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const image='data:image/png;base64,'+png.toString('base64');
const raw=(route,data)=>new Promise((resolve,reject)=>{
  const body=JSON.stringify(data===undefined?{}:data);
  const req=http.request({host:'127.0.0.1',port,path:route,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
    let chunks='';res.on('data',c=>chunks+=c);res.on('end',()=>resolve({status:res.statusCode,body:chunks}));
  });
  req.on('error',reject);req.end(body);
});
const t=async(label,p)=>{const t0=Date.now();const r=await p;console.log(label,Date.now()-t0,'ms ->',r.status);return r;};
await t('raw add A',raw('/api/history',{image,ratio:'1:1'}));
await t('raw add B',raw('/api/history',{image,ratio:'1:1'}));
await t('raw delete #1',raw('/api/history/delete',{number:1}));
await t('raw empty',raw('/api/history/empty-trash'));
console.log('raw empty body:',(await Promise.resolve()).then?'' :'');
await new Promise(r=>server.close(r));
await rm(outputDir,{recursive:true,force:true});
console.log('done');process.exit(0);
