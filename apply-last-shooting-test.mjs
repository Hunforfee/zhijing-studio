import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// vm 沙箱里的数组原型与宿主不同，统一按 JSON 比较
const same=(actual,expected,label)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected),label);
const app=await readFile('dist/app.js','utf8'),html=await readFile('dist/index.html','utf8'),css=await readFile('dist/style.css','utf8');
// 按钮挂在 03 拍摄场景与角度 组标题栏内
assert.ok(html.includes('id="shootingGroupTitle"><b>03</b> 拍摄场景与角度<button type="button" id="applyLastShooting"'),'index.html 的 03 组标题缺少「应用上次」按钮');
assert.ok(html.includes('class="apply-last-shooting" disabled'),'「应用上次」按钮应默认禁用');
assert.ok(css.includes('.apply-last-shooting'),'style.css 缺少「应用上次」按钮样式');
assert.ok(css.includes('margin-left:auto'),'「应用上次」按钮应靠右对齐');
// 回归：updateCount 在初始化早期（约第 66 行 renderSelections）就会调用 refreshApplyLastButton。
// 若 lastShootingPlan 用 let 且声明在调用点之后，页面加载时会因 TDZ 报错导致整站 JS 失效。
assert.ok(app.includes('var lastShootingPlan'),'lastShootingPlan 必须用 var 声明（hoisting），否则初始化期 TDZ 报错');
assert.ok(app.indexOf('function updateCount()')<app.indexOf('// SHOOTING_PLAN_CACHE_START'),'updateCount 早于 SHOOTING_PLAN_CACHE 区块，印证了必须使用 var/hoisting 的原因');
// 逻辑接线
const block=app.slice(app.indexOf('// SHOOTING_PLAN_CACHE_START'),app.indexOf('// SHOOTING_PLAN_CACHE_END'));
assert.ok(block.length>0,'app.js 缺少 SHOOTING_PLAN_CACHE 区块');
assert.ok(app.includes('function refreshApplyLastButton'),'app.js 缺少 refreshApplyLastButton');
assert.ok(app.includes('function rememberShootingPlan'),'app.js 缺少 rememberShootingPlan');
assert.ok(/\$\('applyLastShooting'\)\.onclick=applyLastShootingPlan;/.test(app),'app.js 未绑定「应用上次」点击');
assert.ok(/refreshPatternProof\(\);\r?\n  rememberShootingPlan\(\);/.test(app),'生成开始时未记录上次方案');
assert.ok(/if\(typeof refreshApplyLastButton==='function'\)refreshApplyLastButton\(\);/.test(app),'updateCount 未同步「应用上次」按钮状态');

// 在受控上下文中执行真实逻辑
const scenes=[{id:'warm'},{id:'natural'},{id:'hotel'},{id:'studio'},{id:'outdoor'},{id:'terrace'},{id:'minimal'},{id:'french'},{id:'kids'}];
const angles=[{id:'side'},{id:'front'},{id:'top'},{id:'detail'},{id:'left'},{id:'right'},{id:'low'},{id:'wide'},{id:'reverse'},{id:'foot'},{id:'pillowclose'},{id:'drape'}];
const store=new Map();
const state={product:'set',scenes:['warm'],angles:['side'],busy:false,referenceUpload:null,referenceScene:true,referenceAngle:true};
const makeButton=()=>{const b={textContent:'',disabled:false,title:'',className:'',setAttribute(){},offsetWidth:0};b.classList={toggle(name,force){const has=b.className.split(/\s+/).includes(name);const enable=force??!has;b.className=b.className.split(/\s+/).filter(v=>v!==name).concat(enable?[name]:[]).filter(Boolean).join(' ');},add(name){if(!b.classList.contains(name))b.classList.toggle(name,true)},remove(name){b.classList.toggle(name,false)},contains:name=>b.className.split(/\s+/).includes(name)};return b};
const button=makeButton(),messages=[],saved=[];
const ctx=vm.createContext({state,scenes,angles,messages,saved,toast:t=>messages.push(t),renderSelections(){},setTimeout(){},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,v);saved.push(v)}},$:id=>id==='applyLastShooting'?button:null});
vm.runInContext(block.replace(/^\$\('applyLastShooting'\)\.onclick=applyLastShootingPlan;$/m,''),ctx);
const run=code=>vm.runInContext(code,ctx);
run('refreshApplyLastButton()');

