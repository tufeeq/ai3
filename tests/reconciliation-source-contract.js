const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const predictive=fs.readFileSync(path.join(root,'predictive-radar.js'),'utf8');

const shared=[
  '/ai/tag/data/live-quotes.json',
  '/ai/tag/data/tagx2-sentinel.json',
  '/ai/tag/data/coverage-rescue.json',
  '/ai/tag/data/sec-catalysts.json',
  '/ai/tag/data/sharia.json',
  '/ai/tag/data/sharia-v4-challenger.json'
];

for(const url of shared){
  assert(app.includes(url),`app.js missing shared production feed ${url}`);
  assert(predictive.includes(url),`predictive-radar.js missing shared production feed ${url}`);
}

const jsonUrls=s=>new Set([...s.matchAll(/\/ai\/tag\/data\/[A-Za-z0-9._-]+\.json/g)].map(m=>m[0]));
const appFeeds=jsonUrls(app);
const predictiveFeeds=jsonUrls(predictive);

// Predictive Radar may intentionally omit audit-only feeds, but it must not introduce
// a market/catalyst/Sharia source that the primary app does not reconcile.
for(const url of predictiveFeeds) assert(appFeeds.has(url),`predictive-only feed bypasses primary reconciliation: ${url}`);

// Missing source time must remain missing. Reconciliation may use a feed-level timestamp,
// but it must never manufacture browser time and make an undated quote look fresh.
const dedupeMatch=app.match(/function dedupeQuotes\(results\)\{[\s\S]*?\}return\[\.\.\.by\.values\(\)\]\}/);
assert(dedupeMatch,'dedupeQuotes implementation not found');
const dedupe=dedupeMatch[0];
assert(!dedupe.includes('new Date().toISOString()'),'app reconciliation must not invent quote observedAt from browser time');
assert(dedupe.includes("f.data?.updatedAt||null"),'app reconciliation must fail closed when quote and feed timestamps are missing');
assert(!predictive.includes("f.data?.updatedAt||new Date().toISOString()"),'predictive reconciliation must not invent quote timestamps');

assert.equal(shared.filter(x=>appFeeds.has(x)&&predictiveFeeds.has(x)).length,shared.length);
console.log(`reconciliation-source-contract: ok (${shared.length} shared feeds; missing quote time fails closed)`);
