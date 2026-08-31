const assert=require('assert');
const fs=require('fs');
const path=require('path');
const P=require('../predictive-radar.js');

const source=fs.readFileSync(path.join(__dirname,'..','predictive-radar.js'),'utf8');
assert.ok(!source.includes('fetch('),'predictive radar must not independently fetch market feeds');
assert.ok(!source.includes('/ai/tag/data/'),'predictive radar must not own production feed URLs');

const events=[];
class FakeEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const engine={rank:rows=>[...rows].sort((a,b)=>String(a.symbol).localeCompare(String(b.symbol)))};
const win={TAGX3Engine:engine,CustomEvent:FakeEvent,dispatchEvent:event=>events.push(event)};
assert.equal(P.installSharedCaseBridge(win),true,'bridge must install once');
assert.equal(P.installSharedCaseBridge(win),false,'bridge must not double-wrap engine rank');
const input=[{symbol:'ZZZ'},{symbol:'AAA'}];
const ranked=engine.rank(input);
assert.deepEqual(ranked.map(x=>x.symbol),['AAA','ZZZ']);
assert.ok(win.TAGX3LatestCases,'shared snapshot must be published');
assert.strictEqual(win.TAGX3LatestCases.cases,ranked,'predictor must receive the exact ranked analyzed-case array');
assert.equal(events.length,1,'one engine ranking must publish one case event');
assert.equal(events[0].type,P.CASE_EVENT);
assert.strictEqual(events[0].detail.cases,ranked);
assert.ok(Number.isFinite(Date.parse(events[0].detail.generatedAt)),'shared snapshot must have a valid publication timestamp');

console.log('shared-analyzed-state-contract: ok');
