(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;else{root.TAGX3MarketUniverse=api;api.install(root)}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LIVE='/ai/tag/data/live-quotes.json',DISCOVERY='/ai/tag/data/discovery-fast.json';
const n=v=>{if(v==null||v==='')return null;const x=Number(String(v).replace(/[%,$]/g,'').replace(/,/g,''));return Number.isFinite(x)?x:null};
const sym=r=>String(r?.symbol||r?.ticker||r?.Ticker||r?.code||'').toUpperCase().trim();
const rowsOf=p=>{if(Array.isArray(p))return p;for(const k of ['quotes','rows','data','results','stocks','items','candidates','opportunities']){const v=p?.[k];if(Array.isArray(v))return v;if(v&&typeof v==='object')return Object.entries(v).map(([s,r])=>r&&typeof r==='object'?{symbol:s,...r}:{symbol:s,value:r})}return[]};
function canonicalFast(r,payload={}){
  const symbol=sym(r);if(!symbol)return null;
  const observedAt=r.observedAt||r._snapshotTimestampUTC||r._firstFastObservedTimestampUTC||payload.snapshotTimestampUTC||payload.updatedAt||null;
  return {...r,symbol,
    price:n(r.price??r.Price??r.last),changePct:n(r.changePct??r.Change??r.changePercent),volume:n(r.volume??r.Volume),
    relVolume:n(r.relVolume??r['Relative Volume']),company:r.company||r.Company||r.name||null,
    floatShares:n(r.floatShares??r['Shares Float']??r.Float),sharesOutstanding:n(r.sharesOutstanding??r['Shares Outstanding']??r['Shares Outstand']),
    shortFloat:n(r.shortFloat??r['Short Float']??r['Short Float %']),dayHigh:n(r.dayHigh??r.High??r.high),dayLow:n(r.dayLow??r.Low??r.low),
    observedAt,marketClockSession:payload.session||r._session||'closed',source:'Discovery Fast',discoveryOnly:true,liveBacked:false,marketObservation:false,
    earlyPatternScore:n(r._earlyPatternScore),volumeExpansion:n(r._volumeExpansionFromFirst),moveFromFirstPct:n(r._moveFromFirstPct)
  };
}
function quality(r){let q=0;if(n(r.price)>0)q+=5;if(n(r.volume)>0)q+=3;if(n(r.floatShares)>0)q+=2;if(r.company)q+=1;if(r.source==='Live Quotes')q+=8;if(r.liveBacked)q+=5;return q}
function merge(live,fast){
  const liveRows=rowsOf(live),fastRows=rowsOf(fast).map(r=>canonicalFast(r,fast)).filter(Boolean),map=new Map();
  for(const r of [...fastRows,...liveRows]){const s=sym(r);if(!s)continue;const x={...r,symbol:s};const old=map.get(s);if(!old||quality(x)>=quality(old))map.set(s,old?{...old,...x}:x)}
  const quotes=[...map.values()];
  api.last={liveCount:liveRows.length,discoveryCount:fastRows.length,uniqueCount:quotes.length,updatedAt:new Date().toISOString(),rows:new Map(quotes.map(r=>[r.symbol,r]))};
  return {...(live||{}),quotes,count:quotes.length,requested:Math.max(Number(live?.requested||0),quotes.length),universeCoverage:{liveSnapshot:liveRows.length,discoveryFast:fastRows.length,unique:quotes.length,source:'live-quotes + discovery-fast',discoveryUpdatedAt:fast?.updatedAt||fast?.snapshotTimestampUTC||null}};
}
async function readJson(response){try{return await response.clone().json()}catch{return null}}
function install(root){if(!root||typeof root.fetch!=='function'||root.__TAGX3_MARKET_UNIVERSE__)return false;root.__TAGX3_MARKET_UNIVERSE__=true;const upstream=root.fetch.bind(root);
  root.fetch=async function(input,init){let path='';try{path=new URL(typeof input==='string'?input:input?.url,root.location?.href||'https://x.invalid').pathname}catch{}
    const response=await upstream(input,init);if(path!==LIVE||!response?.ok)return response;
    try{const live=await readJson(response);const fr=await upstream(`${DISCOVERY}?universe=${Date.now()}`,{cache:'no-store'});const fast=fr.ok?await fr.json():null;if(!fast)return response;const merged=merge(live,fast);const headers=new Headers(response.headers||{});headers.set('content-type','application/json');headers.set('x-tagx-universe',String(merged.count));return new Response(JSON.stringify(merged),{status:response.status,statusText:response.statusText,headers})}catch{return response}
  };return true}
const api={LIVE,DISCOVERY,rowsOf,canonicalFast,merge,last:null,install};return api;
});