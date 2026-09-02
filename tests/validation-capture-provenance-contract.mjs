import assert from 'node:assert/strict';
import {captureProvenance,markdown} from '../scripts/build-validation-capture-provenance.mjs';

const rows=[
  {schemaVersion:2,kind:'TAGX3_VALIDATION_SNAPSHOT',capturedAt:'2026-09-01T13:00:00Z',market:{session:'premarket'},signals:[{symbol:'AAA'}]},
  {schemaVersion:3,kind:'TAGX3_VALIDATION_SNAPSHOT',capturedAt:'2026-09-01T13:10:00Z',market:{session:'premarket'},capture:{trigger:'schedule',runId:'101'},signals:[{symbol:'AAA'}]},
  {schemaVersion:3,kind:'TAGX3_VALIDATION_SNAPSHOT',capturedAt:'2026-09-01T13:20:00Z',market:{session:'premarket'},capture:{trigger:'workflow_run',runId:'102'},signals:[{symbol:'AAA'}]},
  {schemaVersion:3,kind:'TAGX3_VALIDATION_SNAPSHOT',capturedAt:'2026-09-01T02:00:00Z',market:{session:'closed'},capture:{trigger:'schedule',runId:'103'},signals:[{symbol:'AAA'}]},
  {schemaVersion:3,kind:'TAGX3_VALIDATION_SNAPSHOT',capturedAt:'2026-09-01T13:30:00Z',market:{session:'premarket'},capture:{trigger:'workflow_run'},signals:[]}
];

const report=captureProvenance(rows);
assert.equal(report.snapshotCount,5);
assert.equal(report.schemaV3Count,4);
assert.equal(report.triggerProvenanceCount,4);
assert.equal(report.triggerProvenanceCoverageRate,.8);
assert.equal(report.runIdCount,3);
assert.equal(report.runIdCoverageRate,.6);
assert.deepEqual(report.byTrigger,{MISSING:1,schedule:2,workflow_run:2});
assert.deepEqual(report.eligibleByTrigger,{MISSING:1,schedule:2,workflow_run:1});
assert.deepEqual(report.activeMarketByTrigger,{MISSING:1,schedule:1,workflow_run:1});
assert.equal(report.guardrails.tradingThresholdsChanged,false);
assert.equal(report.guardrails.shariaRulesChanged,false);
assert.equal(report.guardrails.dataQualityControlsChanged,false);
assert.equal(report.guardrails.syntheticSnapshotsAdded,false);
const md=markdown(report);
assert.match(md,/Trigger provenance: \*\*80\.0%\*\*/);
assert.match(md,/\| schedule \| 2 \| 2 \| 1 \|/);
assert.match(md,/\| workflow_run \| 2 \| 1 \| 1 \|/);
assert.match(md,/does not alter ranking, Sharia classification, freshness eligibility, lifecycle, or trading thresholds/);

console.log('validation capture provenance contract: OK');
