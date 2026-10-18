import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setCameraDirections,cameraAtlases,cameraCellFor,singleProductAngleName} from './dist/camera-contract.js';
import {buildPrompt} from './server.mjs';
import {buildZhipuPrompt} from './zhipu-prompts.mjs';
const app=await readFile('dist/app.js','utf8');
const base={product:'set',size:'普通平床单：床侧和床尾自然下垂',fabric:'cotton',fabricMode:'auto',ratio:'1:1',repeat:'tile',scale:100,direction:0,notes:''};
test('all twenty approved atlas cells use the same names and camera rules in UI and both providers',()=>{
  const context=vm.createContext({state:base,cameraTools:{singleProductAngleName}});
  vm.runInContext(app.match(/function angleDisplayName\([^\n]+/)[0],context);
  assert.equal(Object.keys(setCameraDirections).length,20);
  for(const [id,rule] of Object.entries(setCameraDirections)){
    assert.equal(cameraCellFor(base,id),cameraAtlases.set.angleIds.indexOf(id));
    context.angle={id,name:'old generic name'};
    assert.equal(vm.runInContext('angleDisplayName(angle)',context),rule.name);
    const prompt=buildPrompt(base,'warm',id);
    assert.ok(prompt.includes(`Camera: [${id}: ${rule.name}]`),id+' label');
    assert.ok(prompt.includes(rule.prompt),id+' English geometry');
    assert.ok(buildZhipuPrompt(base,'warm',id,'fabric').includes(rule.zh),id+' Chinese geometry');
  }
});
test('moved diagonal and corrected elevated/detail frames do not retain their old camera instructions',()=>{
  const rules=Object.fromEntries(Object.keys(setCameraDirections).map(id=>[id,buildPrompt(base,'warm',id)]));
  assert.match(rules.side,/headboard toward upper-right/);
  assert.match(rules.relaxed,/headboard toward upper-left/);
  assert.match(rules.top,/55-65 degrees/);
  assert.doesNotMatch(rules.top,/exactly 90-degree|Overhead is still vertical 90/);
  assert.doesNotMatch(rules.low,/10-20 cm below|low is still near mattress height/);
  assert.doesNotMatch(rules.bedupper,/high 60-degree diagonal/);
  const context=vm.createContext({state:base,angles:Object.keys(setCameraDirections).map(id=>({id}))});
  vm.runInContext(app.match(/function availableAngles\(\)\{[^\n]+/)[0],context);
  assert.deepEqual(Array.from(vm.runInContext('availableAngles().slice(0,2).map(a=>a.id)',context)),['side','relaxed']);
  assert.equal(singleProductAngleName('quilt','top','俯视平铺'),'俯视平铺');
});
