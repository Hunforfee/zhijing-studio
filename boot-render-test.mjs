import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = await readFile('dist/app.js', 'utf8');
const html = await readFile('dist/index.html', 'utf8');
const css = await readFile('dist/style.css', 'utf8');

// 启动标记必须写在 HTML 上，才能覆盖首次绘制（JS 之前）
assert.ok(html.includes('<body class="is-booting">'), 'body 应带 is-booting 启动标记，避免首屏闪烁');

// 初始化不得在历史决策前就渲染参考图
const initLine = app.match(/state\.results=referenceEntries\(\);[\s\S]*?setTimeout\(\(\)=>\{if\(historyPending\)revealBoot\(\)\},6000\);/);
assert.ok(initLine, 'app.js 缺少启动初始化语句');
assert.ok(!/renderSelections\(\);renderResults\(\)/.test(initLine[0]), '首屏不应立即渲染参考图');
// 关键回归：then 回调必须 return 历史加载的 promise，否则 bootDone 会提前渲染参考图
assert.ok(
  /status\(\)\.then\(\(\)=>loadLatestHistoryPreview\(\)\)/.test(initLine[0]),
  'then 回调必须返回 loadLatestHistoryPreview() 的 promise，否则会在历史加载完成前先渲染参考图',
);
assert.ok(!/then\(\(\)=>\{loadLatestHistoryPreview\(\)\}\)/.test(initLine[0]), '不要用不返回 promise 的块回调');
assert.ok(/historyPending=false;revealBoot\(\);if\(!rendered\)renderResults\(\)/.test(initLine[0]), '启动完成应移除标记且仅在未渲染时补渲染');
assert.ok(/setTimeout\(\(\)=>\{if\(historyPending\)revealBoot\(\)\},6000\)/.test(initLine[0]), '缺少 status() 卡住时的兜底');
// 历史加载成功时要回报已渲染，避免重复渲染
assert.ok(/renderResults\(\);return true\}catch\{\}\}/.test(app), 'loadLatestHistoryPreview 渲染后应 return true');

// 样式：启动态显示加载层并隐藏整个作品区（覆盖参考图占位画面），且带自动揭示兜底
assert.match(css, /body\.is-booting \.loading-overlay\{[^}]*display:flex!important/, '启动态应显示加载层');
assert.match(css, /body\.is-booting \.loading-overlay\{[^}]*animation:[^}]*6s/, '加载层应有 6 秒自动揭示兜底');
assert.match(css, /body\.is-booting \.results-panel\{[^}]*visibility:hidden/, '启动态应隐藏作品区，避免参考图占位画面闪现');
assert.match(css, /body\.is-booting \.results-panel\{[^}]*animation:[^}]*6\.5s/, '作品区应有兜底揭示，避免 JS 异常时永久空白');

// 在受控沙箱里真实执行初始化语句
const calls = [];
const timers = [];
const makeClassList = () => {
  const names = new Set(['is-booting']);
  return {
    add: v => names.add(v),
    remove: v => names.delete(v),
    contains: v => names.has(v),
  };
};
const body = {classList: makeClassList()};
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {textContent: ''});
  return nodes.get(id);
};
let resolveStatus;
const statusPromise = new Promise(resolve => { resolveStatus = resolve; });
let statusMode = 'ok';
const ctx = vm.createContext({
  state: {},
  document: {body},
  $: id => node(id),
  setTimeout: (fn, ms) => timers.push({fn, ms}),
  referenceEntries: () => ['reference'],
  renderOptions: () => calls.push('renderOptions'),
  renderSelections: () => calls.push('renderSelections'),
  renderResults: () => calls.push('renderResults'),
  status: () => (statusMode === 'ok' ? statusPromise : Promise.reject(new Error('offline'))),
  loadLatestHistoryPreview: async () => { calls.push('history'); },
});
const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

vm.runInContext(initLine[0], ctx);

// 1) 历史决策完成前：只准备选择器，不渲染画廊，启动标记保留
assert.deepEqual(calls, ['renderOptions', 'renderSelections'], '历史加载前不应渲染画廊');
assert.equal(body.classList.contains('is-booting'), true, '启动标记应保留到首屏渲染完成');
assert.equal(node('loadingTitle').textContent, '正在载入最近一次生成', '启动时应提示正在载入');
assert.equal(timers.length, 1, '应注册一次兜底定时器');
assert.equal(timers[0].ms, 6000, '兜底应为 6 秒');

