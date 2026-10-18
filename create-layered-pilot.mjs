import {readFile,writeFile,mkdir,copyFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {renderLayeredShot} from './video-layered.mjs';
import {composeVideoStory} from './video-composer.mjs';
const oldId='d1c76839-2948-4461-b369-d50a2558a331',oldDir=path.resolve('generated/videos',oldId),old=JSON.parse(await readFile(path.join(oldDir,'job.json'),'utf8'));
const id=process.argv[2]||randomUUID();if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid pilot ID');const directory=path.resolve('generated/videos',id);await mkdir(directory,{recursive:true});
const polygons=[
 {subject:[[0,.396],[.15,.357],[.26,.337],[.36,.312],[.43,.28],[.48,.18],[.523,.064],[.561,.009],[.61,.055],[.65,.064],[.68,0],[1,0],[1,1],[0,1]],foreground:[[0,0],[.065,0],[.13,.065],[.15,.18],[.115,.245],[.045,.185],[0,.17]],ambient:[[.36,.015],[.44,.015],[.485,.065],[.475,.16],[.425,.21],[.355,.12]]},
 {subject:[[.68,0],[.65,.09],[.49,.115],[.34,.15],[.22,.19],[.13,.22],[.06,.26],[0,.3],[0,.58],[.035,.61],[.1,.73],[.16,.8],[.25,.86],[.48,.95],[.57,1],[1,1],[1,0]],foreground:[[0,.57],[.035,.585],[.072,.67],[.16,.76],[.22,.89],[.19,1],[0,1]],ambient:[[.008,.08],[.07,.04],[.16,.08],[.20,.16],[.09,.22],[0,.27]]},
 {subject:[[0,.34],[.16,.355],[.20,.25],[.24,.13],[.27,0],[.46,.06],[.60,.075],[.64,.13],[.78,.21],[1,.28],[1,.76],[.89,.88],[.85,1],[0,1]],foreground:[[.92,.78],[1,.72],[1,1],[.83,1],[.88,.91]],ambient:[[0,0],[.045,0],[.10,.1],[.12,.20],[.07,.24],[0,.22]]}
];
await copyFile(path.join(oldDir,'source'),path.join(directory,'source'));
for(let i=0;i<old.sourceMimes.length;i++)await copyFile(path.join(oldDir,'source-'+i),path.join(directory,'source-'+i));
for(let i=0;i<old.storyboard.shots.length;i++){
 await copyFile(path.join(oldDir,'frame-'+(i+1)+'.png'),path.join(directory,'frame-'+(i+1)+'.png'));
 await renderLayeredShot({directory,index:i,duration:old.storyboard.shots[i].duration,ratio:old.ratio,layers:{...polygons[i],foreground:[]}});
 console.log('已完成分层景深 '+(i+1)+'/'+old.storyboard.shots.length);
}
const storyboard={...old.storyboard,title:old.storyboard.title+' · 分层景深试片'};
await composeVideoStory({directory,storyboard,ratio:old.ratio});
const job={id,workflow:'creative-frames-v1',motionMode:'camera',renderStyle:'layered-pilot-v1',phase:'video',status:'completed',progress:100,created:Date.now(),finished:Date.now(),duration:old.duration,ratio:old.ratio,quality:old.quality,audio:false,mime:old.mime,sourceMimes:old.sourceMimes,creative:old.creative,storyboard,derivedFrom:oldId,message:'分层景深试片 · 床品保持原图，背景微风与前后景视差，本地制作无生成调用',shotTasks:storyboard.shots.map(()=>({status:'completed',frameStatus:'completed'}))};
await writeFile(path.join(directory,'job.json.tmp'),JSON.stringify(job));await rename(path.join(directory,'job.json.tmp'),path.join(directory,'job.json'));
console.log(JSON.stringify({id,file:path.join(directory,'video.mp4')}));
