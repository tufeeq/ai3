const assert=require('node:assert/strict');
const V=require('../core/validation-engine.js');
const protocol={name:'test',frozenAt:'2026-08-30T00:00:00Z',horizonsMin:[15,30],horizonToleranceMin:2,moverThresholdPct:10,falsePositiveMaxMfePct:3,detectedLifecycles:['WATCH','ACCUMULATING','ARMED','IGNITING','EXPANDING'],actionableLifecycles:['ACCUMULATING','ARMED','IGNITING','EXPANDING'],shariaEligible:['VERIFIED','LIKELY_COMPLIANT']};
const snap=(at,a,b,obsAt=at)=>({kind:'TAGX3_VALIDATION_SNAPSHOT',capturedAt:at,observations:[{symbol:'AAA',price:a,observedAt:obsAt},{symbol:'BBB',price:b,observedAt:obsAt}],signals:[{symbol:'AAA',lifecycle:'WATCH',movementIndex:50,ignitionIndex:30,shariaStatus:'VERIFIED'},{symbol:'BBB',lifecycle:'DISCOVERED',movementIndex:20,ignitionIndex:10,shariaStatus:'UNVERIFIED'}]});
const rows=[snap('2026-08-30T14:00:00Z',10,10),snap('2026-08-30T14:15:00Z',11.5,10.1),snap('2026-08-30T14:30:00Z',12,12),snap('2026-08-30T14:45:00Z',11,12.2)];
assert.equal(V.selectHorizonSnapshot(rows,rows[0],15,2).capturedAt,'2026-08-30T14:15:00Z');
assert.equal(V.selectHorizonSnapshot(rows,rows[0],30,2).capturedAt,'2026-08-30T14:30:00Z');
assert.equal(V.selectHorizonSnapshot(rows,rows[0],60,2),null,'missing horizon must not be interpolated');
const p=V.pathStats(rows,rows[0],'AAA','2026-08-30T14:30:00Z');
assert.equal(p.count,2);assert.ok(Math.abs(p.mfePct-20)<1e-9);assert.ok(p.maePct>=14.9,'path uses only future fresh observations through horizon');
const duplicateQuoteRows=[
  snap('2026-08-30T16:00:00Z',10,10,'2026-08-30T16:00:00Z'),
  snap('2026-08-30T16:10:00Z',11,10.1,'2026-08-30T16:10:00Z'),
  snap('2026-08-30T16:20:00Z',11,10.1,'2026-08-30T16:10:00Z'),
  snap('2026-08-30T16:30:00Z',12,10.2,'2026-08-30T16:30:00Z')
];
const duplicatePath=V.pathStats(duplicateQuoteRows,duplicateQuoteRows[0],'AAA','2026-08-30T16:30:00Z');
assert.equal(duplicatePath.count,2,'repeated captures of the same observedAt must not manufacture extra path depth');
assert.ok(Math.abs(duplicatePath.mfePct-20)<1e-9,'deduplicating quote timestamps must preserve measured price excursion');
const card=V.buildScorecard(rows,protocol);
assert.equal(card.status,'MEASURING');
assert.equal(card.snapshotCount,4);
assert.ok(card.horizons[15].validCount>0);
assert.ok(card.horizons[15].moverCount>=1);
assert.equal(card.horizons[15].singlePointPathCount,6,'15-minute windows in a 15-minute cadence have one fresh path observation each');
assert.equal(card.horizons[15].singlePointPathRate,1,'path-depth diagnostic must expose when MFE/MAE collapse to the horizon print');
assert.equal(card.cadence.targetIntervalMin,15);
assert.equal(card.cadence.medianGapMin,15);
assert.equal(card.cadence.maxGapMin,15);
assert.equal(card.cadence.excessiveGapCount,0);
assert.equal(card.cadence.coverageHealthy,true,'regular 15-minute captures should be diagnosed as cadence-healthy');
const eval0=V.evaluateBase(rows[0],rows,protocol).find(x=>x.symbol==='AAA');
assert.equal(eval0.detected,true);assert.equal(eval0.shariaEligible,true);assert.equal(eval0.outcomes[15].status,'OK');
assert.equal(eval0.outcomes[15].pathObservationCount,1,'each outcome must retain the number of fresh path observations used for MFE/MAE');
assert.equal(eval0.outcomes[30].pathObservationCount,2,'longer horizons should expose deeper observed paths when cadence supports them');
const evalB=V.evaluateBase(rows[0],rows,protocol).find(x=>x.symbol==='BBB');
assert.equal(evalB.detected,false);assert.equal(evalB.shariaEligible,false);
const futureLeak=V.evaluateBase(rows[2],rows.slice(0,2),protocol).find(x=>x.symbol==='AAA');
assert.equal(futureLeak.outcomes[15].status,'MISSING','engine must never use a snapshot earlier than the base as a future outcome');

const cadenceGap=[rows[0],rows[1],snap('2026-08-30T15:05:00Z',12,10.2)];
const gapDiag=V.cadenceDiagnostics(cadenceGap,protocol);
assert.equal(gapDiag.gapLimitMin,17);
assert.equal(gapDiag.maxGapMin,50);
assert.equal(gapDiag.excessiveGapCount,1);
assert.equal(gapDiag.coverageHealthy,false,'missing scheduled captures must be exposed rather than hidden behind outcome metrics');

