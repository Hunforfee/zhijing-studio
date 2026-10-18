import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const f='set-surface-prompts.mjs';
await copyFile(f,'../四件套结构研究/同步前-口袋规则.mjs');
let s=await readFile(f,'utf8');
s=s.replace('先建立每个套体的独立正面、反面裁片，再贴花型；','每个被套与枕套都是两片布缝合的柔软口袋。A片、B片为永久布片身份，不是画面上下位置；A翻到底下仍A，B翻到上面仍B，翻折、挤压、光照和机位均不重新分配花型。先建立每个套体的独立正面、反面裁片，再贴花型；');
s=s.replace('尺寸、边饰及材质按选择。','尺寸、边饰及材质按选择。被芯与枕芯柔软承托，边部薄而圆润，不鼓成床垫。只拍这一套，不增加抱枕、第二条被子或床尾巾。');
s=s.replace("return chinese?'双面复核：","return chinese?'永久布片身份：A翻到底下仍A，B翻到上面仍B，花型随布片变形，不随画面位置换面。双面复核：");
s=s.replace("':'FINAL A/B PANEL CHECK:","':'PERMANENT CLOTH PANEL IDENTITY: A remains A when turned underneath; B remains B when turned upward. Prints deform with their own cloth, never reassigned by screen position, creases or lighting. FINAL A/B PANEL CHECK:");
await writeFile(f,s);
const {setStructurePrompt}=await import('./set-surface-prompts.mjs?sync');
const j='generated/prompt-section-edits.json';await copyFile(j,'../四件套结构研究/同步前-口袋规则后台.json');
const data=JSON.parse(await readFile(j,'utf8'));for(const e of data.entries){if(JSON.parse(e.scope)[0]==='product'&&JSON.parse(e.scope)[1]==='set'){e.prompt=setStructurePrompt;e.version=randomUUID();e.updatedAt=new Date().toISOString();}}
await writeFile(j,JSON.stringify(data,null,2)+'\n');
await writeFile('四件套产品结构_自然实物版提示词.md',setStructurePrompt+'\n');
const p='set-product-prompts.mjs';let t=await readFile(p,'utf8');
t=t.replace('const rules={','const rules={\n    front:[\'正面全景保持床尾居中、完整下缘；双面时被套床头端自然宽幅翻回，露出的整片反面B、下层正面A，枕套正面A且自然可见的背片B；仅A时全部A。不要添床尾巾或额外枕头；用户指定造型优先。\',\'Front full-bed view stays centered at the foot with the lower hems visible. With A/B, softly turn back the head end of the SAME duvet in one broad natural fold: the exposed reverse panel is entirely B, the main front below entirely A. Both pillow fronts are A and naturally visible back panels B. A-only uses A everywhere. No extra cushions or separate runner; explicit user styling takes priority.\'],');
await writeFile(p,t);console.log('结构规则、后台覆盖和正面全景已同步，结构字数',Array.from(setStructurePrompt).length);
