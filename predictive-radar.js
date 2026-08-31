(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3PredictiveRadar=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='tagx3.predictiveRadar.v1';
  const CASE_EVENT='tagx:cases';
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

  function buildFromCases(cases,generatedAt){
    return rank((cases||[]).map(c=>build(c,generatedAt)));
  }

  function persist(predictions,storage){
    if(!storage) return predictions;
    let old=[];try{old=JSON.parse(storage.getItem(KEY)||'[]')||[]}catch{}
    const by=new Map(old.map(x=>[x.id,x]));
    for(const p of predictions||[]) if(p.id&&!by.has(p.id)) by.set(p.id,p);
    const saved=[...by.values()].slice(-3000);storage.setItem(KEY,JSON.stringify(saved));return saved;
  }

  function renderInto(host,built){
    if(!host) return;
    const esc=s=>String(s??'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]||ch));
    if(!built.length){host.innerHTML='<div class="predictive-empty">لا توجد تنبؤات مؤهلة الآن: الأداة تفشل مغلقاً عند ضعف الحداثة أو التعارض الشرعي.</div>';return}
    host.innerHTML=built.slice(0,12).map(p=>`<article class="predictive-card"><div><b>${esc(p.symbol)}</b><span>${esc(p.direction)} · ${esc(p.horizon)}</span></div><strong>${p.expectedMoveRangePct.minPct}% → ${p.expectedMoveRangePct.maxPct}%</strong><small>Evidence ${p.evidenceScore}/100 · UNCALIBRATED · Probability: —</small><p>${esc((p.evidence||[]).slice(0,2).join(' · ')||'أدلة محدودة')}</p></article>`).join('');
  }

  function consumeSharedCases(snapshot,host,storage){
    const cases=Array.isArray(snapshot?.cases)?snapshot.cases:[];
    const generatedAt=iso(snapshot?.generatedAt)||new Date().toISOString();
    const built=buildFromCases(cases,generatedAt);
    persist(built,storage);
    renderInto(host,built);
    return built;
  }

  function installSharedCaseBridge(win){
    if(!win?.TAGX3Engine||win.__TAGX3_SHARED_CASE_BRIDGE__) return false;
    const engine=win.TAGX3Engine, original=engine.rank;
    if(typeof original!=='function') return false;
    engine.rank=function sharedRank(rows){
      const ranked=original.call(engine,rows);
      const snapshot={cases:ranked,generatedAt:new Date().toISOString()};
      win.TAGX3LatestCases=snapshot;
      if(typeof win.dispatchEvent==='function'&&typeof win.CustomEvent==='function') win.dispatchEvent(new win.CustomEvent(CASE_EVENT,{detail:snapshot}));
      return ranked;
    };
    win.__TAGX3_SHARED_CASE_BRIDGE__=true;
    return true;
  }

  function bootBrowser(){
    if(typeof window==='undefined') return;
    const host=document.getElementById('predictiveRadar');if(!host)return;
    const consume=snapshot=>consumeSharedCases(snapshot,host,window.localStorage);
    window.addEventListener(CASE_EVENT,e=>consume(e.detail));
    if(window.TAGX3LatestCases) consume(window.TAGX3LatestCases);
  }

  if(typeof window!=='undefined'){
    installSharedCaseBridge(window);
    window.addEventListener('DOMContentLoaded',()=>bootBrowser());
  }
  return {KEY,CASE_EVENT,eligibility,horizonFor,directionFor,scenarioRange,build,rank,buildFromCases,persist,renderInto,consumeSharedCases,installSharedCaseBridge,bootBrowser};
});
