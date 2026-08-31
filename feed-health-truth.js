(()=>{
'use strict';
const HEALTH_URL='/ai/tag/data/feed-health.json';
const LIVE_URL='/ai/tag/data/live-quotes.json';
const SNAPSHOT_MAX_AGE_MIN=10;
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const ageMin=(iso,now=Date.now())=>{const t=Date.parse(iso||'');return Number.isFinite(t)?Math.max(0,(now-t)/60000):null};
function clockWindow(now=Date.now()){
  try{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
    const get=t=>parts.find(p=>p.type===t)?.value;
    const weekday=get('weekday');
    if(['Sat','Sun'].includes(weekday))return 'closed';
    const mins=(Number(get('hour'))*60)+Number(get('minute'));
    if(mins>=240&&mins<570)return 'pre-market';
    if(mins>=570&&mins<960)return 'regular';
    if(mins>=960&&mins<=1200)return 'after-hours';
    return 'closed';
  }catch{return 'unknown'}
}
function assess(health={},live={},now=Date.now()){
  const reportedSession=String(live.marketClockSession||live.marketSession||'unknown').toLowerCase();
  const liveUpdatedAt=live.updatedAtUTC||live.updatedAt||live.updatedAtET||null;
  const snapshotAgeMin=ageMin(liveUpdatedAt,now);
  const declaredMaxSec=Number(live.maxFreshAgeSec||live.freshnessThresholdSec||0);
  const maxAgeMin=declaredMaxSec>0?Math.max(1,declaredMaxSec/60):SNAPSHOT_MAX_AGE_MIN;
  const snapshotFresh=snapshotAgeMin!==null&&snapshotAgeMin<=maxAgeMin;
  const clock=clockWindow(now);
  const reportedClosed=reportedSession==='closed';
  const staleClosedConflict=!snapshotFresh&&reportedClosed&&clock!=='closed'&&clock!=='unknown';
  const session=staleClosedConflict?clock:reportedSession;
  const sessionSource=staleClosedConflict?'CLOCK_WINDOW_STALE_SNAPSHOT':'FEED';
  const requested=Number(live.requested??live.count??0)||0;
  const count=Number(live.count??0)||0;
  const freshCount=Number(live.freshCount??0)||0;
  const pipelineHealthy=String(health.overall||'').toUpperCase()==='HEALTHY';
  const marketOpen=!['closed','unknown',''].includes(session);
  const marketFresh=snapshotFresh&&marketOpen&&freshCount>0&&String(live.dataConfidence||'').toUpperCase()!=='LOW';
  const marketMode=marketFresh?'LIVE':(snapshotFresh&&session==='closed'?'SESSION_FINAL':'STALE_OR_UNAVAILABLE');
  const feeds=Object.entries(health.feeds||{}).map(([name,f])=>({name,status:f?.status||'UNKNOWN',count:Number(f?.count||0),sourceTimestamp:f?.sourceTimestamp||null,sourceAgeMin:ageMin(f?.sourceTimestamp,now)}));
  return{pipelineHealthy,pipelineStatus:health.overall||'UNKNOWN',marketFresh,marketMode,session,reportedSession,sessionSource,clockWindow:clock,snapshotFresh,snapshotAgeMin,maxSnapshotAgeMin:maxAgeMin,requested,count,freshCount,dataConfidence:live.dataConfidence||'UNKNOWN',liveUpdatedAt,feeds};
}
async function get(url){const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
const ageLabel=m=>m==null?'—':m<60?`${Math.round(m)}د`:`${(m/60).toFixed(1)}س`;
function html(a){
  const modeAr=a.marketMode==='LIVE'?'بيانات سوق حية':a.marketMode==='SESSION_FINAL'?'السوق مغلق — بيانات آخر جلسة':(a.sessionSource==='CLOCK_WINDOW_STALE_SNAPSHOT'?'نافذة التداول مفتوحة — بيانات السوق متأخرة':'بيانات السوق غير طازجة/غير متاحة');
  const feedRows=a.feeds.map(f=>`<div class="feed-row"><span>${esc(f.name)}</span><b>${esc(f.status)}</b><small>${f.count||0} · عمر المصدر ${ageLabel(f.sourceAgeMin)}</small></div>`).join('');
  return `<section class="feed-truth-card" data-feed-truth><div class="section-head"><div><span class="kicker">PIPELINE ≠ MARKET FRESHNESS</span><h3>حقيقة التغذية</h3></div></div><div class="feed-truth-summary"><div><span>Pipeline</span><b>${esc(a.pipelineStatus)}</b></div><div><span>Market</span><b>${esc(modeAr)}</b></div><div><span>Fresh quotes</span><b>${a.freshCount}/${a.requested||a.count||0}</b></div><div><span>Snapshot age</span><b>${ageLabel(a.snapshotAgeMin)}</b></div><div><span>Confidence</span><b>${esc(a.dataConfidence)}</b></div></div>${feedRows?`<div class="feed-truth-sources">${feedRows}</div>`:''}<p class="muted">HEALTHY يعني أن مسار الجمع يعمل؛ لا يعني أن الأسعار حية. لا تُعامل أعداد freshness أو session من snapshot قديم كحقيقة حالية، ولا يتم اختراع أي timestamp.</p></section>`;
}
let cached=null,installing=false;
function paint(){const host=document.querySelector('#feedGrid');if(!host||!cached)return;let el=host.querySelector('[data-feed-truth]');if(!el){el=document.createElement('div');el.setAttribute('data-feed-truth-wrapper','1');host.prepend(el)}el.innerHTML=html(cached)}
async function refresh(){if(installing)return;installing=true;try{const [health,live]=await Promise.all([get(HEALTH_URL),get(LIVE_URL)]);cached=assess(health,live);paint()}catch(e){cached={pipelineStatus:'UNAVAILABLE',pipelineHealthy:false,marketFresh:false,marketMode:'STALE_OR_UNAVAILABLE',session:'unknown',sessionSource:'UNAVAILABLE',snapshotFresh:false,snapshotAgeMin:null,requested:0,count:0,freshCount:0,dataConfidence:'UNKNOWN',feeds:[]};paint()}finally{installing=false}}
function install(){refresh();setInterval(refresh,60000);const host=document.querySelector('#feedGrid');if(host&&window.MutationObserver){new MutationObserver(()=>{if(cached&&!host.querySelector('[data-feed-truth]'))paint()}).observe(host,{childList:true})}}
window.TAGX3FeedTruth={assess,ageMin,clockWindow};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();