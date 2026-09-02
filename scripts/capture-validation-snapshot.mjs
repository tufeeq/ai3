import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const U=require('../market-universe-bridge.js');
const E=require('../core/engine.js');

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
const iso=v=>{if(v==null||v==='')return null;const t=new Date(v);return Number.isFinite(t.getTime())?t.toISOString():null};
const symbolOf=r=>String(r?.symbol||r?.ticker||r?.Ticker||'').toUpperCase().trim();
const str=v=>{const x=String(v??'').trim();return x||null};

export function captureContext(env=process.env){
  return {
    trigger:str(env.GITHUB_EVENT_NAME)||'local',
    workflow:str(env.GITHUB_WORKFLOW),
    runId:str(env.GITHUB_RUN_ID),
    runAttempt:n(env.GITHUB_RUN_ATTEMPT),
    headSha:str(env.GITHUB_SHA),
    refName:str(env.GITHUB_REF_NAME)
  };
}

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

export function shariaIndex(payload){
  const m=new Map();
  for(const r of rowsOf(payload)){const s=symbolOf(r);if(!s)continue;m.set(s,String(r?.status||r?.classification||r?.result||'UNVERIFIED').toUpperCase())}
  return m;
}

export function catalystIndex(intel,capturedAt){
  const cutoff=new Date(capturedAt).getTime(),m=new Map();
  for(const e of Array.isArray(intel?.events)?intel.events:[]){
    const symbol=symbolOf(e);if(!symbol)continue;
    const at=iso(e.publishedAt||e.acceptedAt||e.filedAt||e.eventAt);if(!at||new Date(at).getTime()>cutoff)continue;
    const score=n(e.score??e.materialityScore??e.catalystScore)??45;
    const old=m.get(symbol);if(!old||new Date(at)>new Date(old.catalystObservedAt))m.set(symbol,{catalystScore:E.clamp(score),catalystType:e.form||e.type||e.eventType||'EVENT',catalystAt:at,catalystObservedAt:at,daysToCatalyst:0});
  }
  return m;
}

export function minimalObservation(r){
  const symbol=symbolOf(r);if(!symbol)return null;
  const price=n(r.price??r.Price??r.last);if(!(price>0))return null;
  return {symbol,price,changePct:n(r.changePct??r.Change??r.changePercent),volume:n(r.volume??r.Volume),avgVolume:n(r.avgVolume??r['Avg Volume']??r['Average Volume']),floatShares:n(r.floatShares??r.Float??r['Shares Float']),sharesOutstanding:n(r.sharesOutstanding??r.Outstanding??r['Shares Outstanding']),shortFloat:n(r.shortFloat??r['Short Float']??r['Short Float %']),observedAt:iso(r.observedAt||r._snapshotTimestampUTC||r.timestampUTC||r.timestampET||r.updatedAt),source:String(r.source||r._source||'unknown'),discoveryOnly:r.discoveryOnly===true||r._discoveryOnly===true,liveBacked:r.liveBacked===true};
}

export function signalRows(mergedRows,intel,shariaPayload,capturedAt){
  const cats=catalystIndex(intel,capturedAt),sh=shariaIndex(shariaPayload),out=[];
  for(const raw of mergedRows||[]){
    const symbol=symbolOf(raw);if(!symbol||!(n(raw.price??raw.Price??raw.last)>0))continue;
    const cat=cats.get(symbol)||{};
    const c=E.analyze(raw,{...cat,source:raw.source||'validation-snapshot',sourceMeta:{discoveryOnly:raw.discoveryOnly===true||raw.liveBacked===false}},{});
    out.push({symbol,lifecycle:c.lifecycle,stage:c.stage,movementIndex:c.movementIndex,ignitionIndex:c.ignitionIndex,continuationIndex:c.continuationIndex,distributionRisk:c.distributionRisk,riskScore:c.riskScore,dataConfidence:c.dataConfidence?.label||'LOW',dataFresh:c.dataConfidence?.fresh===true,catalystType:c.catalystType||null,catalystAt:c.catalystAt||null,shariaStatus:sh.get(symbol)||'UNVERIFIED'});
  }
  return out.sort((a,b)=>a.symbol.localeCompare(b.symbol));
}

