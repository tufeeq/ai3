import fs from 'node:fs/promises';
import {parseSecAtom,currentFeedUrl} from './sec-current-feed.mjs';

const UA='TAGX3 research assistant contact:tufeeq11@gmail.com';
const OUT='data/intelligence.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=new Date();
const iso=now.toISOString();
const daysAgo=(d,n)=>Date.now()-new Date(d||0).getTime()<=n*86400000;
const normalizedIso=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString():null};
const ageMinBetween=(newer,older)=>{const a=Date.parse(newer||''),b=Date.parse(older||'');return Number.isFinite(a)&&Number.isFinite(b)?Number(Math.max(0,(a-b)/60000).toFixed(1)):null};

async function getJson(url,{headers={},timeout=10000}={}){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),timeout);
  try{const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*',...headers},signal:ac.signal}); if(!r.ok)throw new Error(`HTTP ${r.status}`); return await r.json();}
  finally{clearTimeout(t)}
}
async function getText(url,{headers={},timeout=10000}={}){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),timeout);
  try{const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/atom+xml,text/xml,*/*',...headers},signal:ac.signal}); if(!r.ok)throw new Error(`HTTP ${r.status}`); return await r.text();}
  finally{clearTimeout(t)}
}

async function mapBatches(items,size,worker,pauseMs=0){
  const out=[];
  for(let i=0;i<items.length;i+=size){
    const batch=items.slice(i,i+size);
    out.push(...await Promise.all(batch.map(worker)));
    if(pauseMs&&i+size<items.length)await sleep(pauseMs);
  }
  return out;
}

function liveRows(p){
  if(Array.isArray(p?.quotes))return p.quotes;
  if(p?.quotes&&typeof p.quotes==='object')return Object.values(p.quotes);
  return [];
}

function shortlist(rows,n=40){
  return rows.filter(x=>x?.ticker||x?.symbol).map(x=>({
    symbol:String(x.ticker||x.symbol).toUpperCase(),
    price:Number(x.price||x.regularMarketPrice||0),
    changePct:Number(x.changePct||0),
    early:Number(x.earlyRegimeShiftScore||0),
    ignition:Number(x.ignitionScore||0),
    observedAt:x.timestampET||x.observedAt||null
  })).sort((a,b)=>(b.early+b.ignition)-(a.early+a.ignition)).slice(0,n);
}

function marketTruth(rows){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const hm=Number(p.hour)*60+Number(p.minute);
  const weekday=!['Sat','Sun'].includes(p.weekday);
  const marketWindowOpen=weekday&&hm>=240&&hm<=1200;
  const session=!weekday?'closed':hm<240?'closed':hm<570?'pre-market':hm<960?'regular':hm<=1200?'after-hours':'closed';
  const observed=rows.map(x=>Date.parse(x.timestampET||x.observedAt||'')).filter(Number.isFinite);
  const newestObservedAt=observed.length?new Date(Math.max(...observed)).toISOString():null;
  const marketDataAgeMin=newestObservedAt?Math.max(0,(Date.now()-Date.parse(newestObservedAt))/60000):null;
  const marketDataFresh=marketWindowOpen&&marketDataAgeMin!==null&&marketDataAgeMin<=15;
  return {marketDataLoaded:rows.length>0,marketDataFresh,marketWindowOpen,marketSession:session,newestObservedAt,marketDataAgeMin:marketDataAgeMin===null?null:Number(marketDataAgeMin.toFixed(1))};
}

function secRecent(sub,symbol,title){
  const r=sub?.filings?.recent||{}; const out=[];
  const forms=r.form||[], dates=r.filingDate||[], accepted=r.acceptanceDateTime||[], acc=r.accessionNumber||[], docs=r.primaryDocument||[];
  const wanted=/^(8-K|6-K|S-1|S-3|424B\d*|EFFECT|4|13D|13G|SC 13D|SC 13G|144)$/;
  for(let i=0;i<forms.length;i++){
    if(!wanted.test(String(forms[i]||'')))continue;
    if(!daysAgo(dates[i],21))continue;
    const accession=String(acc[i]||'').replace(/-/g,'');
    const cik=String(sub.cik||'').replace(/^0+/,'');
    const url=accession&&docs[i]?`https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${docs[i]}`:null;
    out.push({symbol,title,type:'SEC',form:forms[i],publishedAt:accepted[i]||dates[i],headline:`${forms[i]} filing — ${title}`,url,source:'SEC EDGAR',verification:'PRIMARY',discoveryScope:'SHORTLIST_ENRICHMENT'});
  }
  return out.slice(0,8);
}

async function gdeltNews(query,symbol,title=null){
  const clean=String(query||'').trim();
  if(!clean)return[];
  const q=encodeURIComponent(clean);
  const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=8&format=json&timespan=3d&sort=datedesc`;
  try{
    const j=await getJson(url,{headers:{'User-Agent':UA},timeout:8000});
    return (j.articles||[]).slice(0,8).map(a=>({symbol,title,type:'NEWS',headline:a.title||'News',publishedAt:a.seendate||null,url:a.url||null,domain:a.domain||null,source:a.domain||'GDELT source',language:a.language||null,verification:'DISCOVERY',discoveryScope:'SHORTLIST_ENRICHMENT'}));
  }catch{return[]}
}

function canonicalEventKey(e){
  const parsed=Date.parse(e?.publishedAt||'');
  const at=Number.isFinite(parsed)?new Date(parsed).toISOString():String(e?.publishedAt||'');
  const symbol=String(e?.symbol||'').toUpperCase();
  const type=String(e?.type||'').toUpperCase();
  if(type==='SEC'){
    const form=String(e?.form||'').toUpperCase().replace(/\s+/g,' ').trim();
    return `${symbol}|SEC|${form}|${at}`;
  }
  const headline=String(e?.headline||'').toLowerCase().replace(/\s+/g,' ').trim();
  return `${symbol}|${type}|${headline}|${at}`;
}

function dedupeEvents(events){
  const best=new Map();
  for(const e of events){
    const k=canonicalEventKey(e);
    const old=best.get(k);
    if(!old){best.set(k,e);continue}
    const score=x=>(x?.verification==='PRIMARY'?4:0)+(x?.url?2:0)+(x?.discoveryScope==='MARKET_WIDE'?1:0);
    if(score(e)>score(old))best.set(k,e);
  }
  return [...best.values()].sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
}

async function main(){
  const errors=[];
  let live=null, mapping=null, liveFetchedAt=null;
  try{live=await getJson('https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/live-quotes.json',{timeout:10000});liveFetchedAt=new Date().toISOString()}catch(e){errors.push(`LIVE:${e.message}`)}
  try{mapping=await getJson('https://www.sec.gov/files/company_tickers.json',{timeout:10000})}catch(e){errors.push(`SEC_MAPPING:${e.message}`)}
  const rows=liveRows(live);
  const picks=shortlist(rows,40);
  const truth=marketTruth(rows);
  const upstreamUpdatedAt=normalizedIso(live?.updatedAtUTC||live?.updatedAtET);
  const upstreamUpdateAgeAtFetchMin=ageMinBetween(liveFetchedAt,upstreamUpdatedAt);
  const upstreamObservationAgeAtFetchMin=ageMinBetween(liveFetchedAt,truth.newestObservedAt);
  const map=new Map(),tickerByCik=new Map(),companyByCik=new Map();
  if(mapping)for(const v of Object.values(mapping)){
    if(!v?.ticker)continue;
    const symbol=String(v.ticker).toUpperCase(),cik=String(Number(v.cik_str));
    map.set(symbol,v); tickerByCik.set(cik,symbol); companyByCik.set(cik,v.title||symbol);
  }
  const companies={};

  const currentForms=['8-K','6-K','S-1','S-3','424B','SC 13D','SC 13G'];
  let marketwideSecOk=!!mapping;
  const marketwideSecResults=mapping?await mapBatches(currentForms,1,async form=>{
    try{
      const xml=await getText(currentFeedUrl(form,100),{timeout:10000});
      return parseSecAtom(xml,{form,tickerByCik,companyByCik,maxEntries:100});
    }catch(e){marketwideSecOk=false;errors.push(`SEC_CURRENT_${form}:${e.message}`);return[]}
  },350):[];

  const secResults=await mapBatches(picks,4,async p=>{
    const m=map.get(p.symbol);
    if(!m)return[];
    const cik=String(m.cik_str).padStart(10,'0'); companies[p.symbol]={title:m.title,cik};
    try{
      const sub=await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`,{timeout:8000});
      return secRecent(sub,p.symbol,m.title);
    }catch(e){errors.push(`SEC_${p.symbol}:${e.message}`);return[]}
  },250);

  const newsResults=await mapBatches(picks.slice(0,30),4,async p=>{
    const c=companies[p.symbol];
    const companyQuery=c?.title?`\"${c.title.replace(/\b(Inc|Corp|Corporation|Ltd|Limited|PLC|Holdings?)\.?\b/gi,'').trim()}\"`:`\"${p.symbol}\" (stock OR shares OR company)`;
    let found=await gdeltNews(companyQuery,p.symbol,c?.title||null);
    if(!found.length&&c?.title)found=await gdeltNews(`\"${p.symbol}\" (stock OR shares OR company)`,p.symbol,c.title);
    return found;
  },200);

  const events=[...marketwideSecResults.flat(),...secResults.flat(),...newsResults.flat()];
  const dedup=dedupeEvents(events);
  const allSymbols=new Set([...picks.map(p=>p.symbol),...dedup.map(e=>e.symbol)]);
  const bySymbol={}; for(const symbol of allSymbols){const own=dedup.filter(e=>e.symbol===symbol);bySymbol[symbol]={events:own.slice(0,8),eventCount:own.length};}
  const marketwideSecCount=dedup.filter(e=>e.type==='SEC'&&e.discoveryScope==='MARKET_WIDE').length;
  const payload={schemaVersion:3,generatedAt:iso,sourceStatus:{live:truth.marketDataFresh,marketDataLoaded:truth.marketDataLoaded,marketDataFresh:truth.marketDataFresh,marketWindowOpen:truth.marketWindowOpen,marketSession:truth.marketSession,newestObservedAt:truth.newestObservedAt,marketDataAgeMin:truth.marketDataAgeMin,quoteCount:rows.length,freshnessScope:'ALL_LOADED_QUOTES',upstreamFeedFetchedAt:liveFetchedAt,upstreamUpdatedAtAtBuild:upstreamUpdatedAt,upstreamNewestObservedAtAtBuild:truth.newestObservedAt,upstreamUpdateAgeAtFetchMin,upstreamObservationAgeAtFetchMin,secMapping:!!mapping,secMarketwideDiscovery:marketwideSecOk,secMarketwideEventCount:marketwideSecCount,newsDiscovery:true},shortlist:picks,companies,eventCount:dedup.length,events:dedup,bySymbol,errors:errors.slice(0,30),policy:'Public-source intelligence. Market-wide SEC current-filing discovery is primary-source and independent of the price shortlist. `sourceStatus.live` means the loaded market universe contains fresh market data inside the active US extended-hours window; loaded-but-stale/session-final data is never labeled live. Shortlist ranking does not determine feed-level freshness. Upstream feed timestamps are retained only as operational provenance and do not override quote observation freshness or trading eligibility. SEC filings are primary-source events; GDELT is discovery-only and requires source-level verification before trade decisions.'};
  await fs.mkdir('data',{recursive:true}); await fs.writeFile(OUT,JSON.stringify(payload,null,2));
  console.log(`wrote ${OUT}: ${dedup.length} events (${marketwideSecCount} market-wide SEC) for ${allSymbols.size} symbols; quotes=${rows.length}; shortlist=${picks.length}; market=${truth.marketSession}; live=${truth.marketDataFresh}; ageMin=${truth.marketDataAgeMin}; upstreamUpdateAgeAtFetchMin=${upstreamUpdateAgeAtFetchMin}; upstreamObservationAgeAtFetchMin=${upstreamObservationAgeAtFetchMin}; errors=${errors.length}`);
}
main().catch(e=>{console.error(e);process.exit(1)});