import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const V=require('../core/validation-engine.js');

async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'))}
async function walk(dir){
  let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);if(e.isDirectory())out=out.concat(await walk(p));else if(e.isFile()&&e.name.endsWith('.json'))out.push(p)}return out;
}
const compactMetric=x=>Object.fromEntries(Object.entries(x||{}).map(([k,v])=>[k,Number.isFinite(v)&&!Number.isInteger(v)?+v.toFixed(4):v]));
function diagnostics(card,horizon){
  const h=String(horizon),ok=card.rows.filter(r=>r.outcomes?.[h]?.status==='OK');
  const movers=ok.filter(r=>(r.outcomes[h].mfePct??-Infinity)>=card.protocol.moverThresholdPct);
  const missed=movers.filter(r=>!r.detected).sort((a,b)=>(b.outcomes[h].mfePct??0)-(a.outcomes[h].mfePct??0)).slice(0,20);
  const falsePos=ok.filter(r=>r.detected&&(r.outcomes[h].mfePct??Infinity)<=card.protocol.falsePositiveMaxMfePct).sort((a,b)=>(a.outcomes[h].mfePct??0)-(b.outcomes[h].mfePct??0)).slice(0,20);
  const provenanceChanges=ok.filter(r=>r.outcomes[h]?.sourceChanged===true||r.outcomes[h]?.liveBackedChanged===true).sort((a,b)=>Math.abs(b.outcomes[h].returnPct??0)-Math.abs(a.outcomes[h].returnPct??0)).slice(0,20);
  const slim=r=>({baseAt:r.baseAt,symbol:r.symbol,lifecycle:r.lifecycle,shariaStatus:r.shariaStatus,movementIndex:r.movementIndex,ignitionIndex:r.ignitionIndex,basePrice:r.basePrice,outcome:r.outcomes[h]});
  return{missedMovers:missed.map(slim),falsePositives:falsePos.map(slim),provenanceChanges:provenanceChanges.map(slim)};
}

export function sessionCadence(snapshots,protocol={}){
  const groups=new Map();
  for(const s of snapshots||[]){
    const t=new Date(s?.capturedAt).getTime();if(!Number.isFinite(t))continue;
    const day=new Date(t).toISOString().slice(0,10);if(!groups.has(day))groups.set(day,[]);groups.get(day).push(t);
  }
  const targetMin=Math.min(...(protocol?.horizonsMin||[15]).map(Number).filter(v=>Number.isFinite(v)&&v>0),15);
  const tolerance=Math.max(Number(protocol?.horizonToleranceMin)||0,1),gapLimit=targetMin+tolerance,gaps=[];
  for(const times of groups.values()){
    times.sort((a,b)=>a-b);for(let i=1;i<times.length;i++)gaps.push((times[i]-times[i-1])/60000);
  }
  const sorted=[...gaps].sort((a,b)=>a-b),median=sorted.length?(sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2):null;
  const excessive=gaps.filter(g=>g>gapLimit);
  return{scope:'WITHIN_SESSION',sessionCount:groups.size,ignoredCrossSessionGapCount:Math.max(groups.size-1,0),targetIntervalMin:targetMin,toleranceMin:tolerance,gapLimitMin:gapLimit,intervalCount:gaps.length,medianGapMin:median,maxGapMin:gaps.length?Math.max(...gaps):null,excessiveGapCount:excessive.length,coverageHealthy:gaps.length>0&&excessive.length===0};
}

