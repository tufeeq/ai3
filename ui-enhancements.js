(()=>{
'use strict';
const THEME_KEY='tagx3.theme.v1';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
function applyTheme(mode){
  const resolved=mode==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):mode;
  document.documentElement.dataset.theme=resolved;
  document.documentElement.dataset.themeMode=mode;
  localStorage.setItem(THEME_KEY,mode);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.content=resolved==='light'?'#f3f6fb':'#070b12';
  document.querySelectorAll('.theme-switch button').forEach(b=>b.classList.toggle('active',b.dataset.theme===mode));
}
function installThemeSwitch(){
  const tools=document.querySelector('.top-tools'); if(!tools||tools.querySelector('.theme-switch'))return;
  const wrap=document.createElement('div'); wrap.className='theme-switch'; wrap.setAttribute('aria-label','اختيار مظهر الواجهة');
  wrap.innerHTML='<button type="button" data-theme="light" title="نهاري">☀︎</button><button type="button" data-theme="dark" title="ليلي">☾</button><button type="button" data-theme="system" title="حسب الجهاز">◐</button>';
  tools.appendChild(wrap);
  wrap.addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(b)applyTheme(b.dataset.theme)});
  applyTheme(localStorage.getItem(THEME_KEY)||'system');
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if((localStorage.getItem(THEME_KEY)||'system')==='system')applyTheme('system')});
}
function metric(label,v,risk=false){const n=clamp(v);return `<div class="detail-metric ${risk?'risk':''}"><span>${esc(label)}</span><b>${Math.round(n)}</b><div class="detail-bar"><i style="width:${n}%"></i></div></div>`}
function row(k,v){return `<div><span>${esc(k)}</span><b>${esc(v??'—')}</b></div>`}
function prettyDetail(raw,title){
  const idx=raw.indices||{},cat=raw.catalyst||{},sh=raw.sharia||{},fm=raw.featureMemory||{};
  const sym=(title||'').split('·')[0].trim();
  const evidence=Array.isArray(sh.evidence)?sh.evidence:[];
  const featureKeys=Object.keys(fm).slice(0,8);
  return `<div class="detail-dashboard">
    <div class="detail-hero"><div><div class="symbol">${esc(sym)}</div><div class="stage">${esc(raw.stage||'—')}</div><div class="detail-badges"><span class="badge state">${esc((title||'').split('·')[1]?.trim()||'—')}</span><span class="badge">First seen ${esc(raw.firstSeen||'—')}</span></div></div><div class="badge ${sh.status==='NON_COMPLIANT'?'bad':sh.status==='VERIFIED'?'ok':sh.status==='CONFLICT_REVIEW'?'warn':'muted'}">${esc(sh.status||'UNVERIFIED')}</div></div>
    <div class="detail-grid">${metric('Movement',idx.movement)}${metric('Ignition',idx.ignition)}${metric('Continuation',idx.continuation)}${metric('Distribution',idx.distribution,true)}${metric('Risk',idx.risk,true)}</div>
    <div class="detail-panels">
      <section class="detail-panel"><h4>CATALYST INTELLIGENCE</h4><div class="detail-evidence">${row('Clock',cat.clock)}${row('Type',cat.type)}${row('At',cat.at)}</div></section>
      <section class="detail-panel"><h4>SHARIAH INTELLIGENCE</h4><p>${esc(sh.reason||'لا توجد أدلة كافية للتحقق الشرعي')}</p><div class="detail-evidence">${row('Status',sh.status||'UNVERIFIED')}${row('Confidence',sh.confidence||'LOW')}${row('Evidence',evidence.length?evidence.length+' sources':'No external evidence')}</div></section>
      <section class="detail-panel"><h4>OBSERVATION</h4><div class="detail-evidence">${row('First Seen',raw.firstSeen)}${row('Last Observed',raw.lastObserved)}${row('Stage',raw.stage)}</div></section>
      <section class="detail-panel"><h4>FEATURE MEMORY</h4><div class="detail-evidence">${featureKeys.length?featureKeys.map(k=>row(k,typeof fm[k]==='object'?(fm[k].value??'active'):fm[k])).join(''):row('Status','No retained features')}</div></section>
    </div>
    <details class="detail-technical"><summary>عرض البيانات التقنية الكاملة JSON</summary><pre>${esc(JSON.stringify(raw,null,2))}</pre></details>
  </div>`;
}
function upgradeDetail(){
  const d=document.querySelector('#detailDialog'); const body=document.querySelector('#detailBody'); const title=document.querySelector('#detailTitle');
  if(!d||!body||!d.open)return;
  const pre=body.querySelector('pre'); if(!pre||body.dataset.enhanced==='1')return;
  try{const raw=JSON.parse(pre.textContent);body.innerHTML=prettyDetail(raw,title?.textContent||'');body.dataset.enhanced='1'}catch(_){/* keep safe raw view */}
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-detail]'))setTimeout(()=>{const b=document.querySelector('#detailBody');if(b)b.dataset.enhanced='0';upgradeDetail()},0);
  if(e.target.closest('#closeDetail')){const b=document.querySelector('#detailBody');if(b)b.dataset.enhanced='0'}
});
new MutationObserver(()=>upgradeDetail()).observe(document.body,{subtree:true,childList:true});
installThemeSwitch();
})();
