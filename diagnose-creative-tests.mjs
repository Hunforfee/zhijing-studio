import {readFile,writeFile} from 'node:fs/promises';
const file='video-service-test.mjs';let text=await readFile(file,'utf8');
text=text.replace('assert.equal(failed.shots.filter(s=>s.url).length,3);','assert.equal(failed.shots.filter(s=>s.url).length,3,failed.message);');
text=text.replaceAll("assert.equal((await finished(request,j.id)).status,'completed');assert.equal(videos,3);","const completed=await finished(request,j.id);assert.equal(completed.status,'completed',completed.message);assert.equal(videos,3);");
await writeFile(file,text);
