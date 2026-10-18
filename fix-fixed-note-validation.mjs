import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('dist/app.js','utf8');s=s.replace("if(isFixed){try{const m=", "if(isFixed){opt.notes=$('notes').value;try{const m=");await writeFile('dist/app.js',s);
