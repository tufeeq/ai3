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
assert.deepEqual(normalized.quoteShapeNormalized,{key:'quotes',count:2});

const alreadyArray={quotes:[{symbol:'ABC',price:1}]};
assert.strictEqual(Q.normalizePayload(alreadyArray),alreadyArray,'array quote payload must not be rewritten');

const sharia={rows:{ABC:{status:'VERIFIED'}}};
const normalizedRows=Q.normalizePayload(sharia);
assert(Array.isArray(normalizedRows.rows),'normalizer itself supports generic map rows for explicit callers');
assert.equal(normalizedRows.rows[0].symbol,'ABC');

assert(Q.QUOTE_PATHS.has('/ai/tag/data/live-quotes.json'));
assert(Q.QUOTE_PATHS.has('/ai/tag/data/tagx2-sentinel.json'));
assert(Q.QUOTE_PATHS.has('/ai/tag/data/coverage-rescue.json'));

console.log('TAGX3 quote-shape contract: OK');
