import assert from 'node:assert/strict';
import {parseSecAtom,currentFeedUrl} from '../scripts/sec-current-feed.mjs';

const xml=`<?xml version="1.0"?><feed>
<entry><title>8-K - Alpha Corp (CIK 0001234567)</title><updated>2026-08-30T19:01:02-04:00</updated><link rel="alternate" href="https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/alpha-8k.htm"/><summary>Filed: 2026-08-30</summary></entry>
<entry><title>8-K - Unknown Corp (CIK 0007654321)</title><updated>2026-08-30T19:02:02-04:00</updated><link rel="alternate" href="https://www.sec.gov/Archives/edgar/data/7654321/x.htm"/></entry>
<entry><title>8-K - Evil Link (CIK 0001234567)</title><updated>2026-08-30T19:03:02-04:00</updated><link rel="alternate" href="https://example.com/not-sec"/></entry>
</feed>`;
const rows=parseSecAtom(xml,{form:'8-K',tickerByCik:new Map([['1234567','ALPH']]),companyByCik:new Map([['1234567','Alpha Corp']])});
assert.equal(rows.length,1,'only mapped US-equity CIKs with SEC provenance should pass');
assert.deepEqual(rows[0],{symbol:'ALPH',title:'Alpha Corp',type:'SEC',form:'8-K',publishedAt:'2026-08-30T19:01:02-04:00',headline:'8-K filing — Alpha Corp',url:'https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/alpha-8k.htm',source:'SEC EDGAR',verification:'PRIMARY',discoveryScope:'MARKET_WIDE'});
const u=currentFeedUrl('SC 13D',250);
assert(u.includes('type=SC%2013D'),'form must be encoded');
assert(u.includes('count=100'),'SEC current-feed count must remain capped');
console.log('SEC current-feed contract: OK');
