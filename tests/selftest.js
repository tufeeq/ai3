const assert=require('node:assert/strict');
const E=require('../core/engine.js');
const S=require('../core/sharia.js');
const L=require('../core/learning.js');

function q(overrides={}){return {symbol:'TEST',price:1.1,changePct:4,volume:2000000,avgVolume:500000,floatShares:5000000,velocity5m:1.2,velocity15m:2.0,tradesPerMin:30,observedAt:new Date().toISOString(),...overrides};}

// Feature half-life should decay by half at one half-life.
assert(Math.abs(E.decay(100,60,60)-50)<1e-9);

// Persistence across session boundary: firstSeen must survive and lifecycle should not reset by date.
const old={firstSeen:'2026-08-28T18:00:00Z',lifecycle:'ACCUMULATING'};
const a=E.analyze(q(),{},old);
assert.equal(a.firstSeen,old.firstSeen);
assert.notEqual(a.lifecycle,undefined);

// Strong early signal should never be marked executable by the analysis engine itself.
assert.equal(a.executable,false);

// Late/exhausted displacement must raise distribution/risk rather than look better just because price is up.
const late=E.analyze(q({changePct:55,velocity5m:-1,velocity15m:-2}),{},{});
assert(late.distributionRisk>a.distributionRisk);
assert(['DISTRIBUTING','CLOSED'].includes(late.lifecycle));

// Missing volume/price evidence must lower data confidence.
const poor=E.analyze(q({volume:0,avgVolume:0}),{},{});
assert(poor.dataConfidence.score<a.dataConfidence.score);

// UNVERIFIED is not NON_COMPLIANT and must not block discovery.
const u=S.classify('TEST',[],{parserFailure:true});
assert.equal(u.status,S.STATUS.UNVERIFIED);
assert.equal(u.blocksDiscovery,false);
assert.equal(u.showInShariaRecommendations,true);

// Confirmed negative evidence can classify NON_COMPLIANT.
const n=S.classify('TEST',[{verdict:'FAIL'},{verdict:'FAIL'}],{});
assert.equal(n.status,S.STATUS.NON_COMPLIANT);
assert.equal(n.showInShariaRecommendations,false);

// A single positive external source is LIKELY, not VERIFIED.
const l=S.classify('TEST',[{verdict:'PASS',source:'External'}],{});
assert.equal(l.status,S.STATUS.LIKELY);

// Conflict must remain visible as conflict, not silently pass/fail.
const c=S.classify('TEST',[{verdict:'PASS'},{verdict:'FAIL'}],{});
assert.equal(c.status,S.STATUS.CONFLICT);

// No-look-ahead replay: observations after cutoff are excluded.
const obs=[q({observedAt:'2026-08-28T14:00:00Z'}),q({observedAt:'2026-08-28T14:30:00Z'})];
const replay=L.replayAt(obs,'2026-08-28T14:15:00Z',E.analyze,{});
assert.equal(replay.length,1);

// One failure is never enough to promote a challenger hypothesis.
const h1=L.hypothesisFromFailures([{missed:true,firstSignalAt:null}]);
assert.equal(h1[0].status,'OBSERVE_MORE');
const h3=L.hypothesisFromFailures([{missed:true},{missed:true},{missed:true}]);
assert.equal(h3[0].status,'CHALLENGER_CANDIDATE');

console.log('TAGX3 self-test: OK');
