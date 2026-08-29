import fs from 'node:fs/promises';

const UA='TAGX3 research assistant contact:tufeeq11@gmail.com';
const OUT='data/intelligence.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=new Date();
const iso=now.toISOString();
const daysAgo=(d,n)=>Date.now()-new Date(d||0).getTime()<=n*86400000;

async function getJson(url,{headers={},timeout=15000}={}){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),timeout);
  try{const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/json,text/plain,*/*',...headers},signal:ac.signal}); if(!r.ok)throw new Error(`HTTP ${r.status}`); return await r.json();}
  finally{clearTimeout(t)}
}

function liveRows(p){
  if(Array.isArray(p?.quotes))return p.quotes;
  if(p?.quotes&&typeof p.quotes==='object')return Object.values(p.quotes);
  return [];
}

function shortlist(rows,n=40){
  return rows.filter(x=>x?.ticker||x?.symbol).map(x=>({
    symbol:String(x.ticker||x.symbol).toUpperCase(),
    price:Number(x.price||x.regularMarketPrice||0),
    changePct:Number(x.changePct||0),
    early:Number(x.earlyRegimeShiftScore||0),
    ignition:Number(x.ignitionScore||0),
    observedAt:x.timestampET||x.observedAt||null
  })).sort((a,b)=>(b.early+b.ignition)-(a.early+a.ignition)).slice(0,n);
}

function secRecent(sub,symbol,title){
  const r=sub?.filings?.recent||{}; const out=[];
  const forms=r.form||[], dates=r.filingDate||[], accepted=r.acceptanceDateTime||[], acc=r.accessionNumber||[], docs=r.primaryDocument||[];
  const wanted=/^(8-K|6-K|S-1|S-3|424B\d*|EFFECT|4|13D|13G|SC 13D|SC 13G|144)$/;
  for(let i=0;i<forms.length;i++){
    if(!wanted.test(String(forms[i]||'')))continue;
    if(!daysAgo(dates[i],21))continue;
    const accession=String(acc[i]||'').replace(/-/g,'');
    const cik=String(sub.cik||'').replace(/^0+/,'');
    const url=accession&&docs[i]?`https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${docs[i]}`:null;
    out.push({symbol,title,type:'SEC',form:forms[i],publishedAt:accepted[i]||dates[i],headline:`${forms[i]} filing — ${title}`,url,source:'SEC EDGAR',verification:'PRIMARY'});
  }
  return out.slice(0,8);
}

async function gdeltNews(query,symbol,title=null){
  const clean=String(query||'').trim();
  if(!clean)return[];
  const q=encodeURIComponent(clean);
  const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=8&format=json&timespan=3d&sort=datedesc`;
  try{
    const j=await getJson(url,{headers:{'User-Agent':UA},timeout:12000});
    return (j.articles||[]).slice(0,8).map(a=>({symbol,title,type:'NEWS',headline:a.title||'News',publishedAt:a.seendate||null,url:a.url||null,domain:a.domain||null,source:a.domain||'GDELT source',language:a.language||null,verification:'DISCOVERY'}));
  }catch{return[]}
}

async function main(){
  const errors=[];
  let live=null, mapping=null;
  try{live=await getJson('https://raw.githubusercontent.com/tufeeq/ai/main/tag/data/live-quotes.json')}catch(e){errors.push(`LIVE:${e.message}`)}
  try{mapping=await getJson('https://www.sec.gov/files/company_tickers.json')}catch(e){errors.push(`SEC_MAPPING:${e.message}`)}
  const picks=shortlist(liveRows(live),40);
  const map=new Map();
  if(mapping)for(const v of Object.values(mapping)){if(v?.ticker)map.set(String(v.ticker).toUpperCase(),v)}
  const events=[]; const companies={};
  for(const p of picks){
    const m=map.get(p.symbol);
    if(!m)continue;
    const cik=String(m.cik_str).padStart(10,'0'); companies[p.symbol]={title:m.title,cik};
    try{
      const sub=await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`); events.push(...secRecent(sub,p.symbol,m.title));
    }catch(e){errors.push(`SEC_${p.symbol}:${e.message}`)}
    await sleep(125);
  }
  for(const p of picks.slice(0,30)){
    const c=companies[p.symbol];
    const companyQuery=c?.title?`\"${c.title.replace(/\b(Inc|Corp|Corporation|Ltd|Limited|PLC|Holdings?)\.?\b/gi,'').trim()}\"`:`\"${p.symbol}\" (stock OR shares OR company)`;
    const found=await gdeltNews(companyQuery,p.symbol,c?.title||null);
    events.push(...found);
    if(!found.length&&c?.title)events.push(...await gdeltNews(`\"${p.symbol}\" (stock OR shares OR company)`,p.symbol,c.title));
    await sleep(180);
  }
  const seen=new Set(); const dedup=events.filter(e=>{const k=`${e.symbol}|${e.type}|${e.headline}|${e.publishedAt}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
  const bySymbol={}; for(const p of picks)bySymbol[p.symbol]={events:dedup.filter(e=>e.symbol===p.symbol).slice(0,8),eventCount:dedup.filter(e=>e.symbol===p.symbol).length};
  const payload={schemaVersion:2,generatedAt:iso,sourceStatus:{live:!!live,secMapping:!!mapping,newsDiscovery:true},shortlist:picks,companies,eventCount:dedup.length,events:dedup,bySymbol,errors:errors.slice(0,30),policy:'Public-source intelligence. SEC filings are primary-source events; GDELT is discovery-only and requires source-level verification before trade decisions.'};
  await fs.mkdir('data',{recursive:true}); await fs.writeFile(OUT,JSON.stringify(payload,null,2));
  console.log(`wrote ${OUT}: ${dedup.length} events for ${picks.length} symbols`);
}
main().catch(e=>{console.error(e);process.exit(1)});
