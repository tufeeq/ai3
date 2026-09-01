import assert from 'node:assert/strict';
import {markdown,sessionCadence} from '../scripts/build-validation-scorecard.mjs';

const base={generatedAt:'2026-09-01T00:00:00Z',status:'MEASURING',sessions:2,snapshotCount:20,cadence:{targetIntervalMin:15,medianGapMin:31.3,maxGapMin:275.1,excessiveGapCount:10,gapLimitMin:24,coverageHealthy:false},horizons:{30:{validCount:445,moverCount:15,detectedCount:57,flatOutcomeRate:0,singlePointPathCount:400,singlePointPathRate:.8989,sourceChangedOutcomeCount:0,sourceChangedOutcomeRate:0,liveBackedChangedOutcomeCount:0,liveBackedChangedOutcomeRate:0,earlyCaptureRate:.2667,missedMoverRate:.7333,falsePositiveRate:.8421,avgDetectedMFE:.9386,avgDetectedMAE:.9386}}};
const degraded=markdown(base);
assert.match(degraded,/Snapshot cadence is incomplete/,'broken cadence must override generic MEASURING readiness text');
assert.doesNotMatch(degraded,/Metrics are accumulating/,'unhealthy cadence must not be presented as merely accumulating evidence');
assert.match(degraded,/1-point path/,'scorecard table must expose shallow path rate');
const healthyBase={...base,cadence:{...base.cadence,coverageHealthy:true,excessiveGapCount:0,medianGapMin:15,maxGapMin:15}};
const shallow=markdown(healthyBase);
assert.match(shallow,/only one fresh post-signal observation/,'shallow paths must outrank generic MEASURING readiness text when cadence is otherwise healthy');
assert.doesNotMatch(shallow,/Metrics are accumulating/,'single-print MFE\/MAE must not be presented as mature measurement');
const deepBase={...healthyBase,horizons:{30:{...healthyBase.horizons[30],singlePointPathCount:20,singlePointPathRate:.0449}}};
const healthy=markdown(deepBase);
assert.match(healthy,/Metrics are accumulating/,'healthy cadence with sufficiently deep paths may use the normal MEASURING readiness note');
const provenance=markdown({...deepBase,horizons:{30:{...deepBase.horizons[30],sourceChangedOutcomeCount:12,sourceChangedOutcomeRate:.027,liveBackedChangedOutcomeCount:3,liveBackedChangedOutcomeRate:.0067}}});
assert.match(provenance,/change quote source or live-backed provenance/,'provenance transitions must be visible before interpreting performance');
assert.doesNotMatch(provenance,/Metrics are accumulating/,'known provenance shifts must outrank generic readiness text');
assert.match(provenance,/Source shift/,'scorecard table must expose source-shift rate');

const protocol={horizonsMin:[15,30],horizonToleranceMin:9};
const captures=[
  {capturedAt:'2026-08-31T20:00:00Z',market:{session:'regular'}},
  {capturedAt:'2026-08-31T20:15:00Z',market:{session:'afterhours'}},
  {capturedAt:'2026-08-31T20:30:00Z',market:{session:'afterhours'}},
  {capturedAt:'2026-09-01T01:00:00Z',market:{session:'closed'}},
  {capturedAt:'2026-09-01T06:00:00Z',market:{session:'closed'}},
  {capturedAt:'2026-09-01T12:00:00Z',market:{session:'premarket'}},
  {capturedAt:'2026-09-01T12:15:00Z',market:{session:'premarket'}},
  {capturedAt:'2026-09-01T12:30:00Z',market:{session:'regular'}}
];
const sessionAware=sessionCadence(captures,protocol);
assert.equal(sessionAware.scope,'ACTIVE_MARKET_WITHIN_SESSION');
assert.equal(sessionAware.sessionCount,2);
assert.equal(sessionAware.ignoredClosedSnapshotCount,2,'closed-market captures must be disclosed but excluded from cadence health');
assert.equal(sessionAware.ignoredCrossSessionGapCount,1,'overnight boundary must be explicitly counted but excluded from cadence health');
assert.equal(sessionAware.intervalCount,4,'only active-market within-session intervals belong in cadence diagnostics');
assert.equal(sessionAware.medianGapMin,15);
assert.equal(sessionAware.maxGapMin,15);
assert.equal(sessionAware.excessiveGapCount,0);
assert.equal(sessionAware.coverageHealthy,true,'healthy active-market cadence must not be marked unhealthy by closed-market captures or an overnight gap');
const sessionAwareMd=markdown({...deepBase,cadence:sessionAware});
assert.match(sessionAwareMd,/scope \*\*active-market within-session\*\*/,'aggregate scorecard must disclose active-market cadence scope');
assert.match(sessionAwareMd,/closed snapshots ignored \*\*2\*\*/,'aggregate scorecard must disclose excluded closed-market captures');
assert.match(sessionAwareMd,/cross-session gaps ignored \*\*1\*\*/,'aggregate scorecard must disclose ignored cross-session boundaries');

const realGap=sessionCadence([
  {capturedAt:'2026-09-01T12:00:00Z',market:{session:'premarket'}},
  {capturedAt:'2026-09-01T12:15:00Z',market:{session:'premarket'}},
  {capturedAt:'2026-09-01T12:45:00Z',market:{session:'regular'}}
],protocol);
assert.equal(realGap.excessiveGapCount,1,'a genuine active-market gap must remain visible');
assert.equal(realGap.coverageHealthy,false,'closed-market filtering must not hide real intraday coverage failures');

console.log('validation scorecard report contract: OK');
