import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.join(root,'.share');
function matches(a,b){return typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export function createShareServer({token,backend='http://127.0.0.1:4173',getPublicOrigin=async()=>'',fetchImpl=fetch}={}){
  if(!token||token.length<32)throw Error('分享邀请凭证缺失');
  const jobs=new Set(),videoJobs=new Set(),freeDocuments=new Set(),sceneJobs=new Set(),scenes=new Set(),libraryAssets=new Set();
  return http.createServer(async(req,res)=>{
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    try{
      const url=new URL(req.url,'http://localhost');
      const invite=url.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)$/);
      if(invite&&matches(invite[1],token)){
        res.writeHead(303,{'Location':'/','Set-Cookie':`zhijing_invite=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`});return res.end();
      }
      const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('zhijing_invite='))?.slice('zhijing_invite='.length);
      if(!matches(cookie,token)){
        res.writeHead(403,{'Content-Type':'text/html; charset=utf-8'});return res.end('<!doctype html><meta charset="UTF-8"><title>织景 · 邀请访问</title><main style="font-family:sans-serif;max-width:500px;margin:15vh auto;padding:30px"><h2>请使用完整的邀请链接</h2><p>这是私人家纺摄影工作台，请向分享者获取邀请链接。</p></main>');
      }
      const publicOrigin=await getPublicOrigin();
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==(publicOrigin||`http://${req.headers.host}`))return reply(res,403,{error:'请求来源不允许'});
      if(url.pathname.startsWith('/api/service'))return reply(res,403,{error:'访客不能查看或修改生成服务配置，请联系分享者'});
      // Admin assets and APIs remain local even when serving new UI modules.
      if(/^\/admin(?:[/.]|$)/.test(url.pathname)||url.pathname.startsWith('/api/admin/'))return reply(res,404,{error:'页面不存在'});
      if(url.pathname==='/api/status'){
        const upstream=await fetchImpl(backend+'/api/status');const s=await upstream.json();
        return reply(res,200,{configured:s.configured,verified:s.verified,provider:s.provider,model:s.model,approximate:s.approximate,shared:true});
      }
      if(url.pathname==='/api/video/jobs'&&req.method==='GET'){
        const upstream=await fetchImpl(backend+'/api/video/jobs'),data=await upstream.json();return reply(res,upstream.status,{jobs:(data.jobs||[]).filter(j=>videoJobs.has(j.id))});
      }
      if(url.pathname==='/api/free/documents'&&req.method==='GET'){
        const upstream=await fetchImpl(backend+'/api/free/documents'),data=await upstream.json();return reply(res,upstream.status,{documents:(data.documents||[]).filter(doc=>freeDocuments.has(doc.id))});
      }
      if(url.pathname==='/api/scenes/jobs'&&req.method==='GET'){
        const upstream=await fetchImpl(backend+'/api/scenes/jobs'),data=await upstream.json();return reply(res,upstream.status,{jobs:(data.jobs||[]).filter(job=>sceneJobs.has(job.id))});
      }
      if(url.pathname==='/api/scenes'&&req.method==='GET'){
        const upstream=await fetchImpl(backend+'/api/scenes'),data=await upstream.json();return reply(res,upstream.status,{scenes:(data.scenes||[]).filter(scene=>scenes.has(scene.id))});
      }
      if(url.pathname==='/api/library/assets'&&req.method==='GET'){
        const upstream=await fetchImpl(backend+'/api/library/assets'),data=await upstream.json();return reply(res,upstream.status,{assets:(data.assets||[]).filter(asset=>libraryAssets.has(asset.id))});
      }
      const libraryAsset=url.pathname.match(/^\/api\/library\/assets\/([a-f0-9-]{36})(?:\/(image|imageB|thumbnail|update|delete))?$/);
      if(libraryAsset&&!libraryAssets.has(libraryAsset[1]))return reply(res,404,{error:'素材不存在'});
      const newLibraryAsset=url.pathname==='/api/library/assets'&&req.method==='POST';
      const libraryRequest=newLibraryAsset||libraryAsset&&(['GET','HEAD'].includes(req.method)&&!['update','delete'].includes(libraryAsset[2])||req.method==='POST'&&['update','delete'].includes(libraryAsset[2]));
      const sceneJob=url.pathname.match(/^\/api\/scenes\/jobs\/([a-f0-9-]{36})(?:\/(image|cancel))?$/),scene=url.pathname.match(/^\/api\/scenes\/([a-f0-9-]{36})\/(image|delete)$/);
      if(sceneJob&&!sceneJobs.has(sceneJob[1])||scene&&!scenes.has(scene[1]))return reply(res,404,{error:'场景或任务不存在'});
      const newSceneJob=url.pathname==='/api/scenes/jobs'&&req.method==='POST',saveScene=url.pathname==='/api/scenes'&&req.method==='POST';
      const sceneRequest=newSceneJob||saveScene||sceneJob&&(!sceneJob[2]&&req.method==='GET'||sceneJob[2]==='image'&&['GET','HEAD'].includes(req.method)||sceneJob[2]==='cancel'&&req.method==='POST')||scene&&(scene[2]==='image'&&['GET','HEAD'].includes(req.method)||scene[2]==='delete'&&req.method==='POST');
      const freeDocument=url.pathname.match(/^\/api\/free\/documents\/([a-f0-9-]{36})(?:\/(edit|cancel|images\/(?:original|[a-f0-9-]{36})))?$/);
      if(freeDocument&&!freeDocuments.has(freeDocument[1]))return reply(res,404,{error:'自由创作记录不存在'});
      const newFreeDocument=url.pathname==='/api/free/documents'&&req.method==='POST';
      const freeRequest=newFreeDocument||freeDocument&&(['GET','HEAD'].includes(req.method)&&(!freeDocument[2]||freeDocument[2].startsWith('images/'))||req.method==='POST'&&['edit','cancel'].includes(freeDocument[2]));
      const videoJob=url.pathname.match(/^\/api\/video\/jobs\/([a-f0-9-]{36})(?:\/(cancel|content|source|resume|render|script|subtitles|shots\/[0-5]\/(?:content|frame)))?$/);
      if(videoJob&&!videoJobs.has(videoJob[1]))return reply(res,404,{error:'视频任务不存在'});
      const videoRequest=url.pathname==='/api/video/status'&&req.method==='GET'||['/api/video/jobs','/api/video/storyboard'].includes(url.pathname)&&req.method==='POST'||videoJob&&(['GET','HEAD'].includes(req.method)&&!['cancel','resume','render'].includes(videoJob[2])||req.method==='POST'&&['cancel','resume','render'].includes(videoJob[2]));
      const job=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})(\/cancel)?$/);
      if(url.pathname==='/api/jobs/active'&&req.method==='GET'){
        const upstream=await fetchImpl(backend+'/api/jobs/active',{method:'GET'}),active=await upstream.json();
        return reply(res,200,active&&jobs.has(active.id)?active:null);
      }
      const image=url.pathname.match(/^\/generated\/([a-f0-9-]{36})\/\d+(?:-repair-[12])?\.(png|jpg|webp)$/);
      if((job||image)&&!jobs.has((job||image)[1]))return reply(res,404,{error:'作品或任务不存在'});
      // Serve UI assets only; history APIs remain unavailable to shared visitors.
      if(['/image-history.js','/image-history.css'].includes(url.pathname)&&['GET','HEAD'].includes(req.method)){
        const upstream=await fetchImpl(backend+url.pathname,{method:req.method});
        res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/octet-stream'});
        return res.end(Buffer.from(await upstream.arrayBuffer()));
      }
      const staticFile=/^\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(url.pathname)||['/','/home','/home/','/home.html','/tools','/tools/','/toolbox.html','/pattern-design','/pattern-design/','/pattern-design.html','/library','/library/','/asset-library.html','/scenes','/scenes/','/scene-studio','/scene-studio/','/scene-studio.html','/workspace','/workspace/','/index.html','/app.js','/style.css','/pattern-color.js','/fabric-picker.js','/product-submenus.js','/set-variants.js','/mat-variants.js','/quilt-variants.js','/sheet-variants.js','/shooting-reference.js','/camera-input.js','/camera-contract.js','/mattress-contract.js','/mattress-variants.js','/blanket-contract.js','/blanket-variants.js','/sleepbag-contract.js','/sleepbag-variants.js','/image-history.js','/image-history.css','/history-groups.js','/local-model-input.js','/fixed-cloth-renderer.js','/fixed-cloth-model.js','/fixed-cloth-materials.js','/vendor/three.module.js','/vendor/three.core.js','/vendor/addons/GLTFLoader.js','/vendor/addons/BufferGeometryUtils.js','/vendor/pathtracer.module.js','/vendor/mesh-bvh.module.js','/vendor/addons/RoomEnvironment.js','/vendor/addons/Pass.js'].includes(url.pathname)||/^\/assets\/(?:(?:fabrics|scene-photos|scene-thumbs|crafts)\/)?[\w.-]+$/.test(url.pathname);
      const newJob=url.pathname==='/api/jobs'&&req.method==='POST';
      const recognition=['/api/product-recognition','/api/pattern-materials/analyze'].includes(url.pathname)&&req.method==='POST'||url.pathname==='/api/product-recognition/catalog'&&req.method==='GET';
      const textilePlanning=url.pathname==='/api/textile/plan'&&req.method==='POST';
      const readJob=job&&(req.method==='GET'&&!job[2]||req.method==='POST'&&job[2]);
      if(!(staticFile&&['GET','HEAD'].includes(req.method)||image&&req.method==='GET'||newJob||readJob||recognition||textilePlanning||videoRequest||freeRequest||sceneRequest||libraryRequest))return reply(res,404,{error:'页面不存在'});
      const headers={};if(req.headers['content-type'])headers['Content-Type']=req.headers['content-type'];
      if(videoJob&&req.headers.range)headers.Range=req.headers.range;
      let body;
      if(req.method==='POST'){
        const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>(newLibraryAsset?90:45)*1024*1024)return reply(res,413,{error:'上传数据过大'});chunks.push(chunk)}body=Buffer.concat(chunks);
      }
      if(saveScene){let input;try{input=JSON.parse(body.toString());}catch{return reply(res,400,{error:'场景保存参数无效'});}if(!sceneJobs.has(input?.jobId))return reply(res,404,{error:'只能保存本邀请生成的场景候选'});}
      headers.Origin=backend;
      const upstream=await fetchImpl(backend+url.pathname,{method:req.method,headers,body,signal:AbortSignal.timeout(60000),redirect:'error'});
      const bytes=Buffer.from(await upstream.arrayBuffer());
      if(newLibraryAsset&&[200,201].includes(upstream.status)){
        const data=JSON.parse(bytes.toString()),id=data.asset?.id;
        if(!/^[a-f0-9-]{36}$/.test(id||''))return reply(res,502,{error:'素材保存结果无效'});
        if(upstream.status===201)libraryAssets.add(id);
        else if(!libraryAssets.has(id))return reply(res,404,{error:'素材不存在'});
      }
      if(newJob&&upstream.status===202){const data=JSON.parse(bytes.toString());if(/^[a-f0-9-]{36}$/.test(data.id))jobs.add(data.id)}
      if(newFreeDocument&&upstream.status===201){const data=JSON.parse(bytes.toString());if(/^[a-f0-9-]{36}$/.test(data.document?.id))freeDocuments.add(data.document.id)}
      if(newSceneJob&&upstream.status===202){const data=JSON.parse(bytes.toString());if(/^[a-f0-9-]{36}$/.test(data.job?.id))sceneJobs.add(data.job.id)}
      if(saveScene&&upstream.status===200){const data=JSON.parse(bytes.toString());if(/^[a-f0-9-]{36}$/.test(data.scene?.id)&&sceneJobs.has(data.scene.jobId))scenes.add(data.scene.id)}
      if(scene?.[2]==='delete'&&req.method==='POST'&&upstream.status===200)scenes.delete(scene[1]);
      if(url.pathname==='/api/video/jobs'&&req.method==='POST'&&upstream.status===202){const data=JSON.parse(bytes.toString());if(/^[a-f0-9-]{36}$/.test(data.id))videoJobs.add(data.id)}
      const responseHeaders={'Content-Type':upstream.headers.get('content-type')||'application/octet-stream'};if(videoJob)for(const name of ['content-range','accept-ranges','content-disposition']){const value=upstream.headers.get(name);if(value)responseHeaders[name]=value;}
      res.writeHead(upstream.status,responseHeaders);res.end(bytes);
    }catch{reply(res,503,{error:'分享服务暂时不可用，请联系分享者检查本地网站是否运行'});}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await mkdir(runtime,{recursive:true});let token;
  try{token=(await readFile(path.join(runtime,'invite-token'),'utf8')).trim()}catch{token=randomBytes(32).toString('base64url');await writeFile(path.join(runtime,'invite-token'),token)}
  const getPublicOrigin=async()=>{try{return (await readFile(path.join(runtime,'public-origin'),'utf8')).trim()}catch{return ''}};
  createShareServer({token,getPublicOrigin}).listen(4174,'127.0.0.1',()=>console.log('Share gateway ready on 127.0.0.1:4174'));
}
