(()=>{
'use strict';
const CASE_KEY='tagx3.opportunityCases.v1';
function safeCases(){try{const x=JSON.parse(localStorage.getItem(CASE_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function update(){const panel=document.getElementById('opportunitiesPanel');if(!panel)return;let bar=document.getElementById('universeVisibility');if(!bar){bar=document.createElement('div');bar.id='universeVisibility';bar.style.cssText='font-size:9px;color:var(--muted);padding:7px 9px;margin:0 0 8px;border:1px solid var(--line2);border-radius:9px;background:var(--surface)';panel.querySelector('.section-head')?.insertAdjacentElement('afterend',bar)}const available=Number(window.TAGX3MarketUniverse?.last?.uniqueCount||0),analyzed=safeCases().length,lane=Number(document.querySelector('[data-tab].active em')?.textContent||0),visible=document.querySelectorAll('#opportunities .opp-card').length;bar.textContent=`Universe المتاح ${available||'—'} · محلل/مفهرس ${analyzed||'—'} · في المسار ${lane||0} · المعروض الآن ${visible}${lane>visible?' (واجهة مختصرة؛ البحث يشمل البيانات المحملة)':''}`}
window.addEventListener('DOMContentLoaded',()=>{update();setTimeout(update,700);setTimeout(update,1800)},{once:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-tab],#refreshBtn'))setTimeout(update,350)});document.getElementById('search')?.addEventListener('input',()=>setTimeout(update,50));setInterval(update,5000);
window.TAGX3UniverseVisibility={update};
})();