const staleRows=[
  snap('2026-08-30T20:00:00Z',10,10,'2026-08-30T19:59:00Z'),
  snap('2026-08-30T20:15:00Z',10,10,'2026-08-30T19:59:00Z'),
  snap('2026-08-30T20:30:00Z',10,10,'2026-08-30T19:59:00Z')
];
const staleEval=V.evaluateBase(staleRows[0],staleRows,protocol).find(x=>x.symbol==='AAA');
assert.equal(staleEval.outcomes[15].status,'STALE_OBSERVATION','repeated capture time must not manufacture a price outcome when the market observation did not advance');
const staleCard=V.buildScorecard(staleRows,protocol);
assert.equal(staleCard.status,'INSUFFICIENT_FRESH_OBSERVATIONS','future snapshots with non-advancing observations must be diagnosed as a freshness gap, not missing future snapshots');
assert.equal(staleCard.horizons[15].validCount,0,'stale observations must be excluded from performance denominators');
assert.ok(staleCard.horizons[15].excludedOutcomeCounts.STALE_OBSERVATION>0,'scorecard must expose stale exclusions for data-quality diagnosis');
assert.equal(staleCard.horizons[15].falsePositiveRate,null,'stale repeated prices must not be counted as false positives');

const flatRows=[
  snap('2026-08-30T22:00:00Z',10,10,'2026-08-30T22:00:00Z'),
  snap('2026-08-30T22:15:00Z',10,10,'2026-08-30T22:15:00Z'),
  snap('2026-08-30T22:30:00Z',10,10,'2026-08-30T22:30:00Z')
];
const flatCard=V.buildScorecard(flatRows,protocol);
assert.equal(flatCard.horizons[15].validCount,4,'advanced observations with unchanged prices remain valid measurements');
assert.equal(flatCard.horizons[15].flatOutcomeCount,4,'scorecard must quantify flat outcomes rather than silently folding them into false positives');
assert.equal(flatCard.horizons[15].flatOutcomeRate,1,'all-flat outcome windows must be surfaced as a measurement-bias diagnostic');

const provenanceRows=[
  snap('2026-08-30T23:00:00Z',10,10,'2026-08-30T23:00:00Z'),
  snap('2026-08-30T23:15:00Z',10.2,10.1,'2026-08-30T23:15:00Z'),
  snap('2026-08-30T23:30:00Z',10.3,10.2,'2026-08-30T23:30:00Z')
];
for(const o of provenanceRows[0].observations){o.source='feed-A';o.liveBacked=true}
for(const o of provenanceRows[1].observations){o.source='feed-B';o.liveBacked=false}
for(const o of provenanceRows[2].observations){o.source='feed-B';o.liveBacked=false}
const provenanceEval=V.evaluateBase(provenanceRows[0],provenanceRows,protocol).find(x=>x.symbol==='AAA');
assert.equal(provenanceEval.outcomes[15].status,'OK','provenance transitions are diagnostics, not automatic outcome exclusions');
assert.equal(provenanceEval.outcomes[15].sourceChanged,true);
assert.equal(provenanceEval.outcomes[15].baseSource,'feed-A');
assert.equal(provenanceEval.outcomes[15].targetSource,'feed-B');
assert.equal(provenanceEval.outcomes[15].liveBackedChanged,true);
const provenanceCard=V.buildScorecard(provenanceRows,protocol);
assert.equal(provenanceCard.horizons[15].validCount,4,'source diagnostics must not alter the performance denominator');
assert.equal(provenanceCard.horizons[15].sourceChangedOutcomeCount,2,'source transitions must be quantified across valid outcomes');
assert.equal(provenanceCard.horizons[15].sourceChangedOutcomeRate,0.5);
assert.equal(provenanceCard.horizons[15].liveBackedChangedOutcomeCount,2);
assert.equal(provenanceCard.horizons[15].liveBackedChangedOutcomeRate,0.5);

const missingOnly=[snap('2026-08-30T21:00:00Z',10,10)];
assert.equal(V.buildScorecard(missingOnly,protocol).status,'INSUFFICIENT_FUTURE_SNAPSHOTS','absence of horizon snapshots must remain a distinct diagnosis');

const missingTime=structuredClone(rows);
delete missingTime[1].observations[0].observedAt;
const missingEval=V.evaluateBase(missingTime[0],missingTime,protocol).find(x=>x.symbol==='AAA');
assert.equal(missingEval.outcomes[15].status,'STALE_OBSERVATION','unknown target observation time must fail closed');

const missingCaptured=structuredClone(rows);
delete missingCaptured[0].capturedAt;
const missingCapturedCard=V.buildScorecard(missingCaptured,protocol);
assert.equal(missingCapturedCard.snapshotCount,3,'snapshot without capturedAt must be excluded rather than treated as epoch');
assert.equal(V.selectHorizonSnapshot(rows,{...rows[0],capturedAt:null},15,2),null,'missing base capturedAt must fail closed');

const invalidCaptured=structuredClone(rows);
invalidCaptured[0].capturedAt='not-a-date';
const invalidCapturedCard=V.buildScorecard(invalidCaptured,protocol);
assert.equal(invalidCapturedCard.snapshotCount,3,'snapshot with invalid capturedAt must be excluded');
console.log('validation engine contract: ok');