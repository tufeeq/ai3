const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const predictive=fs.readFileSync(path.join(root,'predictive-radar.js'),'utf8');

const productionFeeds=[
  '/ai/tag/data/live-quotes.json',
  '/ai/tag/data/tagx2-sentinel.json',
  '/ai/tag/data/coverage-rescue.json',
  '/ai/tag/data/sec-catalysts.json',
  '/ai/tag/data/sharia.json',
  '/ai/tag/data/sharia-v4-challenger.json'
];

for(const url of productionFeeds){
  assert(app.includes(url),`app.js missing production feed ${url}`);
  assert(!predictive.includes(url),`predictive-radar.js must consume analyzed cases instead of owning feed ${url}`);
}

const jsonUrls=s=>new Set([...s.matchAll(/\/ai\/tag\/data\/[A-Za-z0-9._-]+\.json/g)].map(m=>m[0]));
const appFeeds=jsonUrls(app);
const predictiveFeeds=jsonUrls(predictive);
assert.equal(predictiveFeeds.size,0,'predictive radar must not own production feed URLs');
assert(!predictive.includes('fetch('),'predictive radar must not independently fetch production data');
assert(predictive.includes('installSharedCaseBridge'),'predictive radar must use the shared analyzed-case bridge');
assert(predictive.includes("const CASE_EVENT='tagx:cases'"),'predictive radar must publish/consume the shared case event contract');

// Missing source time must remain missing in the one authoritative reconciliation path.
const dedupeMatch=app.match(/function dedupeQuotes\(results\)\{[\s\S]*?\}return\[\.\.\.by\.values\(\)\]\}/);
assert(dedupeMatch,'dedupeQuotes implementation not found');
const dedupe=dedupeMatch[0];
assert(!dedupe.includes('new Date().toISOString()'),'app reconciliation must not invent quote observedAt from browser time');
assert(dedupe.includes("f.data?.updatedAt||null"),'app reconciliation must fail closed when quote and feed timestamps are missing');

for(const url of productionFeeds) assert(appFeeds.has(url),`authoritative reconciliation path missing ${url}`);
console.log(`reconciliation-source-contract: ok (${productionFeeds.length} authoritative feeds; predictive consumes shared analyzed state; missing quote time fails closed)`);
