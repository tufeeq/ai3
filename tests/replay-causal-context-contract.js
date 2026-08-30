const assert=require('node:assert/strict');
const L=require('../core/learning.js');

const observations=[
  {symbol:'TEST',observedAt:'2026-08-28T14:00:00Z',price:1},
  {symbol:'TEST',observedAt:'2026-08-28T14:30:00Z',price:2}
];
const context={
  catalystScore:90,catalystType:'8-K',catalystAt:'2026-08-28T15:00:00Z',catalystObservedAt:'2026-08-28T14:20:00Z',
  formerRunnerScore:80,memoryObservedAt:'2026-08-28T13:00:00Z',
  sectorLeadLagScore:70,sectorObservedAt:'2026-08-28T14:10:00Z'
};
const seen=[];
const replay=L.replayAt(observations,'2026-08-28T14:15:00Z',(raw,ctx)=>{seen.push({raw,ctx});return ctx},context);
assert.equal(replay.length,1,'observations after replay cutoff must remain excluded');
assert.equal(seen[0].ctx.catalystScore,undefined,'catalyst first known after historical observation must be blocked');
assert.equal(seen[0].ctx.catalystType,undefined,'future catalyst metadata must be blocked');
assert.equal(seen[0].ctx.sectorLeadLagScore,undefined,'sector evidence first observed after historical quote must be blocked');
assert.equal(seen[0].ctx.formerRunnerScore,80,'memory evidence already known at historical observation may remain');
assert.equal(seen[0].ctx.replayCausalGuard.catalyst,'BLOCKED_FUTURE_EVIDENCE');
assert.equal(seen[0].ctx.replayCausalGuard.sector,'BLOCKED_FUTURE_EVIDENCE');

const earlier=L.causalContextAt({catalystScore:55,catalystObservedAt:'2026-08-28T13:55:00Z'},'2026-08-28T14:00:00Z','2026-08-28T14:15:00Z');
assert.equal(earlier.catalystScore,55,'evidence already known at observation time must not be removed');

const invalid=L.replayAt(observations,'not-a-date',()=>({}),context);
assert.deepEqual(invalid,[],'invalid replay cutoff must fail closed');
console.log('replay causal context contract: ok');