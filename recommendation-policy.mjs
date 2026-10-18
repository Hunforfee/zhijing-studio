// Every system-recommendation feature shares this policy, including suites.
// New requests draw a fresh plan; retries reuse the server-owned shot plan.
export function isSystemRecommendation(v={}){return !!(v.recommendScene||v.recommendAngle||v.generateSet);}
export function shuffleRecommendations(items,random=Math.random){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function pickRecommendation(items,random=Math.random){return items[Math.floor(random()*items.length)];}
export function applyRecommendationVariation(prompt,v){
  if(!isSystemRecommendation(v))return prompt;
  const rule='【推荐随机拍摄】每次新生成重新随机规划，每张执行自己的场景、机位、景别、枕套数量摆放、正反面陈列、少量道具及光线；不套用固定序号模板，不复刻首图房间或陈列。套图只约束各类张数，不锁定整组陈列。未勾选推荐的场景或角度继续遵守用户选择；儿童模式始终用儿童床。花色、A/B裁片、产品款式工艺保持，不靠换花色制造差异。';
  const shot=v.recommendationPlan?.[v.recommendIndex||0];
  let result=prompt;
  // Full prompt overrides must still deliver this shot's assigned brief.
  if(shot&&v.recommendScene&&!result.includes(shot.scene[1]))result+=' 本图推荐环境：'+shot.scene[1]+'.';
  if(shot&&v.recommendAngle&&!result.includes(shot.camera[1]))result+=' 本图推荐机位：'+shot.camera[1]+'.';
  return result.includes(rule)?result:result+' '+rule;
}
