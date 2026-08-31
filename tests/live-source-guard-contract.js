const assert=require('assert');
const Guard=require('../live-source-guard.js');

const oldPage={updatedAtUTC:'2026-08-31T10:00:00Z',marketClockSession:'closed',freshCount:0};
const newerRaw={updatedAtUTC:'2026-08-31T15:00:00Z',marketClockSession:'regular',freshCount:437};
let picked=Guard.chooseNewest(oldPage,newerRaw);
assert.strictEqual(picked.source,'raw-github','newer raw source must beat stale Pages snapshot');
assert.strictEqual(picked.payload,newerRaw,'newer raw payload must be returned unchanged');
assert.strictEqual(picked.payload.marketClockSession,'regular');
assert.strictEqual(picked.payload.freshCount,437);

const newerPage={updatedAtUTC:'2026-08-31T16:00:00Z',marketClockSession:'regular',freshCount:400};
picked=Guard.chooseNewest(newerPage,newerRaw);
assert.strictEqual(picked.source,'pages','newer Pages source must win when it is actually fresher');
assert.strictEqual(picked.payload,newerPage);

picked=Guard.chooseNewest(null,newerRaw);
assert.strictEqual(picked.source,'raw-github','raw source must remain usable when Pages is unavailable');
assert.strictEqual(picked.payload,newerRaw);

assert.strictEqual(Guard.PAGE_LIVE,'/ai/tag/data/live-quotes.json');
assert(Guard.RAW_LIVE.includes('raw.githubusercontent.com/tufeeq/ai/main/tag/data/live-quotes.json'));
console.log('live source guard contract: OK');