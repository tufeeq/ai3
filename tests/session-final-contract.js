const assert=require('node:assert/strict');
const E=require('../core/engine.js');
global.window={TAGX3Engine:E};
require('../session-final-policy.js');

const old=new Date(Date.now()-24*3600000).toISOString();
const base={symbol:'LAST',price:2.5,changePct:6,volume:2500000,avgVolume:500000,floatShares:8000000,velocity5m:0.7,velocity15m:1.4,tradesPerMin:25,observedAt:old};
const closed=E.analyze({...base,marketClockSession:'closed',sessionFinal:true,liveBacked:true,marketObservation:true},{},{});
assert.equal(closed.dataConfidence.label,'SESSION FINAL');
assert.equal(closed.dataConfidence.fresh,false,'last-session data must never be called live/fresh');
assert.equal(closed.dataConfidence.sessionFinal,true);
assert.equal(closed.dataConfidence.usable,true,'complete last-session data should remain usable for analysis');
assert(closed.dataConfidence.score>=80,'age alone must not destroy completeness confidence for a valid closed session');
assert.equal(closed.executable,false);

const discovery=E.analyze({...base,observedAt:new Date().toISOString(),marketClockSession:'closed',sessionFinal:false,liveBacked:false,discoveryOnly:true,marketObservation:false},{},{});
assert.equal(discovery.dataConfidence.label,'LOW','closed Finviz-only snapshot must not inherit fresh quote confidence');
assert.equal(discovery.dataConfidence.fresh,false);
assert.equal(discovery.dataConfidence.sessionFinal,false,'discovery snapshot is not a verified session-final quote');
assert.equal(discovery.dataConfidence.usable,false);
assert.equal(discovery.dataConfidence.freshnessClass,'CLOSED_DISCOVERY_SNAPSHOT');
assert(discovery.dataConfidence.score<=40);
assert.equal(discovery.executable,false);

const staleLive=E.analyze({...base,marketClockSession:'regular',sessionFinal:false},{},{});
assert.equal(staleLive.dataConfidence.fresh,false);
assert.notEqual(staleLive.dataConfidence.label,'SESSION FINAL','stale intraday data must not be promoted to session final');

const fs=require('node:fs');
const bridge=fs.readFileSync('finviz-bridge.js','utf8');
const evidence=fs.readFileSync('evidence-intelligence.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert(bridge.includes('sessionFinal=live?.marketClockSession===\'closed\''));
assert(bridge.includes('liveBacked:false')&&bridge.includes('discoveryOnly:true'),'Finviz-only rows must retain discovery provenance');
assert(bridge.includes('liveBacked:true')&&bridge.includes('discoveryOnly:false'),'live-backed rows must be explicitly distinguished');
assert(evidence.includes('if(Array.isArray(q))return Object.fromEntries'), 'evidence layer must accept merged quote arrays');
assert(html.indexOf('session-final-policy.js')>html.indexOf('core/engine.js')&&html.indexOf('session-final-policy.js')<html.indexOf('app.js'),'session-final policy must load after engine and before app');
console.log('TAGX3 session-final contract: OK');
