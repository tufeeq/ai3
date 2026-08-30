const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('universe-visibility.js','utf8'),html=fs.readFileSync('index.html','utf8');
for(const token of ['uniqueCount','tagx3.opportunityCases.v1','في المسار','المعروض الآن','واجهة مختصرة'])assert(src.includes(token),`missing universe visibility token ${token}`);
assert(html.includes('<script src="universe-visibility.js"></script>'),'dashboard must load universe visibility layer');
console.log('universe visibility contract: OK');