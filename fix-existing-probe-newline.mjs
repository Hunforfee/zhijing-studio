import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('dist/app.js','utf8');s=s.replaceAll(".stack.split('\r\n')", ".stack.split('\\n')").replaceAll(".stack.split('\n')", ".stack.split('\\n')");await writeFile('dist/app.js',s);
