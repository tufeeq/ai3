(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports) module.exports=api;
else { root.TAGX3CatalystShape=api; api.install(root); }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CATALYST_PATH='/ai/tag/data/sec-catalysts.json';
function normalizePayload(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return payload;
  if(Array.isArray(payload.data))return payload;
  if(Array.isArray(payload.events))return {...payload,data:payload.events,catalystShapeNormalized:{from:'events',count:payload.events.length}};
  return payload;
}
function install(root){
  if(!root||typeof root.fetch!=='function'||root.__TAGX3_CATALYST_SHAPE_ADAPTER__)return false;
  root.__TAGX3_CATALYST_SHAPE_ADAPTER__=true;
  const upstream=root.fetch.bind(root);
  root.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input?.url||'';let url;
    try{url=new URL(raw,root.location?.href||'https://example.invalid/')}catch{return upstream(input,init)}
    const response=await upstream(input,init);
    if(url.pathname!==CATALYST_PATH||!response?.ok)return response;
    try{
      const payload=await response.clone().json(),normalized=normalizePayload(payload);
      if(normalized===payload)return response;
      const headers=new Headers(response.headers||{});headers.set('content-type','application/json');headers.set('x-tagx-catalyst-shape','normalized');
      return new Response(JSON.stringify(normalized),{status:response.status,statusText:response.statusText,headers});
    }catch{return response}
  };
  return true;
}
return {CATALYST_PATH,normalizePayload,install};
});
