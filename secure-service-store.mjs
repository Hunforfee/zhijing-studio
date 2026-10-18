import {execFile} from 'node:child_process';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const defaultFile=new URL('./.share/service-config.dpapi',import.meta.url);
function protect(bytes,decrypt=false){
  if(process.platform!=='win32')throw Error('此加密配置仅支持当前 Windows 用户');
  const operation=decrypt?'Unprotect':'Protect';
  const script=`Add-Type -AssemblyName System.Security; $data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::${operation}($data,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  return new Promise((resolve,reject)=>{
    const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,maxBuffer:128*1024},(error,stdout)=>{if(error)return reject(Error('本机配置加密读写失败，请使用保存配置时的 Windows 账户'));try{resolve(Buffer.from(stdout.trim(),'base64'))}catch{reject(Error('加密配置格式无效'))}});
    child.stdin.on('error',()=>{});child.stdin.end(bytes.toString('base64'));
  });
}
export async function saveServiceConfig(config,file=defaultFile){
  const destination=file instanceof URL?file:pathToFileURL(path.resolve(file));
  const encrypted=await protect(Buffer.from(JSON.stringify(config),'utf8'));
  await mkdir(new URL('.',destination),{recursive:true});
  const temporary=new URL(destination.href+'.tmp');
  await writeFile(temporary,encrypted,{mode:0o600});await rename(temporary,destination);
}
export async function loadServiceConfig(file=defaultFile){
  let encrypted;try{encrypted=await readFile(file)}catch(error){if(error.code==='ENOENT')return undefined;throw Error('无法读取本机加密配置')}
  try{return {...JSON.parse((await protect(encrypted,true)).toString('utf8')),verified:false}}catch{throw Error('无法解密服务配置，请使用原 Windows 账户启动网站')}
}
