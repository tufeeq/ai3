'use strict';
const assert=require('assert');
const E=require('../core/engine.js');

const raw={symbol:'TEST',price:2.5,changePct:4,volume:500000,avgVolume:200000,floatShares:10000000,observedAt:'2026-08-31T06:00:00Z',velocity5m:1.2,velocity15m:2.1,tradesPerMin:25};

const undated=E.analyze(raw,{catalystScore:80,formerRunnerScore:70,sectorLeadLagScore:65});
assert.strictEqual(undated.features.catalyst.observedAt,null,'undated catalyst evidence must not inherit current time');
assert.strictEqual(undated.features.formerRunner.observedAt,null,'undated memory evidence must not inherit current time');
assert.strictEqual(undated.features.sectorLeadLag.observedAt,null,'undated sector evidence must not inherit current time');

const decayed=E.decayFeatureBook(undated.features,Date.parse('2026-08-31T06:05:00Z'));
assert.strictEqual(decayed.catalyst.currentWeight,0,'undated catalyst evidence must have zero current weight');
assert.strictEqual(decayed.formerRunner.currentWeight,0,'undated former-runner evidence must have zero current weight');
assert.strictEqual(decayed.sectorLeadLag.currentWeight,0,'undated sector evidence must have zero current weight');

const dated=E.analyze(raw,{
  catalystScore:80,catalystObservedAt:'2026-08-31T05:30:00Z',
  formerRunnerScore:70,memoryObservedAt:'2026-08-29T12:00:00Z',
  sectorLeadLagScore:65,sectorObservedAt:'2026-08-31T05:55:00Z'
});
assert.strictEqual(dated.features.catalyst.observedAt,'2026-08-31T05:30:00.000Z');
assert.strictEqual(dated.features.formerRunner.observedAt,'2026-08-29T12:00:00.000Z');
assert.strictEqual(dated.features.sectorLeadLag.observedAt,'2026-08-31T05:55:00.000Z');

const invalid=E.analyze(raw,{catalystScore:80,catalystObservedAt:'not-a-date',formerRunnerScore:70,memoryObservedAt:'bad',sectorLeadLagScore:65,sectorObservedAt:'invalid'});
assert.strictEqual(invalid.features.catalyst.observedAt,null);
assert.strictEqual(invalid.features.formerRunner.observedAt,null);
assert.strictEqual(invalid.features.sectorLeadLag.observedAt,null);
console.log('secondary evidence timestamp contract ok');