async function fetchJson(name,url){
  const started=Date.now();
  const res=await fetch(`${url}?validation=${Date.now()}`,{headers:{'user-agent':'TAGX3-validation-capture/1.0'},cache:'no-store'});
  if(!res.ok)throw new Error(`${name}: HTTP ${res.status}`);
  const text=await res.text();
  const data=JSON.parse(text);
  return {name,url,data,bytes:Buffer.byteLength(text),sha256:sha256(text),fetchedAt:new Date().toISOString(),latencyMs:Date.now()-started};
}

export function buildSnapshot(downloads,capturedAt=new Date().toISOString(),capture=captureContext({})){
  const by=Object.fromEntries(downloads.map(x=>[x.name,x]));
  const merged=U.merge(by.live.data,by.broad.data,by.fast.data,by.rich.data,by.extended.data,by.hot.data);
  const observations=merged.quotes.map(minimalObservation).filter(Boolean).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const symbols=observations.map(x=>x.symbol);
  const intel=by.intelligence.data||{},news=by.marketNews.data||{};
  const signals=signalRows(merged.quotes,intel,by.sharia.data,capturedAt);
  return {
    schemaVersion:3,
    kind:'TAGX3_VALIDATION_SNAPSHOT',
    capturedAt,
    immutable:true,
    capture,
    methodology:{purpose:'out-of-sample measurement; no threshold tuning from isolated cases',executable:false,signalCapture:'production engine outputs frozen at capture time'},
    market:{session:by.live.data?.marketClockSession||by.live.data?.session||null,freshCount:n(by.live.data?.freshCount),liveRequested:n(by.live.data?.requested),liveCount:n(by.live.data?.count)},
    coverage:{mergedSymbols:observations.length,signalSymbols:signals.length,broadRows:rowsOf(by.broad.data).length,fastRows:rowsOf(by.fast.data).length,richRows:rowsOf(by.rich.data).length,extendedRows:rowsOf(by.extended.data).length,hotRows:rowsOf(by.hot.data).length,symbolsSha256:sha256(symbols.join('\n'))},
    intelligence:{generatedAt:intel.generatedAt||intel.updatedAt||null,eventCount:Array.isArray(intel.events)?intel.events.length:0,bySymbolCount:intel.bySymbol&&typeof intel.bySymbol==='object'?Object.keys(intel.bySymbol).length:0,marketNewsGeneratedAt:news.generatedAt||null,marketNewsCount:Array.isArray(news.items)?news.items.length:0},
    sharia:shariaSummary(by.sharia.data),
    sources:Object.fromEntries(downloads.map(x=>[x.name,{url:x.url,sha256:x.sha256,bytes:x.bytes,fetchedAt:x.fetchedAt,latencyMs:x.latencyMs,sourceUpdatedAt:x.data?.updatedAt||x.data?.updatedAtUTC||x.data?.generatedAt||x.data?.snapshotTimestampUTC||null,count:n(x.data?.count)??rowsOf(x.data).length}])),
    observations,
    signals
  };
}

export function sameEvidenceWithin(previous,current,maxGapMs=120000){
  const a=Date.parse(previous?.capturedAt),b=Date.parse(current?.capturedAt);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||b-a>maxGapMs)return false;
  const prevNames=Object.keys(previous?.sources||{}).sort();
  const currNames=Object.keys(current?.sources||{}).sort();
  if(prevNames.length!==currNames.length||prevNames.some((name,i)=>name!==currNames[i]))return false;
  return currNames.length>0&&currNames.every(name=>{
    const x=previous.sources?.[name]?.sha256,y=current.sources?.[name]?.sha256;
    return /^[a-f0-9]{64}$/.test(x||'')&&x===y;
  });
}

