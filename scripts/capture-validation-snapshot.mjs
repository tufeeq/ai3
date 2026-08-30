import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const U=require('../market-universe-bridge.js');

export const SOURCES={
  live:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/live-quotes.json',
  broad:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/universe-broad.json',
  fast:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/discovery-fast.json',
  rich:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/discovery.json',
  extended:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/extended-hours.json',
  hot:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/extended-hot.json',
  sharia:'https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/sharia.json',
  intelligence:'https://raw.githubusercontent.com/tufeeq/ai3/main/data/intelligence.json',
  marketNews:'https://raw.githubusercontent.com/tufeeq/ai3/main/data/market-news.json'
};

const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const n=v=>{if(v==null||v==='')return null;const x=Number(String(v).replace(/[%,$,]/g,''));return Number.isFinite(x)?x:null};
const iso=v=>{const t=new Date(v||0);return Number.isFinite(t.getTime())?t.toISOString():null};
const symbolOf=r=>String(r?.symbol||r?.ticker||r?.Ticker||'').toUpperCase().trim();

export function rowsOf(payload){
  if(Array.isArray(payload))return payload;
  for(const k of ['quotes','rows','data','results','stocks','items','candidates','opportunities']){
    const v=payload?.[k];
    if(Array.isArray(v))return v;
    if(v&&typeof v==='object')return Object.entries(v).map(([symbol,row])=>row&&typeof row==='object'?{symbol,...row}:{symbol});
  }
  return [];
}

export function shariaSummary(payload){
  const out={total:0,VERIFIED:0,LIKELY_COMPLIANT:0,UNVERIFIED:0,CONFLICT_REVIEW:0,NON_COMPLIANT:0,EXCLUDED:0,other:0};
  for(const r of rowsOf(payload)){
    out.total++;
    const s=String(r?.status||r?.classification||r?.result||'UNVERIFIED').toUpperCase();
    if(Object.prototype.hasOwnProperty.call(out,s))out[s]++;else out.other++;
  }
  return out;
}

export function minimalObservation(r){
  const symbol=symbolOf(r);if(!symbol)return null;
  const price=n(r.price??r.Price??r.last);if(!(price>0))return null;
  return {
    symbol,
    price,
    changePct:n(r.changePct??r.Change??r.changePercent),
    volume:n(r.volume??r.Volume),
    avgVolume:n(r.avgVolume??r['Avg Volume']??r['Average Volume']),
    floatShares:n(r.floatShares??r.Float??r['Shares Float']),
    sharesOutstanding:n(r.sharesOutstanding??r.Outstanding??r['Shares Outstanding']),
    shortFloat:n(r.shortFloat??r['Short Float']??r['Short Float %']),
    observedAt:iso(r.observedAt||r._snapshotTimestampUTC||r.timestampUTC||r.timestampET||r.updatedAt),
    source:String(r.source||r._source||'unknown'),
    discoveryOnly:r.discoveryOnly===true||r._discoveryOnly===true,
    liveBacked:r.liveBacked===true
  };
}

async function fetchJson(name,url){
  const started=Date.now();
  const res=await fetch(`${url}?validation=${Date.now()}`,{headers:{'user-agent':'TAGX3-validation-capture/1.0'},cache:'no-store'});
  if(!res.ok)throw new Error(`${name}: HTTP ${res.status}`);
  const text=await res.text();
  const data=JSON.parse(text);
  return {name,url,data,bytes:Buffer.byteLength(text),sha256:sha256(text),fetchedAt:new Date().toISOString(),latencyMs:Date.now()-started};
}

