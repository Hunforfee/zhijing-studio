import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const app=await readFile('dist/app.js','utf8'),html=await readFile('dist/index.html','utf8'),css=await readFile('dist/style.css','utf8');
// 页面里有两组全选按钮
assert.ok(html.includes('id="selectAllScenes"'),'index.html 缺少拍摄场景全选按钮');
assert.ok(html.includes('id="selectAllAngles"'),'index.html 缺少拍摄角度全选按钮');
// 样式与逻辑接线
assert.ok(css.includes('.select-all-button'),'style.css 缺少全选按钮样式');
assert.ok(app.includes('function syncSelectAllButtons'),'app.js 缺少 syncSelectAllButtons');
assert.ok(/\$\('selectAllScenes'\)\.onclick=/.test(app)&&/\$\('selectAllAngles'\)\.onclick=/.test(app),'app.js 未绑定全选点击');
assert.ok(app.includes('syncSelectAllButtons();updateCount()'),'renderSelections 未同步全选按钮状态');
// 在受控上下文中执行真实逻辑
const scenes=[{id:'warm'},{id:'natural'},{id:'hotel'},{id:'studio'},{id:'outdoor'},{id:'terrace'},{id:'minimal'},{id:'french'},{id:'kids'}];
const angles=[{id:'side'},{id:'front'},{id:'top'},{id:'detail'},{id:'left'},{id:'right'},{id:'low'},{id:'wide'},{id:'reverse'},{id:'foot'},{id:'pillowclose'},{id:'drape'}];
angles.push(...['headclose','foldleft','foldright','relaxed','pillowedge','sheetcorner','reverseclose','bedupper'].map(id=>({id,setOnly:true})));
const state={product:'set',scenes:['warm'],angles:['side'],busy:false,referenceUpload:null,referenceScene:true,referenceAngle:true};
const makeButton=()=>{const b={textContent:'',disabled:false,className:'',setAttribute(){}};b.classList={toggle(name,force){const has=b.className.split(/\s+/).includes(name);const enable=force??!has;b.className=b.className.split(/\s+/).filter(v=>v!==name).concat(enable?[name]:[]).filter(Boolean).join(' ');},contains:name=>b.className.split(/\s+/).includes(name)};return b};
const buttons={selectAllScenes:makeButton(),selectAllAngles:makeButton()};
const ctx=vm.createContext({fixedEngineSelected:()=>false,state,scenes,angles,$:id=>buttons[id],renderSelections(){}});
vm.runInContext(app.match(/function availableAngles\(\)\{[^\n]+/)[0],ctx);
vm.runInContext(app.match(/function syncSelectAllButtons\(\)\{[^\n]+/)[0],ctx);
vm.runInContext(app.match(/\$\('selectAllScenes'\)\.onclick=[^\n]+/)[0],ctx);
vm.runInContext(app.match(/\$\('selectAllAngles'\)\.onclick=[^\n]+/)[0],ctx);
const sync=()=>vm.runInContext('syncSelectAllButtons()',ctx);
// 场景：初始单选 → 全选 → 取消全选
sync();assert.equal(buttons.selectAllScenes.textContent,'全选');
vm.runInContext("$('selectAllScenes').onclick()",ctx);assert.equal(state.scenes.length,scenes.length,'场景全选后数量不对');assert.deepEqual(state.scenes,scenes.map(s=>s.id));
sync();assert.equal(buttons.selectAllScenes.textContent,'取消全选');assert.equal(buttons.selectAllScenes.className.includes('all-selected'),true);
vm.runInContext("$('selectAllScenes').onclick()",ctx);assert.equal(state.scenes.length,0,'再次点击应清空场景');sync();assert.equal(buttons.selectAllScenes.textContent,'全选');
// 角度：同上
sync();assert.equal(buttons.selectAllAngles.textContent,'全选');
vm.runInContext("$('selectAllAngles').onclick()",ctx);assert.equal(state.angles.length,angles.length,'角度全选后数量不对');assert.deepEqual(Array.from(state.angles),Array.from(vm.runInContext('availableAngles().map(a=>a.id)',ctx)));
sync();assert.equal(buttons.selectAllAngles.textContent,'取消全选');
vm.runInContext("$('selectAllAngles').onclick()",ctx);assert.equal(state.angles.length,0,'再次点击应清空角度');
// 生成中不可操作
state.busy=true;state.scenes=['warm'];vm.runInContext("$('selectAllScenes').onclick()",ctx);assert.deepEqual(state.scenes,['warm'],'生成中点击不应改动选择');sync();assert.equal(buttons.selectAllScenes.disabled,true,'生成中按钮应为禁用态');state.busy=false;
// 参考图锁定对应维度时禁用
state.referenceUpload={file:{}};state.referenceScene=true;state.referenceAngle=false;sync();
assert.equal(buttons.selectAllScenes.disabled,true,'参考场景时场景全选应禁用');
assert.equal(buttons.selectAllAngles.disabled,false,'仅参考场景时角度全选应可用');
state.referenceScene=false;state.referenceAngle=true;sync();
assert.equal(buttons.selectAllScenes.disabled,false,'仅参考角度时场景全选应可用');
assert.equal(buttons.selectAllAngles.disabled,true,'参考角度时角度全选应禁用');
console.log('拍摄场景/角度全选检查通过：全选、取消全选、生成中锁定、参考图维度锁定。');
