(()=>{
'use strict';
const INTEL='/data/intelligence.json',LIVE='/ai/tag/data/live-quotes.json';
let intel=null,live=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function json(url){try{const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
function injectStyle(){if(document.getElementById('evidence-intelligence-style'))return;const s=document.createElement('style');s.id='evidence-intelligence-style';s.textContent=`.evidence-news{margin-top:7px;padding:7px 8px;border:1px solid rgba(47,128,255,.2);border-radius:8px;background:rgba(47,128,255,.06);font-size:9px;line-height:1.5;color:#8da5c2}.evidence-news b{color:#cfe1f7}.evidence-pending-wrap{margin-top:10px;padding:10px;border:1px dashed var(--line2);border-radius:12px}.evidence-pending-wrap>summary{cursor:pointer;font-size:11px;font-weight:800;color:var(--muted)}.evidence-pending{display:grid;gap:7px;margin-top:8px}.evidence-pending .opp-card{opacity:.78}.badge.evidence{color:#8fc3ff;background:rgba(47,128,255,.12)}.badge.session-final{color:#8ea2ba;background:#edf2f7}.evidence-ready-count{font-size:9px;color:var(--muted);margin-top:3px}`;document.head.appendChild(s)}
function rowsMap(){const q=live?.quotes;return q&&typeof q==='object'&&!Array.isArray(q)?q:{}}
function eventsFor(symbol){const direct=intel?.bySymbol?.[symbol]?.events;if(Array.isArray(direct))return direct;return Array.isArray(intel?.events)?intel.events.filter(e=>String(e?.symbol||'').toUpperCase()===symbol):[]}
function marketClosed(){return live?.marketClockSession==='closed'}
function isClosedSessionQuote(symbol){if(!marketClosed())return false;const q=rowsMap()[symbol];if(!q)return true;const t=new Date(q.timestampET||q.observedAt||0).getTime();const age=(Date.now()-t)/3600000;return Number.isFinite(age)&&age>=0&&age<=96}
function decorateCard(card){
  const symbol=card.querySelector('.ticker')?.textContent?.trim()?.toUpperCase();if(!symbol)return false;
  const badges=card.querySelector('.badges');const badgeList=[...card.querySelectorAll('.badges .badge')];
  const lifecycle=badgeList[0]?.textContent?.trim()||'';const sharia=badgeList[1]?.textContent?.trim()||'';const dataBadge=badgeList.at(-1);
  if(dataBadge&&isClosedSessionQuote(symbol)&&['LOW','MEDIUM','HIGH'].includes(dataBadge.textContent.trim())){
    dataBadge.textContent='SESSION FINAL';dataBadge.classList.remove('bad');dataBadge.classList.add('session-final');dataBadge.title='السوق مغلق؛ هذه آخر لقطة جلسة متاحة وليست قراءة لحظية متقادمة.';
  }
  card.querySelector('.evidence-news')?.remove();
  const events=eventsFor(symbol);const recent=events.filter(e=>{const t=new Date(e.publishedAt||0).getTime();return Number.isFinite(t)&&Date.now()-t<=7*86400000}).slice(0,3);
  if(recent.length&&badges){const b=document.createElement('span');b.className='badge evidence';b.textContent=`NEWS ${recent.length}`;badges.appendChild(b);const top=recent[0];const box=document.createElement('div');box.className='evidence-news';box.innerHTML=`<b>${esc(top.type==='SEC'?`SEC ${top.form||''}`:'NEWS DISCOVERY')}</b> · ${esc(top.headline||'')}<br><span>${esc(top.source||top.domain||'source')} · ${esc(top.publishedAt||'')}</span>`;card.querySelector('.why')?.insertAdjacentElement('afterend',box)}
  const dataOk=!dataBadge?.classList.contains('bad');
  const shariaBlocked=sharia==='NON_COMPLIANT';
  const technicalConfirmed=['ACCUMULATING','ARMED','IGNITING','EXPANDING'].includes(lifecycle)&&dataOk;
  const evidenceOk=recent.length>0||technicalConfirmed;
  const ready=dataOk&&!shariaBlocked&&evidenceOk;
  card.dataset.evidenceReady=ready?'1':'0';
  card.dataset.shariaResearchPending=sharia==='UNVERIFIED'?'1':'0';
  return ready;
}
function applyGate(){
  injectStyle();const list=document.getElementById('opportunities');if(!list)return;
  const existing=list.parentElement?.querySelector('.evidence-pending-wrap');existing?.remove();
  const cards=[...list.querySelectorAll('.opp-card')];if(!cards.length)return;
  let ready=0;const pending=[];for(const c of cards){decorateCard(c)?ready++:pending.push(c)}
  const head=list.closest('.opportunity-panel')?.querySelector('.section-head h2');if(head)head.textContent='الفرص مكتملة بيانات السوق';
  let count=list.closest('.opportunity-panel')?.querySelector('.evidence-ready-count');if(!count){count=document.createElement('div');count.className='evidence-ready-count';list.before(count)}count.textContent=`${ready} مكتملة سوقيًا/فنيًا · ${pending.length} قيد الاستكمال`;
  if(pending.length){const d=document.createElement('details');d.className='evidence-pending-wrap';d.innerHTML=`<summary>قيد استكمال بيانات السوق/الدليل (${pending.length}) — ليست فرصًا تنفيذية</summary><div class="evidence-pending"></div>`;list.after(d);const box=d.querySelector('.evidence-pending');pending.forEach(c=>box.appendChild(c));}
  if(!ready&&list.querySelectorAll('.opp-card').length===0)list.insertAdjacentHTML('beforeend','<div class="empty">لا توجد حاليًا فرصة مكتملة بيانات السوق + تأكيد فني/محفز. التصنيف الشرعي غير المتحقق يظهر كحالة بحثية ولا يحجب الفرصة، بينما NON_COMPLIANT فقط هو المستبعد عند تفعيل الفلتر.</div>');
}
async function refreshEvidence(){[live,intel]=await Promise.all([json(LIVE),json(INTEL)]);applyGate();setTimeout(applyGate,900)}
window.addEventListener('DOMContentLoaded',()=>setTimeout(refreshEvidence,350),{once:true});
window.addEventListener('load',()=>setTimeout(refreshEvidence,700),{once:true});
document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(refreshEvidence,900));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTimeout(applyGate,200)));
})();
