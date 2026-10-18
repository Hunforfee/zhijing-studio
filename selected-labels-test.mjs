import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=await readFile('dist/app.js','utf8'),set=await readFile('dist/set-variants.js','utf8'),mat=await readFile('dist/mat-variants.js','utf8'),quilt=await readFile('dist/quilt-variants.js','utf8');
const label={children:[],replaceChildren(...items){this.children=items}},purpose={},trigger={dataset:{get product(){return ctx.state.product}},title:'',classList:{add(){}},setAttribute(){},querySelector:()=>label};
const ctx=vm.createContext({state:{productVariantChoices:{set:true,mat:true,quilt:true},product:'set',fabric:'cotton',fabricMode:'auto',quiltSeason:'winter'},document:{createElement:()=>({}),querySelector:selector=>selector.includes('group-purpose')?purpose:trigger},$:()=>({textContent:''}),variantPanel:{hidden:true,querySelector:()=>({})},matVariantPanel:{hidden:true},quiltVariantPanel:{hidden:true,querySelector:()=>({})}});
vm.runInContext(app.match(/function renderChosenProductLabel\([^\n]+/)[0],ctx);
vm.runInContext(set.split('const variantPanel=')[0]+set.match(/function renderSetVariantControl\([^\n]+/)[0],ctx);
vm.runInContext("chosenSheetVariant='fitted';chosenDuvetVariant='piping';renderSetVariantControl()",ctx);assert.equal(label.children[0].textContent,'四件套');assert.equal(label.children[1].textContent,'被套埋绳款 · 床笠款 · 枕套简约工艺');
vm.runInContext("chosenDuvetVariant='wide-flange';renderSetVariantControl()",ctx);assert.equal(label.children[1].textContent,'被套宽边款 · 床笠款 · 枕套简约工艺');
vm.runInContext(mat.split('const matVariantPanel=')[0]+mat.match(/function renderMatVariantControl\([^\n]+/)[0],ctx);
ctx.state.product='mat';for(const id of ['ice','rattan','bamboo']){ctx.state.fabric=id;ctx.state.fabricMode='selected';vm.runInContext('renderMatVariantControl()',ctx);assert.equal(label.children[1].textContent,{ice:'冰丝席',rattan:'藤席',bamboo:'竹席'}[id]);}
vm.runInContext(quilt.split('const quiltVariantPanel=')[0]+quilt.match(/function renderQuiltVariantControl\([^\n]+/)[0],ctx);ctx.state.product='quilt';
for(const season of ['winter','summer']){ctx.state.quiltSeason=season;vm.runInContext('renderQuiltVariantControl()',ctx);assert.equal(label.children[0].textContent,'被芯');assert.equal(label.children[1].textContent,season==='winter'?'冬被':'夏凉被');}
console.log('主菜单显示检查通过：四件套三组独立组合、3 种凉席、冬被/夏凉被。');