// 无历史记录：按钮禁用并给出说明
assert.equal(button.disabled,true,'无历史记录时按钮应禁用');
assert.equal(button.textContent,'应用上次');
assert.match(button.title,/生成一次后/);
run("applyLastShootingPlan()");
assert.match(messages.at(-1),/还没有上次的拍摄方案/,'无历史时点击应提示');

// 生成一次 → 写入历史，按钮点亮
state.scenes=['studio','french'];state.angles=['front','top','pillowclose'];
run('rememberShootingPlan()');
assert.equal(button.disabled,false,'有历史记录后按钮应可用');
assert.equal(button.classList.contains('has-history'),true,'有历史时应加高亮类');
assert.match(button.title,/2 个场景 · 3 个角度/);
assert.equal(saved.length,1,'应写入 localStorage');
const persisted=JSON.parse(store.get('zhijing.lastShootingPlan.v1'));
same(persisted.scenes,['studio','french']);
same(persisted.angles,['front','top','pillowclose']);

// 改动当前选择后点击 → 恢复上次
state.scenes=['warm'];state.angles=['side'];
run('applyLastShootingPlan()');
same(state.scenes,['studio','french'],'场景未恢复');
same(state.angles,['front','top','pillowclose'],'角度未恢复');
assert.match(messages.at(-1),/已应用上次：2 个场景 · 3 个角度/);

// 刷新页面后仍可从 localStorage 读回
state.scenes=['minimal'];
run('lastShootingPlan=readShootingPlan()');
same(run('lastShootingPlan').scenes,['studio','french'],'刷新后应能读回上次方案');
run('refreshApplyLastButton()');
assert.equal(button.disabled,false,'读回后按钮应可用');

// 脏数据：未知 id 全部被丢弃
store.set('zhijing.lastShootingPlan.v1',JSON.stringify({scenes:['nope','hotel'],angles:['bogus'],savedAt:1}));
run('lastShootingPlan=readShootingPlan()');
assert.equal(run('lastShootingPlan'),null,'全无效的记录应视为无历史');
store.set('zhijing.lastShootingPlan.v1','{ broken json');
run('lastShootingPlan=readShootingPlan()');
assert.equal(run('lastShootingPlan'),null,'损坏的 JSON 不应抛错');
store.set('zhijing.lastShootingPlan.v1',JSON.stringify({scenes:['nope','hotel'],angles:['low'],savedAt:1}));
run('lastShootingPlan=readShootingPlan()');
same(run('lastShootingPlan').scenes,['hotel'],'应过滤掉未知场景 id');
assert.equal(run('lastShootingPlan').angles.length,1,'应过滤掉未知角度 id');

// 生成中不可操作
store.set('zhijing.lastShootingPlan.v1',JSON.stringify({scenes:['studio'],angles:['front'],savedAt:1}));
run('lastShootingPlan=readShootingPlan()');
state.busy=true;state.scenes=['warm'];state.angles=['side'];
run("applyLastShootingPlan()");
same(state.scenes,['warm'],'生成中点击不应改动选择');
assert.match(messages.at(-1),/请等待当前生成完成/);
run('refreshApplyLastButton()');
assert.equal(button.disabled,true,'生成中按钮应为禁用态');
state.busy=false;

// 参考图接管两个维度时禁用，仅接管一个维度时只恢复另一维度
state.referenceUpload={file:{}};state.referenceScene=true;state.referenceAngle=true;
run('refreshApplyLastButton()');
assert.equal(button.disabled,true,'参考图接管场景与角度时按钮应禁用');
run('applyLastShootingPlan()');
assert.match(messages.at(-1),/无需应用/);
state.referenceAngle=false;
run('refreshApplyLastButton()');
assert.equal(button.disabled,false,'仅参考场景时按钮应可用');
state.scenes=['warm'];state.angles=['side'];
run('applyLastShootingPlan()');
same(state.scenes,['warm'],'参考场景时不应改动场景选择');
same(state.angles,['front'],'仅参考场景时应恢复角度');
console.log('「应用上次」检查通过：记录、恢复、持久化、脏数据过滤、生成中与参考图锁定。');
