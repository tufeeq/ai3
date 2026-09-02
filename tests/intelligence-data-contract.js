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
const eventKeys=new Set(),eventSymbols=new Set();
for(const e of x.events){
  assert(/^[A-Z0-9.\-]+$/.test(String(e.symbol||'')),`invalid event symbol ${e.symbol}`);
  eventSymbols.add(e.symbol);
  const outsideShortlist=!shortlistSymbols.has(e.symbol);
  if(outsideShortlist)assert(e.type==='SEC'&&e.verification==='PRIMARY'&&e.discoveryScope==='MARKET_WIDE',`outside-shortlist event ${e.symbol} must be primary market-wide SEC discovery`);
  assert(['SEC','NEWS'].includes(e.type),`unsupported event type ${e.type}`);
  assert(e.headline&&e.source,'events require headline and source provenance');
  const at=Date.parse(e.publishedAt||'');
  assert(Number.isFinite(at),`${e.symbol} ${e.type} publishedAt must be parseable`);
  assert(at<=generated+5*60*1000,`${e.symbol} ${e.type} cannot be published after feed generation`);
  if(e.type==='SEC'){
    assert.strictEqual(e.verification,'PRIMARY','SEC events must be primary-source verified');
    assert.strictEqual(e.source,'SEC EDGAR','SEC events must identify EDGAR provenance');
    assert(/^https:\/\/www\.sec\.gov\//.test(String(e.url||'')),'SEC event must link to sec.gov');
    if(e.discoveryScope)assert(['MARKET_WIDE','SHORTLIST_ENRICHMENT'].includes(e.discoveryScope),`unsupported SEC discovery scope ${e.discoveryScope}`);
  }else{
    assert.strictEqual(e.verification,'DISCOVERY','news must remain discovery-only until source-level verification');
    assert(!outsideShortlist,'discovery-only news may not enter intelligence outside the price shortlist');
  }
  const key=`${e.symbol}|${e.type}|${e.headline}|${e.publishedAt}`;
  assert(!eventKeys.has(key),`duplicate event ${key}`); eventKeys.add(key);
}
for(const symbol of new Set([...shortlistSymbols,...eventSymbols])){
  const bucket=x.bySymbol[symbol];
  assert(bucket&&Array.isArray(bucket.events),`bySymbol missing ${symbol}`);
  const all=x.events.filter(e=>e.symbol===symbol);
  assert.strictEqual(bucket.eventCount,all.length,`bySymbol eventCount mismatch for ${symbol}`);
  assert.deepStrictEqual(bucket.events,all.slice(0,8),`bySymbol event slice mismatch for ${symbol}`);
}
if(Object.prototype.hasOwnProperty.call(s,'secMarketwideDiscovery')){
  assert.strictEqual(typeof s.secMarketwideDiscovery,'boolean','secMarketwideDiscovery must be boolean');
  assert(Number.isInteger(s.secMarketwideEventCount)&&s.secMarketwideEventCount>=0,'secMarketwideEventCount must be a non-negative integer');
  const actual=x.events.filter(e=>e.type==='SEC'&&e.discoveryScope==='MARKET_WIDE').length;
  assert.strictEqual(s.secMarketwideEventCount,actual,'market-wide SEC count must match events');
}
// Feed-level freshness must be measured across every loaded quote, not only the
// ranked shortlist. Otherwise a fresh low-ranked quote can coexist with a stale
// top-40 and incorrectly force the whole intelligence artifact fail-closed.
const intelligenceBuilder=fs.readFileSync('scripts/build-intelligence.mjs','utf8');
assert(/const rows=liveRows\(live\);/.test(intelligenceBuilder),'intelligence must preserve the full loaded quote universe for feed truth');
assert(/const picks=shortlist\(rows,40\);/.test(intelligenceBuilder),'shortlist ranking must remain separate from feed truth');
assert(/const truth=marketTruth\(rows\);/.test(intelligenceBuilder),'feed freshness must be computed from all loaded quotes');
assert(!/marketTruth\(picks\)/.test(intelligenceBuilder),'shortlist must never determine feed-level freshness');
assert(/x\.timestampET\|\|x\.observedAt/.test(intelligenceBuilder),'feed truth must accept upstream timestampET observations');
if(Object.prototype.hasOwnProperty.call(s,'freshnessScope')){
  assert.strictEqual(s.freshnessScope,'ALL_LOADED_QUOTES','freshness scope must remain full loaded universe');
  assert(Number.isInteger(s.quoteCount)&&s.quoteCount>=x.shortlist.length,'quoteCount must cover at least the shortlist');
}
// Operational provenance must be captured at build time so historical artifacts
// can distinguish producer/envelope lag from stale quote observations. These
// diagnostics must not participate in marketDataFresh/live eligibility.
for(const token of ['upstreamFeedFetchedAt','upstreamUpdatedAtAtBuild','upstreamNewestObservedAtAtBuild','upstreamUpdateAgeAtFetchMin','upstreamObservationAgeAtFetchMin']){
  assert(intelligenceBuilder.includes(token),`intelligence builder must retain ${token}`);
}
assert(/upstreamUpdatedAt=normalizedIso\(live\?\.updatedAtUTC\|\|live\?\.updatedAtET\)/.test(intelligenceBuilder),'upstream envelope timestamp must come from the fetched feed itself');
assert(/upstreamObservationAgeAtFetchMin=ageMinBetween\(liveFetchedAt,truth\.newestObservedAt\)/.test(intelligenceBuilder),'upstream observation age must compare fetch time to quote observation time');
const marketTruthSource=(intelligenceBuilder.match(/function marketTruth\(rows\)\{[\s\S]*?\n\}/)||[])[0]||'';
assert(/marketDataFresh=marketWindowOpen&&marketDataAgeMin!==null&&marketDataAgeMin<=15/.test(marketTruthSource),'freshness gate must remain quote-observation based and <=15 minutes');
assert(!/upstream(Update|Observation|Feed)/.test(marketTruthSource),'diagnostic upstream provenance must never enter market freshness truth');
assert(/Upstream feed timestamps are retained only as operational provenance/.test(intelligenceBuilder),'policy must state that upstream provenance is diagnostic only');
// Once a generated artifact contains the additive provenance fields, keep their
// shape strict without making old pre-migration artifacts fail CI before the next
// scheduled Intelligence rebuild lands.
if(Object.prototype.hasOwnProperty.call(s,'upstreamFeedFetchedAt')){
  for(const k of ['upstreamFeedFetchedAt','upstreamUpdatedAtAtBuild','upstreamNewestObservedAtAtBuild']){
    assert(Number.isFinite(Date.parse(s[k]||'')),`${k} must be parseable when present`);
  }
  for(const k of ['upstreamUpdateAgeAtFetchMin','upstreamObservationAgeAtFetchMin'])assert(Number.isFinite(s[k])&&s[k]>=0,`${k} must be a non-negative number when present`);
}
// Operational measurement contract: validation must observe the artifact after a
// successful production intelligence rebuild. A scheduled fallback remains, but
// validation must not dispatch intelligence itself; that old feedback topology
// produced measured gaps far above the 15-minute target and could snapshot the
// pre-reconciliation artifact.
const validationWorkflow=fs.readFileSync('.github/workflows/validation-snapshots.yml','utf8');
assert(/workflow_run:\s*\n\s*workflows:\s*\["TAGX3 Intelligence Feed"\]/m.test(validationWorkflow),'validation must follow TAGX3 Intelligence Feed');
assert(/github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'/.test(validationWorkflow),'failed intelligence runs must not produce measurement snapshots');
assert(!/gh workflow run intelligence-feed\.yml/.test(validationWorkflow),'validation must not dispatch intelligence or create a feedback loop');
assert(validationWorkflow.indexOf('Core/UI/data-contract gate')<validationWorkflow.indexOf('Capture immutable validation snapshot'),'snapshot publication must remain behind full repository contracts');
console.log(`intelligence-data contract ok: ${x.shortlist.length} shortlist symbols, ${eventSymbols.size} event symbols, ${x.events.length} events, live=${s.live}; full-universe freshness, immutable upstream provenance, and post-intelligence validation coupling locked`);
