(()=>{
'use strict';
const E=window.TAGX3Engine;
if(!E||typeof E.analyze!=='function'||window.__TAGX3_SESSION_FINAL_POLICY__)return;
window.__TAGX3_SESSION_FINAL_POLICY__=true;
const baseAnalyze=E.analyze.bind(E);
const ageHours=ts=>{const t=new Date(ts||0).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()-t)/3600000):Infinity};
const completenessScore=raw=>{
  let score=100;
  const price=Number(raw?.price??raw?.last??raw?.regularMarketPrice??raw?.currentPrice??raw?.close)||0;
  const volume=Number(raw?.volume??raw?.regularMarketVolume??raw?.dayVolume)||0;
  const avg=Number(raw?.avgVolume??raw?.averageVolume??raw?.averageDailyVolume10Day??raw?.avgVol)||0;
  const flt=Number(raw?.floatShares??raw?.float??raw?.sharesFloat)||0;
  if(!price)score-=45;
  if(!volume)score-=18;
  if(!avg)score-=8;
  if(!flt)score-=8;
  return Math.max(0,Math.min(100,score));
};
function rawDiscoveryOnly(raw){return raw?.discoveryOnly===true||raw?.liveBacked===false||raw?.marketObservation===false}
function withProvenanceContext(raw,context={}){
  if(!rawDiscoveryOnly(raw))return context;
  return {...context,sourceMeta:{...(context.sourceMeta||{}),discoveryOnly:true}};
}
function isClosedDiscoverySnapshot(raw){return raw?.marketClockSession==='closed'&&rawDiscoveryOnly(raw)}
function isSessionFinal(raw){
  if(isClosedDiscoverySnapshot(raw))return false;
  if(raw?.marketClockSession!=='closed'&&!raw?.sessionFinal)return false;
  const ts=raw?.observedAt||raw?.timestamp||raw?.updatedAt||raw?.quoteTime||raw?.timestampET;
  const age=ageHours(ts);
  return Number.isFinite(age)&&age>=0&&age<=96;
}
E.analyze=function(raw,context={},previous={}){
  // Trust row-level provenance over container/source labels. Finviz-only rows can
  // travel inside the Live Quotes merged payload, so sourceMeta must not erase
  // discoveryOnly/liveBacked/marketObservation truth during market hours.
  const effectiveContext=withProvenanceContext(raw,context);
  const out=baseAnalyze(raw,effectiveContext,previous);
  if(isClosedDiscoverySnapshot(raw)){
    const current=Number(out.dataConfidence?.score);
    out.dataConfidence={
      ...(out.dataConfidence||{}),
      score:Number.isFinite(current)?Math.min(current,40):40,
      label:'LOW',
      fresh:false,
      sessionFinal:false,
      usable:false,
      freshnessClass:'CLOSED_DISCOVERY_SNAPSHOT'
    };
    out.sessionFinal=false;
    out.executable=false;
    out.modelNote='لقطة اكتشاف محدثة أثناء إغلاق السوق وليست ملاحظة سعر سوق جديدة؛ تستخدم للاكتشاف فقط ولا تمنح ثقة freshness أو SESSION FINAL.';
    return out;
  }
  if(!isSessionFinal(raw))return out;
  const score=completenessScore(raw);
  out.dataConfidence={
    ...(out.dataConfidence||{}),
    score,
    label:'SESSION FINAL',
    fresh:false,
    sessionFinal:true,
    usable:true,
    ageMin:Number.isFinite(out.dataConfidence?.ageMin)?out.dataConfidence.ageMin:ageHours(raw?.observedAt||raw?.timestampET)*60,
    freshnessClass:'CLOSED_SESSION_FINAL'
  };
  out.sessionFinal=true;
  out.executable=false;
  out.modelNote='آخر لقطة موثقة من الجلسة السابقة؛ صالحة للتحليل التاريخي/التحضيري وليست سعرًا حيًا أو إشارة تنفيذ لحظي.';
  return out;
};
window.TAGX3SessionFinalPolicy={rawDiscoveryOnly,withProvenanceContext,isClosedDiscoverySnapshot,isSessionFinal};
})();
