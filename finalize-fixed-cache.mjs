import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('dist/index.html','utf8');s=s.replace(/\/app\.js\?v=[^" ]+/,'/app.js?v=20261004-fixed-cloth2').replaceAll('20261004-fixed-cloth1','20261004-fixed-cloth2').replaceAll('20261004-works-controls1','20261004-fixed-history2');await writeFile('dist/index.html',s);
