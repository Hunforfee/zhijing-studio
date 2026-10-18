import {readFile,writeFile} from 'node:fs/promises';
for(const f of ['dist/camera-contract.js','dist/style.css','camera-reference-test.mjs']){
let s=await readFile(f,'utf8');s=s.replaceAll('set-framed-angles-v3-approved-front.png','set-framed-angles-v4-floral-front.png');await writeFile(f,s);}
for(const f of ['dist/index.html','dist/app.js']){let s=await readFile(f,'utf8');s=s.replaceAll('20261004-set-front3','20261004-set-front4');await writeFile(f,s);}
