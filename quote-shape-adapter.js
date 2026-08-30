(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports) module.exports=api;
else { root.TAGX3QuoteShape=api; api.install(root); }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const QUOTE_PATHS=new Set([
  '/ai/tag/data/live-quotes.json',
  '/ai/tag/data/tagx2-sentinel.json',
  '/ai/tag/data/coverage-rescue.json'
]);
const KEYS=['quotes','data','results','stocks','items','candidates','opportunities','rows'];
function canonicalRow(row,symbol,fallbackObservedAt){
  if(!row||typeof row!=='object'||Array.isArray(row))return {symbol:String(symbol||'').toUpperCase(),value:row};
  const out={...row};
  if(!out.symbol&&!out.ticker&&!out.code&&symbol)out.symbol=String(symbol).toUpperCase();
  if(out.velocity5m==null&&out.priceVelocity5mPct!=null)out.velocity5m=out.priceVelocity5mPct;
  if(out.velocity15m==null&&out.priceVelocity15mPct!=null)out.velocity15m=out.priceVelocity15mPct;
  if(!out.observedAt)out.observedAt=out.timestampET||out.timestamp||out.updatedAt||fallbackObservedAt||null;
  return out;
}
function normalizePayload(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return payload;
  const fallbackObservedAt=payload.updatedAt||payload.updatedAtUTC||payload.updatedAtET||payload.timestamp||null;
  for(const key of KEYS){
    const value=payload[key];
    if(Array.isArray(value)){
      const rows=value.map(row=>canonicalRow(row,null,fallbackObservedAt));
      return {...payload,[key]:rows,quoteShapeNormalized:{key,count:rows.length,canonicalized:true}};
    }
    if(value&&typeof value==='object'){
      const rows=Object.entries(value).map(([symbol,row])=>canonicalRow(row,symbol,fallbackObservedAt));
      return {...payload,[key]:rows,quoteShapeNormalized:{key,count:rows.length,canonicalized:true}};
    }
  }
  return payload;
}
function install(root){
  if(!root||typeof root.fetch!=='function'||root.__TAGX3_QUOTE_SHAPE_ADAPTER__)return false;
  root.__TAGX3_QUOTE_SHAPE_ADAPTER__=true;
  const upstream=root.fetch.bind(root);
  root.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input?.url||'';
    let url;
    try{url=new URL(raw,root.location?.href||'https://example.invalid/')}catch{return upstream(input,init)}
    const response=await upstream(input,init);
    if(!QUOTE_PATHS.has(url.pathname)||!response?.ok)return response;
    try{
      const payload=await response.clone().json();
      const normalized=normalizePayload(payload);
      if(normalized===payload)return response;
      const headers=new Headers(response.headers||{});
      headers.set('content-type','application/json');
      headers.set('x-tagx-quote-shape','normalized');
      return new Response(JSON.stringify(normalized),{status:response.status,statusText:response.statusText,headers});
    }catch{return response}
  };
  return true;
}
return {QUOTE_PATHS,canonicalRow,normalizePayload,install};
});
