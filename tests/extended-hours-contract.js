const assert=require('node:assert/strict');
const U=require('../market-universe-bridge.js');

const live={marketClockSession:'closed',quotes:[{symbol:'AAA',price:10,changePct:1,observedAt:'2026-08-28T20:00:00Z',source:'Live Quotes',liveBacked:true}]};
const pre={session:'pre-market',updatedAtUTC:'2026-08-31T12:15:00Z',rows:{AAA:{ticker:'AAA',session:'pre-market',last:11,rthClose:10,previousClose:9.9,sessionChangePct:10,timestampUTC:'2026-08-31T12:15:00Z',priceVelocity5mPct:2.5}}};
let merged=U.merge(live,{}, {}, {},pre,{});
let a=merged.quotes.find(x=>x.symbol==='AAA');
assert.equal(a.price,11,'newer pre-market market observation must override prior regular-session price');
assert.equal(a.preMarketPrice,11);
assert.equal(a.preMarketChangePct,10);
assert.equal(a.afterHoursChangePct,null);
assert.equal(a.extendedSession,'pre-market');
assert.equal(a.marketObservation,true);
assert.equal(a.discoveryOnly,false);
assert.equal(a.velocity5m,2.5);

const after={session:'after-hours',updatedAtUTC:'2026-08-31T21:10:00Z',rows:{AAA:{ticker:'AAA',session:'after-hours',last:12.25,rthClose:11.5,previousClose:10,sessionChangePct:6.5217,timestampUTC:'2026-08-31T21:10:00Z',extendedVolume:250000,priceVelocity15mPct:3.1}}};
merged=U.merge({quotes:[{symbol:'AAA',price:11.5,changePct:15,observedAt:'2026-08-31T20:00:00Z',source:'Live Quotes',liveBacked:true}]},{},{},{},after,{});
a=merged.quotes.find(x=>x.symbol==='AAA');
assert.equal(a.price,12.25,'newer after-hours observation must override RTH close');
assert.equal(a.afterHoursPrice,12.25);
assert(Math.abs(a.afterHoursChangePct-6.5217)<1e-8);
assert.equal(a.preMarketChangePct,null);
assert.equal(a.regularClose,11.5);
assert.equal(a.extendedVolume,250000);
assert.equal(a.velocity15m,3.1);
assert.equal(merged.universeCoverage.extendedSession,'after-hours');

const oldAfter={session:'after-hours',rows:{AAA:{ticker:'AAA',last:8,sessionChangePct:-20,timestampUTC:'2026-08-30T21:00:00Z'}}};
merged=U.merge({quotes:[{symbol:'AAA',price:11.5,observedAt:'2026-08-31T20:00:00Z',source:'Live Quotes',liveBacked:true}]},{},{},{},oldAfter,{});
a=merged.quotes.find(x=>x.symbol==='AAA');
assert.equal(a.price,11.5,'stale extended-hours observation must never overwrite a newer regular quote');

console.log('extended-hours contract: OK');