import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {setDetailRules,setProductPrompt,setCameraConstruction} from './set-product-prompts.mjs';
import {angleDirections,promptVersion} from './photography-prompts.mjs';
const context=vm.createContext({});vm.runInContext((await readFile(new URL('./dist/set-variants.js',import.meta.url),'utf8')).split('const variantPanel=')[0],context);
const variants=vm.runInContext('setVariants',context);
const lines=['# 四件套款式提示词与研究说明','',`版本：${promptVersion}`,'','本文件由当前生图代码导出，22 个子选项可组成 384 种搭配。普通生成、上传拍摄参考图的生成、智谱生成和后台组合预览均使用以下细节。','',
  '## 资料核实范围','',
  '通用产品结构已根据用户提供的学院风5047585商品图片包修订：浏览145张图片索引并放大核对翻面、枕套侧面、床单折边和拉链细节。详细依据见 ../四件套结构研究/简约四件套结构学习记录.md。本商品的隐藏缝法、开口定位及床笠角袋细节尚未确认；以下其他装饰工艺商品的核实范围保持独立。','',
  '已阅读找家纺公开商品标题与规格：同一系列区分床单、床笠、床裙，且宽边、花边、贝壳边、夹棉绗缝床裙为不同商品特征。商品详情直连出现访问失败，内置浏览器页面连接超时，本轮未完成实拍图片逐张核验，也未确认需要登录。以下几何、针脚、垂坠和阴影描述是用于控制生成的建模约束，不能当作这些商品的实测工艺。','',
  '- [床单 / 床笠 / 床裙三种规格实例](https://detail.zhaojiafang.com/goods/62670684)：只用于核对三种床面结构分别销售，不将牛奶绒材质强加给其他面料。',
  '- [泡泡纱花边床单 / 床裙实例](https://detail.zhaojiafang.com/goods/30168908)：只用于核对花边与床面结构可以分别组合。',
  '- [宽边四件套实例](https://detail.zhaojiafang.com/goods/58773972)：核对宽边款存在；页面文字未给出边宽，4～6 厘米是本站现有示意默认值，不是行业统一标准。',
  '- [贝壳边床单 / 床笠实例](https://detail.zhaojiafang.com/goods/71167710)：核对边缘款式与床单 / 床笠结构可分别选择；圆弧边的具体裁剪仍待实拍核实。',
  '- [夹棉绗缝床裙实例](https://detail.zhaojiafang.com/goods/70957876)：属于明确的附加工艺，因此普通床裙不会自动加入夹棉或绗缝。','',
  '埋绳、窄边、包边、蕾丝、百褶等未完成本站实拍核实，细节按当前菜单定义和物理合理性编写。床罩按当前菜单的“合体床罩”定义处理，不将商家可能使用的“床盖”名称直接视为同一产品。未新增工艺选项，也没有从示例商品复制印花、底色或装饰。窄边 1～2 厘米同样是本站现有默认值。','',
  '## 通用四件套结构（后台、参考图编辑及两种生图接口共用的精简稿）','',setProductPrompt(),''];
for(const group of ['被套工艺','床单款式','枕套工艺']){
  lines.push('## '+group,'');
  for(const item of variants.filter(v=>v.group===group)){
    const rule=setDetailRules.find(r=>r.id===item.id);
    if(!rule)throw Error('Missing construction detail: '+item.id);
    lines.push('### '+item.name+' ['+item.id+']','','原有选择规格：'+item.spec,'','新增实际提示词：'+rule.detail,'');
  }
}
lines.push('## 按机位显示真实结构','');
for(const [angle,item]of Object.entries(angleDirections))lines.push('### '+item.name,'',setCameraConstruction({product:'set'},angle,true),'');
lines.push('## 优先关系与检查','',
  'A/B 花型和配色、所选产品与三组工艺优先；质感使用独立质感参考或用户所选面料库，未选择则参考上传花型图。拍摄参考按用户勾选的场景 / 角度生效，不能覆盖明确选择的工艺。特写与俯视不为了展示隐藏工艺而改变机位。','',
  '仅在自然可见处展示接缝和工艺，镜头看不到的背面不强制露出；翻折保持同一被套前后连续，床单不与被套一起翻折。默认保留两只睡眠枕头，特写允许其在画外。','',
  '旧的组合标识和已保存的手工提示词保留。若后台已有手工替换，该分类使用手工文字，内置规则不会覆盖您的编辑；可在后台重置该分类以使用最新默认。','',
  '测试核对 384 种组合、12 个机位、参考图范围、两种接口的提示词传递，以及智谱最长组合的长度限制。测试未调用付费图像服务，不能证明实拍一致性；成图仍需按花型、工艺、床面结构和机位核验。');
await writeFile(new URL('./四件套款式提示词与研究说明.md',import.meta.url),lines.join('\r\n'),'utf8');
console.log('四件套 22 个子选项的实际提示词、资料来源和核实范围已导出。');
