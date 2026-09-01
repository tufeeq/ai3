import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const UPSTREAM='https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/live-quotes.json';
const LOCAL='data/intelligence.json';
const minute=60_000;

function ts(value){
  const n=Date.parse(value||'');
  return Number.isFinite(n)?n:null;
}
function roundMin(ms){return Number((ms/minute).toFixed(1));}
function upstreamRows(payload){
  if(Array.isArray(payload?.quotes))return payload.quotes;
  if(payload?.quotes&&typeof payload.quotes==='object')return Object.values(payload.quotes);
  return [];
}
function newestObservation(rows){
  const times=rows.map(x=>ts(x?.timestampET||x?.observedAt)).filter(Number.isFinite);
  return times.length?new Date(Math.max(...times)).toISOString():null;
}

export function classifyFeedProvenance({consumerGeneratedAt,consumerNewestObservedAt,upstreamUpdatedAt,upstreamNewestObservedAt}){
  const consumer=ts(consumerGeneratedAt), consumerQuote=ts(consumerNewestObservedAt), producer=ts(upstreamUpdatedAt), producerQuote=ts(upstreamNewestObservedAt);
  const valid={consumerGeneratedAt:consumer!==null,consumerNewestObservedAt:consumerQuote!==null,upstreamUpdatedAt:producer!==null,upstreamNewestObservedAt:producerQuote!==null};
  if(!Object.values(valid).every(Boolean))return {status:'INSUFFICIENT_PROVENANCE',valid};
  const upstreamAdvanceAfterConsumerMin=roundMin(producer-consumer);
  const upstreamQuoteAdvanceMin=roundMin(producerQuote-consumerQuote);
  const consumerQuoteAgeAtBuildMin=roundMin(consumer-consumerQuote);
  const upstreamQuoteAgeAtPayloadMin=roundMin(producer-producerQuote);
  let status='ALIGNED_OR_NO_NEWER_UPSTREAM_EVIDENCE';
  if(producer>consumer+minute)status='UPSTREAM_HAS_ADVANCED_SINCE_CONSUMER';
  return {status,valid,upstreamAdvanceAfterConsumerMin,upstreamQuoteAdvanceMin,consumerQuoteAgeAtBuildMin,upstreamQuoteAgeAtPayloadMin};
}

async function fetchJson(url,timeout=10_000){
  const ac=new AbortController(); const timer=setTimeout(()=>ac.abort(),timeout);
  try{const r=await fetch(url,{headers:{'User-Agent':'TAGX3 feed provenance diagnostic'},signal:ac.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}
  finally{clearTimeout(timer)}
}

async function main(){
  const consumer=JSON.parse(await fs.readFile(LOCAL,'utf8'));
  const upstream=await fetchJson(UPSTREAM);
  const rows=upstreamRows(upstream);
  const upstreamNewestObservedAt=newestObservation(rows);
  const result=classifyFeedProvenance({
    consumerGeneratedAt:consumer?.generatedAt,
    consumerNewestObservedAt:consumer?.sourceStatus?.newestObservedAt,
    upstreamUpdatedAt:upstream?.updatedAtUTC||upstream?.updatedAt,
    upstreamNewestObservedAt
  });
  console.log(JSON.stringify({
    checkedAt:new Date().toISOString(),
    consumer:{generatedAt:consumer?.generatedAt||null,newestObservedAt:consumer?.sourceStatus?.newestObservedAt||null,marketDataFresh:consumer?.sourceStatus?.marketDataFresh??null,live:consumer?.sourceStatus?.live??null},
    upstream:{updatedAt:upstream?.updatedAtUTC||upstream?.updatedAt||null,newestObservedAt:upstreamNewestObservedAt,quoteCount:rows.length,freshCount:Number.isInteger(upstream?.freshCount)?upstream.freshCount:null,scanDurationSec:Number.isFinite(upstream?.scanDurationSec)?upstream.scanDurationSec:null,dataConfidence:upstream?.dataConfidence||null},
    diagnosis:result,
    policy:'Diagnostic only. Never changes freshness thresholds, Sharia controls, rankings, or trading decisions.'
  },null,2));
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(e=>{console.error(e);process.exit(1)});
