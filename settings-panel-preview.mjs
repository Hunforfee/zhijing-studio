import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForSelector('.ui-scheme-switch');
 await page.addStyleTag({path:'output/settings-panel-preview.css'});
 await page.locator('[data-scheme=B]').click();
 await page.waitForFunction(()=>!document.body.classList.contains('is-booting'));
 await page.locator('#creationPanel').screenshot({path:'output/创作设置-独立面板预览.png'});
 await page.screenshot({path:'output/创作设置-整体预览.png'});
 const metrics=await page.locator('#creationPanel').evaluate(e=>({visible:e.clientHeight,content:e.scrollHeight,header:getComputedStyle(e.querySelector('.panel-title')).backgroundColor}));
 console.log(metrics);assert.ok(metrics.content<=metrics.visible+2,'Settings must fit the laptop viewport');
 await page.locator('[data-scheme=A]').click();
 assert.notEqual(await page.locator('#creationPanel>.panel-title').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(37, 75, 59)');
 console.log('Preview verified; scheme A remains unchanged.');
}finally{await browser.close();}
