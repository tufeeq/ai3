import fs from 'node:fs/promises';

const UA='TAGX3 Market Intelligence research bot';
const queries=[
  {scope:'MARKET',sector:null,q:'US stock market Federal Reserve inflation jobs Treasury yields when:1d'},
  {scope:'SECTOR',sector:'Technology / Semiconductors',q:'semiconductor AI chips stocks sector when:1d'},
  {scope:'SECTOR',sector:'Energy',q:'oil OPEC energy stocks sector when:1d'},
  {scope:'SECTOR',sector:'Healthcare / Biotech',q:'biotech FDA healthcare stocks sector when:1d'},
  {scope:'SECTOR',sector:'Financials',q:'banks financial stocks Treasury yields sector when:1d'},
  {scope:'SECTOR',sector:'Crypto-linked equities',q:'bitcoin crypto stocks market when:1d'}
];
const decode=s=>String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
const tag=(block,name)=>{const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decode(m[1]):''};
const sourceOf=block=>{const m=block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);return m?decode(m[1]):'Google News'};
function impact(title=''){
  const t=title.toLowerCase();
  if(/rate cut|dovish|cooling inflation|inflation falls|soft landing|stimulus/.test(t))return{bias:'POSITIVE_POTENTIAL',reason:'قد يدعم تقييمات الأسهم والسيولة إذا أكدته حركة المؤشرات والعوائد.'};
  if(/rate hike|hawkish|inflation rises|hot inflation|tariff|sanction|war|recession|default/.test(t))return{bias:'RISK_POTENTIAL',reason:'قد يرفع علاوة المخاطر أو يضغط على التقييم والسيولة.'};
  if(/oil rises|oil jumps|opec cut/.test(t))return{bias:'SECTOR_POSITIVE_POTENTIAL',reason:'قد يدعم أسهم الطاقة مع احتمال ضغط على القطاعات الحساسة للتضخم.'};
  if(/oil falls|opec increase/.test(t))return{bias:'SECTOR_MIXED',reason:'قد يضغط على الطاقة ويخفف بعض ضغوط التكلفة والتضخم.'};
  return{bias:'MIXED_OR_UNCLEAR',reason:'الأثر يحتاج تأكيدًا من حركة المؤشرات والقطاعات والسيولة.'};
}
async function fetchQuery(x){
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(x.q)}&hl=en-US&gl=US&ceid=US:en`;
  const r=await fetch(url,{headers:{'user-agent':UA,'accept':'application/rss+xml,text/xml'}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const xml=await r.text(),items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  return items.slice(0,12).map(block=>{const title=tag(block,'title'),publishedAt=tag(block,'pubDate'),link=tag(block,'link'),source=sourceOf(block),im=impact(title);return{title,publishedAt,link,source,scope:x.scope,sector:x.sector,verification:'DISCOVERY',impactBias:im.bias,impactReason:im.reason,query:x.q}}).filter(x=>x.title&&x.link);
}
const settled=await Promise.allSettled(queries.map(fetchQuery));
const all=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]).sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
const seen=new Set(),items=[];
for(const x of all){const k=x.title.toLowerCase().replace(/\s+/g,' ').trim();if(seen.has(k))continue;seen.add(k);items.push(x);if(items.length>=48)break}
const out={schemaVersion:1,generatedAt:new Date().toISOString(),source:'Google News RSS topical discovery',verification:'DISCOVERY',scope:'MARKET_AND_SECTOR_ONLY',items,queryStatus:settled.map((x,i)=>({scope:queries[i].scope,sector:queries[i].sector,ok:x.status==='fulfilled',count:x.status==='fulfilled'?x.value.length:0,error:x.status==='rejected'?String(x.reason?.message||x.reason):null}))};
await fs.mkdir('data',{recursive:true});await fs.writeFile('data/market-news.json',JSON.stringify(out,null,2));
console.log(`market-news: ${items.length} items`);
