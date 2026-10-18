// Category research: COCOON TravelSheet / Sea to Summit Comfort Blend liner.
// Preserve the existing user-defined SKU; brand variants do not prove its seams.
export const sleepbagStructureVersion='travel-liner/2026-10-09-v2';
export const sleepbagVariantNames={travel:'旅行睡袋'};
export function sleepbagVariant(v={}){return sleepbagVariantNames[v.sleepbagVariant]?v.sleepbagVariant:'travel'}
export function sleepbagConstructionGuard(v,zh=false){
  if(v.product!=='sleepbag')return '';
  return zh?'【旅行睡袋结构v2】1件无填充薄布隔脏睡袋：下片承托、上片覆盖；两片等宽，仅两长边脚侧下半段缝合，缝到中段终止，头侧上半段两边自由敞开。仅脚端短边隐形拉链，齿链带藏缝内；枕袋缝在下片头端背面，普通枕芯在下片下面，不另加枕套。尺寸按目标规格，布在床垫上方，不包侧墙、不做床笠。翻上片只露其真实反面，下片留在承托面。隐藏部位不强露，参考不添加全侧拉链、填充绗缝或帽兜。':
    'TRAVEL LINER TOPOLOGY LOCK ('+sleepbagStructureVersion+'): exactly one unfilled thin-cloth sack: a bottom sleeping panel and a same-width top cover panel, joined ONLY along the LOWER HALF of BOTH long sides, from foot to mid-body. Stitching stops there; both upper-half edges remain completely open and unsewn. ONLY the foot short edge is closed by an INVISIBLE ZIPPER, with teeth and tape hidden inside cloth and only a discreet slider if visible. A pillow sleeve is sewn on the BACK (the underside) of the bottom panel at the head end; one plain pillow goes UNDER that panel, never in a separate pillowcase above it. Use target product dimensions. The sack covers the WHOLE mattress like bedding ONLY across its TOP: no mattress-sidewall encasement, fitted skirt or elastic corners. Turning the top sheet reveals that sheet actual reverse, not a new blanket or the bottom panel reverse. Show only naturally visible construction; no elastic corner straps, no drawstring pouch and no full-length zipper. Selected topology overrides inconsistent old photos and manual styling.';
}
const structures={travel:{
  zh:'产品身份：1条酒店隔脏用旅行睡袋内衬，双层指上下两片薄布，不是夹棉或双层填充。下片承托身体，上片覆盖身体；两片等宽长方形，按目标规格铺在床垫上方，不包侧墙。连接：从脚端到中段，仅两条长边下半段缝合；中段以后侧缝终止，头侧上半段两边独立敞开，形成侧入口，上层自由边细折边。脚端：一条横向隐形拉链连接两片薄布，合拢时链齿链带藏入布缝，拉头细小。头端：下片背面接等宽枕袋，保留原目标深度约40～50厘米；头端与两侧有真实连接，背面袋口朝脚端，普通枕芯从背面套入后压在下片下面。正面只看到布覆盖的枕部隆起，不另放印花枕套。上层头侧未缝半片可自由翻回，露出的仍是同一上层布反面；下片留在承托面。面料质感按选择，薄软细皱，无填充、绗缝、帽兜或木乃伊收窄。隐蔽结构只在对应特写自然展示，不增加酒店被子或床单。',
  prompt:'PRODUCT IDENTITY: exactly ONE flat TWO-LAYER hotel dirt-barrier travel sleeping bag LINER. Two-layer means TWO thin fabric panels, not two insulated shells. The same-width rectangular BOTTOM panel supports the sleeper and the TOP panel covers the sleeper. Use target dimensions; lay the sack across the mattress TOP without wrapping sidewalls. CONNECTION MAP: side seams run from foot to mid-body ONLY, terminating there; above the endpoint, headward edges have independently finished free hems and remain open. FOOT: one concealed short-edge zipper connects the two thin cloth layers, not a mattress cover. HEAD: a same-width sleeve, retaining the target depth about 40-50 cm, attaches to the underside of the bottom head panel. Head and side attachments are real seams; the underside mouth faces footward, with one plain pillow inserted underneath the bottom sleeping panel. Normal views show only a covered head bulge, never an independent pillowcase above the sack. FOLD: lift only the free upper half of the top panel; reveal its actual reverse and the separate bottom sleeping surface while the bottom remains supported. Selected weave and thin soft drape, fine real hems and gentle wrinkles. No filler, quilted chambers, mummy taper, hood, extra sheet, duvet, bedspread or storage bag.'
}};
export function sleepbagProductPrompt(v,zh=false){const item=structures[sleepbagVariant(v)];return (zh?item.zh:item.prompt)+' '+sleepbagConstructionGuard({...v,product:'sleepbag'},zh);}
export function sleepbagSurface(){return {
  edge:'thin independently finished free hems above the seam endpoint',
  surface:'the selected thin fabric actual weave and gentle shallow wrinkles without invented padding',
  body:'two unfilled cloth-thin panels on TOP of the mattress, not a fabric mattress sidewall',
  seam:'lower-half long-side stitching with a genuine termination at mid-body',
  open:'two free headward upper-half edges above the seam endpoint',
  zipper:'the concealed foot short-edge closure between two cloth panels, with hidden tape/teeth and one discreet slider',
  sleeve:'the attached sleeve on the underside of the bottom head panel, with a foot-facing mouth and one mostly enclosed plain pillow'
};}
export function sleepbagDirection(v,angle,common={}){
  if(sleepbagVariant(v)!=='travel')return null;
  if(common?.prompt)return {...common,zh:common.zh+' 当前是无填充隔脏睡袋，床垫侧面属于承托床垫，不属于睡袋。仅按本构图呈现可见结构，不为证明工艺拉开隐藏部位。',prompt:common.prompt+' '+sleepbagConstructionGuard({...v,product:'sleepbag'})+' Retain cloth-thin layers and only naturally visible construction; never pull apart hidden parts to prove construction.'};
  const s=sleepbagSurface();
  const views={
    detail:{name:'面料织纹特写',zh:'中近景只拍睡袋自身所选织纹与细皱，细节占50%～65%，保留相连布面，不画成夹棉格或绒毯。',prompt:'SLEEPING BAG TEXTILE DETAIL: contextual 85-100 mm-equivalent close-up, 25-45 degrees to '+s.surface+'. Detail 50-65% with connected cloth and editable margins. Do not widen to the full bed or introduce padding, elastic or closure hardware into this surface crop.'},
    low:{name:'低机位薄边',zh:'床尾低机位拍床垫上方叠合的两片薄布与脚端闭合边；素色床垫侧墙与睡袋分离，不当睡袋填充。',prompt:'SLEEPING BAG LOW THIN-EDGE: low foot-end camera around mattress TOP height, 40-55 mm lens. Distinguish '+s.body+' and '+s.zipper+' from the plain mattress wall below. The sack edge is cloth-thin, not a padded slab or mattress encasement.'},
    reverse:{name:'翻折露内层',zh:'只把上层头侧未缝半片向脚端宽幅翻回搭在自身下半片上，露出该片反面与独立下层躺卧面；下片不抬起，无独立床尾巾。',prompt:'SLEEPING BAG OPEN-TOP FOLD-BACK: fold ONLY the top panel free headward half footward onto its own lower half in soft broad irregular folds. Reveal the actual reverse of that top panel and the supported bottom sleeping face, tracing '+s.open+' into '+s.seam+'. No thick duvet turnover, floating flap, separate runner or opened foot zipper.'},
    foot:{name:'脚端拉链近景',zh:'略俯拍脚端短边与下角，两片薄布在隐形拉链处闭合；齿藏布缝，只自然露小拉头，不露大齿整条链带或床垫围拉链。',prompt:'SLEEPING BAG FOOT ZIPPER: medium-close 30-45-degree foot view of the short-edge closure and true lower cloth corners. Show '+s.zipper+' ABOVE the plain mattress edge. CLOSED invisible zipper means concealed teeth/tape and a fine meeting of cloth hems; never exaggerated teeth or a zip around mattress sidewalls. Head/pillow may remain outside this crop.'},
    pillowclose:{name:'背面枕袋特写',zh:'局部轻抬或翻转下片头端，露背面相连枕袋与朝脚端袋口；枕芯大部分套入，仅袋口可露少量素色枕芯边。其余下片留床上，不做正面帽兜或独立枕套。',prompt:'UNDERSIDE PILLOW SLEEVE CLOSE-UP: contextual 30-45-degree head view, 70-85 mm lens. Locally lift/turn the BOTTOM head extension to reveal '+s.sleeve+', while the rest stays supported. Show true attachment seams, mouth and a small plain pillow edge only where naturally accessible. Never a top-side pillow hood, standalone printed pillowcase, elastic strap or second pillow.'},
    drape:{name:'侧边缝合与开口',zh:'沿长边中段拍缝线终止处：脚侧两层相接、头侧两层自由分开，薄折边和接触阴影可信；不是床裙、松紧侧围或全侧拉链。',prompt:'SLEEPING BAG SIDE SEAM AND OPENING: contextual 50-70 mm view around mid-body, showing '+s.seam+' meet '+s.open+'. Let the top free edge lift slightly above the supported bottom so both layers are traceable. No skirt, full-side zip, fitted sidewall or padded duvet hem.'}
  };
  return views[angle]||null;
}
export function sleepbagAngleName(angle,fallback=''){return {detail:'面料织纹特写',low:'低机位薄边',reverse:'翻折露内层',foot:'脚端拉链近景',pillowclose:'背面枕袋特写',drape:'侧边缝合与开口'}[angle]||fallback;}
