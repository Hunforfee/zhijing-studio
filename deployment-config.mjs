import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export function deploymentKey(value){
  if(typeof value!=='string'||! /^[A-Za-z0-9+/]{43}=$/.test(value))throw Error('ZHJ_DEPLOYMENT_KEY 必须是32字节密钥的Base64编码');
  const key=Buffer.from(value,'base64');if(key.length!==32)throw Error('ZHJ_DEPLOYMENT_KEY 格式无效');return key;
}
export function encryptConfiguration(value,keyValue){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',deploymentKey(keyValue),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {version:1,algorithm:'aes-256-gcm',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}
export function decryptConfiguration(envelope,keyValue){
  try{
    if(envelope?.version!==1||envelope.algorithm!=='aes-256-gcm')throw Error();
    const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');if(iv.length!==12||tag.length!==16)throw Error();
    const cipher=createDecipheriv('aes-256-gcm',deploymentKey(keyValue),iv);cipher.setAuthTag(tag);
    const plain=Buffer.concat([cipher.update(Buffer.from(envelope.data,'base64')),cipher.final()]);
    const result=JSON.parse(plain.toString('utf8'));if(!result||typeof result!=='object'||Array.isArray(result))throw Error();return result;
  }catch{throw Error('服务配置解密失败，请检查 ZHJ_DEPLOYMENT_KEY 与加密配置是否匹配');}
}
export async function loadDeploymentConfiguration({env=process.env,file=new URL('./deploy/service-config.enc.json',import.meta.url)}={}){
  if(!env.ZHJ_DEPLOYMENT_KEY)return undefined;
  let data;try{data=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return undefined;throw Error('无法读取部署服务配置');}
  let envelope;try{envelope=JSON.parse(data);}catch{throw Error('部署服务配置格式无效');}
  const bundle=decryptConfiguration(envelope,env.ZHJ_DEPLOYMENT_KEY);
  if(bundle.version!==1||!bundle.image||typeof bundle.image!=='object')throw Error('部署服务配置内容无效');
  if(env.SUB2API_BASE_URL){
    let url;try{url=new URL(env.SUB2API_BASE_URL);}catch{throw Error('SUB2API_BASE_URL 格式无效');}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('SUB2API_BASE_URL 须为不含账号密码或查询参数的 HTTP(S) 地址');
    const baseUrl=url.href.replace(/\/$/,'');
    if(bundle.image.profiles?.sub2api)bundle.image.profiles.sub2api.baseUrl=baseUrl;
    if(bundle.image.provider==='sub2api')bundle.image.baseUrl=baseUrl;
  }
  return bundle;
}