// 2) 历史加载完成后：只渲染一次，并移除启动标记
resolveStatus();
await tick();
assert.equal(calls.filter(c => c === 'history').length, 1, '应加载一次历史预览');
assert.equal(calls.filter(c => c === 'renderResults').length, 1, '首屏应渲染一次');
assert.equal(body.classList.contains('is-booting'), false, '渲染后应移除启动标记');

// 3) 兜底定时器与重复触发都不应二次渲染
timers[0].fn();
await tick();
assert.equal(calls.filter(c => c === 'renderResults').length, 1, '兜底与重复触发不应重复渲染');

// 3b) 历史仍在加载时兜底触发：只揭示页面，不渲染参考图（避免参考图先闪、真图后到的闪烁）
const callsFallback = [];
const bodyF = {classList: makeClassList()};
const nodesF = new Map();
const nodeF = id => {
  if (!nodesF.has(id)) nodesF.set(id, {textContent: ''});
  return nodesF.get(id);
};
let resolveStatusF;
const ctxF = vm.createContext({
  state: {}, document: {body: bodyF}, $: id => nodeF(id),
  setTimeout: (fn, ms) => timers.push({fn, ms}),
  referenceEntries: () => ['reference'], renderOptions: () => {}, renderSelections: () => {},
  renderResults: () => callsFallback.push('renderResults'),
  status: () => new Promise(resolve => { resolveStatusF = resolve; }),
  loadLatestHistoryPreview: async () => { callsFallback.push('history'); return true; },
});
vm.runInContext(initLine[0], ctxF);
timers[timers.length - 1].fn();
await tick();
assert.equal(bodyF.classList.contains('is-booting'), false, '兜底应移除启动标记，页面不能永久空白');
assert.deepEqual(callsFallback, [], '历史未定论时兜底不得渲染参考图');
resolveStatusF();
await tick();
assert.deepEqual(callsFallback, ['history'], '兜底后历史仍应继续加载并自行渲染');

// 4) status() 失败时仍要出图，不能卡在启动态
const calls2 = [];
const body2 = {classList: makeClassList()};
const nodes2 = new Map();
const node2 = id => {
  if (!nodes2.has(id)) nodes2.set(id, {textContent: ''});
  return nodes2.get(id);
};
const ctx2 = vm.createContext({
  state: {}, document: {body: body2}, $: id => node2(id), setTimeout: () => {},
  referenceEntries: () => ['reference'], renderOptions: () => {}, renderSelections: () => {},
  renderResults: () => calls2.push('renderResults'),
  status: () => Promise.reject(new Error('offline')),
  loadLatestHistoryPreview: async () => { calls2.push('history'); },
});
vm.runInContext(initLine[0], ctx2);
await tick();
assert.deepEqual(calls2, ['renderResults'], '服务状态接口失败时也应渲染出图');
assert.equal(body2.classList.contains('is-booting'), false, '失败路径也应移除启动标记');

// 5) 历史加载自己渲染过（return true）时，bootDone 不应重复渲染
const calls3 = [];
const body3 = {classList: makeClassList()};
const nodes3 = new Map();
const node3 = id => {
  if (!nodes3.has(id)) nodes3.set(id, {textContent: ''});
  return nodes3.get(id);
};
const ctx3 = vm.createContext({
  state: {}, document: {body: body3}, $: id => node3(id), setTimeout: () => {},
  referenceEntries: () => ['reference'], renderOptions: () => {}, renderSelections: () => {},
  renderResults: () => calls3.push('renderResults'),
  status: async () => ({}),
  loadLatestHistoryPreview: async () => { calls3.push('history'); return true; },
});
vm.runInContext(initLine[0], ctx3);
await tick();
assert.deepEqual(calls3, ['history'], '历史已渲染时不应再调 renderResults');
assert.equal(body3.classList.contains('is-booting'), false, '仍应移除启动标记');

console.log('首屏渲染检查通过：先载入后渲染、无参考图闪烁、失败与超时兜底均能出图。');
