const assert=require('node:assert/strict');
const F=require('../ingestion-funnel.js');

const records=[
  {path:'/ai/tag/data/live-quotes.json',payload:{marketClockSession:'closed',quotes:[{symbol:'AAA'},{symbol:'BBB'}]}},
  {path:'/ai/tag/data/tagx2-sentinel.json',payload:{session:'after-hours',data:[{ticker:'BBB'},{ticker:'CCC'}]}},
  {path:'/ai/tag/data/coverage-rescue.json',payload:{rows:[{code:'DDD'},{foo:'missing-symbol'}]}}
];
const s=F.summarizeFeeds(records);
assert.equal(s.feedRows,6);
assert.equal(s.uniqueSymbols,4);
assert.equal(s.feeds[0].session,'closed');
assert.equal(s.feeds[1].session,'after-hours');

const c=F.summarizeCases([
  {symbol:'AAA',sharia:'VERIFIED'},
  {symbol:'BBB',sharia:'LIKELY_COMPLIANT'},
  {symbol:'CCC',sharia:'UNVERIFIED'},
  {symbol:'DDD',sharia:'NON_COMPLIANT'}
]);
assert.equal(c.analyzed,4);
assert.equal(c.sharia.VERIFIED,1);
assert.equal(c.sharia.LIKELY_COMPLIANT,1);
assert.equal(c.sharia.UNVERIFIED,1);
assert.equal(c.sharia.NON_COMPLIANT,1);

// Diagnostics are observational only: module exports no ranking/threshold/execution mutation API.
for(const forbidden of ['rank','analyze','execute','setThreshold']) assert.equal(typeof F[forbidden],'undefined');
console.log('TAGX3 ingestion-funnel contract: OK');
