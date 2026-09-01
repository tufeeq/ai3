import assert from 'node:assert/strict';
import {markdown} from '../scripts/build-validation-scorecard.mjs';

const base={generatedAt:'2026-09-01T00:00:00Z',status:'MEASURING',sessions:2,snapshotCount:20,cadence:{targetIntervalMin:15,medianGapMin:31.3,maxGapMin:275.1,excessiveGapCount:10,gapLimitMin:24,coverageHealthy:false},horizons:{30:{validCount:445,moverCount:15,detectedCount:57,earlyCaptureRate:.2667,missedMoverRate:.7333,falsePositiveRate:.8421,avgDetectedMFE:.9386,avgDetectedMAE:.9386}}};
const degraded=markdown(base);
assert.match(degraded,/Snapshot cadence is incomplete/,'broken cadence must override generic MEASURING readiness text');
assert.doesNotMatch(degraded,/Metrics are accumulating/,'unhealthy cadence must not be presented as merely accumulating evidence');
const healthy=markdown({...base,cadence:{...base.cadence,coverageHealthy:true,excessiveGapCount:0,medianGapMin:15,maxGapMin:15}});
assert.match(healthy,/Metrics are accumulating/,'healthy cadence may use the normal MEASURING readiness note');
console.log('validation scorecard report contract: OK');
