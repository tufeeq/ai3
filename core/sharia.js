(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3Sharia=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STATUS={VERIFIED:'VERIFIED',LIKELY:'LIKELY_COMPLIANT',CONFLICT:'CONFLICT_REVIEW',UNVERIFIED:'UNVERIFIED',NON_COMPLIANT:'NON_COMPLIANT'};
  const POSITIVE=new Set(['HALAL','SHARIAH_COMPLIANT','COMPLIANT','PASS','VERIFIED','PERMISSIBLE','YES','TRUE']);
  const NEGATIVE=new Set(['NOT_HALAL','NON_COMPLIANT','NON-COMPLIANT','FAIL','HARAM','EXCLUDED','NO','FALSE']);
  const norm=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,'_');

  function parseSourceRow(raw,source){
    const symbol=String(raw?.symbol||raw?.ticker||raw?.code||'').toUpperCase().trim();
    const candidate=raw?.status??raw?.shariaStatus??raw?.classification??raw?.result??raw?.halal??raw?.isHalal;
    const n=norm(candidate);
    let verdict='UNKNOWN';
    if(POSITIVE.has(n)) verdict='PASS';
    if(NEGATIVE.has(n)) verdict='FAIL';
    return {symbol,source,verdict,rawValue:candidate,observedAt:raw?.updatedAt||raw?.observedAt||raw?.checkedAt||raw?.asOf||null,methodology:raw?.methodology||null,details:raw?.reason||raw?.activityReason||raw?.details||null};
  }

  function rowsFromPayload(payload){
    if(Array.isArray(payload)) return payload;
    for(const key of ['data','results','stocks','items']) if(Array.isArray(payload?.[key])) return payload[key];
    if(Array.isArray(payload?.rows)) return payload.rows;
    if(payload?.rows&&typeof payload.rows==='object') return Object.entries(payload.rows).map(([symbol,row])=>({symbol,...(row||{})}));
    return [];
  }

  function indexPayload(payload,source='external'){
    const rows=rowsFromPayload(payload);
    const map=new Map();
    for(const r of rows){
      const p=parseSourceRow(r,source);
      if(p.symbol) map.set(p.symbol,p);
    }
    return map;
  }

  function classify(symbol,evidence=[],internal={}){
    const rows=(evidence||[]).filter(Boolean);
    const passes=rows.filter(x=>x.verdict==='PASS');
    const fails=rows.filter(x=>x.verdict==='FAIL');
    const activityExcluded=internal.activityExcluded===true;
    const ratiosPass=internal.ratiosPass===true;
    const ratiosFail=internal.ratiosFail===true;
    const parserFailure=internal.parserFailure===true;

    let status=STATUS.UNVERIFIED;
    let confidence='LOW';
    let reason='لا توجد أدلة كافية للتحقق الشرعي.';
    if(activityExcluded||ratiosFail||fails.length>=2){
      status=STATUS.NON_COMPLIANT; confidence='HIGH';
      reason=activityExcluded?'نشاط مستبعد وفق قواعد الفحص.':ratiosFail?'النسب الداخلية فشلت وفق المنهجية المحددة.':'أكثر من مصدر مستقل صنفه غير متوافق.';
    }else if(fails.length&&passes.length){
      status=STATUS.CONFLICT; confidence='MEDIUM'; reason='تعارض بين مصادر الفحص الشرعي؛ يحتاج مراجعة.';
    }else if(ratiosPass&&passes.length){
      status=STATUS.VERIFIED; confidence='HIGH'; reason='اجتاز الفحص الداخلي ويوجد تأييد خارجي.';
    }else if(passes.length>=2){
      status=STATUS.LIKELY; confidence='MEDIUM_HIGH'; reason='مصدران خارجيان على الأقل يشيران إلى التوافق، دون تحقق داخلي كامل.';
    }else if(passes.length===1){
      status=STATUS.LIKELY; confidence='MEDIUM'; reason='مصدر خارجي واحد يشير إلى التوافق؛ التحقق الداخلي غير مكتمل.';
    }else if(fails.length===1){
      status=STATUS.CONFLICT; confidence='MEDIUM'; reason='مصدر واحد يشير إلى عدم التوافق؛ يلزم تحقق إضافي قبل الحكم النهائي.';
    }else if(parserFailure){
      status=STATUS.UNVERIFIED; confidence='LOW'; reason='تعذر إكمال الفحص بسبب مشكلة بيانات/Parser؛ لا يعني عدم الشرعية.';
    }
    return {symbol,status,confidence,reason,evidence:rows,internal:{...internal},blocksDiscovery:false,showInShariaRecommendations:status!==STATUS.NON_COMPLIANT};
  }

  function attach(cases,sourceMaps=[],internalMap={}){
    return (cases||[]).map(c=>{
      const evidence=[];
      for(const m of sourceMaps){ const e=m?.get?.(c.symbol); if(e) evidence.push(e); }
      return {...c,sharia:classify(c.symbol,evidence,internalMap[c.symbol]||{})};
    });
  }

  return {STATUS,parseSourceRow,rowsFromPayload,indexPayload,classify,attach};
});