async function latestSnapshotFile(root=path.join('validation','snapshots')){
  let days;
  try{days=await fs.readdir(root,{withFileTypes:true})}catch(e){if(e?.code==='ENOENT')return null;throw e}
  for(const day of days.filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse()){
    const dir=path.join(root,day);
    const files=(await fs.readdir(dir,{withFileTypes:true})).filter(x=>x.isFile()&&x.name.endsWith('.json')).map(x=>x.name).sort().reverse();
    if(files.length)return path.join(dir,files[0]);
  }
  return null;
}

export function validateSnapshot(s){
  const errors=[];
  if(s?.kind!=='TAGX3_VALIDATION_SNAPSHOT')errors.push('wrong kind');
  if(s?.immutable!==true)errors.push('snapshot must be immutable');
  if(s?.schemaVersion>=3&&!str(s?.capture?.trigger))errors.push('missing capture trigger provenance');
  if(!Number.isInteger(s?.coverage?.mergedSymbols)||s.coverage.mergedSymbols<1)errors.push('no merged symbols');
  if(!Array.isArray(s?.observations)||s.observations.length!==s?.coverage?.mergedSymbols)errors.push('observation count mismatch');
  if(s.schemaVersion>=2&&(!Array.isArray(s.signals)||s.signals.length!==s.coverage.signalSymbols))errors.push('signal count mismatch');
  const seen=new Set();
  for(const o of s?.observations||[]){if(!o.symbol||!(o.price>0))errors.push('invalid observation');if(!o.observedAt)errors.push(`missing observation timestamp ${o.symbol||'UNKNOWN'}`);if(seen.has(o.symbol))errors.push(`duplicate ${o.symbol}`);seen.add(o.symbol)}
  const sigSeen=new Set();for(const x of s?.signals||[]){if(!x.symbol||sigSeen.has(x.symbol))errors.push(`invalid/duplicate signal ${x.symbol}`);sigSeen.add(x.symbol)}
  for(const [name,meta] of Object.entries(s?.sources||{})){if(!/^[a-f0-9]{64}$/.test(meta.sha256||''))errors.push(`missing source hash ${name}`)}
  return errors;
}

async function main(){
  const downloads=await Promise.all(Object.entries(SOURCES).map(([name,url])=>fetchJson(name,url)));
  const capturedAt=new Date().toISOString();
  const snapshot=buildSnapshot(downloads,capturedAt,captureContext());
  const errors=validateSnapshot(snapshot);if(errors.length)throw new Error(errors.join('; '));
  const previousFile=await latestSnapshotFile();
  if(previousFile){
    const previous=JSON.parse(await fs.readFile(previousFile,'utf8'));
    if(sameEvidenceWithin(previous,snapshot)){
      console.log(JSON.stringify({skipped:'NEAR_DUPLICATE_EVIDENCE',previousFile,gapSeconds:(Date.parse(capturedAt)-Date.parse(previous.capturedAt))/1000},null,2));
      return;
    }
  }
  const stamp=capturedAt.replace(/:/g,'-').replace(/\.\d{3}Z$/,'Z');
  const day=capturedAt.slice(0,10);
  const dir=path.join('validation','snapshots',day);await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,`${stamp}.json`);
  try{await fs.access(file);throw new Error(`immutable snapshot already exists: ${file}`)}catch(e){if(e?.code!=='ENOENT')throw e}
  await fs.writeFile(file,JSON.stringify(snapshot)+'\n','utf8');
  console.log(JSON.stringify({file,mergedSymbols:snapshot.coverage.mergedSymbols,signals:snapshot.coverage.signalSymbols,session:snapshot.market.session,trigger:snapshot.capture.trigger,runId:snapshot.capture.runId,events:snapshot.intelligence.eventCount,marketNews:snapshot.intelligence.marketNewsCount,sharia:snapshot.sharia},null,2));
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)main().catch(e=>{console.error(e);process.exit(1)});
