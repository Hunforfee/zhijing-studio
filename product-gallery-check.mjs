import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const p=await b.newPage({viewport:{width:1366,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/');await p.waitForSelector('.group-product>.scheme-picker');await p.locator('[data-scheme=B]').click();await p.locator('.group-product>.scheme-picker').click();
 for(const product of ['set','mat','quilt','pillowcore','mattress','blanket','sleepbag']){
  if(product!=='set')await p.locator('[data-product='+product+']').click();
  await p.waitForTimeout(100);
  const info=await p.locator('.scheme-product-details>[data-embedded-active]').evaluate(e=>({id:e.id,count:e.querySelectorAll('.set-variant-option').length,width:e.clientWidth,scrollWidth:e.scrollWidth,bottom:Math.max(...[...e.querySelectorAll('.set-variant-option')].map(x=>x.getBoundingClientRect().bottom)),tips:[...e.querySelectorAll('.set-variant-options>h3')].some(x=>getComputedStyle(x).display!=='none')}));
  console.log(product,info);assert.ok(info.count>0&&!info.tips&&info.scrollWidth<=info.width+2);assert.ok(info.bottom<748,'All subtypes should fit desktop popup');
  if(product==='mat'||product==='sleepbag')await p.locator('.scheme-picker-dialog[open]').screenshot({path:'output/产品分类-'+product+'-精简.png'});
 }
 assert.deepEqual(errors,[]);console.log('All seven product groups verified.');
}finally{await b.close();}
