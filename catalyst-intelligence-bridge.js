(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports) module.exports=api;
else { root.TAGX3CatalystIntelligenceBridge=api; api.install(root); }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CATALYST_PATH='/ai/tag/data/sec-catalysts.json';
const INTELLIGENCE_PATH='./data/intelligence.json';
const symbolOf=x=>String(x?.symbol||x?.ticker||'').trim().toUpperCase();
const timeOf=x=>x?.eventAt||x?.catalystAt||x?.publishedAt||x?.acceptedAt||x?.filedAt||x?.observedAt||x?.timestamp||null;
function nativeRows(payload){
  if(Array.isArray(payload))return payload;
  for(const k of ['data','events','rows','items'])if(Array.isArray(payload?.[k]))return payload[k];
  return [];
}
function verifiedSecEvents(intel){
  const events=Array.isArray(intel?.events)?intel.events:[];
  return events.filter(e=>String(e?.type||'').toUpperCase()==='SEC'&&symbolOf(e)&&timeOf(e)&&String(e?.verification||'').toUpperCase()==='PRIMARY')
    .map(e=>({symbol:symbolOf(e),type:'SEC',form:e.form||null,eventType:e.form?`SEC ${e.form}`:'SEC filing',eventAt:timeOf(e),acceptedAt:timeOf(e),observedAt:timeOf(e),headline:e.headline||null,url:e.url||null,source:e.source||'SEC EDGAR',verification:'PRIMARY',intelligenceFallback:true}));
}
function mergePayload(nativePayload,intel){
  const rows=nativeRows(nativePayload),fallback=verifiedSecEvents(intel),seen=new Set();
  const merged=[];
  for(const r of rows){const key=`${symbolOf(r)}|${timeOf(r)||''}|${r?.form||r?.type||''}`;if(!seen.has(key)){seen.add(key);merged.push(r)}}
  let added=0;
  for(const r of fallback){const key=`${symbolOf(r)}|${timeOf(r)||''}|${r?.form||r?.type||''}`;if(!seen.has(key)){seen.add(key);merged.push(r);added++}}
  return {...(nativePayload&&typeof nativePayload==='object'&&!Array.isArray(nativePayload)?nativePayload:{}),data:merged,catalystIntelligenceBridge:{enabled:true,nativeCount:rows.length,primarySecFallbackCount:fallback.length,addedCount:added,policy:'PRIMARY_SEC_ONLY_NO_SYNTHETIC_EVENTS'}};
}
function install(root){
  if(!root||typeof root.fetch!=='function'||root.__TAGX3_CATALYST_INTEL_BRIDGE__)return false;
  root.__TAGX3_CATALYST_INTEL_BRIDGE__=true;
  const upstream=root.fetch.bind(root);
  root.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input?.url||'';let url;
    try{url=new URL(raw,root.location?.href||'https://example.invalid/')}catch{return upstream(input,init)}
    if(url.pathname!==CATALYST_PATH)return upstream(input,init);
    const [nativeResp,intelResp]=await Promise.all([upstream(input,init),upstream(`${INTELLIGENCE_PATH}?v=${Date.now()}`,{cache:'no-store'})]);
    if(!nativeResp?.ok||!intelResp?.ok)return nativeResp;
    try{
      const [nativePayload,intel]=await Promise.all([nativeResp.clone().json(),intelResp.json()]);
      const merged=mergePayload(nativePayload,intel),headers=new Headers(nativeResp.headers||{});
      headers.set('content-type','application/json');headers.set('x-tagx-catalyst-intelligence-bridge','1');
      return new Response(JSON.stringify(merged),{status:nativeResp.status,statusText:nativeResp.statusText,headers});
    }catch{return nativeResp}
  };
  return true;
}
return {CATALYST_PATH,INTELLIGENCE_PATH,symbolOf,timeOf,nativeRows,verifiedSecEvents,mergePayload,install};
});