export function buildSnapshot(downloads,capturedAt=new Date().toISOString()){
  const by=Object.fromEntries(downloads.map(x=>[x.name,x]));
  const merged=U.merge(by.live.data,by.broad.data,by.fast.data,by.rich.data,by.extended.data,by.hot.data);
  const observations=merged.quotes.map(minimalObservation).filter(Boolean).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const symbols=observations.map(x=>x.symbol);
  const intel=by.intelligence.data||{},news=by.marketNews.data||{};
  return {
    schemaVersion:1,
    kind:'TAGX3_VALIDATION_SNAPSHOT',
    capturedAt,
    immutable:true,
    methodology:{purpose:'out-of-sample measurement; no threshold tuning from isolated cases',executable:false},
    market:{session:by.live.data?.marketClockSession||by.live.data?.session||null,freshCount:n(by.live.data?.freshCount),liveRequested:n(by.live.data?.requested),liveCount:n(by.live.data?.count)},
    coverage:{mergedSymbols:observations.length,broadRows:rowsOf(by.broad.data).length,fastRows:rowsOf(by.fast.data).length,richRows:rowsOf(by.rich.data).length,extendedRows:rowsOf(by.extended.data).length,hotRows:rowsOf(by.hot.data).length,symbolsSha256:sha256(symbols.join('\n'))},
    intelligence:{generatedAt:intel.generatedAt||intel.updatedAt||null,eventCount:Array.isArray(intel.events)?intel.events.length:0,bySymbolCount:intel.bySymbol&&typeof intel.bySymbol==='object'?Object.keys(intel.bySymbol).length:0,marketNewsGeneratedAt:news.generatedAt||null,marketNewsCount:Array.isArray(news.items)?news.items.length:0},
    sharia:shariaSummary(by.sharia.data),
    sources:Object.fromEntries(downloads.map(x=>[x.name,{url:x.url,sha256:x.sha256,bytes:x.bytes,fetchedAt:x.fetchedAt,latencyMs:x.latencyMs,sourceUpdatedAt:x.data?.updatedAt||x.data?.updatedAtUTC||x.data?.generatedAt||x.data?.snapshotTimestampUTC||null,count:n(x.data?.count)??rowsOf(x.data).length}])),
    observations
  };
}

export function validateSnapshot(s){
  const errors=[];
  if(s?.kind!=='TAGX3_VALIDATION_SNAPSHOT')errors.push('wrong kind');
  if(s?.immutable!==true)errors.push('snapshot must be immutable');
  if(!Number.isInteger(s?.coverage?.mergedSymbols)||s.coverage.mergedSymbols<1)errors.push('no merged symbols');
  if(!Array.isArray(s?.observations)||s.observations.length!==s?.coverage?.mergedSymbols)errors.push('observation count mismatch');
  const seen=new Set();
  for(const o of s?.observations||[]){if(!o.symbol||!(o.price>0))errors.push('invalid observation');if(seen.has(o.symbol))errors.push(`duplicate ${o.symbol}`);seen.add(o.symbol)}
  for(const [name,meta] of Object.entries(s?.sources||{})){if(!/^[a-f0-9]{64}$/.test(meta.sha256||''))errors.push(`missing source hash ${name}`)}
  return errors;
}

async function main(){
  const downloads=await Promise.all(Object.entries(SOURCES).map(([name,url])=>fetchJson(name,url)));
  const capturedAt=new Date().toISOString();
  const snapshot=buildSnapshot(downloads,capturedAt);
  const errors=validateSnapshot(snapshot);if(errors.length)throw new Error(errors.join('; '));
  const stamp=capturedAt.replace(/:/g,'-').replace(/\.\d{3}Z$/,'Z');
  const day=capturedAt.slice(0,10);
  const dir=path.join('validation','snapshots',day);await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,`${stamp}.json`);
  try{await fs.access(file);throw new Error(`immutable snapshot already exists: ${file}`)}catch(e){if(e?.code!=='ENOENT')throw e}
  await fs.writeFile(file,JSON.stringify(snapshot,null,2)+'\n','utf8');
  console.log(JSON.stringify({file,mergedSymbols:snapshot.coverage.mergedSymbols,session:snapshot.market.session,events:snapshot.intelligence.eventCount,marketNews:snapshot.intelligence.marketNewsCount,sharia:snapshot.sharia},null,2));
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)main().catch(e=>{console.error(e);process.exit(1)});
