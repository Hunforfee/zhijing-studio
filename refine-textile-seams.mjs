import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('dist/fixed-cloth-materials.js','utf8');s=s.replace("if(kind==='weave'){", "if(kind==='weave-normal'){\n   let nx=.23*Math.cos(x*Math.PI/4)*Math.cos(y*Math.PI/4),ny=.20*Math.sin(y*Math.PI/2),nz=1;const l=Math.hypot(nx,ny,nz);im.data[i]=(nx/l*.5+.5)*255;im.data[i+1]=(ny/l*.5+.5)*255;im.data[i+2]=(nz/l*.5+.5)*255;\n  }else if(kind==='weave'){");await writeFile('dist/fixed-cloth-materials.js',s);
s=await readFile('dist/fixed-cloth-renderer.js','utf8');s=s.replace("const weave=surfaceTexture('weave'),wood=", "const weaveNormal=surfaceTexture('weave-normal');weaveNormal.repeat.set(12,12);textures.push(weaveNormal);\n    const weave=surfaceTexture('weave'),wood=");s=s.replace("const fabricOptions={roughness,metalness:0", "const fabricOptions={normalMap:weaveNormal,normalScale:new THREE.Vector2(.22,.22),roughness,metalness:0");
// Avoid accumulating custom normal perturbation twice; the native normal map is supported by both renderers.
const a=s.indexOf('    for(const m of Object.values(mats)){m.onBeforeCompile='),b=s.indexOf('materials.push(...Object.values(mats));',a);if(a>=0&&b>a)s=s.slice(0,a)+'    '+s.slice(b);
s=s.replace("    function box(w,h,d,x,y,z,color){", `    // Thin sewn seams follow real cloth boundaries, never ordinary styling creases.
    const seamM=new THREE.MeshStandardMaterial({color:'#c7bfb0',roughness:1});materials.push(seamM);
    for(const p of panels.filter(p=>p.name==='duvet-A'||p.name.endsWith('-A')||p.name.includes('sheet'))){
      const cols=p.name.startsWith('pillow')?49:113,rows=p.positions.length/3/cols;
      const vertex=(i,j)=>new THREE.Vector3(...p.positions.slice((j*cols+i)*3,(j*cols+i)*3+3));
      const route=[];for(let j=0;j<rows;j++)route.push(vertex(0,j));for(let i=1;i<cols;i++)route.push(vertex(i,rows-1));for(let j=rows-2;j>=0;j--)route.push(vertex(cols-1,j));
      if(p.name.startsWith('pillow'))for(let i=cols-2;i>0;i--)route.push(vertex(i,0));
      const curve=new THREE.CatmullRomCurve3(route,false,'centripetal'),g=new THREE.TubeGeometry(curve,route.length,.0007,4,false);geometries.push(g);const thread=new THREE.Mesh(g,seamM);thread.castShadow=false;scene.add(thread);
    }
    function box(w,h,d,x,y,z,color){`);
await writeFile('dist/fixed-cloth-renderer.js',s);
