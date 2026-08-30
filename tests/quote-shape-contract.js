const assert=require('node:assert/strict');
const Q=require('../quote-shape-adapter.js');

const payload={
  marketClockSession:'closed',
  quotes:{
    ABC:{price:1.25,volume:1000,observedAt:'2026-08-28T19:59:00-04:00'},
    xyz:{ticker:'XYZ',price:2.5,volume:2000,observedAt:'2026-08-28T19:58:00-04:00'}
  }
};
const normalized=Q.normalizePayload(payload);
assert(Array.isArray(normalized.quotes),'object-map quotes must normalize to an array');
assert.equal(normalized.quotes.length,2);
assert.equal(normalized.quotes[0].symbol,'ABC','map key must become symbol when row has no symbol');
assert.equal(normalized.quotes[1].ticker,'XYZ','existing ticker identity must be preserved');
assert.equal(normalized.marketClockSession,'closed','feed-level session provenance must survive normalization');
assert.deepEqual(normalized.quoteShapeNormalized,{key:'quotes',count:2,canonicalized:true});

// Production Sentinel uses priceVelocity*Pct and timestampET. These fields are causal
// evidence and must not be silently zeroed or replaced with Date.now() by app ingestion.
const sentinel={
  updatedAtUTC:'2026-08-28T22:05:11.663447+00:00',
  candidates:[{
    ticker:'GCL',price:0.7261,changePct:7.554,
    priceVelocity5mPct:9.998,priceVelocity15mPct:10.015,
    timestampET:'2026-08-28T18:02:33-04:00'
  }]
};
const ns=Q.normalizePayload(sentinel);
assert.equal(ns.candidates[0].velocity5m,9.998,'Sentinel 5m velocity must reach the engine');
assert.equal(ns.candidates[0].velocity15m,10.015,'Sentinel 15m velocity must reach the engine');
assert.equal(ns.candidates[0].observedAt,'2026-08-28T18:02:33-04:00','Sentinel timestampET must remain the causal observation time');
assert.notEqual(ns.candidates[0].observedAt,new Date().toISOString(),'normalization must never synthesize current time for historical Sentinel rows');

const arrayPayload={updatedAtUTC:'2026-08-28T22:00:00Z',quotes:[{symbol:'ABC',price:1}]};
const na=Q.normalizePayload(arrayPayload);
assert(Array.isArray(na.quotes));
assert.equal(na.quotes[0].observedAt,'2026-08-28T22:00:00Z','array feeds should inherit a real feed timestamp when row timestamp is absent');

const sharia={rows:{ABC:{status:'VERIFIED'}}};
const normalizedRows=Q.normalizePayload(sharia);
assert(Array.isArray(normalizedRows.rows),'normalizer itself supports generic map rows for explicit callers');
assert.equal(normalizedRows.rows[0].symbol,'ABC');

assert(Q.QUOTE_PATHS.has('/ai/tag/data/live-quotes.json'));
assert(Q.QUOTE_PATHS.has('/ai/tag/data/tagx2-sentinel.json'));
assert(Q.QUOTE_PATHS.has('/ai/tag/data/coverage-rescue.json'));

console.log('TAGX3 quote-shape contract: OK');
