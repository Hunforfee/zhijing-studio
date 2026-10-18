import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createTestDocument} from './test-dom.mjs';
const app=await readFile('dist/app.js','utf8'),history=await readFile('dist/image-history.js','utf8'),css=await readFile('dist/style.css','utf8'),html=await readFile('dist/index.html','utf8');
// 右上角放大按钮已移除，改为点击主图打开查看器
assert.ok(!html.includes('id="zoomBtn"'),'右上角放大按钮应已移除');
assert.ok(/\$\('heroImage'\)\.onclick=zoom;\$\('heroCanvas'\)\.onclick=zoom;/.test(app),'点击主图应接入放大');
assert.match(css,/\.gallery-main \.hero-frame>(img|canvas)[^{]*\{[^}]*cursor:zoom-in/,'主图悬停应为放大光标');
assert.match(css,/\.large-viewer \.large-preview\{[^}]*cursor:zoom-in/,'弹窗大图悬停应为放大光标');
assert.ok(!/\.large-viewer \.large-preview\.zoomed\{[^}]*cursor:/.test(css),'放大后光标应保持 + 号，不应变成 − 号');
assert.match(css,/\.large-viewer \.large-preview\{[^}]*-webkit-user-drag:none/,'应禁止浏览器原生图片拖拽');
// 两个入口都接入同一个查看器
assert.ok(/function zoom\(\)\{[^}]*openImageViewer\(/.test(app),'当前生成的放大未接入 openImageViewer');
assert.ok(/historyZoom'\)\.onclick=[\s\S]{0,400}?openImageViewer/.test(history),'历史图片的放大未接入 openImageViewer');
// 样式：弹窗不滚动、大图受视口高度约束、箭头存在
assert.match(css,/dialog:has\(\.large-viewer\)\{[^}]*overflow:hidden/,'弹窗应禁止滚动');
assert.match(css,/\.large-viewer \.large-preview\{[^}]*max-height:[^}]*vh/,'大图应受视口高度约束');
assert.match(css,/\.viewer-arrow\{/,'缺少左右切换箭头样式');
// 在受控 DOM 中执行真实函数
const {document}=createTestDocument('<dialog id="modal"><button class="close-modal"></button><div id="modalContent"></div></dialog>');
const dialog=document.getElementById('modal');let opened=false;dialog.showModal=()=>{opened=true;dialog.open=true};
const ctx=vm.createContext({document,$:id=>document.getElementById(id),modal(html){document.getElementById('modalContent').innerHTML=html;dialog.showModal()}});
vm.runInContext(app.match(/function openImageViewer\(items,index\)\{[^\n]+/)[0],ctx);
const content=()=>document.getElementById('modalContent');
const items=[{src:()=>'one.png',title:'图片 #1'},{src:()=>'two.png',title:'图片 #2'},{src:()=>'three.png',title:'图片 #3'}];
vm.runInContext('openImageViewer(items,0)',Object.assign(ctx,{items}));
assert.equal(opened,true,'应打开弹窗');
assert.equal(content().querySelector('h2').textContent,'图片 #1');
assert.equal(content().querySelector('.large-preview').src,'one.png');
assert.equal(content().querySelector('.viewer-counter').textContent,'1 / 3');
assert.equal(content().querySelectorAll('.viewer-arrow').length,2,'应有左右两个箭头');
assert.equal(content().querySelectorAll('.viewer-arrow').every(button=>!button.hidden),true,'多图时箭头应显示');
// 左箭头循环到最后一张，右箭头回到第一张
content().querySelector('.viewer-prev').onclick();
assert.equal(content().querySelector('.large-preview').src,'three.png','左箭头应切到前一张（末位循环）');
assert.equal(content().querySelector('.viewer-counter').textContent,'3 / 3');
content().querySelector('.viewer-next').onclick();
assert.equal(content().querySelector('.large-preview').src,'one.png','右箭头应切到后一张（末位循环）');
assert.equal(content().querySelector('h2').textContent,'图片 #1');
// 中途进入也能正确定位
vm.runInContext('openImageViewer(items,1)',ctx);
assert.equal(content().querySelector('.large-preview').src,'two.png');
assert.equal(content().querySelector('.viewer-counter').textContent,'2 / 3');
// 单张时不显示箭头与计数
vm.runInContext('openImageViewer([items[0]],0)',ctx);
assert.equal(content().querySelectorAll('.viewer-arrow').every(button=>button.hidden),true,'单张时应隐藏箭头');
assert.equal(content().querySelector('.viewer-counter').hidden,true,'单张时应隐藏计数');
// 点击大图渐进放大（100→150→225→340%），超过上限回到原始，放大态可滚动平移
const previewEl=content().querySelector('.large-preview');
const zoomState=()=>({width:previewEl.style.width,zoomed:previewEl.classList.contains('zoomed'),viewerZoomed:content().querySelector('.preview-scroll').classList.contains('zoomed')});
previewEl.onclick();
assert.deepEqual(zoomState(),{width:'150%',zoomed:true,viewerZoomed:true},'第一次点击应放大到 150%');
previewEl.onclick();
assert.deepEqual(zoomState(),{width:'225%',zoomed:true,viewerZoomed:true},'第二次点击应放大到 225%');
previewEl.onclick();
assert.deepEqual(zoomState(),{width:'340%',zoomed:true,viewerZoomed:true},'第三次点击应到达上限 340%');
previewEl.onclick();
assert.deepEqual(zoomState(),{width:'100%',zoomed:false,viewerZoomed:false},'超过上限应还原到 100%');
// 放大后按住左键拖动可平移查看，拖动不会误触发缩放
previewEl.onclick();
const viewerEl=content().querySelector('.preview-scroll');
viewerEl.scrollLeft=40;viewerEl.scrollTop=30;
previewEl.listeners.mousedown({button:0,clientX:200,clientY:200,preventDefault(){}});
previewEl.listeners.mousemove({clientX:170,clientY:185});
assert.equal(viewerEl.scrollLeft,70,'向左上拖动应增大 scrollLeft');
assert.equal(viewerEl.scrollTop,45,'向上拖动应增大 scrollTop');
previewEl.onclick();
assert.equal(previewEl.style.width,'150%','拖动后的 click 不应改变缩放');
previewEl.onclick();
assert.equal(previewEl.style.width,'225%','拖动抑制只应影响一次点击');
previewEl.listeners.mouseup({});
// 未放大时按住拖动不应平移
vm.runInContext('openImageViewer(items,0)',Object.assign(ctx,{items}));
const freshPreview=content().querySelector('.large-preview'),freshViewer=content().querySelector('.large-viewer');
freshViewer.scrollLeft=25;
freshPreview.listeners.mousedown({button:0,clientX:100,clientY:100,preventDefault(){}});
freshPreview.listeners.mousemove({clientX:60,clientY:100});
assert.equal(freshViewer.scrollLeft,25,'未放大时拖动不应平移');
content().querySelector('.large-preview').classList.add('zoomed');content().querySelector('.preview-scroll').classList.add('zoomed');
vm.runInContext('openImageViewer(items,0)',Object.assign(ctx,{items}));
assert.equal(content().querySelector('.large-preview').classList.contains('zoomed'),false,'重新打开应复位放大态');
assert.match(css,/\.large-viewer \.preview-scroll\{[^}]*max-height:[^}]*vh/,'滚动容器应受视口高度约束');
assert.match(css,/\.large-viewer \.preview-scroll\.zoomed\{[^}]*overflow:auto/,'放大超出屏幕时应出现滚动条');
// 缩放滚动容器独立于箭头列，拖动图片不会把切换箭头一起滚走
assert.ok(/<div class="preview-scroll"><img class="large-preview"/.test(app),'大图应包在独立滚动容器内');
const scrollHost=previewEl.parentNode;
assert.equal(scrollHost.classList.contains('preview-scroll'),true,'滚动容器应为 preview-scroll');
const arrows=content().querySelectorAll('.viewer-arrow');
assert.equal(arrows.length,2,'应有两个切换箭头');
assert.equal(arrows.every(button=>button.parentNode.classList.contains('large-viewer')),true,'两个箭头应留在滚动容器之外');
console.log('弹窗大图查看检查通过：自适应视口、左右循环切换、计数同步、单张隐藏箭头、点击放大还原。');
