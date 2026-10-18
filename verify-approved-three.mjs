import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://localhost:4173/');await page.waitForFunction(()=>document.querySelector('[data-angle="top"] .angle-photo')?.dataset.previewSrc?.includes('v13-confirmed'));
for(const [id,cell] of [['top','2'],['left','4'],['right','5']]){
 const card=page.locator('[data-angle="'+id+'"]');await card.scrollIntoViewIfNeeded();const r=await card.locator('.angle-photo').evaluate(el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el,'::before');return {w:b.width,h:b.height,pw:parseFloat(s.width),ph:parseFloat(s.height),cell:el.dataset.previewCell}});
 if(Math.abs(r.w-r.h)>1||Math.abs(r.w-r.pw)>1||Math.abs(r.h-r.ph)>1||r.cell!==cell)throw Error(JSON.stringify(r));
 await card.hover();await page.waitForFunction(()=>!document.getElementById('angleImagePreview').hidden);await page.waitForFunction(()=>document.querySelector('#angleImagePreview canvas')?.width===512);await page.mouse.move(0,0);console.log(id+' thumbnail and hover verified');
}
await browser.close();
