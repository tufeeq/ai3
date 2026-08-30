const fs=require('fs'),assert=require('assert');
const x=JSON.parse(fs.readFileSync('data/intelligence.json','utf8'));
const generated=Date.parse(x.generatedAt||'');
assert(Number.isFinite(generated),'generatedAt must be parseable');
assert.strictEqual(x.schemaVersion,3,'unexpected intelligence schemaVersion');
assert(Array.isArray(x.shortlist)&&x.shortlist.length>0,'shortlist must be non-empty');
assert(Array.isArray(x.events),'events must be an array');
assert(x.bySymbol&&typeof x.bySymbol==='object'&&!Array.isArray(x.bySymbol),'bySymbol must be an object map');
assert.strictEqual(x.eventCount,x.events.length,'eventCount must equal deduplicated events length');
const s=x.sourceStatus||{};
for(const k of ['marketDataLoaded','marketDataFresh','marketWindowOpen','live'])assert.strictEqual(typeof s[k],'boolean',`${k} must be boolean`);
assert.strictEqual(s.live,s.marketDataFresh,'live must mean fresh market data, never merely a successful pipeline run');
if(s.live){
  assert.strictEqual(s.marketWindowOpen,true,'live data requires an active market window');
  assert(Number.isFinite(s.marketDataAgeMin)&&s.marketDataAgeMin<=15,'live data must be <=15 minutes old');
}
const shortlistSymbols=new Set();
for(const r of x.shortlist){
  assert(/^[A-Z0-9.\-]+$/.test(String(r.symbol||'')),`invalid shortlist symbol ${r.symbol}`);
  assert(!shortlistSymbols.has(r.symbol),`duplicate shortlist symbol ${r.symbol}`); shortlistSymbols.add(r.symbol);
  const at=Date.parse(r.observedAt||'');
  assert(Number.isFinite(at),`shortlist ${r.symbol} observedAt must be parseable`);
  assert(at<=generated+5*60*1000,`shortlist ${r.symbol} cannot be observed after feed generation`);
}
const eventKeys=new Set();
for(const e of x.events){
  assert(shortlistSymbols.has(e.symbol),`event ${e.symbol} must belong to current shortlist`);
  assert(['SEC','NEWS'].includes(e.type),`unsupported event type ${e.type}`);
  assert(e.headline&&e.source,'events require headline and source provenance');
  const at=Date.parse(e.publishedAt||'');
  assert(Number.isFinite(at),`${e.symbol} ${e.type} publishedAt must be parseable`);
  assert(at<=generated+5*60*1000,`${e.symbol} ${e.type} cannot be published after feed generation`);
  if(e.type==='SEC'){
    assert.strictEqual(e.verification,'PRIMARY','SEC events must be primary-source verified');
    assert.strictEqual(e.source,'SEC EDGAR','SEC events must identify EDGAR provenance');
    assert(/^https:\/\/www\.sec\.gov\//.test(String(e.url||'')),'SEC event must link to sec.gov');
  }else{
    assert.strictEqual(e.verification,'DISCOVERY','news must remain discovery-only until source-level verification');
  }
  const key=`${e.symbol}|${e.type}|${e.headline}|${e.publishedAt}`;
  assert(!eventKeys.has(key),`duplicate event ${key}`); eventKeys.add(key);
}
for(const symbol of shortlistSymbols){
  const bucket=x.bySymbol[symbol];
  assert(bucket&&Array.isArray(bucket.events),`bySymbol missing ${symbol}`);
  const all=x.events.filter(e=>e.symbol===symbol);
  assert.strictEqual(bucket.eventCount,all.length,`bySymbol eventCount mismatch for ${symbol}`);
  assert.deepStrictEqual(bucket.events,all.slice(0,8),`bySymbol event slice mismatch for ${symbol}`);
}
console.log(`intelligence-data contract ok: ${x.shortlist.length} symbols, ${x.events.length} events, live=${s.live}`);
