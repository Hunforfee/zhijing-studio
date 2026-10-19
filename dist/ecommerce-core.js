export const commerceTools=[
  {id:'marketing',name:'营销排版',action:'AI 策划营销方案',tag:'CAMPAIGN',description:'把已确认的商品图，做成可修改的营销物料。'},
  {id:'sku',name:'SKU 规格图',action:'AI 整理 SKU 方案',tag:'PRODUCT VARIANTS',description:'一款一图，花色、尺寸和件数清楚对应。'},
  {id:'size',name:'尺寸导购图',action:'AI 整理尺寸导购',tag:'SIZE GUIDE',description:'区分床宽、被套规格与床笠包高。'},
  {id:'audit',name:'商品一致性检查',action:'AI 核对商品资料',tag:'PRODUCT REVIEW',description:'对照真实资料，逐项确认图片与文字中的疑点。'}
];
export const dimensionFields=[['bedWidth','适用床宽','cm'],['coverWidth','被套宽','cm'],['coverLength','被套长','cm'],['sheetWidth','床单 / 床笠宽','cm'],['sheetLength','床单 / 床笠长','cm'],['wrapHeight','床笠包高','cm'],['pillowWidth','枕套 / 枕芯宽','cm'],['pillowLength','枕套 / 枕芯长','cm'],['pillowCount','枕套 / 枕芯数量','只'],['pieces','总件数','件']];
export const categories=['四件套','被芯','枕芯','床单','床笠','凉席','毯子','其他'];
export function dimensionLabel(category,key){const base=dimensionFields.find(([id])=>id===key)?.[1]||key;if(key.startsWith('cover')&&category!=='四件套')return base.replace('被套',category==='被芯'?'被芯':'商品');if(key.startsWith('pillow'))return base.replace('枕套 / 枕芯',category==='枕芯'?'枕芯':'枕套');return base;}
export function relevantDimensions(category){const keys=category==='枕芯'?['pillowWidth','pillowLength','pillowCount']:category==='床单'?['bedWidth','sheetWidth','sheetLength']:category==='床笠'?['bedWidth','sheetWidth','sheetLength','wrapHeight']:['被芯','凉席','毯子','其他'].includes(category)?['bedWidth','coverWidth','coverLength']:dimensionFields.map(([key])=>key);return dimensionFields.filter(([key])=>keys.includes(key));}
export const emptyVariant=()=>({id:crypto.randomUUID(),name:'',price:'',imageIndex:null,...Object.fromEntries(dimensionFields.map(([key])=>[key,null]))});
export const defaultDesign=()=>({headline:'',subline:'',badge:'',layout:'editorial',background:'#f6f2e8',accent:'#285a45',ink:'#243b30',ratio:'3:4',edge:1600});
export const defaultFacts=()=>({name:'',category:'四件套',brand:'',code:'',material:'',craft:'',features:'',campaign:'',price:'',platform:'通用',variants:[emptyVariant()],imageNotes:[]});
export function textContrast(a,b){const light=color=>{const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb.reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);};const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function specLines(variant,category){
  if(!variant)return [];
  const rows=[];const add=(name,value)=>{if(value)rows.push([name,value]);};
  add('适用床宽',variant.bedWidth?variant.bedWidth+' cm':'');
  if(!['床单','床笠','枕芯'].includes(category))add(category==='被芯'?'被芯尺寸':category==='四件套'?'被套尺寸':'商品尺寸',variant.coverWidth&&variant.coverLength?variant.coverWidth+' × '+variant.coverLength+' cm':'');
  if(['四件套','床单','床笠'].includes(category))add(category==='床笠'?'床笠尺寸':category==='床单'?'床单尺寸':'床单 / 床笠',variant.sheetWidth&&variant.sheetLength?variant.sheetWidth+' × '+variant.sheetLength+' cm':'');
  if(['四件套','床笠'].includes(category))add('床笠包高',variant.wrapHeight?variant.wrapHeight+' cm':'');
  if(['四件套','枕芯'].includes(category)){add(category==='枕芯'?'枕芯尺寸':'枕套尺寸',variant.pillowWidth&&variant.pillowLength?variant.pillowWidth+' × '+variant.pillowLength+' cm':'');add(category==='枕芯'?'枕芯数量':'枕套数量',variant.pillowCount!=null?variant.pillowCount+' 只':'');}
  add('组合件数',variant.pieces?variant.pieces+' 件':'');return rows;
}
export function localCommerceChecks(facts){
  const issues=[];
  for(const [i,v]of facts.variants.entries()){
    const label=v.name||'规格 '+(i+1);
    for(const [a,b,name]of [['coverWidth','coverLength','被套'],['sheetWidth','sheetLength','床单 / 床笠'],['pillowWidth','pillowLength','枕套 / 枕芯']])if(!!v[a]!==!!v[b])issues.push(label+'：请补齐'+name+'的长和宽。');
    if(facts.category==='四件套'&&v.coverWidth&&v.coverLength&&v.sheetWidth&&v.sheetLength&&v.pillowCount!=null&&v.pieces!=null&&v.pieces!==v.pillowCount+2)issues.push(label+'：总件数与一件被套、一件床单及已填枕套数量不一致。');
    if(v.wrapHeight&&facts.category!=='床笠')issues.push(label+'：已填写床笠包高，请确认此组合确实包含床笠。');
  }
  const names=facts.variants.map(v=>v.name.trim()).filter(Boolean);if(new Set(names).size!==names.length)issues.push('存在重复的规格名称，请区分花色或尺寸。');
  return issues;
}
export const csvColumns=[['name','规格名称'],...dimensionFields.map(([key,label,unit])=>[key,label+'('+unit+')']),['price','价格(元)'],['imageIndex','图片序号']];
const safeCell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
export function variantsCSV(variants){return '\ufeff'+[csvColumns.map(([,label])=>label),...variants.map(v=>csvColumns.map(([key])=>key==='imageIndex'?(v[key]==null?'':v[key]+1):v[key]))].map(row=>row.map(safeCell).join(',')).join('\r\n');}
export function parseCSV(text){
  if(typeof text!=='string'||text.length>128000)throw Error('规格表请控制在 128 KB 以内');
  const rows=[];let row=[],cell='',quoted=false;const source=text.replace(/^\ufeff/,'');
  for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw Error('CSV 引号格式无效');}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==','){if(c==='\r'&&source[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}}else cell+=c;}
  if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function importVariants(text,imageCount){
  const rows=parseCSV(text),headers=csvColumns.map(([,label])=>label);
  if(!rows.length||rows[0].length!==headers.length||rows[0].some((cell,i)=>cell.trim()!==headers[i]))throw Error('列名与模板不一致，请先下载规格模板');
  if(rows.length<2||rows.length>25)throw Error('请导入 1 至 24 个规格');
  return rows.slice(1).map((row,i)=>{if(row.length!==headers.length)throw Error('第 '+(i+2)+' 行列数不正确');const v=emptyVariant();csvColumns.forEach(([key],n)=>{const value=row[n].trim().replace(/^'(?=[=+@-])/,'');if(key==='name'||key==='price')v[key]=value;else if(value==='')v[key]=null;else{const number=Number(value);if(!Number.isFinite(number)||number<0||key==='imageIndex'&&(!Number.isInteger(number)||number<1||number>imageCount))throw Error('第 '+(i+2)+' 行的数字或图片序号无效');v[key]=key==='imageIndex'?number-1:number;}});if(!v.name||v.name.length>80||v.price&&!/^\d{1,7}(?:\.\d{1,2})?$/.test(v.price)||dimensionFields.some(([key])=>v[key]!=null&&(v[key]<(key==='pillowCount'?0:1)||v[key]>(['pieces','pillowCount'].includes(key)?50:1000)||['pieces','pillowCount'].includes(key)&&!Number.isInteger(v[key]))))throw Error('第 '+(i+2)+' 行名称、价格或尺寸超出可用范围');return v;});
}
export function reportCSV(report,reviews={}){return '\ufeff'+[['图片','检查项','疑点','依据','建议','人工处理'],...report.issues.map(issue=>[issue.imageIndex==null?'整体':issue.imageIndex+1,issue.field,issue.observation,issue.evidence,issue.suggestion,({confirmed:'确认需修改',dismissed:'已核实无误',pending:'待核实'})[reviews[issue.id]||'pending']])].map(row=>row.map(safeCell).join(',')).join('\r\n');}
