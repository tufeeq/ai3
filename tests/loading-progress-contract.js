const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('loading-progress.js','utf8'),html=fs.readFileSync('index.html','utf8');
for(const path of ['/ai/tag/data/live-quotes.json','/ai/tag/data/universe-broad.json','/ai/tag/data/discovery-fast.json','/ai/tag/data/discovery.json','/ai/tag/data/extended-hours.json','/ai/tag/data/extended-hot.json','/ai/tag/data/tagx2-sentinel.json','/ai/tag/data/coverage-rescue.json','/ai/tag/data/sec-catalysts.json','/ai/tag/data/sharia.json','/ai/tag/data/enrichment.json','/ai/tag/data/feed-health.json','/ai3/data/intelligence.json','/ai3/data/market-news.json'])assert(src.includes(path),`progress must track required source ${path}`);
assert(src.includes('window.fetch=async function'),'progress must observe actual fetch completion');
assert(src.includes("r.ok?'ok':'error'"),'progress must distinguish success from failed HTTP loads');
assert(src.includes("x==='ok'||x==='error'"),'progress completion must only count settled requests');
assert(html.indexOf('<script src="loading-progress.js"></script>')<html.indexOf('<script src="fast-fetch.js"></script>'),'progress tracker must install before fetch layers');
console.log('loading progress contract: OK');