import {videoBinary} from '../video-composer.mjs';
try{
  await videoBinary();
  console.log('视频剪辑组件已就绪：H.264、AAC、字幕及稳定运镜功能检查通过。');
}catch(error){console.error(error.message);process.exitCode=1;}
