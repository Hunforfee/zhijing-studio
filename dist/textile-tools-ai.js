const uuid=/^[a-f0-9-]{36}$/;
async function request(url,data){const response=await fetch(url,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});let value;try{value=await response.json();}catch{throw Error('服务暂时未返回可读取的结果，请稍后检查任务状态');}if(!response.ok){const error=Error(value?.error||'请求失败（HTTP '+response.status+'）');error.status=response.status;throw error;}return value;}
export class ImageAssistant{
  constructor({storageKey,status,result,busy}){Object.assign(this,{storageKey,status,result,busy});this.pending=null;this.submitting=false;try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&uuid.test(saved.documentId)&&(!saved.operationId||uuid.test(saved.operationId)))this.pending=saved;}catch{}window.addEventListener('pagehide',()=>clearTimeout(this.timer));if(this.pending){this.busy(true);this.status('发现尚未确认的任务，可点击“检查任务”继续查看；不会自动重新生成。');}}
  persist(){try{if(this.pending)localStorage.setItem(this.storageKey,JSON.stringify(this.pending));else localStorage.removeItem(this.storageKey);}catch{}}
  missing(pending){if(this.pending!==pending)return;this.pending=null;this.persist();this.busy(false);this.status('原任务记录已不存在，已清除本机待确认状态。可以重新上传素材；没有重新提交生成。');}
  async start(image,prompt,{title='花型创作',lockPattern=false,referenceImage,ratio='source'}={}){
    if(this.submitting||this.pending)return;this.submitting=true;this.busy(true);this.status('正在检查图片服务…');
    try{const service=await request('/api/status');if(!service.configured||!['sub2api','openai','compatible'].includes(service.provider))throw Error('请在原工作台设置中连接支持参考图编辑的图片服务');const created=await request('/api/free/documents',{image,title});this.pending={documentId:created.document.id,operationId:null};this.persist();this.status('正在提交花型要求…');const submitted=await request('/api/free/documents/'+this.pending.documentId+'/edit',{sourceVersion:'original',mode:'custom',prompt,ratio,lockPattern,lockCraft:false,...(referenceImage?{referenceImage}:{})});this.pending.operationId=submitted.operationId;this.persist();this.status('已加入图片队列；完成后可先对比再采用。');void this.check();}
    catch(error){this.status(error.message+(this.pending?'。任务结果可能尚未确认，请检查任务，勿连续重复提交。':''));if(!this.pending)this.busy(false);}finally{this.submitting=false;}
  }
  async check(){
    const pending=this.pending;if(!pending||this.checking===pending)return;this.checking=pending;clearTimeout(this.timer);const isCurrent=()=>this.pending===pending;
    try{const {document:doc}=await request('/api/free/documents/'+pending.documentId);if(!isCurrent())return;const operation=pending.operationId?doc.operations.find(item=>item.id===pending.operationId):doc.operations.at(-1);
      if(!operation){this.status('该记录中尚无已确认的生成任务，请核对后停止检查，再重新提交。');return;}
      pending.operationId=operation.id;this.persist();const version=doc.versions.find(item=>item.id===operation.id);
      if(version&&operation.status==='done'){if(!new RegExp('^/api/free/documents/'+doc.id+'/images/[a-f0-9-]{36}$').test(version.url))throw Error('结果地址无效');await this.result(version.url,{isCurrent});if(!isCurrent())return;this.pending=null;this.persist();this.busy(false);this.status('结果已生成。请先核对花型细节，再决定是否采用。');}
      else if(['error','cancelled'].includes(operation.status)){this.pending=null;this.persist();this.busy(false);this.status(operation.message||'任务已结束；不会自动重试。');}
      else{this.status(operation.message||'正在生成花型结果…');this.timer=setTimeout(()=>this.check(),2500);}
    }catch(error){if(isCurrent()){if(error.status===404)this.missing(pending);else this.status(error.message+'；可再次检查任务，不会重新计费提交。');}}finally{if(this.checking===pending)this.checking=null;}
  }
  async cancel(){if(this.submitting||!this.pending)return;const pending=this.pending;clearTimeout(this.timer);try{await request('/api/free/documents/'+pending.documentId+'/cancel',{});if(this.pending!==pending)return;this.pending=null;this.persist();this.busy(false);this.status('已停止后续处理，原稿保留；供应商已接受的任务可能继续处理和计费。');}catch(error){if(this.pending===pending){if(error.status===404)this.missing(pending);else this.status('停止结果未确认：'+error.message);}}}
}
