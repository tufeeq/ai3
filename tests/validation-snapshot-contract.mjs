import assert from 'node:assert/strict';
import {buildSnapshot,validateSnapshot,sameEvidenceWithin,SOURCES,captureContext} from '../scripts/capture-validation-snapshot.mjs';

const wrap=(name,data)=>({name,url:SOURCES[name],data,bytes:123,sha256:'a'.repeat(64),fetchedAt:'2026-08-31T00:00:00Z',latencyMs:10});
const downloads=[
  wrap('live',{marketClockSession:'closed',freshCount:0,requested:2,count:2,quotes:[{symbol:'AAA',price:10,volume:1000,observedAt:'2026-08-28T20:00:00Z',source:'Live Quotes',liveBacked:true},{symbol:'BBB',price:5,volume:500,observedAt:'2026-08-28T20:00:00Z',source:'Live Quotes',liveBacked:true}]}),
  wrap('broad',{rows:[{Ticker:'AAA',Company:'Alpha',Price:'10',Volume:'1000'},{Ticker:'CCC',Company:'Gamma',Price:'3',Volume:'200',observedAt:'2026-08-28T20:00:00Z'}]}),
  wrap('fast',{rows:[{Ticker:'CCC',Price:'3',Volume:'200',observedAt:'2026-08-28T20:00:00Z'}]}),
  wrap('rich',{rows:[{Ticker:'AAA',Company:'Alpha',Price:'10',Float:'8.2'}]}),
  wrap('extended',{rows:[]}),wrap('hot',{rows:[]}),
  wrap('sharia',{rows:{AAA:{status:'VERIFIED'},BBB:{status:'UNVERIFIED'},CCC:{status:'NON_COMPLIANT'}}}),
  wrap('intelligence',{generatedAt:'2026-08-31T00:00:00Z',events:[{symbol:'AAA',type:'SEC',form:'8-K',publishedAt:'2026-08-30T23:50:00Z',verification:'PRIMARY'},{symbol:'BBB',type:'SEC',form:'8-K',publishedAt:'2026-08-31T00:05:00Z',verification:'PRIMARY'}],bySymbol:{AAA:{},BBB:{}}}),
  wrap('marketNews',{generatedAt:'2026-08-31T00:00:00Z',items:[{scope:'MARKET'}]})
];
const capture=captureContext({GITHUB_EVENT_NAME:'schedule',GITHUB_WORKFLOW:'TAGX3 Validation Snapshots',GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'2',GITHUB_SHA:'abc123',GITHUB_REF_NAME:'main'});
const s=buildSnapshot(downloads,'2026-08-31T00:01:00Z',capture);
assert.equal(s.schemaVersion,3);
assert.equal(s.kind,'TAGX3_VALIDATION_SNAPSHOT');
assert.equal(s.immutable,true);
assert.deepEqual(s.capture,{trigger:'schedule',workflow:'TAGX3 Validation Snapshots',runId:'12345',runAttempt:2,headSha:'abc123',refName:'main'},'immutable snapshots must preserve workflow trigger/run provenance so sampling gaps can be attributed');
assert.equal(s.coverage.mergedSymbols,3,'snapshot must preserve full de-duplicated observable universe rather than rendered opportunity count');
assert.equal(s.coverage.signalSymbols,3,'every observable symbol must freeze the model output available at capture time');
assert.equal(s.market.freshCount,0,'closed-session freshness must remain source truth');
assert.equal(s.sharia.VERIFIED,1);assert.equal(s.sharia.UNVERIFIED,1);assert.equal(s.sharia.NON_COMPLIANT,1);
assert.equal(s.intelligence.eventCount,2);assert.equal(s.intelligence.marketNewsCount,1);
assert.equal(new Set(s.observations.map(x=>x.symbol)).size,s.observations.length,'observations must be symbol-unique');
assert.equal(new Set(s.signals.map(x=>x.symbol)).size,s.signals.length,'frozen model signals must be symbol-unique');
assert.equal(s.signals.find(x=>x.symbol==='AAA').catalystType,'8-K','evidence known before capture may enter the frozen signal');
assert.equal(s.signals.find(x=>x.symbol==='BBB').catalystAt,null,'future catalyst evidence must not leak into the frozen historical signal');
assert.equal(s.signals.find(x=>x.symbol==='AAA').shariaStatus,'VERIFIED');
assert.equal(s.signals.find(x=>x.symbol==='CCC').shariaStatus,'NON_COMPLIANT');
assert.deepEqual(validateSnapshot(s),[]);
const broken=structuredClone(s);broken.sources.live.sha256='bad';broken.observations.push({...broken.observations[0]});broken.signals.push({...broken.signals[0]});broken.capture.trigger='';
assert(validateSnapshot(broken).some(x=>x.includes('source hash')));
assert(validateSnapshot(broken).some(x=>x.includes('duplicate')));
assert(validateSnapshot(broken).some(x=>x.includes('capture trigger provenance')),'schema v3 snapshots must fail closed when trigger provenance is absent');

const localCapture=captureContext({});
assert.equal(localCapture.trigger,'local');
assert.equal(localCapture.runId,null);
assert.equal(localCapture.runAttempt,null);

const nearDuplicate=structuredClone(s);nearDuplicate.capturedAt='2026-08-31T00:02:00Z';nearDuplicate.capture.trigger='workflow_run';
assert.equal(sameEvidenceWithin(s,nearDuplicate),true,'identical evidence inside two minutes should be suppressed when event and fallback triggers collide');
const scheduledSample=structuredClone(s);scheduledSample.capturedAt='2026-08-31T00:11:00Z';
assert.equal(sameEvidenceWithin(s,scheduledSample),false,'normal ten-minute sampling must remain intact even when upstream evidence is unchanged');
const changedEvidence=structuredClone(nearDuplicate);changedEvidence.sources.live.sha256='b'.repeat(64);
assert.equal(sameEvidenceWithin(s,changedEvidence),false,'any changed source payload must be captured immediately');

const missingTimestampDownloads=structuredClone(downloads);
missingTimestampDownloads.find(x=>x.name==='live').data.quotes.push({symbol:'ZZZ',price:7,volume:700,source:'Live Quotes',liveBacked:true});
const missingTimestampSnapshot=buildSnapshot(missingTimestampDownloads,'2026-08-31T00:01:00Z',capture);
const zzz=missingTimestampSnapshot.observations.find(x=>x.symbol==='ZZZ');
assert.equal(zzz?.observedAt,null,'missing observation time must remain null, never epoch/current time');
assert(validateSnapshot(missingTimestampSnapshot).some(x=>x.includes('missing observation timestamp ZZZ')),'snapshot validation must reject untimestamped observations');

const invalidTimestampDownloads=structuredClone(downloads);
invalidTimestampDownloads.find(x=>x.name==='live').data.quotes.push({symbol:'YYY',price:8,volume:800,observedAt:'not-a-date',source:'Live Quotes',liveBacked:true});
const invalidTimestampSnapshot=buildSnapshot(invalidTimestampDownloads,'2026-08-31T00:01:00Z',capture);
assert.equal(invalidTimestampSnapshot.observations.find(x=>x.symbol==='YYY')?.observedAt,null,'invalid observation time must fail closed');
assert(validateSnapshot(invalidTimestampSnapshot).some(x=>x.includes('missing observation timestamp YYY')),'invalid timestamps must block snapshot publication');
console.log('validation snapshot contract: OK');
