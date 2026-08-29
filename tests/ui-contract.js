const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const theme=fs.readFileSync('theme.css','utf8');
const ui=fs.readFileSync('ui-enhancements.js','utf8');
const app=fs.readFileSync('app.js','utf8');

for(const id of ['dashboard','summary','opportunities','focusView','ratingPanel','catalystPanel','shariaPanel','signalMatrix','liquidityLifecycle','feedGrid','trades','alerts','detailDialog','detailBody']){
  assert(html.includes(`id="${id}"`),`missing required UI anchor #${id}`);
}
assert(html.includes('theme.css'),'theme stylesheet must be loaded');
assert(html.includes('ui-enhancements.js'),'UI enhancement script must be loaded after app');
assert(html.indexOf('ui-enhancements.js')>html.indexOf('app.js'),'enhancements must load after app.js');
assert(theme.includes('html[data-theme="light"]'),'light theme contract missing');
assert(theme.includes('.theme-switch'),'theme switch styles missing');
assert(ui.includes("THEME_KEY='tagx3.theme.v1'"),'theme preference persistence missing');
assert(ui.includes('prefers-color-scheme'),'system theme support missing');
assert(ui.includes('prettyDetail'),'human-readable detail renderer missing');
assert(ui.includes('MutationObserver'),'detail enhancement observer missing');
assert(app.includes("data-detail"),'opportunity detail action missing');
assert(!html.includes('<script src="http:'),'insecure script reference detected');
assert(!html.includes('<link rel="stylesheet" href="http:'),'insecure stylesheet reference detected');

console.log('TAGX3 UI contract: OK');
