import {createRequire} from 'node:module';
import {draftStoryboard} from './dist/video-storyboard.js';
const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080}});
try{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4173/')||r.request().url().startsWith('data:')?r.continue():r.abort());
 await page.route('**/api/video/storyboard',r=>r.fulfill({json:{storyboard:draftStoryboard({topic:'daily',product:'set',duration:20,people:'hands',brief:'',facts:''})}}));
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.locator('a[href="#videoDesignModule"]').click();await page.locator('#videoSourceFile').setInputFiles('dist/assets/set20-fresh/bedupper.png');await page.waitForFunction(()=>document.querySelectorAll('.video-source-tile').length===1);await page.locator('#videoTemplate').click();await page.waitForFunction(()=>document.querySelectorAll('.video-shot-card').length===4);
 console.log(await page.evaluate(()=>Object.fromEntries(['.video-design-body','.video-preview-column','#videoPreviewStage','#videoSourcePreview','.video-browser'].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return [s,{top:r.top,height:r.height,rows:c.gridTemplateRows,objectPosition:c.objectPosition,transform:c.transform,overflow:c.overflow,minHeight:c.minHeight}];}))));await page.screenshot({path:'output/video-story-layout-check.png'});
}finally{await browser.close();}
