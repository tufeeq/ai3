import assert from 'node:assert/strict';
import {buildSnapshot,validateSnapshot,SOURCES} from '../scripts/capture-validation-snapshot.mjs';

const wrap=(name,data)=>({name,url:SOURCES[name],data,bytes:123,sha256:'a'.repeat(64),fetchedAt:'2026-08-31T00:00:00Z',latencyMs:10});
const downloads=[
  wrap('live',{marketClockSession:'closed',freshCount:0,requested:2,count:2,quotes:[{symbol:'AAA',price:10,volume:1000,observedAt:'2026-08-28T20:00:00Z',source:'Live Quotes',liveBacked:true},{symbol:'BBB',price:5,volume:500,observedAt:'2026-08-28T20:00:00Z',source:'Live Quotes',liveBacked:true}]}),
  wrap('broad',{rows:[{Ticker:'AAA',Company:'Alpha',Price:'10',Volume:'1000'},{Ticker:'CCC',Company:'Gamma',Price:'3',Volume:'200'}]}),
  wrap('fast',{rows:[{Ticker:'CCC',Price:'3',Volume:'200'}]}),
  wrap('rich',{rows:[{Ticker:'AAA',Company:'Alpha',Price:'10',Float:'8.2'}]}),
  wrap('extended',{rows:[]}),wrap('hot',{rows:[]}),
  wrap('sharia',{rows:{AAA:{status:'VERIFIED'},BBB:{status:'UNVERIFIED'},CCC:{status:'NON_COMPLIANT'}}}),
  wrap('intelligence',{generatedAt:'2026-08-31T00:00:00Z',events:[{symbol:'AAA'}],bySymbol:{AAA:{}}}),
  wrap('marketNews',{generatedAt:'2026-08-31T00:00:00Z',items:[{scope:'MARKET'}]})
];
const s=buildSnapshot(downloads,'2026-08-31T00:01:00Z');
assert.equal(s.kind,'TAGX3_VALIDATION_SNAPSHOT');
assert.equal(s.immutable,true);
assert.equal(s.coverage.mergedSymbols,3,'snapshot must preserve full de-duplicated observable universe rather than rendered opportunity count');
assert.equal(s.market.freshCount,0,'closed-session freshness must remain source truth');
assert.equal(s.sharia.VERIFIED,1);assert.equal(s.sharia.UNVERIFIED,1);assert.equal(s.sharia.NON_COMPLIANT,1);
assert.equal(s.intelligence.eventCount,1);assert.equal(s.intelligence.marketNewsCount,1);
assert.equal(new Set(s.observations.map(x=>x.symbol)).size,s.observations.length,'observations must be symbol-unique');
assert.deepEqual(validateSnapshot(s),[]);
const broken=structuredClone(s);broken.sources.live.sha256='bad';broken.observations.push({...broken.observations[0]});
assert(validateSnapshot(broken).some(x=>x.includes('source hash')));
assert(validateSnapshot(broken).some(x=>x.includes('duplicate')));
console.log('validation snapshot contract: OK');
