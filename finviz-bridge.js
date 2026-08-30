(()=>{
'use strict';
const upstream=window.fetch.bind(window);
const FINVIZ_RAW='https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/finviz.json';
let finvizCache=null,finvizAt=0,finvizPromise=null;
const num=v=>{if(v==null||v==='')return null;const s=String(v).replace(/[$,%]/g,'').replace(/,/g,'').trim();const m=s.match(/^(-?\d+(?:\.\d+)?)\s*([KMBT])?$/i);if(!m)return Number.isFinite(+s)?+s:null;const mult={K:1e3,M:1e6,B:1e9,T:1e12}[String(m[2]||'').toUpperCase()]||1;return +m[1]*mult};
const pct=v=>num(v);
const sym=r=>String(r?.symbol||r?.ticker||r?.Ticker||r?.Symbol||'').trim().toUpperCase();
const first=(r,keys)=>{for(const k of keys)if(r?.[k]!=null&&r[k]!=='')return r[k];return null};
const ageHours=ts=>{const t=new Date(ts||0).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()-t)/3600000):Infinity};
function normalizeFinviz(r,updatedAt){
  const symbol=sym(r);if(!symbol)return null;
  const price=num(first(r,['Price','price','Last','Close']));if(!(price>0))return null;
  return {
    symbol,
    price,
    changePct:pct(first(r,['Change','change','Change %','Perf Day']))??0,
    volume:num(first(r,['Volume','volume']))??0,
    avgVolume:num(first(r,['Average Volume','Avg Volume','AvgVolume','averageVolume']))??0,
    floatShares:num(first(r,['Shares Float','Shs Float','Float','floatShares']))??0,
    previousClose:num(first(r,['Prev Close','Previous Close','previousClose']))??0,
    preMarketChangePct:pct(first(r,['Pre-Market Change','Premarket Change','preMarketChangePct']))??0,
    afterHoursChangePct:pct(first(r,['After-Hours Change','After Hours Change','postMarketChangePercent']))??0,
    relativeVolume:num(first(r,['Relative Volume','Rel Volume','RVOL']))??0,
    marketCap:num(first(r,['Market Cap','MarketCap']))??null,
    sector:first(r,['Sector','sector']),industry:first(r,['Industry','industry']),company:first(r,['Company','company']),
    observedAt:first(r,['_snapshotTimestampUTC','observedAt','timestamp'])||updatedAt||new Date().toISOString(),
    source:'Finviz Elite',finviz:true
  };
}
function payloadRows(p){if(Array.isArray(p))return p;if(Array.isArray(p?.data))return p.data;if(Array.isArray(p?.rows))return p.rows;return[]}
async function loadFinviz(){
  if(finvizCache&&Date.now()-finvizAt<4*60*1000)return finvizCache;
  if(finvizPromise)return finvizPromise;
  finvizPromise=(async()=>{
    const r=await upstream(`${FINVIZ_RAW}?ts=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Finviz HTTP ${r.status}`);
    const p=await r.json(),updatedAt=p?.updatedAt||p?.snapshotTimestampUTC||null;
    const rows=payloadRows(p).map(x=>normalizeFinviz(x,updatedAt)).filter(Boolean);
    finvizCache={rows,updatedAt,session:p?.session||null,sessionBucket:p?.sessionBucket||null};finvizAt=Date.now();return finvizCache;
  })().catch(()=>({rows:[],updatedAt:null,session:null,sessionBucket:null})).finally(()=>{finvizPromise=null});
  return finvizPromise;
}
function liveRows(p){
  if(Array.isArray(p?.quotes))return p.quotes;
  if(p?.quotes&&typeof p.quotes==='object')return Object.entries(p.quotes).map(([s,q])=>({symbol:s,...q}));
  if(Array.isArray(p?.data))return p.data;
  return [];
}
function merge(live,finviz){
  const by=new Map();
  for(const f of finviz.rows||[])by.set(f.symbol,f);
  for(const l0 of liveRows(live)){
    const s=sym(l0);if(!s)continue;const f=by.get(s)||{};
    const observedAt=first(l0,['observedAt','timestamp','updatedAt','quoteTime','timestampET'])||f.observedAt;
    const sessionFinal=live?.marketClockSession==='closed'&&ageHours(observedAt)<=96;
    by.set(s,{...f,...l0,symbol:s,
      price:num(first(l0,['price','last','regularMarketPrice','currentPrice','close']))??f.price,
      changePct:pct(first(l0,['changePct','changePercent','regularMarketChangePercent','pctChange','change']))??f.changePct,
      volume:num(first(l0,['volume','regularMarketVolume','dayVolume']))??f.volume,
      avgVolume:num(first(l0,['avgVolume','averageVolume','averageDailyVolume10Day','avgVol']))||f.avgVolume||0,
      floatShares:num(first(l0,['floatShares','float','sharesFloat']))||f.floatShares||0,
      observedAt,
      marketClockSession:live?.marketClockSession||null,
      sourcePayloadUpdatedAt:live?.updatedAtUTC||live?.updatedAt||null,
      sessionFinal
    });
  }
  return [...by.values()].filter(x=>x.symbol&&x.price>0);
}
window.fetch=async function(input,init={}){
  const raw=typeof input==='string'?input:input?.url||'';let u;try{u=new URL(raw,location.href)}catch{return upstream(input,init)};
  if(u.origin!==location.origin||u.pathname!=='/ai/tag/data/live-quotes.json')return upstream(input,init);
  const [baseResp,fz]=await Promise.all([upstream(input,init),loadFinviz()]);
  if(!baseResp.ok)return baseResp;
  try{
    const live=await baseResp.clone().json();
    const rows=merge(live,fz);
    const sessionFinalCount=rows.filter(x=>x.sessionFinal).length;
    const payload={...live,quotes:rows,finvizBridge:{enabled:true,count:fz.rows.length,updatedAt:fz.updatedAt,session:fz.session,sessionBucket:fz.sessionBucket},mergedCount:rows.length,sessionFinalCount};
    return new Response(JSON.stringify(payload),{status:200,statusText:'OK',headers:{'content-type':'application/json','x-tagx-finviz-bridge':'1'}});
  }catch{return baseResp}
};
window.TAGX3FinvizBridge={load:loadFinviz};
})();
