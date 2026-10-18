import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {saveServiceConfig,loadServiceConfig} from './secure-service-store.mjs';
const dir=await mkdtemp(path.join(tmpdir(),'zhijing-secure-test-'));
try{
  const file=pathToFileURL(path.join(dir,'config.dpapi'));
  assert.equal(await loadServiceConfig(file),undefined);
  const config={provider:'sub2api',apiKey:'synthetic-test-key-not-real',baseUrl:'https://example.test/v1',model:'gpt-image-2',verified:true};
  await saveServiceConfig(config,file);assert.equal((await readFile(file)).includes(Buffer.from(config.apiKey)),false);
  assert.deepEqual(await loadServiceConfig(file),{...config,verified:false});
  await saveServiceConfig({...config,model:'test-image-model'},file);assert.equal((await loadServiceConfig(file)).model,'test-image-model');
  console.log('Windows 加密保存、重新读取及覆盖更新检查通过，未使用真实密钥。');
}finally{assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'zhijing-secure-test-'));await rm(dir,{recursive:true,force:true})}
