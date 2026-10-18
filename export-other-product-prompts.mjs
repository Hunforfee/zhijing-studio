import {mkdir,writeFile} from 'node:fs/promises';
import {otherProductStructures,otherProductRule,otherProductPromptVersion} from './other-product-prompts.mjs';
const sources=[
 ['罗莱：双面凉感夏被','https://www.luolai.com/products/double-sided-cooling-quilt-1?variant=44826162397235','双面材质分别描述；仅借鉴结构表达，不导入品牌配色、成分比例或凉感指标。'],
 ['Brooklinen：冬被与轻薄被','https://www.brooklinen.com/products/down-comforter','填充蓬松度与壳布光泽分开描述；绗缝是填充约束，不是A/B裁片分界。品牌方格结构不能代表所有被子。'],
 ['IKEA：床笠','https://www.ikea.com/sg/en/p/hoestvaedd-fitted-sheet-blue-80458858/','顶面、贴合侧围、弹力底缘各有作用；不把承托床垫厚度画成床笠填充。'],
 ['Brooklinen：床褥垫','https://www.brooklinen.com/products/mattress-pad','床褥是独立于承托床垫的上层垫；本站薄/厚/泡棉结构与尺寸目标仍以菜单为准。'],
 ['IKEA：薄绒毯','https://www.ikea.com/us/en/p/daggkapor-throw-light-beige-20624592/','薄绒表面与毯身重量分开表达；绒面不可自动推导夹棉或缎边。'],
 ['MUJI：毯类目录','https://muji.com.au/collections/throws-blankets','纱布、华夫格等织纹毯与绒毯分别描述；不将品牌可逆复合毯构造强加给本站纱布毯。'],
 ['Decathlon：旅行睡袋内衬','https://www.decathlon.co.uk/p/cotton-sleeping-bag-liner-comfort/324944/c335m8584370','参考薄布内衬的产品身份；本站已确认的半侧缝、脚端隐形拉链、背面枕袋优先，不复制其他品牌的入口结构。']
];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rows=Object.entries(otherProductStructures).map(([key,structure])=>{const [product,variant]=key.split(':');const v={product,imageB:true,...(product==='mat'?{fabric:variant}:product==='quilt'?{quiltSeason:variant}:product==='sheet'?{sheetVariant:variant}:product==='mattress'?{mattressVariant:variant}:product==='blanket'?{blanketVariant:variant}:product==='sleepbag'?{sleepbagVariant:variant}:{})};return {key,structure,AB:otherProductRule(v),A:otherProductRule({...v,imageB:false})};});
await mkdir('docs',{recursive:true});
await writeFile('docs/其他产品提示词优化.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>其他产品提示词优化</title><style>body{max-width:1080px;margin:40px auto;padding:0 24px;color:#263c32;font:16px/1.8 system-ui;background:#f7f8f5}h1{font-size:28px}article{background:white;border:1px solid #dfe5db;border-radius:12px;padding:20px;margin:16px 0}h2{font-size:20px;margin:0}summary{cursor:pointer;color:#47735a}a{color:#396a52}small{color:#788378}</style><h1>其他产品提示词优化</h1><small>2026-10-11 · ${otherProductPromptVersion}</small><p>采用四件套的分层逻辑：先锁定产品与部件连接，再确定各裁片A/B归属，最后描述兼容材质、机位和陈列。覆盖16个现有细分款式及后台兼容枕套规则；四件套原提示词保留。</p><p>各款式的A/B分配沿用本站约定：单独床单/床笠整体B，配套枕套正A反B；被/毯/席正A反B；垫子顶与侧A、底B；睡袋上片外及下片躺卧面A、真实反面B。仅A时全部用A，睡袋素枕除外。审核仅检查当前镜头可见结构，不要求特写露出所有部件。</p><h2>产品规则</h2>${rows.map(r=>`<article><h2>${escape(r.structure.split('：')[0])}</h2><p>${escape(r.structure)}</p><details><summary>查看A/B完整提示词</summary><p>${escape(r.AB)}</p></details><details><summary>查看仅A完整提示词</summary><p>${escape(r.A)}</p></details></article>`).join('')}<h2>研究来源与应用边界</h2><p>品牌页面用于研究可见部件、材质和陈列方式，不代表用户商品的真实成分、尺寸或功能指标。竹席/藤席及牛奶绒/拉舍尔没有取得足够品牌特定构造证据，保留本站已选款式目标，细节仅按兼容的用户资料调整。</p>${sources.map(([name,url,note])=>`<article><a href="${escape(url)}">${name}</a><p>${note}</p></article>`).join('')}<p>测试使用模拟响应，无真实付费试生成。提示词能提高一致性，实际画面仍由生图模型生成并按现有一次纠错流程完善。</p></html>`,'utf8');
await writeFile('docs/other-product-prompts.json',JSON.stringify({version:otherProductPromptVersion,sources,products:rows},null,2));
console.log('导出产品提示词与研究说明');
