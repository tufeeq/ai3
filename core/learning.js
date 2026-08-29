(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3Learning=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FAILURES=['COVERAGE_FAILURE','DETECTION_LATENCY','RANKING_FAILURE','FALSE_POSITIVE','TIMING_ERROR','CATALYST_ATTRIBUTION_ERROR','EXHAUSTION_EXIT_FAILURE','DATA_FAILURE','SHARIA_DATA_FAILURE','CONTINUATION_ERROR'];
  function classifyFailure(record){
    if(!record) return 'DATA_FAILURE';
    if(record.missed===true) return record.firstSignalAt?'DETECTION_LATENCY':'COVERAGE_FAILURE';
    if(record.dataConfidence==='LOW') return 'DATA_FAILURE';
    if(record.shariaParserFailed) return 'SHARIA_DATA_FAILURE';
    if(record.detectedEarly&&record.rank>20&&record.outcomeMovePct>=25) return 'RANKING_FAILURE';
    if(record.detectedEarly&&record.outcomeMovePct<5) return 'FALSE_POSITIVE';
    if(record.distributionMissed) return 'EXHAUSTION_EXIT_FAILURE';
    if(record.catalystMismatch) return 'CATALYST_ATTRIBUTION_ERROR';
    if(record.directionCorrect&&record.timingErrorMin>120) return 'TIMING_ERROR';
    if(record.ignited&&!record.continued&&record.expectedContinuation) return 'CONTINUATION_ERROR';
    return null;
  }
  function metrics(rows){
    const x=rows||[]; const n=x.length||1;
    const early=x.filter(r=>r.detectedEarly).length;
    const missed=x.filter(r=>r.missed).length;
    const falsePos=x.filter(r=>r.detectedEarly&&Number(r.outcomeMovePct)<5).length;
    const lead=x.filter(r=>Number.isFinite(+r.leadTimeMin));
    const mfe=x.filter(r=>Number.isFinite(+r.mfePct));
    const mae=x.filter(r=>Number.isFinite(+r.maePct));
    return {count:x.length,earlyCaptureRate:early/n,missedMoverRate:missed/n,falsePositiveRate:falsePos/Math.max(1,early),avgLeadTimeMin:lead.reduce((a,b)=>a+ +b.leadTimeMin,0)/Math.max(1,lead.length),avgMFE:mfe.reduce((a,b)=>a+ +b.mfePct,0)/Math.max(1,mfe.length),avgMAE:mae.reduce((a,b)=>a+ +b.maePct,0)/Math.max(1,mae.length)};
  }
  function replayAt(observations,cutoffIso,analyzer,context={}){
    const cutoff=new Date(cutoffIso).getTime();
    return (observations||[]).filter(o=>new Date(o.observedAt).getTime()<=cutoff).map(o=>analyzer(o,context,{}));
  }
  function hypothesisFromFailures(rows){
    const counts={}; for(const r of rows||[]){const f=classifyFailure(r); if(f) counts[f]=(counts[f]||0)+1;}
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([failure,count])=>({failure,count,status:count>=3?'CHALLENGER_CANDIDATE':'OBSERVE_MORE',rule:'لا تُرقّى أي فرضية بسبب حالة واحدة؛ يلزم Replay متعدد الحالات والجلسات.'}));
  }
  return {FAILURES,classifyFailure,metrics,replayAt,hypothesisFromFailures};
});