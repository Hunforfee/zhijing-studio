import {readFile,writeFile} from 'node:fs/promises';
async function edit(file,changes){let s=(await readFile(file,'utf8')).replace(/\r\n/g,'\n');for(const [before,after]of changes){if(!s.includes(before))throw Error(file+' missing edit target '+before.slice(0,90));s=s.replace(before,after);}await writeFile(file,s);}
await edit('server.mjs',[
 ["import {recognizeUploadedProduct,productRecognitionCatalog}","import {analyzePatternMaterials,normalizePatternMaterials,patternMaterialInstruction} from './pattern-materials.mjs';\nimport {recognizeUploadedProduct,productRecognitionCatalog}"],
 ['return {...v,...(v.product', 'return {...v,...normalizePatternMaterials(v.patternMaterials),...(v.product'],
 ["      if(pathname==='/api/product-recognition/catalog'",`      if(pathname==='/api/pattern-materials/analyze'&&req.method==='POST'){
        const request=await body(req,40*1024*1024);
        const config=options.recognitionService||{...service,visionModel:process.env.VISION_MODEL||(service.provider!=='zhipu'&&service.visionModel==='glm-4.6v'?undefined:service.visionModel)};
        const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
        return json(res,200,await analyzePatternMaterials({images:request.images,config,fetchImpl,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])}));
      }
      if(pathname==='/api/product-recognition/catalog'`],
 ["        const prompt=correction+enforceBeddingFidelity(enforceSetPanelBoundaries(enforceReferenceEdit", "        const materialStart=form.getAll('image[]').length+1;\n        for(const item of v.patternMaterialBytes)form.append('image[]',new Blob([item.bytes],{type:'image/png'}),'fabric-'+item.side+'-supplement-'+item.index+'.png');\n        const prompt=correction+enforceBeddingFidelity(enforceSetPanelBoundaries(enforceReferenceEdit"],
 ['+additionalReferenceInstruction(v,additionalStart);', '+additionalReferenceInstruction(v,additionalStart)+patternMaterialInstruction(v,materialStart);'],
 ["...v.referenceImagesBytes.slice(1).map(bytes=>({type:'image_url',image_url:{url:bytes.toString('base64')}})),{type:'text'", "...v.referenceImagesBytes.slice(1).map(bytes=>({type:'image_url',image_url:{url:bytes.toString('base64')}})),...v.patternMaterialBytes.flatMap(item=>[{type:'image_url',image_url:{url:item.bytes.toString('base64')}},{type:'text',text:'Supplemental '+item.side+'-side fabric material '+item.index+': compare its visible motif, craft and texture only with FABRIC '+item.side+'. Do not mix A/B, copy its scene or override selected product/craft. Include visible matching print refinements in fabric'+item.side+', weave and nap in sourceTexture, compatible component seam details in craftDetails.'}]),{type:'text'"],
 ["),v,{compact:true,final:true});\n          inspector.record", "),v,{compact:true,final:true})+(v.patternMaterialBytes.length?' 额外多图观察（不得覆盖所选产品、工艺、A/B裁片和独立质感设置）：'+JSON.stringify(v.patternMaterialObservations).slice(0,900):'');\n          inspector.record"],
 ["max_tokens:v.referenceBytes||v.textureReferenceBytes||Object.keys(v.craftReferenceBytes).length?2200:700", "max_tokens:v.referenceBytes||v.textureReferenceBytes||v.patternMaterialBytes.length||Object.keys(v.craftReferenceBytes).length?2200:700"]
]);
await edit('dist/app.js',[
 ['const payload={...opt,cameraReferences,', 'const payload={...opt,...(await globalThis.patternMaterials?.payload()||{}),cameraReferences,'],
 ['const pair={a:pack(state.upload.file),b:state.uploadB?pack(state.uploadB.file):null};','const pair={a:pack(state.upload.file),b:state.uploadB?pack(state.uploadB.file):null,materials:globalThis.patternMaterials?.storage()};'],
 ["    else $('removeUploadB').onclick();\n    toast", "    else $('removeUploadB').onclick();\n    await globalThis.patternMaterials?.restore(pair.materials);\n    toast"]
]);
await edit('dist/index.html',[
 ['<h3 id="fabricGroupTitle"><b>02</b> 花型与面料</h3>','<h3 id="fabricGroupTitle"><b>02</b> 花型</h3>'],
 ['</body>','<script src="/pattern-materials.js?v=20261015-multi1" defer></script><link rel="stylesheet" href="/pattern-materials.css?v=20261015-multi1"></body>']
]);
console.log('Multi-image backend and generation integration applied');
