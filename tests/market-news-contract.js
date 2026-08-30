const fs=require('fs'),assert=require('assert');
const script=fs.readFileSync('scripts/build-market-news.mjs','utf8'),workflow=fs.readFileSync('.github/workflows/market-news.yml','utf8'),board=fs.readFileSync('market-overview.js','utf8');
for(const token of ["scope:'MARKET'","scope:'SECTOR'",'verification:\'DISCOVERY\'','MARKET_AND_SECTOR_ONLY'])assert(script.includes(token),`market-news producer missing ${token}`);
assert(script.includes('Federal Reserve')&&script.includes('semiconductor')&&script.includes('energy stocks')&&script.includes('biotech'),'producer must cover macro and major sectors');
assert(workflow.includes('node scripts/build-market-news.mjs'),'workflow must build dedicated market news');
assert(workflow.includes('npm run check && npm test'),'market-news bot must pass repository contracts before commit');
assert(board.includes('MARKET_NEWS'),'dashboard must load dedicated market-news payload');
assert(board.includes('أخبار وإفصاحات الشركات الفردية لا تظهر في هذه النشرة'),'company-specific news must be kept out of homepage market bulletin');
console.log('market news contract: OK');