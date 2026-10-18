import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('dist/app.js','utf8');s=s.replace("${r.reference?'REFERENCE':r.ai?'AI PHOTO':'LOCAL PREVIEW'}", "${r.reference?'REFERENCE':r.engine==='fixed-cloth'?'3D RENDER':r.ai?'AI PHOTO':'LOCAL PREVIEW'}");
s=s.replace("+' 张结构示意。','complete');", "+' 张'+(isFixed?'固定结构图':'结构示意')+'。','complete');");s=s.replace("(isAI?'AI 产品摄影':'结构示意')", "(isFixed?'固定结构图':isAI?'AI 产品摄影':'结构示意')");await writeFile('dist/app.js',s);
s=await readFile('dist/fixed-cloth-model.js','utf8');s=s.replace("  if(opt.notes?.trim())", "  if(opt.scenes?.some(s=>!['warm','natural','hotel','studio'].includes(s)))throw Error('固定结构第一版支持暖白侘寂、原木自然、雅致酒店和纯色影棚');\n  if(opt.notes?.trim())");await writeFile('dist/fixed-cloth-model.js',s);
let p=await readFile('package.json','utf8');const j=JSON.parse(p);j.scripts.test+=' fixed-cloth-test.mjs';await writeFile('package.json',JSON.stringify(j,null,2)+'\n');
