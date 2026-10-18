import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(dir,'四件套提示词方案-v1.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const find=(group,id)=>data.groups.find(g=>g.id===group).options.find(o=>o.id===id);
function combine(example){
  const selected=data.groups.map(g=>find(g.id,example[g.id]));
  const structure=[data.base.prompt,data.base[example.fabric],data.base.panelIdentity].join(' ');
  const sections=[['产品结构',structure],...data.groups.map((g,i)=>[g.name,selected[i].prompt])];
  const hasFlatEdge=selected.some(o=>o.id.includes('flange')||o.id.includes('scallop'));
  const hasSeparateEdge=selected.some(o=>/piping|binding|ruffle$|lace$/.test(o.id));
  const edge=[];
  if(hasFlatEdge)edge.push(example.fabric==='ab'?'平布边沿所属正反裁片分别延续花型；内侧压线不切换A/B。':'平布边沿所属裁片延续A花型；内侧压线不改变花型归属。');
  if(hasSeparateEdge)edge.push('独立边饰仅按对应所选工艺生成，不用翻折露出的反面代替边饰。');
  if(edge.length)sections.push(['边饰花型',edge.join(' ')]);
  const material=example.fabric==='aOnly'?data.fabric.material[example.material].replace('原始A/B上传图分别','原始A上传图'):data.fabric.material[example.material];
  sections.push(['印花设置',data.fabric.pattern],['面料质感',material],['铺放造型',data.pose[example.pose]],['拍摄场景',data.photography.scene],['拍摄机位',data.photography.cameras[example.camera]],['成像要求',data.photography.quality]);
  return sections;
}
const examples=data.examples.map(e=>({...e,sections:combine(e)}));
const groups=data.groups.map(g=>`<section class="group"><h2>${esc(g.name)} <small>${g.options.length}项 · 仅作用于${esc(g.component)}</small></h2>${g.options.map(o=>`<article><h3>${esc(o.name)}${o.id===g.default?' <em>默认</em>':''}</h3><p>${esc(o.prompt)}</p></article>`).join('')}</section>`).join('');
const payload=JSON.stringify({data,examples}).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>四件套提示词 · 讨论稿</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6f1;color:#263d33;font:16px/1.85 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;margin:auto;padding:40px 24px 80px}h1{font-size:32px;margin:8px 0}h2{font-size:22px;line-height:1.5;margin:0 0 18px}h3{font-size:17px;margin:0 0 6px}p{margin:0}small{font-size:13px;font-weight:400;color:#728273}header{padding:20px 0 28px}.badge,em{font-style:normal;font-size:12px;background:#e7ecdf;padding:4px 10px;border-radius:20px}.badge{background:#f3e6c8;color:#745629}.lead{color:#697b6d;margin-top:12px}.card,.group{background:white;padding:26px;border:1px solid #dce3d7;border-radius:16px;margin:0 0 20px}.group article{border-top:1px solid #edf0e8;padding:16px 0}.group article:last-child{padding-bottom:0}.flow{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.flow span{padding:5px 12px;background:#e7ede4;border-radius:6px}select,button{font:inherit;border:1px solid #bccab8;padding:9px 14px;border-radius:8px;background:white;color:#263d33}select{max-width:100%}button{background:#365947;color:white;cursor:pointer}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0}.part{border-top:1px solid #e3e9df;padding:14px 0}.part h3{color:#507362;font-size:14px}.count{color:#7d897b;font-size:13px}.note{background:#f1f4ea;padding:14px 18px;border-radius:9px;font-size:14px}.rules{padding-left:20px}.rules li{margin:6px 0}a{color:#3c6751}details summary{cursor:pointer;font-weight:600}footer{color:#718272;font-size:14px}
</style><main><header><span class="badge">讨论稿 · 尚未接入后台</span><h1>四件套提示词，按结构逐层组合</h1><p class="lead">覆盖现有22个子菜单选项。共有结构只写一次，子菜单只描述差异，最终仅保留已选方案。</p><div class="flow"><span>产品共有结构</span><span>被套工艺</span><span>床面款式</span><span>枕套工艺</span><span>花型与质感</span><span>铺放与拍摄</span></div></header>
<section class="card"><h2>组合原则</h2><ul class="rules">${data.principles.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="note">普通四件套的默认是简约被套＋自然外垂床单＋简约枕套。共有结构本身不预设床单下摆或装饰边；子菜单决定实际结构。</p></section>
<section class="card"><h2>产品共有结构 · 包含严格A/B分界</h2><p>${esc(data.base.prompt)}</p><div class="part"><h3>仅上传A时的结构布面分配</h3><p>${esc(data.base.aOnly)}</p></div><div class="part"><h3>同时上传A/B时的结构布面分配</h3><p>${esc(data.base.ab)}</p></div><div class="part"><h3>裁片与接缝，共用一次</h3><p>${esc(data.base.panelIdentity)}</p></div><p class="note">生成时只在产品结构中组合当前有效的A或A/B规则，不再另设重复的花型归属段。枕套总数最多4只，位置可随造型自由安排。</p><p class="lead"><small>包口遮盖拉链来自你已确认的被套基础要求；未知枕套开口不擅自设定。本稿针对网站当前基础两片套体，不延伸到未知拼接SKU。</small></p></section>
${groups}
<section class="card"><h2>印花与质感</h2><div class="part"><h3>边饰花型，按选项输出相关句子</h3><p>${esc(data.fabric.craftSurface)}</p></div><div class="part"><h3>印花设置</h3><p>${esc(data.fabric.pattern)}</p></div>${Object.entries(data.fabric.material).map(([key,p])=>`<div class="part"><h3>${{upload:'默认质感：参考上传花型',library:'选择面料库',reference:'上传质感参考'}[key]}</h3><p>${esc(p)}</p></div>`).join('')}<p class="note">正反布面的归属已统一放入产品结构。本区域只负责印花参数和表面质感；面料库接入时写入具体织纹、光泽等特征。</p></section>
<section class="card"><h2>三份完整组合示例</h2><p>均为文字示范，无生图请求。例3是枕套特写，完整商品结构仍存在，画面只展示自然可见部分。</p><nav><select id="example" aria-label="组合示例"></select><button id="copy" type="button">复制当前完整提示词</button><span class="count" id="count"></span></nav><div id="output"></div></section>
<section class="card"><h2>参考图各自负责什么</h2><p>${esc(data.referencePolicy)}</p></section>
<section class="card"><h2>确认后接入后台的要求</h2><ul class="rules">${data.acceptance.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="note">目前不会改动线上提示词、参考图或模型配置。精简提示词可减少歧义，图片效果仍需要实际检查。</p></section><footer>版本 ${esc(data.version)} · 同目录JSON保留模块及现有选项ID，便于后续接入。</footer></main>
<script type="application/json" id="payload">${payload}</script><script>
const payload=JSON.parse(document.getElementById('payload').textContent),picker=document.getElementById('example'),output=document.getElementById('output');
payload.examples.forEach((e,i)=>{const o=document.createElement('option');o.value=i;o.textContent=e.name;picker.append(o)});
const text=()=>payload.examples[Number(picker.value)].sections.map(([name,p])=>'【'+name+'】'+p).join('\\n\\n');
function render(){output.replaceChildren();for(const [name,p]of payload.examples[Number(picker.value)].sections){const d=document.createElement('div');d.className='part';const h=document.createElement('h3');h.textContent=name;const line=document.createElement('p');line.textContent=p;d.append(h,line);output.append(d)}document.getElementById('count').textContent=text().length+'字符';document.getElementById('copy').textContent='复制当前完整提示词'}picker.onchange=render;document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(text());document.getElementById('copy').textContent='已复制'}catch{const range=document.createRange();range.selectNodeContents(output);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.getElementById('copy').textContent='已选中，请复制'}};render();
</script></html>`;
fs.writeFileSync(path.join(dir,'四件套提示词讨论稿.html'),html);
fs.writeFileSync(path.join(dir,'三份完整组合提示词.txt'),examples.map(e=>e.name+'\n\n'+e.sections.map(([label,p])=>'【'+label+'】'+p).join('\n\n')).join('\n\n--------------------\n\n'));
console.log(JSON.stringify({options:data.groups.map(g=>({name:g.name,count:g.options.length})),examples:examples.map(e=>({name:e.name,characters:e.sections.map(([n,p])=>n+p).join('').length})),html:path.join(dir,'四件套提示词讨论稿.html')}));
