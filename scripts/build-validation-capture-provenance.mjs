import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'))}
async function walk(dir){
  let out=[];
  for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){
    const p=path.join(dir,e.name);
    if(e.isDirectory())out=out.concat(await walk(p));
    else if(e.isFile()&&e.name.endsWith('.json'))out.push(p);
  }
  return out;
}

const nyClockFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function inActiveMarketWindow(value){
  try{
    const parts=nyClockFormatter.formatToParts(new Date(value)),get=type=>parts.find(p=>p.type===type)?.value;
    if(['Sat','Sun'].includes(get('weekday')))return false;
    const mins=Number(get('hour'))*60+Number(get('minute'));
    return mins>=240&&mins<=1200;
  }catch{return false}
}
const triggerOf=s=>String(s?.capture?.trigger||'').trim()||'MISSING';
const countBy=rows=>{
  const out={};
  for(const row of rows){const key=triggerOf(row);out[key]=(out[key]||0)+1}
  return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
};
const ratio=(n,d)=>d?+(n/d).toFixed(4):null;

export function captureProvenance(snapshots=[]){
  const rows=(snapshots||[]).filter(s=>s?.kind==='TAGX3_VALIDATION_SNAPSHOT');
  const withTrigger=rows.filter(s=>triggerOf(s)!=='MISSING');
  const withRunId=rows.filter(s=>String(s?.capture?.runId||'').trim());
  const schemaV3=rows.filter(s=>Number(s?.schemaVersion)>=3);
  const eligible=rows.filter(s=>Array.isArray(s?.signals)&&s.signals.length>0);
  const active=eligible.filter(s=>String(s?.market?.session||'').toLowerCase()!=='closed'&&inActiveMarketWindow(s?.capturedAt));
  return {
    schemaVersion:1,
    kind:'TAGX3_VALIDATION_CAPTURE_PROVENANCE',
    snapshotCount:rows.length,
    eligibleSignalSnapshotCount:eligible.length,
    activeMarketEligibleSnapshotCount:active.length,
    schemaV3Count:schemaV3.length,
    triggerProvenanceCount:withTrigger.length,
    triggerProvenanceCoverageRate:ratio(withTrigger.length,rows.length),
    runIdCount:withRunId.length,
    runIdCoverageRate:ratio(withRunId.length,rows.length),
    byTrigger:countBy(rows),
    eligibleByTrigger:countBy(eligible),
    activeMarketByTrigger:countBy(active),
    guardrails:{tradingThresholdsChanged:false,shariaRulesChanged:false,dataQualityControlsChanged:false,syntheticSnapshotsAdded:false}
  };
}

export function markdown(r){
  const pct=v=>v==null?'—':`${(v*100).toFixed(1)}%`;
  const lines=['# TAGX3 Validation Capture Provenance','',`Snapshots: **${r.snapshotCount}** · eligible: **${r.eligibleSignalSnapshotCount}** · active-market eligible: **${r.activeMarketEligibleSnapshotCount}**`,`Trigger provenance: **${pct(r.triggerProvenanceCoverageRate)}** · run-id provenance: **${pct(r.runIdCoverageRate)}**`,'','| Trigger | All | Eligible | Active market |','|---|---:|---:|---:|'];
  const keys=new Set([...Object.keys(r.byTrigger||{}),...Object.keys(r.eligibleByTrigger||{}),...Object.keys(r.activeMarketByTrigger||{})]);
  for(const key of [...keys].sort())lines.push(`| ${key} | ${r.byTrigger?.[key]||0} | ${r.eligibleByTrigger?.[key]||0} | ${r.activeMarketByTrigger?.[key]||0} |`);
  lines.push('','> Diagnostic only. Capture provenance does not alter ranking, Sharia classification, freshness eligibility, lifecycle, or trading thresholds.','');
  return lines.join('\n');
}

export async function build(root='validation/snapshots'){
  const files=(await walk(root)).sort(),snapshots=[];
  for(const f of files){const s=await readJson(f);if(s?.kind==='TAGX3_VALIDATION_SNAPSHOT')snapshots.push(s)}
  const report={generatedAt:new Date().toISOString(),...captureProvenance(snapshots)};
  await fs.mkdir('validation/scorecards',{recursive:true});
  await fs.writeFile('validation/scorecards/capture-provenance.json',JSON.stringify(report,null,2)+'\n');
  await fs.writeFile('validation/scorecards/capture-provenance.md',markdown(report)+'\n');
  console.log(JSON.stringify(report,null,2));
  return report;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)build().catch(e=>{console.error(e);process.exit(1)});
