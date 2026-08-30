const assert=require('node:assert/strict');
const C=require('../catalyst-shape-adapter.js');

const payload={status:'OK',count:2,events:[
  {symbol:'AAA',type:'8-K',acceptedAt:'2026-08-28T15:00:00Z'},
  {ticker:'BBB',form:'6-K',filedAt:'2026-08-28T16:00:00Z'}
]};
const normalized=C.normalizePayload(payload);
assert.notEqual(normalized,payload);
assert.equal(Array.isArray(normalized.data),true);
assert.equal(normalized.data.length,2);
assert.equal(normalized.data[0].symbol,'AAA');
assert.equal(normalized.data[1].ticker,'BBB');
assert.deepEqual(normalized.events,payload.events);
assert.deepEqual(normalized.catalystShapeNormalized,{from:'events',count:2});

// Existing app-compatible payloads are left unchanged.
const existing={data:[{symbol:'CCC'}],events:[{symbol:'DDD'}]};
assert.equal(C.normalizePayload(existing),existing);

// Missing/unavailable feeds do not gain synthetic events.
const unavailable={status:'DATA_UNAVAILABLE',events:[]};
const empty=C.normalizePayload(unavailable);
assert.equal(empty.data.length,0);
assert.equal(empty.status,'DATA_UNAVAILABLE');

for(const forbidden of ['rank','analyze','execute','setThreshold']) assert.equal(typeof C[forbidden],'undefined');
console.log('TAGX3 catalyst-shape contract: OK');
