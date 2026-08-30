const assert=require('node:assert/strict');
const E=require('../core/engine.js');
global.window={TAGX3Engine:E};
require('../session-final-policy.js');

const old=new Date(Date.now()-24*3600000).toISOString();
const base={symbol:'LAST',price:2.5,changePct:6,volume:2500000,avgVolume:500000,floatShares:8000000,velocity5m:0.7,velocity15m:1.4,tradesPerMin:25,observedAt:old};
const closed=E.analyze({...base,marketClockSession:'closed',sessionFinal:true},{},{});
assert.equal(closed.dataConfidence.label,'SESSION FINAL');
assert.equal(closed.dataConfidence.fresh,false,'last-session data must never be called live/fresh');
assert.equal(closed.dataConfidence.sessionFinal,true);
assert.equal(closed.dataConfidence.usable,true,'complete last-session data should remain usable for analysis');
assert(closed.dataConfidence.score>=80,'age alone must not destroy completeness confidence for a valid closed session');
assert.equal(closed.executable,false);

const staleLive=E.analyze({...base,marketClockSession:'regular',sessionFinal:false},{},{});
assert.equal(staleLive.dataConfidence.fresh,false);
assert.notEqual(staleLive.dataConfidence.label,'SESSION FINAL','stale intraday data must not be promoted to session final');

const fs=require('node:fs');
const bridge=fs.readFileSync('finviz-bridge.js','utf8');
const evidence=fs.readFileSync('evidence-intelligence.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert(bridge.includes('sessionFinal=live?.marketClockSession===\'closed\''));
assert(evidence.includes('if(Array.isArray(q))return Object.fromEntries'), 'evidence layer must accept merged quote arrays');
assert(html.indexOf('session-final-policy.js')>html.indexOf('core/engine.js')&&html.indexOf('session-final-policy.js')<html.indexOf('app.js'),'session-final policy must load after engine and before app');
console.log('TAGX3 session-final contract: OK');
