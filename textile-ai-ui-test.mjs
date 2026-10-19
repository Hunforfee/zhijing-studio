import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PNG} from 'pngjs';
import {createServer} from './server.mjs';

const require=createRequire('C:/Users/Hunfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const outputDir=await mkdtemp(path.join(os.tmpdir(),'zhijing-ai-workflows-')),calls=[];
function fixture(colors){const png=new PNG({width:160,height:120});for(let y=0;y<120;y++)for(let x=0;x<160;x++){const i=(y*160+x)*4;png.data.set(colors[x<80?0:1],i);}return PNG.sync.write(png);}
const original=fixture([[180,65,75,255],[65,135,105,255]]),candidate=fixture([[45,85,125,255],[205,155,95,255]]);
const input={name:'主花型.png',mimeType:'image/png',buffer:original},detail={...input,name:'细节.png',buffer:candidate};
const colors=['#F5F1E8','#708769','#D5B2A0','#425F50'];
const plans={
 palette:{summary:'原稿主纹保留清晰层次，尝试低饱和的系列色。',palettes:['晨雾绿','花间暖','暮色蓝'].map((name,i)=>({name,colors:i?[...colors].reverse():colors,reason:'主色与底色形成温和的层次。'}))},
 moodboard:{title:'晨光花语提案',note:'让细节与主图一起表达自然的卧室氛围。',colors,order:[1,0],layout:'grid',background:'#F5F1E8',reason:'先展示细节，再组合主花型。'},
 delivery:{ratio:'9:16',fit:'contain',format:'image/png',maxEdge:640,quality:85,prefix:'晨光系列',reason:'适合移动端竖版页面，完整展示主体。'},
 copy:{titles:['春日四件套，纯棉与宽边设计'],bullets:['纯棉材质','宽边设计'],body:'把喜欢的花型带进卧室。春日四件套，以纯棉材质与宽边设计，表达日常的从容。'}
};
let invalidCopy=false,holdPalette=false,releasePalette,enteredPalette;
const server=createServer({outputDir,stylingReferencePaths:[],service:{provider:'sub2api',apiKey:'mock-only-key',baseUrl:'https://mock-ai.example/v1',model:'gpt-image-2'},videoOptions:{loadConfig:async()=>null,checkComposer:async()=>false},fetchImpl:async(url,init)=>{
 if(url.endsWith('/responses')){const payload=JSON.parse(init.body),text=payload.input[0].content.find(item=>item.type==='input_text').text,kind=text.match(/TEXTILE_KIND=(\w+)/)?.[1];assert.ok(plans[kind],text);calls.push({kind,payload});if(holdPalette&&kind==='palette'){enteredPalette();await new Promise(resolve=>releasePalette=resolve);}await new Promise(resolve=>setTimeout(resolve,90));const value=invalidCopy&&kind==='copy'?{...plans.copy,body:'未经证实的抗菌认证'}:plans[kind];return Response.json({output_text:JSON.stringify(value)});}
 assert.ok(url.endsWith('/images/edits'),url);calls.push({kind:'image',prompt:init.body.get('prompt')});return Response.json({data:[{b64_json:candidate.toString('base64')}]});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(base)||/^(data|blob):/.test(route.request().url())?route.continue():route.abort());
 await page.goto(base+'/tools?tool=recolor',{waitUntil:'networkidle'});assert.equal(calls.length,0);
 const panel=id=>page.locator('#panel-'+id),button=(id,text)=>panel(id).getByRole('button',{name:text,exact:true});
 const go=async id=>{await page.locator('[data-tool-link="'+id+'"]').click();await panel(id).waitFor();};
 const upload=async(id,files=input)=>{await page.locator('#'+id+'Upload').setInputFiles(files);await page.waitForFunction(id=>{const node=document.querySelector('#panel-'+id+' .tt-ai-start');return node&&!node.disabled;},id);};
 const generate=async id=>{await panel(id).locator('.tt-ai-start').click();await panel(id).locator('.tt-ai-results:not([hidden])').waitFor({timeout:30000});await page.waitForFunction(id=>!document.querySelector('#panel-'+id+' .tt-ai-start').disabled,id);};
 const canvasData=async id=>page.locator('#'+id+'Canvas').evaluate(node=>node.toDataURL());
 const download=async(selector,name)=>{const waiting=page.waitForEvent('download');await selector.click();const target=path.join(outputDir,name);await(await waiting).saveAs(target);return readFile(target);};

 await upload('recolor');const before=await canvasData('recolor');await generate('recolor');assert.equal(calls.length,1);assert.equal(await canvasData('recolor'),before,'candidate must not change original');assert.equal(await panel('recolor').locator('.tt-ai-palette-options article').count(),3);
 await button('recolor','采用这组配色').first().click();assert.notEqual(await canvasData('recolor'),before);assert.ok((await button('recolor','采用这组配色').evaluateAll(elements=>elements.every(node=>node.disabled))));await button('recolor','撤回本次 AI 方案').click();assert.equal(await canvasData('recolor'),before);
 await button('recolor','采用这组配色').last().click();assert.notEqual(await canvasData('recolor'),before);
 await mkdir('.share',{recursive:true});await page.screenshot({path:'.share/textile-ai-palette.png',fullPage:true});

 await go('board');await upload('board',[input,detail]);await generate('board');assert.equal(await page.locator('#boardTitle').inputValue(),'');assert.equal(await page.locator('.tt-board-item span').first().textContent(),'主花型.png');await button('board','采用 AI 搭配方案').click();assert.equal(await page.locator('#boardTitle').inputValue(),'晨光花语提案');assert.equal(await page.locator('#boardLayout').inputValue(),'grid');assert.equal(await page.locator('.tt-board-item span').first().textContent(),'细节.png');assert.ok((await download(page.locator('#boardDownload'),'board.png')).length>1000);await button('board','撤回本次 AI 方案').click();assert.equal(await page.locator('.tt-board-item span').first().textContent(),'主花型.png');

 await go('delivery');await upload('delivery',[input,detail]);await generate('delivery');assert.equal(await page.locator('#deliveryRatio').inputValue(),'source');await button('delivery','应用 AI 参数，再批量处理').click();assert.equal(await page.locator('#deliveryRatio').inputValue(),'9:16');assert.equal(await page.locator('#deliveryFormat').inputValue(),'image/png');assert.equal(await page.locator('#deliveryDownload').isDisabled(),true);await page.locator('#deliveryUpscale').check();await page.locator('#deliveryRun').click();await page.waitForFunction(()=>!document.getElementById('deliveryZIP').disabled);const zip=await download(page.locator('#deliveryZIP'),'delivery.zip');assert.ok(zip.includes(Buffer.from('晨光系列_001.png')));const bytes=await download(page.locator('#deliveryDownload'),'delivery.png');const png=PNG.sync.read(bytes);assert.deepEqual([png.width,png.height],[360,640]);

 await go('copy');await page.locator('#copyName').fill('春日四件套');await page.locator('#copyMaterial').fill('纯棉');await page.locator('#copyCraft').fill('宽边设计');await page.locator('#copyRun').click();const basic=await page.locator('#copyOutput').inputValue();await generate('copy');assert.equal(await page.locator('#copyOutput').inputValue(),basic);await button('copy','采用 AI 文案').click();assert.match(await page.locator('#copyOutput').inputValue(),/把喜欢的花型带进卧室/);await page.locator('#copyOutput').fill('春日四件套 · 用户精修后的商品文案');assert.match((await download(page.locator('#copyDownload'),'copy-edited.txt')).toString(),/用户精修后的商品文案/);await button('copy','撤回本次 AI 方案').click();assert.equal(await page.locator('#copyOutput').inputValue(),basic);
 invalidCopy=true;await panel('copy').locator('.tt-ai-start').click();await page.waitForFunction(()=>document.querySelector('#panel-copy .tt-ai-status').dataset.error==='true');assert.equal(await page.locator('#copyOutput').inputValue(),basic,'invalid model facts preserve prior output');assert.match(await panel('copy').locator('.tt-ai-status').textContent(),/依据|事实|信息|证实|填写|确认/);invalidCopy=false;

 await go('extract');await upload('extract');await page.locator('#extractWidth').fill('160');await page.locator('#extractHeight').fill('120');await generate('extract');assert.equal(await page.locator('#extractDownload').isDisabled(),true);assert.equal(await panel('extract').locator('.tt-ai-image-compare img').count(),2);await button('extract','采用 AI 结果并继续编辑').click();const extracted=PNG.sync.read(await download(page.locator('#extractDownload'),'extract-ai.png'));assert.deepEqual([extracted.width,extracted.height],[160,120]);assert.deepEqual([...extracted.data.slice(0,4)],[45,85,125,255]);

 await go('repeat');await upload('repeat');await generate('repeat');assert.equal(await page.locator('#repeatMode').inputValue(),'mirror');await button('repeat','采用 AI 结果并继续编辑').click();assert.equal(await page.locator('#repeatMode').inputValue(),'straight');assert.ok((await download(page.locator('#repeatDownload'),'repeat-ai.png')).length>100);
 const invariants=await page.evaluate(async()=>{const{offsetPattern,repairedPattern}=await import('/textile-ai-images.js');const source=document.createElement('canvas');source.width=101;source.height=79;const ctx=source.getContext('2d'),pixels=ctx.createImageData(101,79);for(let i=0;i<pixels.data.length;i+=4)pixels.data.set([(i/4)%255,80,160,(i/4)%7?255:80],i);ctx.putImageData(pixels,0,0);const offset=offsetPattern(source),roundtrip=offsetPattern(offset,true),other=document.createElement('canvas');other.width=101;other.height=79;other.getContext('2d').fillStyle='#ffffff';other.getContext('2d').fillRect(0,0,101,79);const repaired=offsetPattern(repairedPattern(offset,other)),a=offset.getContext('2d').getImageData(0,0,101,79).data,b=repaired.getContext('2d').getImageData(0,0,101,79).data,c=roundtrip.getContext('2d').getImageData(0,0,101,79).data;let preserved=true,alpha=true,changed=false,roundtripOK=true;for(let y=0;y<79;y++)for(let x=0;x<101;x++){const i=(y*101+x)*4,outside=Math.abs((x+.5)/101-.5)>.15&&Math.abs((y+.5)/79-.5)>.15;for(let k=0;k<4;k++){if(outside&&a[i+k]!==b[i+k])preserved=false;if(a[i+k]!==b[i+k])changed=true;if(Math.abs(pixels.data[i+k]-c[i+k])>2)roundtripOK=false;}if(a[i+3]!==b[i+3])alpha=false;}return{preserved,alpha,changed,roundtripOK};});assert.deepEqual(invariants,{preserved:true,alpha:true,changed:true,roundtripOK:true});

 await go('recolor');holdPalette=true;const entered=new Promise(resolve=>enteredPalette=resolve),lockedPixels=await canvasData('recolor');await panel('recolor').locator('.tt-ai-start').click();await entered;await go('extract');await page.locator('#extractNext').selectOption('recolor');await page.locator('#extractContinue').click();await page.waitForFunction(()=>document.getElementById('extractStatus').textContent.includes('正在处理'));assert.equal(await panel('extract').isVisible(),true);releasePalette();holdPalette=false;await go('recolor');await page.waitForFunction(()=>!document.querySelector('#panel-recolor .tt-ai-start').disabled);assert.equal(await canvasData('recolor'),lockedPixels,'cross-tool transfer must not overwrite an AI task source');
 for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:700}]){await page.setViewportSize(viewport);const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify({viewport,size}));}
 assert.deepEqual(errors,[]);assert.deepEqual(calls.map(call=>call.kind),['palette','moodboard','delivery','copy','copy','image','image','palette']);assert.match(calls.at(-2).prompt,/CENTER vertical and horizontal cross/);
 console.log(JSON.stringify({aiTools:6,explicitPreviewAndAdoption:true,undo:true,invalidFactsPreserveOutput:true,seamRepairPreservesOutside:true,crossToolSourceProtected:true,actualExports:true,mockRequests:calls.length,paidRequests:0,viewports:5}));
}finally{releasePalette?.();await browser.close();await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())+path.sep+'zhijing-ai-workflows-'));await rm(outputDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
