(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3PredictiveRadar=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='tagx3.predictiveRadar.v1';
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
  const finite=v=>Number.isFinite(Number(v));
  const iso=v=>{if(v==null||v==='')return null;const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null};

  function eligibility(c){
    if(!c||!c.symbol||!finite(c.price)||Number(c.price)<=0) return {ok:false,reason:'INVALID_MARKET_DATA'};
    const sh=c.sharia?.status||'UNVERIFIED';
    if(sh==='NON_COMPLIANT') return {ok:false,reason:'SHARIA_NON_COMPLIANT'};
    if(sh==='CONFLICT_REVIEW') return {ok:false,reason:'SHARIA_CONFLICT_REVIEW'};
    const dc=c.dataConfidence||{};
    if(dc.fresh!==true||Number(dc.score||0)<58) return {ok:false,reason:'DATA_NOT_FRESH_ENOUGH'};
    return {ok:true,reason:null};
  }

  function horizonFor(c){
    if(c.catalystClock==='EVENT'||c.lifecycle==='IGNITING'||c.lifecycle==='EXPANDING') return '30M-2H';
    if(c.catalystClock==='T-1D'||c.catalystClock==='T-3D') return 'NEXT_SESSION';
    return 'SESSION';
  }

  function directionFor(c){
    const cont=Number(c.continuationIndex||0), ign=Number(c.ignitionIndex||0), dist=Number(c.distributionRisk||0), move=Number(c.movementIndex||0);
    const up=move*0.30+ign*0.28+cont*0.30+(100-dist)*0.12;
    const down=dist*0.48+Number(c.riskScore||0)*0.27+Math.max(0,-Number(c.changePct||0))*2.5;
    if(down>=68&&down-up>=10) return 'DOWNSIDE_RISK';
    if(up>=58&&up-down>=8) return 'UPSIDE';
    return 'NEUTRAL';
  }

  function scenarioRange(c,direction){
    const move=clamp(c.movementIndex), ign=clamp(c.ignitionIndex), cont=clamp(c.continuationIndex), dist=clamp(c.distributionRisk), risk=clamp(c.riskScore);
    const energy=(move*0.34+ign*0.32+cont*0.24+(100-dist)*0.10)/100;
    const uncertainty=(risk+dist)/200;
    const base=Math.max(1.0,Math.min(12,1.25+energy*7+uncertainty*2.5));
    if(direction==='UPSIDE') return {minPct:+(base*0.45).toFixed(1),maxPct:+base.toFixed(1)};
    if(direction==='DOWNSIDE_RISK') return {minPct:+(-base).toFixed(1),maxPct:+(-base*0.35).toFixed(1)};
    return {minPct:+(-base*0.35).toFixed(1),maxPct:+(base*0.35).toFixed(1)};
  }

  function build(c,generatedAt){
    const gate=eligibility(c), observedAt=iso(c?.observedAt), at=iso(generatedAt)||new Date().toISOString();
    if(!gate.ok) return {symbol:c?.symbol||'',status:'BLOCKED',blockedReason:gate.reason,generatedAt:at,evidenceCutoff:observedAt};
    if(!observedAt) return {symbol:c?.symbol||'',status:'BLOCKED',blockedReason:'MISSING_EVIDENCE_CUTOFF',generatedAt:at,evidenceCutoff:null};
    if(Date.parse(at)<Date.parse(observedAt)) return {symbol:c?.symbol||'',status:'BLOCKED',blockedReason:'PREDICTION_BEFORE_EVIDENCE_CUTOFF',generatedAt:at,evidenceCutoff:observedAt};
    const direction=directionFor(c), range=scenarioRange(c,direction);
    const evidenceScore=Math.round(clamp(Number(c.movementIndex||0)*0.30+Number(c.ignitionIndex||0)*0.24+Number(c.continuationIndex||0)*0.20+(100-Number(c.distributionRisk||0))*0.12+Number(c.dataConfidence?.score||0)*0.14));
    return {
      id:`${c.symbol}:${observedAt}`,
      symbol:c.symbol,status:'EXPERIMENTAL',calibration:'UNCALIBRATED',probability:null,
      direction,horizon:horizonFor(c),expectedMoveRangePct:range,evidenceScore,
      generatedAt:at,evidenceCutoff:observedAt,priceAtPrediction:Number(c.price),
      lifecycle:c.lifecycle,stage:c.stage,shariaStatus:c.sharia?.status||'UNVERIFIED',
      catalysts:{type:c.catalystType||null,clock:c.catalystClock||null,at:c.catalystAt||null},
      evidence:(c.whyNow||[]).slice(0,5),
      invalidation:c.invalidation||'انهيار السيولة أو تغير البنية التي صنعت السيناريو',
      note:'سيناريو تجريبي غير معاير؛ probability تبقى null حتى تتوافر أدلة متعددة الجلسات.'
    };
  }

  function rank(rows){
    return [...(rows||[])].filter(x=>x.status==='EXPERIMENTAL').sort((a,b)=>b.evidenceScore-a.evidenceScore);
  }

  function persist(predictions,storage){
    if(!storage) return predictions;
    let old=[];try{old=JSON.parse(storage.getItem(KEY)||'[]')||[]}catch{}
    const by=new Map(old.map(x=>[x.id,x]));
    for(const p of predictions||[]) if(p.id&&!by.has(p.id)) by.set(p.id,p);
    const saved=[...by.values()].slice(-3000);storage.setItem(KEY,JSON.stringify(saved));return saved;
  }

  async function bootBrowser(){
    if(typeof window==='undefined'||!window.TAGX3Engine||!window.TAGX3Sharia) return;
    const host=document.getElementById('predictiveRadar');if(!host)return;
    const E=window.TAGX3Engine,S=window.TAGX3Sharia;
    const feeds=[
      ['Live Quotes','/ai/tag/data/live-quotes.json','quotes'],['Sentinel','/ai/tag/data/tagx2-sentinel.json','quotes'],['Coverage Rescue','/ai/tag/data/coverage-rescue.json','quotes'],
      ['SEC Catalysts','/ai/tag/data/sec-catalysts.json','catalyst'],['Sharia Production','/ai/tag/data/sharia.json','sharia'],['Sharia Challenger','/ai/tag/data/sharia-v4-challenger.json','sharia']
    ];
    const rowsOf=p=>{if(Array.isArray(p))return p;for(const k of ['data','quotes','results','stocks','items','candidates','opportunities','rows'])if(Array.isArray(p?.[k]))return p[k];return[]};
    const sym=x=>String(x?.symbol||x?.ticker||x?.code||'').toUpperCase().trim();
    const results=await Promise.all(feeds.map(async([name,url,kind])=>{try{const r=await fetch(`${url}?pr=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));return{name,kind,ok:true,data:await r.json()}}catch(error){return{name,kind,ok:false,error:String(error)}}}));
    const cats=new Map();const cf=results.find(x=>x.ok&&x.kind==='catalyst');
    for(const r of rowsOf(cf?.data||[])){const s=sym(r);if(!s)continue;const type=r.type||r.catalystType||r.form||r.eventType||'SEC/Event',eventAt=r.eventAt||r.catalystAt||r.acceptedAt||r.filedAt||r.timestamp||null;let days=999;if(eventAt){days=(new Date(eventAt).getTime()-Date.now())/86400000;if(days<0&&days>-2)days=0}cats.set(s,{catalystType:type,catalystAt:eventAt,catalystScore:Number(r.score||r.materialityScore||r.catalystScore||0)||(type?45:0),daysToCatalyst:days,catalystObservedAt:r.observedAt||r.updatedAt||eventAt})}
    const by=new Map();for(const f of results.filter(x=>x.ok&&x.kind==='quotes'))for(const raw of rowsOf(f.data)){const s=sym(raw);if(!s)continue;const q={...raw,symbol:s,source:f.name,observedAt:raw.observedAt||raw.updatedAt||raw.timestamp||f.data?.updatedAt};const old=by.get(s);if(!old||new Date(q.observedAt)>=new Date(old.observedAt))by.set(s,q)}
    let cases=[...by.values()].map(raw=>E.analyze(raw,{...(cats.get(raw.symbol)||{}),source:raw.source,sourceMeta:{discoveryOnly:raw.source!=='Live Quotes'},formerRunnerScore:Number(raw.formerRunnerScore||raw.formerRunner||0),sectorLeadLagScore:Number(raw.sectorLeadLagScore||raw.sympathyScore||0)},{}));
    const maps=results.filter(x=>x.ok&&x.kind==='sharia').map(x=>S.indexPayload(x.data,x.name));cases=S.attach(cases,maps,{});
    const built=rank(cases.map(c=>build(c)));persist(built,window.localStorage);
    const esc=s=>String(s??'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]||ch));
    if(!built.length){host.innerHTML='<div class="predictive-empty">لا توجد تنبؤات مؤهلة الآن: الأداة تفشل مغلقاً عند ضعف الحداثة أو التعارض الشرعي.</div>';return}
    host.innerHTML=built.slice(0,12).map(p=>`<article class="predictive-card"><div><b>${esc(p.symbol)}</b><span>${esc(p.direction)} · ${esc(p.horizon)}</span></div><strong>${p.expectedMoveRangePct.minPct}% → ${p.expectedMoveRangePct.maxPct}%</strong><small>Evidence ${p.evidenceScore}/100 · UNCALIBRATED · Probability: —</small><p>${esc((p.evidence||[]).slice(0,2).join(' · ')||'أدلة محدودة')}</p></article>`).join('');
  }

  if(typeof window!=='undefined') window.addEventListener('DOMContentLoaded',()=>bootBrowser().catch(()=>{}));
  return {KEY,eligibility,horizonFor,directionFor,scenarioRange,build,rank,persist,bootBrowser};
});
