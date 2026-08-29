const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
const mobile=fs.readFileSync('mobile.css','utf8');
const truth=fs.readFileSync('ui-truth.js','utf8');

assert(index.includes('mobile.css'),'mobile.css must be loaded');
assert(index.includes('ui-truth.js'),'ui-truth.js must be loaded');
assert(!index.includes('/data/intelligence.json'),'missing intelligence feed must not be preloaded');
assert(mobile.includes('@media (max-width: 760px)'),'mobile breakpoint contract missing');
assert(mobile.includes('padding-bottom:calc(88px + env(safe-area-inset-bottom))'),'content must clear bottom navigation');
assert(mobile.includes('.opportunity-panel{order:1'),'opportunities must be first on mobile');
assert(truth.includes("quality='review'"),'truth layer must support review-only state');
assert(truth.includes("quality='blocked'"),'truth layer must support blocked state');
assert(truth.includes("quality='live'"),'truth layer must support live state');
assert(!truth.includes('MutationObserver'),'truth layer must not add a global DOM observer');
assert(truth.includes('غير جاهزة للترقية'),'cards must explain promotion gates');
console.log('mobile truth contract: ok');
