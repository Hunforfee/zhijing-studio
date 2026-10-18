import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {encryptConfiguration,decryptConfiguration,loadDeploymentConfiguration} from './deployment-config.mjs';
import {saveServiceConfig,loadServiceConfig} from './secure-service-store.mjs';
const key=randomBytes(32).toString('base64'),bundle={version:1,image:{version:2,activeProvider:'sub2api',profiles:{sub2api:{provider:'sub2api',apiKey:'synthetic-deployment-image-secret',baseUrl:'https://example.test/v1',model:'image-custom',recognitionModel:'vision-custom'}}},video:{version:2,activeProvider:'minimax',profiles:{minimax:{provider:'minimax',apiKey:'synthetic-deployment-video-secret',model:'MiniMax-Hailuo-2.3'}}}};
test('portable envelope preserves complete image and video settings without plaintext credentials',()=>{
 const encrypted=encryptConfiguration(bundle,key),text=JSON.stringify(encrypted);assert.ok(!text.includes('synthetic-deployment'));assert.deepEqual(decryptConfiguration(encrypted,key),bundle);assert.notEqual(encryptConfiguration(bundle,key).iv,encrypted.iv);
 assert.throws(()=>decryptConfiguration(encrypted,randomBytes(32).toString('base64')),/解密失败/);
 assert.throws(()=>decryptConfiguration({...encrypted,tag:randomBytes(16).toString('base64')},key),/解密失败/);
});
test('deployment config loads only with the environment key and never silently accepts corrupt data',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-deploy-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'service.enc.json');await writeFile(file,JSON.stringify(encryptConfiguration(bundle,key)));
 assert.equal(await loadDeploymentConfiguration({env:{},file}),undefined);assert.deepEqual(await loadDeploymentConfiguration({env:{ZHJ_DEPLOYMENT_KEY:key},file}),bundle);
 const overridden=await loadDeploymentConfiguration({env:{ZHJ_DEPLOYMENT_KEY:key,SUB2API_BASE_URL:'https://relay.example.test/v1/'},file});assert.equal(overridden.image.profiles.sub2api.baseUrl,'https://relay.example.test/v1');assert.equal(overridden.image.profiles.sub2api.apiKey,bundle.image.profiles.sub2api.apiKey);
 await assert.rejects(loadDeploymentConfiguration({env:{ZHJ_DEPLOYMENT_KEY:key,SUB2API_BASE_URL:'https://user:password@example.test/v1'},file}),/SUB2API_BASE_URL/);
 await assert.rejects(loadDeploymentConfiguration({env:{ZHJ_DEPLOYMENT_KEY:'invalid'},file}),/解密失败/);
});
test('server config persists portably with AES-GCM and does not require Windows DPAPI',async t=>{
 const old=process.env.ZHJ_DEPLOYMENT_KEY;process.env.ZHJ_DEPLOYMENT_KEY=key;
 const dir=await mkdtemp(path.join(os.tmpdir(),'zhijing-portable-store-'));t.after(async()=>{if(old===undefined)delete process.env.ZHJ_DEPLOYMENT_KEY;else process.env.ZHJ_DEPLOYMENT_KEY=old;await rm(dir,{recursive:true,force:true});});const file=path.join(dir,'service.dpapi'),config=bundle.image.profiles.sub2api;
 await saveServiceConfig(config,file);const bytes=await readFile(file);assert.ok(bytes.toString().startsWith('ZHJ-AES-GCM-1\n'));assert.ok(!bytes.includes(Buffer.from(config.apiKey)));assert.deepEqual(await loadServiceConfig(file),{...config,verified:false});
 process.env.ZHJ_DEPLOYMENT_KEY=randomBytes(32).toString('base64');await assert.rejects(loadServiceConfig(file),/无法解密服务器配置/);
});
