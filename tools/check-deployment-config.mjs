import {loadDeploymentConfiguration} from '../deployment-config.mjs';
import {serviceProfiles} from '../service-profiles.mjs';
import {videoConfigProfiles} from '../video-providers.mjs';
const bundle=await loadDeploymentConfiguration();if(!bundle)throw Error('未配置 ZHJ_DEPLOYMENT_KEY，无法加载已备份的服务设置');
const image=serviceProfiles(bundle.image),active=image.profiles[image.activeProvider],video=videoConfigProfiles(bundle.video||{}),url=active?.baseUrl?new URL(active.baseUrl):null;
if(!active?.apiKey||!url)throw Error('主用图片服务的密钥或地址未配置');
const report={imageProvider:image.activeProvider,imageModel:active.model,videoProvider:video.activeProvider,videoModel:video.config.model,imageConfigured:true,videoConfigured:!!video.config.apiKey,relayRequiresLocalService:['127.0.0.1','localhost','[::1]'].includes(url.hostname)};
if(process.argv.includes('--network')){
 try{const response=await fetch(active.baseUrl.replace(/\/$/,'')+'/models',{headers:{Authorization:'Bearer '+active.apiKey},signal:AbortSignal.timeout(15000),redirect:'error'});report.imageServiceHttpStatus=response.status;if(!response.ok)process.exitCode=1;}
 catch{report.imageServiceReachable=false;process.exitCode=1;}
}
console.log(JSON.stringify(report,null,2));
if(report.relayRequiresLocalService)console.log('主用图片服务为本机中转地址：服务器必须运行对应中转；否则请设置 SUB2API_BASE_URL。');
