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
  const slim=r=>({baseAt:r.baseAt,symbol:r.symbol,lifecycle:r.lifecycle,shariaStatus:r.shariaStatus,movementIndex:r.movementIndex,ignitionIndex:r.ignitionIndex,basePrice:r.basePrice,outcome:r.outcomes[h]});
  return{missedMovers:missed.map(slim),falsePositives:falsePos.map(slim)};
}
function summary(card){
  const horizons=Object.fromEntries(Object.entries(card.horizons||{}).map(([h,m])=>[h,compactMetric(m)]));
  const diagnosticsByHorizon={};for(const h of Object.keys(horizons))diagnosticsByHorizon[h]=diagnostics(card,h);
  return{schemaVersion:1,kind:'TAGX3_VALIDATION_SCORECARD_SUMMARY',generatedAt:card.generatedAt,status:card.status,sessions:card.sessions,snapshotCount:card.snapshotCount,cadence:compactMetric(card.cadence),protocol:card.protocol,horizons,diagnostics:diagnosticsByHorizon,guardrails:{thresholdsChanged:false,edgeClaimed:false,missingOutcomesInterpolated:false}};
}
function markdown(s){
  const lines=['# TAGX3 Validation Scorecard','',`Generated: ${s.generatedAt}`,`Status: **${s.status}**`,`Sessions: **${s.sessions}** · Snapshots: **${s.snapshotCount}**`];
  if(s.cadence)lines.push(`Cadence: target **${s.cadence.targetIntervalMin}m** · median **${s.cadence.medianGapMin??'—'}m** · max **${s.cadence.maxGapMin??'—'}m** · excessive gaps **${s.cadence.excessiveGapCount??0}** · healthy **${s.cadence.coverageHealthy===true?'yes':'no'}**`);
  lines.push('','> Measurement only. No production thresholds are changed and no trading edge is claimed.','', '| Horizon | Valid | Movers | Detected | Capture | Missed | False positive | Avg detected MFE | Avg detected MAE |','|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const f=v=>v==null?'—':`${(v*100).toFixed(1)}%`,n=v=>v==null?'—':Number(v).toFixed(2);
  for(const [h,m] of Object.entries(s.horizons||{}))lines.push(`| ${h}m | ${m.validCount} | ${m.moverCount} | ${m.detectedCount} | ${f(m.earlyCaptureRate)} | ${f(m.missedMoverRate)} | ${f(m.falsePositiveRate)} | ${n(m.avgDetectedMFE)}% | ${n(m.avgDetectedMAE)}% |`);
  let note='Insufficient future snapshots for the configured horizons; metrics remain intentionally unavailable.';
  if(s.status==='MEASURING')note='Metrics are accumulating. Do not interpret a single session as validated performance.';
  else if(s.cadence&&s.cadence.coverageHealthy===false)note=`Snapshot cadence is incomplete (${s.cadence.excessiveGapCount||0} gap(s) above ${s.cadence.gapLimitMin} minutes). Repair measurement coverage before interpreting model performance.`;
  lines.push('','## Readiness note','',note,'');return lines.join('\n');
}

export async function build(root='validation/snapshots'){
  const protocol=await readJson('validation/protocol.json');
  const files=(await walk(root)).sort(),snapshots=[];
  for(const f of files){const s=await readJson(f);if(s?.kind==='TAGX3_VALIDATION_SNAPSHOT')snapshots.push(s)}
  const eligible=snapshots.filter(s=>Array.isArray(s.signals)&&s.signals.length>0);
  const card=V.buildScorecard(eligible,protocol),s=summary(card);
  await fs.mkdir('validation/scorecards',{recursive:true});
  await fs.writeFile('validation/scorecards/latest.json',JSON.stringify(s,null,2)+'\n');
  await fs.writeFile('validation/scorecards/latest.md',markdown(s)+'\n');
  const byDay=new Map();for(const x of eligible){const d=x.capturedAt.slice(0,10);if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(x)}
  for(const [day,rows] of byDay){const ds=summary(V.buildScorecard(rows,protocol));await fs.writeFile(`validation/scorecards/${day}.json`,JSON.stringify(ds,null,2)+'\n')}
  console.log(JSON.stringify({snapshots:snapshots.length,eligibleSignalSnapshots:eligible.length,status:s.status,cadence:s.cadence,horizons:s.horizons},null,2));
  return s;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)build().catch(e=>{console.error(e);process.exit(1)});
