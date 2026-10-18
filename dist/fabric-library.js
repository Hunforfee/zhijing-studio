// Shared catalog used by the browser and generation service. Legacy IDs remain compatible.
globalThis.beddingFabricLibrary = Object.freeze([
  {
    "id": "smooth-micro",
    "name": "微纹质感",
    "group": "光滑度",
    "hint": "1级 · 细小织纹清晰，低光泽",
    "prompt": "smoothness level 1: clearly visible tiny even woven surface grain, subtle fine textile irregularity and restrained matte diffuse reflection; not coarse linen; match surface only, never change original A/B print colors or product construction, and do not infer actual fiber composition or quality certification"
  },
  {
    "id": "smooth-fine",
    "name": "细腻质感",
    "group": "光滑度",
    "hint": "2级 · 细密平滑，光感克制",
    "prompt": "smoothness level 2: fine dense even weave with tiny closely spaced threads, finer flatter surface than microtexture and restrained soft low sheen; match surface only, never change original A/B print colors or product construction, and do not infer actual fiber composition or quality certification"
  },
  {
    "id": "smooth-flow",
    "name": "顺滑质感",
    "group": "光滑度",
    "hint": "3级 · 顺滑均匀，柔和缎光",
    "prompt": "smoothness level 3: smoothly even fine woven surface with clearly visible soft satin sheen and broad gentle highlights flowing over folds; match surface only, never change original A/B print colors or product construction, and do not infer actual fiber composition or quality certification"
  },
  {
    "id": "smooth-silk",
    "name": "丝滑质感",
    "group": "光滑度",
    "hint": "4级 · 丝滑流畅，明显丝缎光泽",
    "prompt": "smoothness level 4: silky smooth extremely fine woven surface with continuous brighter flowing satin sheen and refined directional reflections; match surface only, never change original A/B print colors or product construction, and do not infer actual fiber composition or quality certification"
  },
  {
    "id": "smooth-premium",
    "name": "高级丝滑",
    "group": "光滑度",
    "hint": "5级 · 极细滑表面，更强且克制的丝缎光泽",
    "prompt": "smoothness level 5: exceptionally fine premium silky smooth surface with luminous elegant pearlescent satin sheen, the strongest controlled glossy light response; never wet, metallic, plastic or glittery; match surface only, never change original A/B print colors or product construction, and do not infer actual fiber composition or quality certification"
  },
  {
    "id": "wrinkle-light",
    "name": "轻微皱感",
    "group": "水洗褶皱",
    "hint": "浅细皱纹，轻度松弛",
    "prompt": "sparse shallow fine washed microcrinkles with gently relaxed fibers"
  },
  {
    "id": "wrinkle-natural",
    "name": "自然皱感",
    "group": "水洗褶皱",
    "hint": "不规则细皱，水洗感明显",
    "prompt": "natural irregular washed microcrinkles and relaxed softly textured woven surface"
  },
  {
    "id": "wrinkle-strong",
    "name": "明显皱感",
    "group": "水洗褶皱",
    "hint": "细皱更密，起伏清晰",
    "prompt": "pronounced dense irregular washed microcrinkles with clearly visible small-scale surface relief"
  },
  {
    "id": "weave-slub",
    "name": "粗纱麻纹",
    "group": "织纹",
    "hint": "粗细纱节清晰可见",
    "prompt": "irregular thick-and-thin slub yarns with visible coarse linen-like woven texture"
  },
  {
    "id": "weave-jacquard",
    "name": "立体提花",
    "group": "织纹",
    "hint": "织造纹样有轻微凹凸",
    "prompt": "subtle dimensional jacquard woven relief; use only its thread relief and never import the reference floral motif or replace the uploaded A/B print"
  },
  {
    "id": "weave-waffle",
    "name": "格状凹凸",
    "group": "织纹",
    "hint": "格状织造凹凸肌理",
    "prompt": "small waffle weave cells with recessed square centers and raised woven ridges; these are surface texture, not added printed squares"
  },
  {
    "id": "pile-peach",
    "name": "微磨毛",
    "group": "绒感",
    "hint": "细微浮绒，柔和雾感",
    "prompt": "extremely fine peach-skin brushed fiber haze over the weave, subtle matte softness without thick plush pile"
  },
  {
    "id": "pile-short",
    "name": "细短绒",
    "group": "绒感",
    "hint": "短而均匀，柔软细腻",
    "prompt": "short even fine soft surface pile with visibly tiny raised fibers"
  },
  {
    "id": "pile-dense",
    "name": "密实短绒",
    "group": "绒感",
    "hint": "绒毛紧密，顺逆毛光影",
    "prompt": "dense closely packed short velvet pile with directional nap shading and compact smooth fiber tips"
  },
  {
    "id": "pile-fluffy",
    "name": "蓬松绒",
    "group": "绒感",
    "hint": "绒毛松软，蓬松体积感",
    "prompt": "loose fluffy soft surface pile with visible airy fiber tufts; preserve the selected product structure and filling"
  },
  {
    "id": "pile-long",
    "name": "长毛绒",
    "group": "绒感",
    "hint": "较长绒毛，顺毛方向清晰",
    "prompt": "clearly visible long shaggy surface pile strands with a consistent directional flow; preserve seams and the selected product construction"
  }
]);
