import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForSelector('.ui-scheme-switch');await page.waitForSelector('#detailPageModule');
 await page.waitForTimeout(1800);
 assert.equal(await page.locator('html').getAttribute('data-ui-scheme'),'B');
 async function bounds(){return page.evaluate(()=>{const c=document.getElementById('creationPanel'),r=c.getBoundingClientRect();return {width:innerWidth,height:innerHeight,top:r.top,bottom:r.bottom,left:r.left,client:c.clientHeight,scroll:c.scrollHeight,bodyWidth:document.documentElement.scrollWidth,groups:document.getElementById('creationGroups').getBoundingClientRect().toJSON()};});}
 console.log('B desktop',await bounds());
 await page.screenshot({path:'output/方案B-桌面.png',fullPage:true});
 await page.locator('.group-product>.scheme-picker').click();assert.equal(await page.locator('.scheme-picker-dialog[open] #products').count(),1);
 await page.locator('[data-product="set"]').click();
 await page.locator('#setVariantPanel [data-set-variant="fitted"]').click();
 await page.locator('#setVariantPanel .set-variant-done').click();
 assert.match(await page.locator('.group-product>.scheme-picker').innerText(),/床笠/);
 await page.locator('.scheme-picker-dialog[open]>header button').click();
 await page.locator('#shootSection>.scheme-picker').click();assert.equal(await page.locator('.scheme-picker-dialog[open] #shootingChoices').count(),1);
 await page.locator('.scheme-picker-dialog[open]>header button').click();
 await page.locator('#notes').fill('保留方案切换前的草稿');
 await page.locator('[data-scheme=A]').click();
 assert.equal(await page.locator('#notes').inputValue(),'保留方案切换前的草稿');
 assert.equal(await page.locator('.group-product #products').count(),1);assert.equal(await page.locator('#shootSection #shootingChoices').count(),1);
 assert.equal(await page.locator('#creationPanel').evaluate(e=>getComputedStyle(e).position),'static');
 await page.screenshot({path:'output/方案A-还原.png',fullPage:true});
 await page.reload();await page.waitForSelector('.ui-scheme-switch');assert.equal(await page.locator('html').getAttribute('data-ui-scheme'),'A');
 await page.locator('[data-scheme=B]').click();
 for(const [width,height] of [[1366,768],[1920,1080],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(250);const b=await bounds();console.log('B responsive',b);assert.ok(b.bodyWidth<=width,'页面不应横向溢出');if(width>1050)assert.ok(b.scroll<=b.client+2,'桌面创作设置应在一页内完整显示');await page.screenshot({path:`output/方案B-${width}.png`,fullPage:true});}
 console.log('page errors',errors);assert.deepEqual(errors,[]);
}finally{await browser.close();}
