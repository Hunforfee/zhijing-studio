import {chromium} from 'file:///C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/');await page.waitForTimeout(1000);
const images=await page.evaluate(async()=>{
 const {createFixedClothRenderer}=await import('/fixed-cloth-renderer.js');
 const tex=color=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,64,64);return c.toDataURL();};
 const opt={product:'set',size:'被套简约细缝边；普通平床单：自然垂落；两只枕套简约细缝边',scale:100,direction:0,repeat:'tile',ratio:'1:1'};
 const r=await createFixedClothRenderer(opt,tex('#d54139'),tex('#3775d9'));const out={metadata:r.metadata};for(const angle of ['front','side','top','reverse'])out[angle]=(await r.render('warm',angle)).toDataURL();r.dispose();return out;
});for(const angle of ['front','side','top','reverse'])await writeFile('.share/fixed-cloth-'+angle+'.png',Buffer.from(images[angle].split(',')[1],'base64'));console.log(JSON.stringify({errors,metadata:images.metadata,engineControl:await page.locator('#generationEngine').count()}));
}finally{await browser.close();}

