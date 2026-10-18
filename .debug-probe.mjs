import {readFileSync, writeFileSync} from 'node:fs';

// 恢复无探针版本，把探针插进函数体内部（第一 statements），才能抓到真实调用者
const path = 'dist/app.js';
let source = readFileSync('.app.debug-backup', 'utf8');
const probe = tag =>
  `try{console.log('[probe] ${tag} t=' + Math.round(performance.now()) + ' boot=' + document.body.className + ' || ' + new Error().stack.split('\\n').slice(2,8).map(function(s){return s.trim().replace(/^at /,'').split(' ')[0]}).join(' << '))}catch(e){}\n`;

for (const [tag, def] of [
  ['renderResults', 'function renderResults(){'],
  ['resetGalleryToReference', 'function resetGalleryToReference(){'],
]) {
  if (!source.includes(def)) throw new Error('not found: ' + tag);
  source = source.replace(def, def + probe(tag));
}
writeFileSync(path, source);
console.log('in-body probe installed');
