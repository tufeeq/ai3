(()=>{
'use strict';
const E=window.TAGX3Engine,S=window.TAGX3Sharia,T=window.TAGX3Trades;
const CASE_KEY='tagx3.opportunityCases.v1';
const SETTINGS_KEY='tagx3.settings.v1';
const state={cases:[],feeds:[],alerts:[],activeTab:'building',filter:'',hideNonCompliant:true,loading:false,lastRefresh:null};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(v,d=2)=>Number.isFinite(+v)?(+v).toFixed(d):'—';
const pct=v=>Number.isFinite(+v)?`${+v>=0?'+':''}${(+v).toFixed(2)}%`:'—';
const ago=iso=>{if(!iso)return'—';const m=Math.max(0,(Date.now()-new Date(iso).getTime())/60000);return m<60?`${Math.round(m)}د`:m<1440?`${(m/60).toFixed(1)}س`:`${(m/1440).toFixed(1)}ي`;};
const safeParse=(s,f)=>{try{return JSON.parse(s)||f}catch{return f}};
const loadPrev=()=>new Map((safeParse(localStorage.getItem(CASE_KEY),[])||[]).map(x=>[x.symbol,x]));
const saveCases=rows=>localStorage.setItem(CASE_KEY,JSON.stringify(rows.map(c=>({symbol:c.symbol,firstSeen:c.firstSeen,lastObserved:c.lastObserved,lifecycle:c.lifecycle,movementIndex:c.movementIndex,ignitionIndex:c.ignitionIndex,continuationIndex:c.continuationIndex,distributionRisk:c.distributionRisk,riskScore:c.riskScore,price:c.price,sharia:c.sharia?.status||'UNVERIFIED'}))));

const FEEDS=[
 {name:'Live Quotes',url:'/ai/tag/data/live-quotes.json',core:true,kind:'quotes'},
 {name:'Sentinel',url:'/ai/tag/data/tagx2-sentinel.json',core:false,kind:'quotes'},
 {name:'Coverage Rescue',url:'/ai/tag/data/coverage-rescue.json',core:false,kind:'quotes'},
 {name:'SEC Catalysts',url:'/ai/tag/data/sec-catalysts.json',core:false,kind:'catalyst'},
 {name:'Sharia Production',url:'/ai/tag/data/sharia.json',core:false,kind:'sharia'},
 {name:'Sharia Challenger',url:'/ai/tag/data/sharia-v4-challenger.json',core:false,kind:'sharia'},
 {name:'Top20 Audit',url:'/ai/tag/data/tagx2-top20-audit.json',core:false,kind:'audit'}
];

async function fetchJson(feed){
 const started=performance.now();
 try{const r=await fetch(`${feed.url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();return{...feed,ok:true,data,ms:Math.round(performance.now()-started)};}
 catch(error){return{...feed,ok:false,error:String(error?.message||error),ms:Math.round(performance.now()-started)};}
}
function rowsOf(p){if(Array.isArray(p))return p;for(const k of ['data','quotes','results','stocks','items','candidates','opportunities','rows'])if(Array.isArray(p?.[k]))return p[k];return[];}
function symbolOf(x){return String(x?.symbol||x?.ticker||x?.code||'').toUpperCase().trim();}
function catalystMap(payload){const map=new Map();for(const r of rowsOf(payload)){const s=symbolOf(r);if(!s)continue;const type=r.type||r.catalystType||r.form||r.eventType||'SEC/Event';const at=r.eventAt||r.catalystAt||r.acceptedAt||r.filedAt||r.timestamp||null;let days=999;if(at){days=(new Date(at).getTime()-Date.now())/86400000;if(days<0&&days>-2)days=0;}const score=Number(r.score||r.materialityScore||r.catalystScore||0)||(type?45:0);map.set(s,{catalystType:type,catalystAt:at,catalystScore:E.clamp(score),daysToCatalyst:days,catalystObservedAt:r.observedAt||r.updatedAt||at});}return map;}
function shariaMaps(feedResults){return feedResults.filter(f=>f.ok&&f.kind==='sharia').map(f=>S.indexPayload(f.data,f.name));}
function enrichFromLegacy(raw){
 const x=raw||{};return{
  velocity5m:x.velocity5m??x.v5??x.change5m??x.velocity?.m5,
  velocity15m:x.velocity15m??x.v15??x.change15m??x.velocity?.m15,
  tradesPerMin:x.tradesPerMin??x.tpm,
  floatShares:x.floatShares??x.float??x.sharesFloat,
  avgVolume:x.avgVolume??x.averageVolume??x.avgVol,
  preMarketChangePct:x.preMarketChangePct??x.preMarketChangePercent,
  afterHoursChangePct:x.afterHoursChangePct??x.postMarketChangePercent,
  ...x
 };
}
function dedupeQuotes(results){
 const by=new Map();
 for(const f of results.filter(x=>x.ok&&x.kind==='quotes')){
  for(const raw0 of rowsOf(f.data)){
   const raw=enrichFromLegacy(raw0),s=symbolOf(raw);if(!s)continue;
   raw.symbol=s; raw.source=f.name;
   const ts=raw.observedAt||raw.updatedAt||raw.timestamp||f.data?.updatedAt||new Date().toISOString();raw.observedAt=ts;
   const old=by.get(s); if(!old||new Date(ts)>=new Date(old.observedAt))by.set(s,raw);
  }
 }
 return [...by.values()];
}
function contextFor(symbol,catalysts,raw){
 const c=catalysts.get(symbol)||{};
 return {...c,source:raw.source||'legacy-bridge',sourceMeta:{discoveryOnly:raw.source!=='Live Quotes'},formerRunnerScore:Number(raw.formerRunnerScore||raw.formerRunner||0),sectorLeadLagScore:Number(raw.sectorLeadLagScore||raw.sympathyScore||0)};
}
async function refresh(){
 if(state.loading)return;state.loading=true;renderStatus();
 const results=await Promise.all(FEEDS.map(fetchJson));state.feeds=results;
 const quotes=dedupeQuotes(results),prev=loadPrev();
 const catFeed=results.find(x=>x.ok&&x.kind==='catalyst');const cats=catalystMap(catFeed?.data||[]);
 let cases=quotes.map(raw=>E.analyze(raw,contextFor(symbolOf(raw),cats,raw),prev.get(symbolOf(raw))||{}));
 cases=S.attach(cases,shariaMaps(results),{});
 cases=E.rank(cases);
 state.cases=cases;saveCases(cases);state.lastRefresh=new Date().toISOString();state.loading=false;
 const tradeResult=T.updateAll(new Map(cases.map(c=>[c.symbol,c])));state.alerts=tradeResult.alerts;
 render();
}
function shariaClass(s){return{'VERIFIED':'ok','LIKELY_COMPLIANT':'likely','CONFLICT_REVIEW':'warn','UNVERIFIED':'muted','NON_COMPLIANT':'bad'}[s]||'muted';}
function lifecycleClass(s){return{'ARMED':'armed','IGNITING':'ignite','EXPANDING':'expand','ACCUMULATING':'acc','DISTRIBUTING':'dist'}[s]||'watch';}
function bucket(c){if(c.lifecycle==='DISTRIBUTING'||c.lifecycle==='CLOSED'||c.stage==='EXHAUSTION_RISK')return'exit';if(c.lifecycle==='IGNITING'||c.lifecycle==='EXPANDING')return'igniting';if(c.catalystAt||c.rawFeatures?.catalyst>=40)return'catalyst';return'building';}
function filtered(){return state.cases.filter(c=>(!state.hideNonCompliant||c.sharia?.status!=='NON_COMPLIANT')&&(!state.filter||c.symbol.includes(state.filter))).filter(c=>bucket(c)===state.activeTab);}
function card(c){
 const stale=!c.dataConfidence?.fresh; const sh=c.sharia||{status:'UNVERIFIED',reason:''};
 return `<article class="opp-card ${lifecycleClass(c.lifecycle)}">
  <div class="card-head"><div><div class="ticker">${esc(c.symbol)}</div><div class="mini">منذ ${ago(c.firstSeen)} · ${esc(c.stage)}</div></div><div class="price"><b>$${fmt(c.price,4)}</b><span class="${c.changePct>=0?'up':'down'}">${pct(c.changePct)}</span></div></div>
  <div class="badges"><span class="badge state">${esc(c.lifecycle)}</span><span class="badge sharia ${shariaClass(sh.status)}">${esc(sh.status)}</span><span class="badge ${stale?'bad':'ok'}">DATA ${esc(c.dataConfidence?.label||'LOW')}</span>${c.unknownCatalyst?'<span class="badge warn">UNKNOWN CATALYST</span>':''}</div>
  <div class="meters">
   ${meter('Movement',c.movementIndex)}${meter('Ignition',c.ignitionIndex)}${meter('Continuation',c.continuationIndex)}${meter('Distribution',c.distributionRisk,true)}
  </div>
  <div class="why"><b>لماذا الآن:</b> ${esc((c.whyNow||[]).join(' · '))}</div>
  <div class="details"><span>RVOL ${fmt(c.rawFeatures?.relVolume,2)}×</span><span>Float turnover ${fmt((c.rawFeatures?.floatTurnover||0)*100,1)}%</span><span>Risk ${c.riskScore}/100</span><span>${c.catalystClock||'NO CLOCK'}</span></div>
  <div class="sharia-note"><b>التحليل الشرعي:</b> ${esc(sh.reason||'غير متحقق')} ${sh.evidence?.length?`· مصادر: ${sh.evidence.length}`:''}</div>
  <div class="invalidation"><b>إبطال الفرضية:</b> ${esc(c.invalidation)}</div>
  <div class="actions"><button class="primary" data-add="${esc(c.symbol)}">أضف لمتابعتي بسعر الدخول</button><button data-detail="${esc(c.symbol)}">تفاصيل الإشارة</button></div>
 </article>`;
}
function meter(label,v,risk=false){return `<div class="meter"><div><span>${label}</span><b>${Math.round(v||0)}</b></div><progress max="100" value="${Math.round(v||0)}" class="${risk?'risk':''}"></progress></div>`;}
function renderStatus(){const el=$('#status');if(!el)return;const ok=state.feeds.filter(x=>x.ok).length;el.innerHTML=state.loading?'<span class="pulse">جارٍ تحديث المحركات…</span>':`<span>${ok}/${FEEDS.length} feeds</span><span>آخر تحديث ${state.lastRefresh?ago(state.lastRefresh):'—'}</span>`;}
function renderTabs(){document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.activeTab);const n=state.cases.filter(c=>bucket(c)===b.dataset.tab&&(!state.hideNonCompliant||c.sharia?.status!=='NON_COMPLIANT')).length;b.querySelector('em').textContent=n;});}
function renderCards(){const rows=filtered(),el=$('#opportunities');el.innerHTML=rows.length?rows.slice(0,80).map(card).join(''):`<div class="empty">لا توجد حالات في هذا المسار وفق البيانات الحالية. هذا ليس حكمًا بأن السوق بلا فرص؛ قد تكون التغذية ناقصة أو الحالات في مسار آخر.</div>`;}
function renderFeeds(){const el=$('#feedGrid');el.innerHTML=state.feeds.map(f=>`<div class="feed ${f.ok?'good':'fail'}"><b>${esc(f.name)}</b><span>${f.ok?`OK · ${f.ms}ms`:`FAIL · ${esc(f.error)}`}</span></div>`).join('');}
function renderTrades(){
 const trades=T.read(),cases=new Map(state.cases.map(c=>[c.symbol,c]));const el=$('#trades');
 el.innerHTML=trades.length?trades.map(t=>{const c=cases.get(t.symbol),p=c?((c.price-t.entryPrice)/t.entryPrice*100):t.pnlPct;return `<div class="trade-row"><div><b>${esc(t.symbol)}</b><span>دخول $${fmt(t.entryPrice,4)} · ${esc(t.status)}</span></div><div><b class="${p>=0?'up':'down'}">${pct(p)}</b><span>MFE ${pct(t.mfePct)} · MAE ${pct(t.maePct)}</span></div><div><span>${c?esc(c.lifecycle):'لا توجد قراءة حالية'}</span><span>Dist ${c?c.distributionRisk:'—'} · Cont ${c?c.continuationIndex:'—'}</span></div><div class="trade-actions">${t.status==='OPEN'?`<button data-close="${t.id}">إغلاق</button>`:''}<button data-remove="${t.id}">حذف</button></div></div>`}).join(''):'<div class="empty">لم تضف أي صفقة. اختر فرصة وسجل سعر دخولك الفعلي.</div>';
}
function renderAlerts(){const alerts=[...state.alerts,...T.readAlerts()].filter((a,i,x)=>x.findIndex(b=>b.id===a.id)===i).slice(0,20),el=$('#alerts');el.innerHTML=alerts.length?alerts.map(a=>`<div class="alert ${a.severity.toLowerCase()}"><b>${esc(a.symbol)} · ${esc(a.type)}</b><span>${esc(a.message)}</span><small>${ago(a.createdAt)}</small></div>`).join(''):'<div class="empty">لا توجد تنبيهات جديدة.</div>';}
function renderSummary(){
 const valid=state.cases.filter(c=>c.sharia?.status!=='NON_COMPLIANT');
 const metrics={armed:valid.filter(c=>c.lifecycle==='ARMED').length,igniting:valid.filter(c=>['IGNITING','EXPANDING'].includes(c.lifecycle)).length,building:valid.filter(c=>c.lifecycle==='ACCUMULATING').length,dist:valid.filter(c=>c.lifecycle==='DISTRIBUTING').length};
 $('#summary').innerHTML=`<div><b>${metrics.armed}</b><span>ARMED</span></div><div><b>${metrics.igniting}</b><span>IGNITING</span></div><div><b>${metrics.building}</b><span>ACCUMULATING</span></div><div><b>${metrics.dist}</b><span>DISTRIBUTING</span></div>`;
}
function render(){renderStatus();renderSummary();renderTabs();renderCards();renderFeeds();renderTrades();renderAlerts();}
function openTradeDialog(symbol){const c=state.cases.find(x=>x.symbol===symbol);if(!c)return;const d=$('#tradeDialog');$('#tradeSymbol').value=symbol;$('#entryPrice').value=c.price||'';$('#personalStop').value='';$('#quantity').value='';$('#tradeContext').textContent=`${c.lifecycle} · Movement ${c.movementIndex} · Ignition ${c.ignitionIndex} · Sharia ${c.sharia?.status||'UNVERIFIED'}`;d.showModal();}
function showDetail(symbol){const c=state.cases.find(x=>x.symbol===symbol);if(!c)return;const d=$('#detailDialog');$('#detailTitle').textContent=`${c.symbol} · ${c.lifecycle}`;$('#detailBody').innerHTML=`<pre>${esc(JSON.stringify({firstSeen:c.firstSeen,lastObserved:c.lastObserved,stage:c.stage,indices:{movement:c.movementIndex,ignition:c.ignitionIndex,continuation:c.continuationIndex,distribution:c.distributionRisk,risk:c.riskScore},catalyst:{clock:c.catalystClock,type:c.catalystType,at:c.catalystAt},sharia:c.sharia,featureMemory:E.decayFeatureBook(c.features),trace:c.trace},null,2))}</pre>`;d.showModal();}

document.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]');if(add)openTradeDialog(add.dataset.add);
 const det=e.target.closest('[data-detail]');if(det)showDetail(det.dataset.detail);
 const tab=e.target.closest('[data-tab]');if(tab){state.activeTab=tab.dataset.tab;renderTabs();renderCards();}
 const close=e.target.closest('[data-close]');if(close){const t=T.read().find(x=>x.id===close.dataset.close);const c=state.cases.find(x=>x.symbol===t?.symbol);const raw=prompt('سعر الخروج الفعلي',c?.price||t?.lastPrice||'');if(raw)try{T.closeTrade(close.dataset.close,Number(raw));renderTrades();}catch(err){alert(err.message)}}
 const rem=e.target.closest('[data-remove]');if(rem&&confirm('حذف الصفقة من القائمة؟')){T.removeTrade(rem.dataset.remove);renderTrades();}
});
$('#refreshBtn').addEventListener('click',refresh);
$('#search').addEventListener('input',e=>{state.filter=e.target.value.toUpperCase().trim();renderCards();});
$('#hideNonCompliant').addEventListener('change',e=>{state.hideNonCompliant=e.target.checked;localStorage.setItem(SETTINGS_KEY,JSON.stringify({hideNonCompliant:state.hideNonCompliant}));render();});
$('#clearAlerts').addEventListener('click',()=>{T.clearAlerts();state.alerts=[];renderAlerts();});
$('#tradeForm').addEventListener('submit',e=>{e.preventDefault();const symbol=$('#tradeSymbol').value,c=state.cases.find(x=>x.symbol===symbol);try{T.addTrade({symbol,entryPrice:Number($('#entryPrice').value),quantity:Number($('#quantity').value)||null,personalStop:Number($('#personalStop').value)||null,notes:$('#tradeNotes').value},c);$('#tradeDialog').close();renderTrades();}catch(err){$('#tradeError').textContent=err.message;}});
$('#cancelTrade').addEventListener('click',()=>$('#tradeDialog').close());
$('#closeDetail').addEventListener('click',()=>$('#detailDialog').close());
const settings=safeParse(localStorage.getItem(SETTINGS_KEY),{});if(typeof settings.hideNonCompliant==='boolean')state.hideNonCompliant=settings.hideNonCompliant;$('#hideNonCompliant').checked=state.hideNonCompliant;
refresh();setInterval(refresh,120000);
})();