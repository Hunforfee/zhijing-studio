import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {normalizeSetOptions} from './shooting-set-plan.mjs';
import {createRecommendationPlan} from './shooting-recommendation.mjs';

test('new smart defaults supply 21 images per scene and retain legacy defaults',()=>{
 const v=normalizeSetOptions({product:'set',smartAngles:true,scenes:['warm','natural'],angles:['front']});
 assert.deepEqual(v.setCounts,{main:15,duvet:2,sheet:2,pillow:2,detail:0});assert.equal(v.recommendCount,21);
 const plan=createRecommendationPlan(v);assert.equal(plan.length,42);
 for(let i=0;i<2;i++)assert.deepEqual(plan.slice(i*21,(i+1)*21).map(s=>s.shotKind),[...Array(15).fill('main'),'duvet','duvet','sheet','sheet','pillow','pillow']);
 assert.equal(normalizeSetOptions({product:'set',generateSet:true}).recommendCount,15);
 assert.throws(()=>normalizeSetOptions({...v,setCounts:{main:0,duvet:0,sheet:0,pillow:0,detail:0}}));
});

test('clear counts preserves last-used counts, scenes and mode and supports refilling',async()=>{
 const source=await readFile('dist/shooting-recommendation.js','utf8'),nodes=new Map(),store=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(){},closest(){return {hidden:false}},classList:{toggle(){}}});return nodes.get(id)};
 const state={product:'set',scenes:['warm','hotel'],recommendAngle:true,busy:false};let updated=0;
 const ctx=vm.createContext({state,$:node,document:{querySelector:()=>node('box')},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},updateCount:()=>updated++,toast(){},renderSelections(){}});
 vm.runInContext(source.split('// Angle choices')[0],ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(state.setCounts)),{main:15,duvet:2,sheet:2,pillow:2});
 vm.runInContext('rememberSmartAngleCounts()',ctx);const saved=[...store.values()][0];
 node('clearAngleCounts').onclick();assert.equal(state.recommendCount,0);assert.ok(Object.values(state.setCounts).every(n=>n===0));assert.equal([...store.values()][0],saved);assert.deepEqual(state.scenes,['warm','hotel']);assert.equal(state.recommendAngle,true);
 node('setCount_main').value='3';node('setCount_main').onchange();assert.equal(state.recommendCount,3);
 node('applyLastAngleCounts').onclick();assert.equal(state.recommendCount,21);assert.equal(state.setCounts.main,15);assert.equal(updated,3);
 state.busy=true;node('clearAngleCounts').onclick();assert.equal(state.recommendCount,21);
});
