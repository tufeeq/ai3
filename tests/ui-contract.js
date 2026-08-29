const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const theme=fs.readFileSync('theme.css','utf8');
const ui=fs.readFileSync('ui-enhancements.js','utf8');
const real=fs.readFileSync('decision-intelligence.js','utf8');
const realCss=fs.readFileSync('decision-intelligence.css','utf8');
const app=fs.readFileSync('app.js','utf8');
const pipeline=fs.readFileSync('scripts/build-intelligence.mjs','utf8');

for(const id of ['dashboard','summary','opportunities','focusView','ratingPanel','catalystPanel','shariaPanel','signalMatrix','liquidityLifecycle','feedGrid','trades','alerts','detailDialog','detailBody']){
  assert(html.includes(`id="${id}"`),`missing required UI anchor #${id}`);
}
assert(html.includes('theme.css'),'theme stylesheet must be loaded');
assert(html.includes('decision-intelligence.css'),'real intelligence stylesheet must be loaded');
assert(html.includes('ui-enhancements.js'),'UI enhancement script must be loaded after app');
assert(html.includes('decision-intelligence.js'),'real intelligence script must be loaded');
assert(html.indexOf('ui-enhancements.js')>html.indexOf('app.js'),'enhancements must load after app.js');
assert(html.indexOf('decision-intelligence.js')>html.indexOf('app.js'),'real intelligence must load after app.js');
assert(!html.includes('وضع تجريبي مهني'),'generic experimental banner should not be the primary operating status');
assert(theme.includes('html[data-theme="light"]'),'light theme contract missing');
assert(theme.includes('.theme-switch'),'theme switch styles missing');
assert(ui.includes("THEME_KEY='tagx3.theme.v1'"),'theme preference persistence missing');
assert(ui.includes('prefers-color-scheme'),'system theme support missing');
assert(ui.includes('prettyDetail'),'human-readable detail renderer missing');
assert(!ui.includes('observe(document.body'),'detail enhancement must not observe the full document body');
assert(!real.includes('observe(document.body'),'decision intelligence must not observe the full document body');
assert(real.includes('REAL MARKET INTELLIGENCE'),'real intelligence panel missing');
assert(real.includes('MODEL OUTCOME'),'model outcome reporting missing');
assert(real.includes('freshCount'),'live freshness gate missing');
assert(real.includes('INSUFFICIENT EVIDENCE'),'evidence sufficiency state missing');
assert(realCss.includes('.actionability'),'actionability visual state missing');
assert(pipeline.includes('data.sec.gov/submissions'),'SEC primary-source pipeline missing');
assert(pipeline.includes('api.gdeltproject.org'),'news discovery pipeline missing');
assert(app.includes('data-detail'),'opportunity detail action missing');
assert(!html.includes('<script src="http:'),'insecure script reference detected');
assert(!html.includes('<link rel="stylesheet" href="http:'),'insecure stylesheet reference detected');

console.log('TAGX3 UI contract: OK');
