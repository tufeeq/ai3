(()=>{
'use strict';
const HEALTH_URL='/ai/tag/data/feed-health.json';
const LIVE_URL='/ai/tag/data/live-quotes.json';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const ageMin=(iso,now=Date.now())=>{const t=Date.parse(iso||'');return Number.isFinite(t)?Math.max(0,(now-t)/60000):null};
function assess(health={},live={},now=Date.now()){
  const session=String(live.marketClockSession||'unknown').toLowerCase();
  const requested=Number(live.requested??live.count??0)||0;
  const count=Number(live.count??0)||0;
  const freshCount=Number(live.freshCount??0)||0;
  const pipelineHealthy=String(health.overall||'').toUpperCase()==='HEALTHY';
  const marketOpen=!['closed','unknown',''].includes(session);
  const marketFresh=marketOpen&&freshCount>0&&String(live.dataConfidence||'').toUpperCase()!=='LOW';
  const marketMode=marketFresh?'LIVE':session==='closed'?'SESSION_FINAL':'STALE_OR_UNAVAILABLE';
  const feeds=Object.entries(health.feeds||{}).map(([name,f])=>({name,status:f?.status||'UNKNOWN',count:Number(f?.count||0),sourceTimestamp:f?.sourceTimestamp||null,sourceAgeMin:ageMin(f?.sourceTimestamp,now)}));
  return{pipelineHealthy,pipelineStatus:health.overall||'UNKNOWN',marketFresh,marketMode,session,requested,count,freshCount,dataConfidence:live.dataConfidence||'UNKNOWN',liveUpdatedAt:live.updatedAtUTC||live.updatedAt||null,feeds};
}
async function get(url){const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
const ageLabel=m=>m==null?'—':m<60?`${Math.round(m)}د`:`${(m/60).toFixed(1)}س`;
function html(a){
  const modeAr=a.marketMode==='LIVE'?'بيانات سوق حية':a.marketMode==='SESSION_FINAL'?'السوق مغلق — بيانات آخر جلسة':'بيانات السوق غير طازجة/غير متاحة';
  const feedRows=a.feeds.map(f=>`<div class="feed-row"><span>${esc(f.name)}</span><b>${esc(f.status)}</b><small>${f.count||0} · عمر المصدر ${ageLabel(f.sourceAgeMin)}</small></div>`).join('');
  return `<section class="feed-truth-card" data-feed-truth><div class="section-head"><div><span class="kicker">PIPELINE ≠ MARKET FRESHNESS</span><h3>حقيقة التغذية</h3></div></div><div class="feed-truth-summary"><div><span>Pipeline</span><b>${esc(a.pipelineStatus)}</b></div><div><span>Market</span><b>${esc(modeAr)}</b></div><div><span>Fresh quotes</span><b>${a.freshCount}/${a.requested||a.count||0}</b></div><div><span>Confidence</span><b>${esc(a.dataConfidence)}</b></div></div>${feedRows?`<div class="feed-truth-sources">${feedRows}</div>`:''}<p class="muted">HEALTHY يعني أن مسار الجمع يعمل؛ لا يعني أن الأسعار حية. صلاحية السوق تُحسم مستقلاً من session + freshCount + data confidence.</p></section>`;
}
let cached=null,installing=false;
function paint(){const host=document.querySelector('#feedGrid');if(!host||!cached)return;let el=host.querySelector('[data-feed-truth]');if(!el){el=document.createElement('div');el.setAttribute('data-feed-truth-wrapper','1');host.prepend(el)}el.innerHTML=html(cached)}
async function refresh(){if(installing)return;installing=true;try{const [health,live]=await Promise.all([get(HEALTH_URL),get(LIVE_URL)]);cached=assess(health,live);paint()}catch(e){cached={pipelineStatus:'UNAVAILABLE',pipelineHealthy:false,marketFresh:false,marketMode:'STALE_OR_UNAVAILABLE',session:'unknown',requested:0,count:0,freshCount:0,dataConfidence:'UNKNOWN',feeds:[]};paint()}finally{installing=false}}
function install(){refresh();setInterval(refresh,60000);const host=document.querySelector('#feedGrid');if(host&&window.MutationObserver){new MutationObserver(()=>{if(cached&&!host.querySelector('[data-feed-truth]'))paint()}).observe(host,{childList:true})}}
window.TAGX3FeedTruth={assess,ageMin};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();