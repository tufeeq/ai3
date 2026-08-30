const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
const text=(xml,tag)=>decode((String(xml).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const linkOf=entry=>decode((String(entry).match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)||[])[1]||'').trim();
const cikOf=entry=>{
  const body=`${text(entry,'title')} ${text(entry,'summary')} ${linkOf(entry)}`;
  const m=body.match(/\bCIK\s*[:#-]?\s*0*(\d{4,10})\b/i)||body.match(/\/data\/0*(\d+)\//i);
  return m?String(Number(m[1])):'';
};
export function parseSecAtom(xml,{form='SEC',tickerByCik=new Map(),companyByCik=new Map(),maxEntries=100}={}){
  const blocks=String(xml||'').match(/<entry\b[\s\S]*?<\/entry>/gi)||[];
  const out=[];
  for(const entry of blocks.slice(0,maxEntries)){
    const cik=cikOf(entry); if(!cik)continue;
    const symbol=String(tickerByCik.get(cik)||'').toUpperCase().trim(); if(!symbol)continue;
    const publishedAt=text(entry,'updated')||text(entry,'published');
    const url=linkOf(entry); if(!publishedAt||!/^https:\/\/(?:www\.)?sec\.gov\//i.test(url))continue;
    const rawTitle=text(entry,'title');
    const companyTitle=companyByCik.get(cik)||rawTitle.replace(/^\s*[^-]+-\s*/,'').replace(/\s*\(CIK[\s\S]*$/i,'').trim()||symbol;
    out.push({symbol,title:companyTitle,type:'SEC',form,publishedAt,headline:`${form} filing — ${companyTitle}`,url,source:'SEC EDGAR',verification:'PRIMARY',discoveryScope:'MARKET_WIDE'});
  }
  return out;
}

export function currentFeedUrl(form,count=100){
  const type=encodeURIComponent(String(form||'').trim());
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${type}&company=&dateb=&owner=include&start=0&count=${Math.max(1,Math.min(100,Number(count)||100))}&output=atom`;
}