function summary(card,cadenceOverride=null){
  const horizons=Object.fromEntries(Object.entries(card.horizons||{}).map(([h,m])=>[h,compactMetric(m)]));
  const diagnosticsByHorizon={};for(const h of Object.keys(horizons))diagnosticsByHorizon[h]=diagnostics(card,h);
  return{schemaVersion:1,kind:'TAGX3_VALIDATION_SCORECARD_SUMMARY',generatedAt:card.generatedAt,status:card.status,sessions:card.sessions,snapshotCount:card.snapshotCount,cadence:compactMetric(cadenceOverride||card.cadence),protocol:card.protocol,horizons,diagnostics:diagnosticsByHorizon,guardrails:{thresholdsChanged:false,edgeClaimed:false,missingOutcomesInterpolated:false,provenanceChangesExcluded:false,singlePointPathsExcluded:false}};
}
export function markdown(s){
  const lines=['# TAGX3 Validation Scorecard','',`Generated: ${s.generatedAt}`,`Status: **${s.status}**`,`Sessions: **${s.sessions}** · Snapshots: **${s.snapshotCount}**`];
  if(s.cadence)lines.push(`Cadence: target **${s.cadence.targetIntervalMin}m** · median **${s.cadence.medianGapMin??'—'}m** · max **${s.cadence.maxGapMin??'—'}m** · excessive gaps **${s.cadence.excessiveGapCount??0}** · healthy **${s.cadence.coverageHealthy===true?'yes':'no'}**${s.cadence.scope==='WITHIN_SESSION'?` · scope **within-session** · cross-session gaps ignored **${s.cadence.ignoredCrossSessionGapCount??0}**`:''}`);
  lines.push('','> Measurement only. No production thresholds are changed and no trading edge is claimed.','', '| Horizon | Valid | Flat | 1-point path | Source shift | Live-backed shift | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |','|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const f=v=>v==null?'—':`${(v*100).toFixed(1)}%`,n=v=>v==null?'—':Number(v).toFixed(2);
  for(const [h,m] of Object.entries(s.horizons||{}))lines.push(`| ${h}m | ${m.validCount} | ${f(m.flatOutcomeRate)} | ${f(m.singlePointPathRate)} | ${f(m.sourceChangedOutcomeRate)} | ${f(m.liveBackedChangedOutcomeRate)} | ${m.moverCount} | ${m.detectedCount} | ${f(m.earlyCaptureRate)} | ${f(m.missedMoverRate)} | ${f(m.falsePositiveRate)} | ${n(m.avgDetectedMFE)}% | ${n(m.avgDetectedMAE)}% |`);
  let note='Insufficient future snapshots for the configured horizons; metrics remain intentionally unavailable.';
  if(s.cadence&&s.cadence.coverageHealthy===false)note=`Snapshot cadence is incomplete (${s.cadence.excessiveGapCount||0} within-session gap(s) above ${s.cadence.gapLimitMin} minutes). Repair measurement coverage before interpreting model performance.`;
  else if(Object.values(s.horizons||{}).some(m=>(m.singlePointPathRate??0)>=0.8))note='Most valid outcome paths contain only one fresh post-signal observation. Endpoint return is measurable, but MFE/MAE largely collapse to that single print and should not be interpreted as true intrahorizon excursion evidence.';
  else if(Object.values(s.horizons||{}).some(m=>(m.sourceChangedOutcomeCount??0)>0||(m.liveBackedChangedOutcomeCount??0)>0))note='Some valid outcome windows change quote source or live-backed provenance between capture and resolution. They remain in the denominator, but reconciliation continuity must be reviewed before attributing large moves to model performance.';
  else if(Object.values(s.horizons||{}).some(m=>(m.flatOutcomeRate??0)>=0.8))note='A very high share of valid windows are completely flat. Treat false-positive and average-return metrics as potentially session/liquidity biased until multi-session coverage confirms otherwise.';
  else if(s.status==='MEASURING')note='Metrics are accumulating. Do not interpret a single session as validated performance.';
  lines.push('','## Readiness note','',note,'');return lines.join('\n');
}

export async function build(root='validation/snapshots'){
  const protocol=await readJson('validation/protocol.json');
  const files=(await walk(root)).sort(),snapshots=[];
  for(const f of files){const s=await readJson(f);if(s?.kind==='TAGX3_VALIDATION_SNAPSHOT')snapshots.push(s)}
  const eligible=snapshots.filter(s=>Array.isArray(s.signals)&&s.signals.length>0);
  const card=V.buildScorecard(eligible,protocol),s=summary(card,sessionCadence(eligible,protocol));
  await fs.mkdir('validation/scorecards',{recursive:true});
  await fs.writeFile('validation/scorecards/latest.json',JSON.stringify(s,null,2)+'\n');
  await fs.writeFile('validation/scorecards/latest.md',markdown(s)+'\n');
  const byDay=new Map();for(const x of eligible){const d=x.capturedAt.slice(0,10);if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(x)}
  for(const [day,rows] of byDay){const ds=summary(V.buildScorecard(rows,protocol),sessionCadence(rows,protocol));await fs.writeFile(`validation/scorecards/${day}.json`,JSON.stringify(ds,null,2)+'\n')}
  console.log(JSON.stringify({snapshots:snapshots.length,eligibleSignalSnapshots:eligible.length,status:s.status,cadence:s.cadence,horizons:s.horizons},null,2));
  return s;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)build().catch(e=>{console.error(e);process.exit(1)});
