(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3ValidationEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ms=v=>{if(v==null||v==='')return null;const t=new Date(v).getTime();return Number.isFinite(t)?t:null};
  const num=v=>Number.isFinite(+v)?+v:null;
  const pct=(a,b)=>a>0&&b>0?((b-a)/a)*100:null;
  const symbolOf=x=>String(x?.symbol||'').toUpperCase().trim();
  const indexObs=s=>new Map((s?.observations||[]).map(o=>[symbolOf(o),o]).filter(([k])=>k));
  const indexSignals=s=>new Map((s?.signals||[]).map(o=>[symbolOf(o),o]).filter(([k])=>k));
  const obsMs=o=>ms(o?.observedAt);

  function futureSnapshots(snapshots,base){
    const bt=ms(base?.capturedAt);if(bt==null)return[];
    return (snapshots||[]).filter(s=>{const t=ms(s?.capturedAt);return t!=null&&t>bt}).sort((a,b)=>ms(a.capturedAt)-ms(b.capturedAt));
  }

  function selectHorizonSnapshot(snapshots,base,horizonMin,toleranceMin=9){
    const bt=ms(base?.capturedAt);if(bt==null)return null;
    const target=bt+horizonMin*60000,max=toleranceMin*60000;
    let best=null,bestErr=Infinity;
    for(const s of futureSnapshots(snapshots,base)){
      const st=ms(s.capturedAt),err=Math.abs(st-target);
      if(err<=max&&err<bestErr){best=s;bestErr=err;}
      if(st>target+max)break;
    }
    return best;
  }

  function observationAdvanced(baseObs,futureObs){
    const b=obsMs(baseObs),f=obsMs(futureObs);
    return b!=null&&f!=null&&f>b;
  }

  function pathStats(snapshots,base,symbol,endAt){
    const bt=ms(base?.capturedAt),et=ms(endAt);if(bt==null||et==null||et<=bt)return{count:0,mfePct:null,maePct:null,peakAt:null,troughAt:null};
    const start=indexObs(base).get(symbol),p0=num(start?.price),baseObsAt=obsMs(start);if(!(p0>0)||baseObsAt==null)return{count:0,mfePct:null,maePct:null,peakAt:null,troughAt:null};
    let mfe=-Infinity,mae=Infinity,peakAt=null,troughAt=null,count=0;
    for(const s of snapshots||[]){
      const t=ms(s?.capturedAt);if(t==null||t<=bt||t>et)continue;
      const o=indexObs(s).get(symbol),p=num(o?.price),ot=obsMs(o);if(!(p>0)||ot==null||ot<=baseObsAt)continue;
      const r=pct(p0,p);count++;if(r>mfe){mfe=r;peakAt=s.capturedAt}if(r<mae){mae=r;troughAt=s.capturedAt}
    }
    return{count,mfePct:Number.isFinite(mfe)?mfe:null,maePct:Number.isFinite(mae)?mae:null,peakAt,troughAt};
  }

  function evaluateBase(base,snapshots,protocol){
    const obs=indexObs(base),signals=indexSignals(base),rows=[];
    const horizons=protocol?.horizonsMin||[15,30,120],tol=protocol?.horizonToleranceMin??9;
    for(const [symbol,o] of obs){
      const sig=signals.get(symbol)||{};
      const lifecycle=sig.lifecycle||'UNSCORED';
      const detected=(protocol?.detectedLifecycles||[]).includes(lifecycle);
      const actionable=(protocol?.actionableLifecycles||[]).includes(lifecycle);
      const shariaEligible=(protocol?.shariaEligible||[]).includes(sig.shariaStatus);
      const outcomes={};
      for(const h of horizons){
        const target=selectHorizonSnapshot(snapshots,base,h,tol);
        if(!target){outcomes[h]={status:'MISSING'};continue;}
        const fo=indexObs(target).get(symbol),p0=num(o.price),p1=num(fo?.price);
        if(!(p0>0&&p1>0)){outcomes[h]={status:'MISSING_SYMBOL',snapshotAt:target.capturedAt};continue;}
        if(!observationAdvanced(o,fo)){
          outcomes[h]={status:'STALE_OBSERVATION',snapshotAt:target.capturedAt,baseObservedAt:o?.observedAt||null,targetObservedAt:fo?.observedAt||null};
          continue;
        }
        const path=pathStats(snapshots,base,symbol,target.capturedAt);
        if(!path.count){outcomes[h]={status:'NO_FRESH_PATH',snapshotAt:target.capturedAt};continue;}
        outcomes[h]={status:'OK',snapshotAt:target.capturedAt,returnPct:pct(p0,p1),mfePct:path.mfePct,maePct:path.maePct,peakAt:path.peakAt,troughAt:path.troughAt};
      }
      rows.push({symbol,lifecycle,detected,actionable,shariaStatus:sig.shariaStatus||'UNVERIFIED',shariaEligible,movementIndex:num(sig.movementIndex),ignitionIndex:num(sig.ignitionIndex),continuationIndex:num(sig.continuationIndex),distributionRisk:num(sig.distributionRisk),riskScore:num(sig.riskScore),basePrice:num(o.price),baseObservedAt:o.observedAt||null,outcomes});
    }
    return rows;
  }

  function metricsForHorizon(rows,h,protocol){
    const valid=rows.filter(r=>r.outcomes?.[h]?.status==='OK');
    const moverThreshold=+protocol.moverThresholdPct;
    const fpMax=+protocol.falsePositiveMaxMfePct;
    const movers=valid.filter(r=>(r.outcomes[h].mfePct??-Infinity)>=moverThreshold);
    const detected=valid.filter(r=>r.detected);
    const actionable=valid.filter(r=>r.actionable);
    const captured=movers.filter(r=>r.detected);
    const missed=movers.filter(r=>!r.detected);
    const falsePos=detected.filter(r=>(r.outcomes[h].mfePct??Infinity)<=fpMax);
    const actionableFalsePos=actionable.filter(r=>(r.outcomes[h].mfePct??Infinity)<=fpMax);
    const avg=(xs,key)=>{const a=xs.map(x=>x.outcomes[h]?.[key]).filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null};
    const excluded=rows.reduce((acc,r)=>{const s=r.outcomes?.[h]?.status;if(s&&s!=='OK')acc[s]=(acc[s]||0)+1;return acc;},{});
    return {horizonMin:+h,validCount:valid.length,moverCount:movers.length,detectedCount:detected.length,actionableCount:actionable.length,earlyCaptureRate:movers.length?captured.length/movers.length:null,missedMoverRate:movers.length?missed.length/movers.length:null,falsePositiveRate:detected.length?falsePos.length/detected.length:null,actionableFalsePositiveRate:actionable.length?actionableFalsePos.length/actionable.length:null,avgDetectedMFE:avg(detected,'mfePct'),avgDetectedMAE:avg(detected,'maePct'),avgActionableMFE:avg(actionable,'mfePct'),avgActionableMAE:avg(actionable,'maePct'),excludedOutcomeCounts:excluded};
  }

  function cadenceDiagnostics(snapshots,protocol={}){
    const times=(snapshots||[]).map(s=>ms(s?.capturedAt)).filter(v=>v!=null).sort((a,b)=>a-b);
    const targetMin=Math.min(...(protocol?.horizonsMin||[15]).map(Number).filter(v=>Number.isFinite(v)&&v>0),15);
    const gaps=[];for(let i=1;i<times.length;i++)gaps.push((times[i]-times[i-1])/60000);
    const sorted=[...gaps].sort((a,b)=>a-b),median=sorted.length?(sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2):null;
    const maxGap=gaps.length?Math.max(...gaps):null;
    const tolerance=Math.max(Number(protocol?.horizonToleranceMin)||0,1);
    const gapLimit=targetMin+tolerance;
    const excessive=gaps.filter(g=>g>gapLimit);
    return{targetIntervalMin:targetMin,toleranceMin:tolerance,gapLimitMin:gapLimit,intervalCount:gaps.length,medianGapMin:median,maxGapMin:maxGap,excessiveGapCount:excessive.length,coverageHealthy:gaps.length>0&&excessive.length===0};
  }

  function diagnosticStatus(horizons,usablePairs){
    if(usablePairs)return'MEASURING';
    const excluded=Object.values(horizons||{}).map(x=>x?.excludedOutcomeCounts||{});
    const stale=excluded.reduce((n,x)=>n+(x.STALE_OBSERVATION||0)+(x.NO_FRESH_PATH||0),0);
    return stale>0?'INSUFFICIENT_FRESH_OBSERVATIONS':'INSUFFICIENT_FUTURE_SNAPSHOTS';
  }

  function buildScorecard(snapshots,protocol){
    const ordered=(snapshots||[]).filter(s=>ms(s?.capturedAt)!=null).sort((a,b)=>ms(a.capturedAt)-ms(b.capturedAt));
    if(!ordered.length)return{schemaVersion:1,kind:'TAGX3_VALIDATION_SCORECARD',status:'NO_SNAPSHOTS',sessions:0,snapshotCount:0,cadence:cadenceDiagnostics([],protocol),horizons:{},rows:[]};
    const baseRows=[];
    for(const base of ordered){const rows=evaluateBase(base,ordered,protocol);for(const r of rows)baseRows.push({baseAt:base.capturedAt,...r});}
    const horizons={};for(const h of protocol.horizonsMin||[])horizons[h]=metricsForHorizon(baseRows,h,protocol);
    const sessionSet=new Set(ordered.map(s=>String(s.capturedAt).slice(0,10)));
    const usablePairs=Object.values(horizons).reduce((n,x)=>n+(x.validCount||0),0);
    return{schemaVersion:1,kind:'TAGX3_VALIDATION_SCORECARD',generatedAt:new Date().toISOString(),protocol:{name:protocol.name,frozenAt:protocol.frozenAt,horizonsMin:protocol.horizonsMin,horizonToleranceMin:protocol.horizonToleranceMin,moverThresholdPct:protocol.moverThresholdPct,falsePositiveMaxMfePct:protocol.falsePositiveMaxMfePct},status:diagnosticStatus(horizons,usablePairs),sessions:sessionSet.size,snapshotCount:ordered.length,cadence:cadenceDiagnostics(ordered,protocol),horizons,rows:baseRows};
  }

  return{selectHorizonSnapshot,observationAdvanced,pathStats,evaluateBase,metricsForHorizon,cadenceDiagnostics,diagnosticStatus,buildScorecard};
});
