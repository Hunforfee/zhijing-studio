import {readFile,writeFile} from 'node:fs/promises';
for(const f of ['dist/camera-contract.js','dist/style.css']){let s=await readFile(f,'utf8');s=s.replaceAll('set-framed-angles-v2-printed.png','set-framed-angles-v3-approved-front.png');await writeFile(f,s);}
let s=await readFile('dist/camera-contract.js','utf8');
s=s.replace("export function cameraReferenceRule(v,angle,imageNumber){","export function cameraReferenceRule(v,angle,imageNumber){\n  const setFront=v.product==='set'&&angle==='front'?' Approved four-piece frontal reference: borrow only its centered slightly elevated foot-end camera, two head pillows, broad soft head-end duvet turnover and independently hanging sheet. Do not copy its plaid, teddy patches, lettering, solid blue color or bedroom; apply uploaded A/B and all selected crafts, material and scene. ':'';");
s=s.replace("return ' Image '+imageNumber+' is a CAMERA COMPOSITION AND PILLOW-PLACEMENT", "return setFront+' Image '+imageNumber+' is a CAMERA COMPOSITION AND PILLOW-PLACEMENT");
await writeFile('dist/camera-contract.js',s);
s=await readFile('dist/app.js','utf8');s=s.replace("import('/camera-contract.js')","import('/camera-contract.js?v=20261004-set-front3')");await writeFile('dist/app.js',s);
s=await readFile('dist/index.html','utf8');s=s.replaceAll('v=20261004-boot1','v=20261004-set-front3');await writeFile('dist/index.html',s);
