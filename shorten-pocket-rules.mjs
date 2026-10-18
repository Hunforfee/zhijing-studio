import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('set-surface-prompts.mjs','utf8');
s=s.replace('上传A/B时：每件被套、每只枕套均由A正面与B反面接合，床面部件整体B；不是一只枕套A、另一只B。两只枕套正面展示A，实际可见的反面展示B；每片布从中心到自身边界只用所属花型。仅上传A时全部表面用A。','上传A/B：被套及每只枕套正面A、反面B，床面部件B；不是一只枕套A、另一只B。仅A时全A。');
s=s.replace('被套和枕套的真实正反接合线两侧分别属于A正面与B反面：先定位这条裁片边界，A到线终止，线另一侧从B开始；不同A/B不得画成同花色布面再补一条假缝线。此分界不用于普通压线、折边缝线或造型折痕。同一裁片内部的花型保持连续。','真实正反接合线两侧分别属于A正面与B反面，不用同色布加假缝线。此分界不用于普通压线、折边缝线或造型折痕。同一裁片内部的花型保持连续。');
s=s.replace('隆起、凹谷、堆褶和压折不等于翻面，正面造型区域仍A。实际翻回同一被套时，露出的反面裁片整片B，下层正面裁片仍A；仅A时均A。不能用阴影或折痕换面，不在B裁片内残留A。只展示自然可见的接合线，床单不随被套翻回。','隆起、凹谷、堆褶和压折不等于翻面。实际翻回同一被套，露出反片全B，下层正片仍A；仅A均A。床单不随被套翻回。');
await writeFile('set-surface-prompts.mjs',s);
const {setStructurePrompt}=await import('./set-surface-prompts.mjs?short');
const j='generated/prompt-section-edits.json',d=JSON.parse(await readFile(j,'utf8'));d.entries.find(e=>e.scope==='["product","set",""]').prompt=setStructurePrompt;
await writeFile(j,JSON.stringify(d,null,2)+'\n');await writeFile('四件套产品结构_自然实物版提示词.md',setStructurePrompt+'\n');
