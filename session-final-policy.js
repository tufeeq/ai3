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
function isSessionFinal(raw){
  if(raw?.marketClockSession!=='closed'&&!raw?.sessionFinal)return false;
  const ts=raw?.observedAt||raw?.timestamp||raw?.updatedAt||raw?.quoteTime||raw?.timestampET;
  const age=ageHours(ts);
  return Number.isFinite(age)&&age>=0&&age<=96;
}
E.analyze=function(raw,context={},previous={}){
  const out=baseAnalyze(raw,context,previous);
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
})();
