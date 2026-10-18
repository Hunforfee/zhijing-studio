import {readFileSync} from 'node:fs';

export function deploymentPublicOrigin(){
  try{return JSON.parse(readFileSync(new URL('./deploy/site-config.json',import.meta.url),'utf8')).publicOrigin||'';}
  catch(error){if(error.code==='ENOENT')return '';throw error;}
}

export function createRequestSourcePolicy({publicOrigin=''}={}){
  let allowedOrigin='';
  if(publicOrigin){
    const url=new URL(publicOrigin);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('PUBLIC_ORIGIN 必须是网站的完整来源地址（协议、域名和可选端口）');
    allowedOrigin=url.origin;
  }
  return req=>{
    if(req.headers['sec-fetch-site']==='cross-site')return false;
    const origin=req.headers.origin;
    // The deployment origin is explicit. Never trust client-supplied proxy headers.
    if(allowedOrigin&&origin===allowedOrigin)return true;
    const host=req.headers.host||'';
    const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if(!loopback||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))return false;
    const localOrigin=`${req.socket.encrypted?'https':'http'}://${host}`;
    return !origin||origin===localOrigin;
  };
}
