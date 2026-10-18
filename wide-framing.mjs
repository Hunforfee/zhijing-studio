export function enforceWideFraming(prompt,v={}){
  const shot=v.recommendationPlan?.[v.recommendIndex||0];
  if(shot?.shotKind!=='main'||!shot.fullProductOverview)return prompt;
  const marker='【广角完整入画优先】';
  if(prompt.includes(marker))return prompt;
  const position=shot.portraitSpace?'主体位于画面中下部，上方35–45%展示真实墙窗和光影，地面10–15%。':'前景地面15–20%。';
  return prompt+' '+marker+'床头睡枕、床尾下摆及左右最外缘全部入画，每个外缘与画框至少留5%空隙；主体40–50%，'+position+'退至房间远端，28–35mm校正广角。禁止切边、缩床或为织纹拉近；参考仅保留花型工艺，忽略近景裁切。完整入画优先于其他填满画面要求。';
}
