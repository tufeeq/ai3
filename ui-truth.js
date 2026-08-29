(()=>{
'use strict';
const $=s=>document.querySelector(s);
const parseFeedHealth=()=>{const text=$('#status')?.textContent||'';const m=text.match(/(\d+)\s*\/\s*(\d+)\s*feeds/i);return m?{ok:Number(m[1]),total:Number(m[2])}:{ok:0,total:0};};
function visibleCaseQuality(){
  const cards=[...document.querySelectorAll('.opp-card')];
  const stale=cards.filter(card=>card.querySelector('.badges .badge:last-child.bad')).length;
  return{cards:cards.length,stale,fresh:Math.max(0,cards.length-stale)};
}
function addPromotionGates(){
  document.querySelectorAll('.opp-card').forEach(card=>{
    card.querySelector('.promotion-gate')?.remove();
    const badges=[...card.querySelectorAll('.badges .badge')];
    const sharia=badges[1]?.textContent?.trim()||'';
    const stale=badges.at(-1)?.classList.contains('bad');
    const reasons=[];
    if(stale)reasons.push('بيانات السعر غير طازجة');
    if(sharia==='UNVERIFIED')reasons.push('التصنيف الشرعي غير متحقق');
    if(sharia==='CONFLICT_REVIEW')reasons.push('التصنيف الشرعي يحتاج مراجعة');
    if(!reasons.length)return;
    const gate=document.createElement('div');
    gate.className='promotion-gate';
    gate.textContent=`غير جاهزة للترقية: ${reasons.join(' · ')}`;
    const why=card.querySelector('.why');
    (why||card).insertAdjacentElement(why?'afterend':'beforeend',gate);
  });
}
function updateMarketTruth(){
  const notice=$('.notice');
  if(!notice)return;
  const title=notice.querySelector('b'),detail=notice.querySelector('div > span:last-child');
  const feeds=parseFeedHealth(),q=visibleCaseQuality();
  let quality='review',headline='الاتصال بالمصادر متاح — صلاحية التنفيذ غير مؤكدة',copy='نجاح الاتصال بالمصدر لا يعني أن الأسعار طازجة أو أن الفرصة مكتملة الأدلة.';
  if(feeds.total&&feeds.ok===0){
    quality='blocked';headline='بيانات السوق غير متاحة للتقييم';copy='تعذر الوصول إلى مصادر البيانات. لا تُعرض الحالات الحالية كفرص تنفيذية.';
  }else if(q.cards===0){
    quality='review';headline='المصادر متصلة — لا توجد حالة قابلة للتقييم في هذا المسار';copy=`المصادر المتاحة ${feeds.ok}/${feeds.total||'—'}، ولا توجد بطاقة ظاهرة تحمل أدلة كافية في المسار الحالي.`;
  }else if(q.fresh===0){
    quality='review';headline='بيانات السوق متصلة — الحالات الظاهرة للمراجعة فقط';copy=`المصادر المتاحة ${feeds.ok}/${feeds.total||'—'}، لكن ${q.cards} من ${q.cards} حالة ظاهرة بلا سعر طازج. لا تعتبرها إشارة تنفيذية.`;
  }else{
    quality='live';headline='توجد أدلة سعر طازجة في الحالات الظاهرة';copy=`${q.fresh} من ${q.cards} حالة ظاهرة تحمل سعرًا طازجًا. تبقى صلاحية كل حالة مشروطة بجودة البيانات والتصنيف الشرعي وأدلة المحفز.`;
  }
  notice.dataset.quality=quality;
  if(title)title.textContent=headline;
  if(detail)detail.textContent=copy;
  addPromotionGates();
}
function scheduleTruthChecks(){[0,450,1200,2600].forEach(ms=>setTimeout(updateMarketTruth,ms));}
window.addEventListener('DOMContentLoaded',scheduleTruthChecks,{once:true});
window.addEventListener('load',scheduleTruthChecks,{once:true});
$('#refreshBtn')?.addEventListener('click',scheduleTruthChecks);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleTruthChecks();});
})();
