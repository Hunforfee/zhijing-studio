import {readFile,writeFile} from 'node:fs/promises';
const zh='床单款锁定：仅一张平床单，从床面连续越过床垫边向外垂落；不加床笠、贴合侧围或角袋，不把床单分成床笠与裙摆。纠正首图及角度参考中的多余床笠。';
const en=' FLAT-SHEET STRUCTURE LOCK: exactly ONE flat sheet, continuously flowing from mattress top over its edge into loose hanging fabric OUTSIDE the frame. No additional fitted sheet, taut fitted sidewall, sewn corner pocket or separate skirt. A visible side area belongs to this same loose sheet, never a second mattress-cover layer. Correct extra fitted-sheet geometry in the first photo and camera reference; preserve the selected flat-sheet construction.';
let s=await readFile('set-surface-prompts.mjs','utf8');
s=s.replace("  if(v.product!=='set'||!(v.imageBBytes||v.imageB))return '';","  if(v.product!=='set')return '';\n  const flat=(v.size||'').includes('普通平床单：');\n  const sheetRule=flat?(chinese?"+JSON.stringify(zh)+":"+JSON.stringify(en)+"):'';\n  if(!(v.imageBBytes||v.imageB))return sheetRule;");
s=s.replace("  return chinese?'永久布片身份：","  return sheetRule+(chinese?'永久布片身份：");
s=s.replace("Styling creases never switch A/B.';","Styling creases never switch A/B.');");
await writeFile('set-surface-prompts.mjs',s);
let p=await readFile('set-product-prompts.mjs','utf8');p=p.replace('床单为薄型单层布，独立于上方被套；','床单为唯一一张薄型单层平布，独立于上方被套；床面与下垂边属于同一张布，不另加床笠、紧绷侧围、缝合角袋或裙片；');await writeFile('set-product-prompts.mjs',p);
const j='generated/prompt-section-edits.json',d=JSON.parse(await readFile(j,'utf8'));for(const e of d.entries){const scope=JSON.parse(e.scope);if(scope[0]==='size'&&scope[1]==='set'&&e.prompt.includes('普通平床单：')){e.prompt+=' '+zh;e.updatedAt=new Date().toISOString();}}
await writeFile(j,JSON.stringify(d,null,2)+'\n');
