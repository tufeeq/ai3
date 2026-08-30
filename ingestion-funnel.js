(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports) module.exports=api;
else { root.TAGX3IngestionFunnel=api; api.install(root); }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const QUOTE_PATHS=new Set(['/ai/tag/data/live-quotes.json','/ai/tag/data/tagx2-sentinel.json','/ai/tag/data/coverage-rescue.json']);
const KEYS=['data','quotes','results','stocks','items','candidates','opportunities','rows'];
function rowsOf(payload){
  if(Array.isArray(payload))return payload;
  for(const key of KEYS)if(Array.isArray(payload?.[key]))return payload[key];
  return [];
}
function symbolOf(row){return String(row?.symbol||row?.ticker||row?.code||'').trim().toUpperCase();}
function summarizeFeeds(records){
  const seen=new Set();let rows=0;
  const feeds=[];
  for(const record of records||[]){
    const list=rowsOf(record?.payload);rows+=list.length;
    let valid=0;
    for(const row of list){const s=symbolOf(row);if(s){seen.add(s);valid++;}}
    feeds.push({path:record.path,rows:list.length,validSymbols:valid,session:record.payload?.marketClockSession||record.payload?.session||null,updatedAt:record.payload?.updatedAtUTC||record.payload?.updatedAt||null});
  }
  return {feedRows:rows,uniqueSymbols:seen.size,feeds};
}
function summarizeCases(cases){
  const statuses={VERIFIED:0,LIKELY_COMPLIANT:0,CONFLICT_REVIEW:0,UNVERIFIED:0,NON_COMPLIANT:0};
  for(const c of cases||[]){const s=String(c?.sharia||c?.shariaStatus||'UNVERIFIED');statuses[s]=(statuses[s]||0)+1;}
  return {analyzed:Array.isArray(cases)?cases.length:0,sharia:statuses};
}
function readCases(root){try{const v=JSON.parse(root.localStorage?.getItem('tagx3.opportunityCases.v1')||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function evidenceCounts(root){
  const cards=[...(root.document?.querySelectorAll?.('.opp-card')||[])];
  return {ready:cards.filter(c=>c.dataset?.evidenceReady==='1').length,pending:cards.filter(c=>c.dataset?.evidenceReady==='0').length};
}
function render(root,state){
  const host=root.document?.getElementById?.('feedGrid');if(!host)return;
  let el=root.document.getElementById('ingestionFunnel');
  if(!el){el=root.document.createElement('div');el.id='ingestionFunnel';el.className='feed-card';host.prepend(el);}
  const f=summarizeFeeds(state.records),c=summarizeCases(readCases(root)),e=evidenceCounts(root);
  const verified=(c.sharia.VERIFIED||0)+(c.sharia.LIKELY_COMPLIANT||0);
  el.innerHTML=`<b>INGESTION FUNNEL</b><small>${f.feedRows} صف · ${f.uniqueSymbols} رمز فريد → ${c.analyzed} محلل → ${verified} شرعيًا VERIFIED/LIKELY → ${e.ready} مكتمل الأدلة</small>`;
  el.title='تشخيص عددي لمسار البيانات الفعلي فقط؛ لا يغير الترتيب أو العتبات أو القرار.';
  state.last={...f,...c,evidence:e,at:new Date().toISOString()};
}
function install(root){
  if(!root||typeof root.fetch!=='function'||root.__TAGX3_INGESTION_FUNNEL__)return false;
  root.__TAGX3_INGESTION_FUNNEL__=true;
  const upstream=root.fetch.bind(root),state={records:[],last:null};
  root.fetch=async function(input,init){
    const response=await upstream(input,init);const raw=typeof input==='string'?input:input?.url||'';let url;
    try{url=new URL(raw,root.location?.href||'https://example.invalid/')}catch{return response}
    if(!QUOTE_PATHS.has(url.pathname)||!response?.ok)return response;
    try{
      const payload=await response.clone().json();
      const record={path:url.pathname,payload,at:new Date().toISOString()};
      const i=state.records.findIndex(x=>x.path===record.path);if(i>=0)state.records[i]=record;else state.records.push(record);
      root.setTimeout?.(()=>render(root,state),1200);
    }catch{}
    return response;
  };
  const schedule=()=>root.setTimeout?.(()=>render(root,state),1600);
  root.addEventListener?.('DOMContentLoaded',schedule,{once:true});
  root.addEventListener?.('load',schedule,{once:true});
  root.document?.getElementById?.('refreshBtn')?.addEventListener?.('click',()=>root.setTimeout?.(()=>render(root,state),1800));
  root.TAGX3IngestionFunnelState=state;
  return true;
}
return {QUOTE_PATHS,rowsOf,symbolOf,summarizeFeeds,summarizeCases,install};
});
