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

const store=new Map();
const root={localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
const snapshot={...s,...c,evidence:{ready:2,pending:2},at:'2026-08-30T10:00:00Z'};
let history=F.persistSnapshot(root,snapshot);
assert.equal(history.length,1);
assert.equal(history[0].uniqueSymbols,4);
assert.equal(history[0].verified,2);
assert.equal(history[0].evidenceReady,2);
// Identical refreshes are deduplicated instead of creating cosmetic history churn.
history=F.persistSnapshot(root,{...snapshot,at:'2026-08-30T10:05:00Z'});
assert.equal(history.length,1);
// A measurable funnel change creates a new retained observation.
history=F.persistSnapshot(root,{...snapshot,uniqueSymbols:5,at:'2026-08-30T10:10:00Z'});
assert.equal(history.length,2);
assert.equal(history.at(-1).uniqueSymbols,5);
assert(history.length<=F.HISTORY_LIMIT);

// Diagnostics are observational only: module exports no ranking/threshold/execution mutation API.
for(const forbidden of ['rank','analyze','execute','setThreshold']) assert.equal(typeof F[forbidden],'undefined');
console.log('TAGX3 ingestion-funnel contract: OK');
