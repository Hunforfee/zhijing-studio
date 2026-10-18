const providers=['sub2api','zhipu','openai','compatible'];
export function serviceProfiles(saved={}) {
  const profiles={};
  for(const id of providers)if(saved.profiles?.[id])profiles[id]={...saved.profiles[id],provider:id};
  if(saved.apiKey||saved.baseUrl){const id=providers.includes(saved.provider)?saved.provider:'compatible';profiles[id]={...saved,provider:id};delete profiles[id].profiles;}
  const activeProvider=providers.includes(saved.activeProvider)&&profiles[saved.activeProvider]?saved.activeProvider:providers.includes(saved.provider)?saved.provider:Object.keys(profiles)[0]||'compatible';
  return {version:2,activeProvider,profiles};
}
export function savedServiceProfiles(profiles,activeProvider){
  return {version:2,activeProvider,profiles:Object.fromEntries(Object.entries(profiles).map(([id,s])=>[id,{...s,verified:false}]))};
}
