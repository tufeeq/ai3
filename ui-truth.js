(()=>{
'use strict';
const $=s=>document.querySelector(s);
const LIVE='/ai/tag/data/live-quotes.json';
let marketMeta=null;
const parseFeedHealth=()=>{const text=$('#status')?.textContent||'';const m=text.match(/(\d+)\s*\/\s*(\d+)\s*feeds/i);return m?{ok:Number(m[1]),total:Number(m[2])}:{ok:0,total:0};};
async function loadMarketMeta(){try{const r=await fetch(`${LIVE}?truth=${Date.now()}`,{cache:'no-store'});if(!r.ok)return null;const p=await r.json();marketMeta={session:p.marketClockSession||p.session||'unknown',freshCount:Number(p.freshCount)||0,count:Number(p.count)||0,requested:Number(p.requested)||0,updatedAt:p.updatedAtET||p.updatedAtUTC||p.updatedAt||null,dataConfidence:p.dataConfidence||'UNKNOWN'};return marketMeta}catch{return null}}
function addPromotionGates(){
  document.querySelectorAll('.opp-card').forEach(card=>{
    card.querySelector('.promotion-gate')?.remove();
    const badges=[...card.querySelectorAll('.badges .badge')];
    const sharia=badges[1]?.textContent?.trim()||'';
    const dataLabel=badges.find(b=>['LOW','MEDIUM','HIGH','SESSION FINAL'].includes(b.textContent.trim()))?.textContent?.trim()||'';
    const reasons=[];
    if(dataLabel==='LOW')reasons.push('جودة بيانات السعر منخفضة');
    if(sharia==='UNVERIFIED')reasons.push('التصنيف الشرعي غير متحقق');
    if(sharia==='CONFLICT_REVIEW')reasons.push('التصنيف الشرعي يحتاج مراجعة');
    if(!reasons.length)return;
    const gate=document.createElement('div');gate.className='promotion-gate';gate.textContent=`غير جاهزة للترقية: ${reasons.join(' · ')}`;
    const why=card.querySelector('.why');(why||card).insertAdjacentElement(why?'afterend':'beforeend',gate);
  });
}
function updateMarketTruth(){
  const notice=$('.notice');if(!notice)return;
  const title=notice.querySelector('b'),detail=notice.querySelector('div > span:last-child'),feeds=parseFeedHealth(),m=marketMeta;
  let quality='review',headline='جارٍ التحقق من حالة السوق الفعلية',copy='نجاح الاتصال بالمصادر لا يعني أن أسعار السوق طازجة.';
  if(feeds.total&&feeds.ok===0){quality='blocked';headline='تعذر الوصول إلى مصادر السوق';copy='لا تُعرض الحالات الحالية كفرص تنفيذية حتى عودة مصادر البيانات.';}
  else if(!m){quality='review';headline='المصادر متصلة — لم يكتمل التحقق من توقيت السوق';copy=`المصادر المتاحة ${feeds.ok}/${feeds.total||'—'}، لكن لم يتم التحقق بعد من freshness الفعلي للأسعار.`;}
  else if(m.session==='closed'){
    quality='review';headline='السوق مغلق — المعروض هو آخر جلسة + أحداث وأخبار لاحقة';copy=`آخر تغذية سوقية: ${m.count||m.requested||'—'} سهم، fresh اللحظي = ${m.freshCount}. تستخدم TAGX آخر جلسة للتحليل التحضيري ولا تصفها بأنها بيانات حية.`;
  }else if(m.freshCount<=0){
    quality='blocked';headline='السوق مفتوح لكن لا توجد أسعار حية موثوقة';copy=`التغطية ${m.count||m.requested||'—'} سهم لكن freshCount=0. أوقفت الأداة أي ادعاء بوجود بيانات حية.`;
  }else{
    quality='live';headline='السوق مفتوح وتوجد أسعار حية موثقة';copy=`${m.freshCount} سعرًا حيًا من ${m.count||m.requested||'—'} ضمن آخر تغذية. تبقى كل حالة مشروطة بالمحفز والسيولة والتصنيف الشرعي.`;
  }
  notice.dataset.quality=quality;if(title)title.textContent=headline;if(detail)detail.textContent=copy;addPromotionGates();
}
async function refreshTruth(){await loadMarketMeta();updateMarketTruth();}
function scheduleTruthChecks(){refreshTruth();[500,1500,3000].forEach(ms=>setTimeout(updateMarketTruth,ms));}
window.addEventListener('DOMContentLoaded',scheduleTruthChecks,{once:true});window.addEventListener('load',scheduleTruthChecks,{once:true});
$('#refreshBtn')?.addEventListener('click',()=>setTimeout(refreshTruth,250));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTruth();});
})();