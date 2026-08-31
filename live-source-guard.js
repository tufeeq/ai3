(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
else{root.TAGX3LiveSourceGuard=api;api.install(root)}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PAGE_LIVE='/ai/tag/data/live-quotes.json';
const RAW_LIVE='https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/live-quotes.json';
function epoch(payload){
  if(!payload||typeof payload!=='object')return 0;
  for(const key of ['updatedAtUTC','updatedAtET','updatedAt','snapshotTimestampUTC']){
    const v=payload[key];if(!v)continue;const t=new Date(v).getTime();if(Number.isFinite(t))return t;
  }
  return 0;
}
function chooseNewest(pagePayload,rawPayload){
  const p=epoch(pagePayload),r=epoch(rawPayload);
  if(r>p)return{payload:rawPayload,source:'raw-github',epoch:r};
  if(p>0)return{payload:pagePayload,source:'pages',epoch:p};
  if(r>0)return{payload:rawPayload,source:'raw-github',epoch:r};
  return{payload:pagePayload||rawPayload||null,source:pagePayload?'pages':rawPayload?'raw-github':'none',epoch:0};
}
async function payloadOf(response){try{return response?.ok?await response.clone().json():null}catch{return null}}
function install(root){
  if(!root||typeof root.fetch!=='function'||root.__TAGX3_LIVE_SOURCE_GUARD__)return false;
  root.__TAGX3_LIVE_SOURCE_GUARD__=true;
  const upstream=root.fetch.bind(root);
  root.fetch=async function(input,init){
    let path='';try{path=new URL(typeof input==='string'?input:input?.url,root.location?.href||'https://x.invalid').pathname}catch{}
    if(path!==PAGE_LIVE)return upstream(input,init);
    const stamp=Date.now();
    const pagePromise=upstream(input,{...(init||{}),cache:'no-store'}).catch(()=>null);
    const rawPromise=upstream(`${RAW_LIVE}?guard=${stamp}`,{cache:'no-store'}).catch(()=>null);
    const [pageResponse,rawResponse]=await Promise.all([pagePromise,rawPromise]);
    const [pagePayload,rawPayload]=await Promise.all([payloadOf(pageResponse),payloadOf(rawResponse)]);
    const picked=chooseNewest(pagePayload,rawPayload);
    if(!picked.payload)return pageResponse||rawResponse||new Response('',{status:503,statusText:'Live feed unavailable'});
    const headers=new Headers((picked.source==='pages'?pageResponse:rawResponse)?.headers||{});
    headers.set('content-type','application/json');
    headers.set('cache-control','no-store');
    headers.set('x-tagx-live-source',picked.source);
    headers.set('x-tagx-live-updated-at',new Date(picked.epoch||Date.now()).toISOString());
    return new Response(JSON.stringify(picked.payload),{status:200,headers});
  };
  return true;
}
return{PAGE_LIVE,RAW_LIVE,epoch,chooseNewest,install};
});