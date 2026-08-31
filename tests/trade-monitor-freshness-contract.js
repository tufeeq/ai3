const assert=require('node:assert/strict');
const T=require('../core/trade-monitor.js');

function baseTrade(){return {
  id:'ABC-1',symbol:'ABC',entryPrice:10,status:'OPEN',personalStop:9.5,mfePct:4,maePct:-2,alerts:[],
  entrySnapshot:{lifecycle:'WATCH',distributionRisk:20,continuationIndex:70,sharia:'UNVERIFIED',dataConfidence:'HIGH',dataFresh:true},
  lastSnapshot:{lifecycle:'WATCH',distributionRisk:20,continuationIndex:70,sharia:'UNVERIFIED',dataConfidence:'HIGH',dataFresh:true}
};}

const stale=T.evaluate(baseTrade(),{
  symbol:'ABC',price:9,lifecycle:'DISTRIBUTING',movementIndex:20,ignitionIndex:10,continuationIndex:20,
  distributionRisk:90,riskScore:90,sharia:{status:'UNVERIFIED'},dataConfidence:{label:'LOW',fresh:false},
  observedAt:'2026-08-28T20:00:00Z',whyNow:[]
});
assert(stale.alerts.some(a=>a.type==='DATA_STALE'),'stale market data must be surfaced');
for(const forbidden of ['PERSONAL_STOP','DISTRIBUTION','TRIM_WATCH','THESIS_WEAKENING'])
  assert(!stale.alerts.some(a=>a.type===forbidden),`stale quote must not emit ${forbidden}`);
assert.equal(stale.trade.mfePct,4,'stale quote must not alter MFE');
assert.equal(stale.trade.maePct,-2,'stale quote must not alter MAE');
assert.equal(stale.trade.pnlPct,undefined,'stale quote must not create current P&L');
assert.equal(stale.trade.lastPrice,undefined,'stale quote must not become last actionable price');

const unknown=T.evaluate(baseTrade(),{
  symbol:'ABC',price:9,lifecycle:'DISTRIBUTING',movementIndex:20,ignitionIndex:10,continuationIndex:20,
  distributionRisk:90,riskScore:90,sharia:{status:'UNVERIFIED'},dataConfidence:{label:'HIGH'},
  observedAt:'2026-08-28T20:00:00Z',whyNow:[]
});
assert(unknown.alerts.some(a=>a.type==='DATA_FRESHNESS_UNVERIFIED'),'missing freshness proof must be surfaced');
for(const forbidden of ['PERSONAL_STOP','DISTRIBUTION','TRIM_WATCH','THESIS_WEAKENING'])
  assert(!unknown.alerts.some(a=>a.type===forbidden),`unknown freshness must not emit ${forbidden}`);
assert.equal(unknown.trade.mfePct,4,'unknown freshness must not alter MFE');
assert.equal(unknown.trade.maePct,-2,'unknown freshness must not alter MAE');
assert.equal(unknown.trade.pnlPct,undefined,'unknown freshness must not create current P&L');
assert.equal(unknown.trade.lastPrice,undefined,'unknown freshness must not become last actionable price');
assert.equal(T.compactSnapshot({price:10,dataConfidence:{label:'HIGH'}}).dataFresh,false,'snapshot freshness must fail closed unless positively verified');

const sharia=T.evaluate(baseTrade(),{
  symbol:'ABC',price:9,lifecycle:'DISTRIBUTING',movementIndex:20,ignitionIndex:10,continuationIndex:20,
  distributionRisk:90,riskScore:90,sharia:{status:'NON_COMPLIANT'},dataConfidence:{label:'LOW',fresh:false},
  observedAt:'2026-08-28T20:00:00Z',whyNow:[]
});
assert(sharia.alerts.some(a=>a.type==='SHARIA_CHANGED'),'Sharia safety change must remain active even when market quote is stale');

const fresh=T.evaluate(baseTrade(),{
  symbol:'ABC',price:9,lifecycle:'DISTRIBUTING',movementIndex:20,ignitionIndex:10,continuationIndex:20,
  distributionRisk:90,riskScore:90,sharia:{status:'UNVERIFIED'},dataConfidence:{label:'HIGH',fresh:true},
  observedAt:new Date().toISOString(),whyNow:[]
});
for(const expected of ['PERSONAL_STOP','DISTRIBUTION','TRIM_WATCH','THESIS_WEAKENING'])
  assert(fresh.alerts.some(a=>a.type===expected),`fresh quote should emit ${expected}`);
assert.equal(fresh.trade.maePct,-10,'fresh quote should update adverse excursion');

console.log('trade-monitor freshness contract: ok');