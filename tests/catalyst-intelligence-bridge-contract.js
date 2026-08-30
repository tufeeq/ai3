const assert=require('node:assert/strict');
const B=require('../catalyst-intelligence-bridge.js');
const native={data:[{symbol:'AAA',form:'8-K',eventAt:'2026-08-28T14:00:00Z'}]};
const intel={events:[
  {symbol:'AAA',type:'SEC',form:'8-K',publishedAt:'2026-08-28T14:00:00Z',verification:'PRIMARY',headline:'duplicate'},
  {symbol:'BBB',type:'SEC',form:'6-K',publishedAt:'2026-08-28T15:00:00Z',verification:'PRIMARY',headline:'primary'},
  {symbol:'CCC',type:'SEC',form:'8-K',publishedAt:'2026-08-28T15:00:00Z',verification:'DISCOVERY'},
  {symbol:'DDD',type:'NEWS',publishedAt:'2026-08-28T15:00:00Z',verification:'PRIMARY'}
]};
const out=B.mergePayload(native,intel);
assert.equal(out.data.length,2,'only unique PRIMARY SEC evidence may augment native catalyst rows');
assert(out.data.some(x=>x.symbol==='BBB'&&x.intelligenceFallback===true),'verified SEC fallback must be retained');
assert(!out.data.some(x=>x.symbol==='CCC'||x.symbol==='DDD'),'unverified SEC and news must not enter catalyst fallback');
assert.equal(out.catalystIntelligenceBridge.nativeCount,1);
assert.equal(out.catalystIntelligenceBridge.addedCount,1);
for(const forbidden of ['setThreshold','executeTrade','autoBuy','autoSell'])assert(!require('fs').readFileSync('catalyst-intelligence-bridge.js','utf8').includes(forbidden));
console.log('catalyst-intelligence-bridge contract: OK');
