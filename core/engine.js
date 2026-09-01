(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3Engine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const LIFECYCLE=['DISCOVERED','WATCH','ACCUMULATING','ARMED','IGNITING','EXPANDING','DISTRIBUTING','CLOSED'];
  const HALF_LIFE_MIN={
    velocity5m:8, velocity15m:22, tradesPerMin:10, volumeAcceleration:18,
    floatCapture:75, vwapAcceptance:45, gainRetention:90, extendedHoursPersistence:150,
    accumulation:720, catalyst:4320, formerRunner:20160, sectorLeadLag:360
  };

  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(+v)?+v:min));
  const num=(v,fallback=0)=>Number.isFinite(+v)?+v:fallback;
  const parseTimestamp=v=>{
    if(v==null||v==='') return null;
    const t=new Date(v).getTime();
    return Number.isFinite(t)?new Date(t).toISOString():null;
  };
  const ageMin=(ts,now=Date.now())=>{
    const t=ts?new Date(ts).getTime():NaN;
    return Number.isFinite(t)?Math.max(0,(now-t)/60000):Infinity;
  };
  const decay=(value,minutes,halfLife)=>num(value)*Math.pow(0.5,Math.max(0,minutes)/Math.max(1,halfLife));

  function feature(value, observedAt, halfLifeMin, invalidation, source){
    return {value:num(value),observedAt:parseTimestamp(observedAt),halfLifeMin:halfLifeMin||60,invalidation:invalidation||null,source:source||'derived'};
  }

  function normalizeQuote(raw,source='live'){
    const symbol=String(raw.symbol||raw.ticker||raw.code||'').toUpperCase().trim();
    const price=num(raw.price??raw.last??raw.regularMarketPrice??raw.currentPrice??raw.close);
    const changePct=num(raw.changePct??raw.changePercent??raw.regularMarketChangePercent??raw.pctChange??raw.change);
    const volume=num(raw.volume??raw.regularMarketVolume??raw.dayVolume);
    const avgVolume=num(raw.avgVolume??raw.averageVolume??raw.averageDailyVolume10Day??raw.avgVol);
    const floatShares=num(raw.floatShares??raw.float??raw.sharesFloat);
    const preMarketChangePct=num(raw.preMarketChangePct??raw.preMarketChangePercent);
    const afterHoursChangePct=num(raw.afterHoursChangePct??raw.postMarketChangePercent);
    const observedAt=parseTimestamp(raw.observedAt||raw.timestampET||raw.timestamp||raw.updatedAt||raw.quoteTime);
    const v5=num(raw.velocity5m??raw.v5??raw.change5m);
    const v15=num(raw.velocity15m??raw.v15??raw.change15m);
    const tradesPerMin=num(raw.tradesPerMin??raw.tpm);
    const previousClose=num(raw.previousClose??raw.prevClose);
    return {symbol,price,changePct,volume,avgVolume,floatShares,preMarketChangePct,afterHoursChangePct,observedAt,v5,v15,tradesPerMin,previousClose,source,raw};
  }

  function deriveFeatures(q,context={}){
    const relVolume=q.avgVolume>0?q.volume/q.avgVolume:0;
    const floatTurnover=q.floatShares>0?q.volume/q.floatShares:0;
    const volumeAcceleration=clamp((Math.max(q.v5,0)*5)+(Math.max(q.v15,0)*2)+(Math.max(relVolume-1,0)*16));
    const liquidity=clamp(relVolume*18+floatTurnover*55+Math.max(q.tradesPerMin,0)*0.7);
    const displacement=clamp(Math.abs(q.changePct)*4.6);
    const earlyFit=clamp(100-Math.max(0,q.changePct-7)*6-Math.max(0,q.changePct-18)*3);
    const persistenceBase=Math.max(q.preMarketChangePct,q.afterHoursChangePct,0);
    const extendedHoursPersistence=clamp(persistenceBase*6+(q.preMarketChangePct>0&&q.afterHoursChangePct>0?18:0));
    const compressionExpansion=clamp((Math.max(q.v5-q.v15/3,0)*18)+(relVolume>1.6?22:0)+(q.changePct>1&&q.changePct<10?18:0));
    const accumulation=clamp(liquidity*0.38+volumeAcceleration*0.28+earlyFit*0.24+extendedHoursPersistence*0.10);
    const formerRunner=clamp(context.formerRunnerScore||0);
    const sectorLeadLag=clamp(context.sectorLeadLagScore||0);
    const catalyst=clamp(context.catalystScore||0);
    return {
      relVolume,floatTurnover,
      volumeAcceleration,liquidity,displacement,earlyFit,extendedHoursPersistence,
      compressionExpansion,accumulation,formerRunner,sectorLeadLag,catalyst
    };
  }

  function reactiveEngine(q,f){
    const movement=clamp(f.volumeAcceleration*0.24+f.liquidity*0.25+f.compressionExpansion*0.22+f.extendedHoursPersistence*0.10+f.earlyFit*0.19);
    const ignition=clamp(Math.max(q.v5,0)*10+Math.max(q.v15,0)*3+f.volumeAcceleration*0.22+f.compressionExpansion*0.28+f.floatTurnover*38);
    const noNews=q.changePct>2&&f.catalyst<20;
    return {movement,ignition,noNews,trace:[['volumeAcceleration',f.volumeAcceleration],['liquidity',f.liquidity],['compressionExpansion',f.compressionExpansion],['earlyFit',f.earlyFit]]};
  }

  function anticipatoryEngine(q,f,context={}){
    const days=num(context.daysToCatalyst,999);
    const clock=days<=0?'EVENT':days<=1?'T-1D':days<=3?'T-3D':days<=10?'T-10D':'DISTANT';
    const proximity=days<=0?100:days<=1?90:days<=3?72:days<=10?48:15;
    const movement=clamp(f.catalyst*0.45+proximity*0.25+f.accumulation*0.30);
    const ignition=clamp(proximity*0.33+f.volumeAcceleration*0.27+f.accumulation*0.40);
    return {movement,ignition,clock,eventType:context.catalystType||null,eventAt:context.catalystAt||null,trace:[['catalyst',f.catalyst],['proximity',proximity],['accumulation',f.accumulation]]};
  }

  function patternMemoryEngine(q,f){
    const movement=clamp(f.formerRunner*0.36+f.sectorLeadLag*0.34+f.accumulation*0.30);
    const ignition=clamp(f.formerRunner*0.30+f.sectorLeadLag*0.28+f.compressionExpansion*0.42);
    return {movement,ignition,trace:[['formerRunner',f.formerRunner],['sectorLeadLag',f.sectorLeadLag],['compressionExpansion',f.compressionExpansion]]};
  }

  function distributionRisk(q,f){
    let r=12;
    if(q.changePct>12) r+=14;
    if(q.changePct>25) r+=18;
    if(q.changePct>50) r+=20;
    if(q.v5<0) r+=16;
    if(q.v15<0) r+=10;
    if(f.liquidity>75&&f.displacement>75&&q.v5<=0.2) r+=14;
    if(f.earlyFit<35) r+=12;
    return clamp(r);
  }

  function continuationIndex(q,f,distRisk){
    return clamp(f.accumulation*0.24+f.extendedHoursPersistence*0.17+f.liquidity*0.20+f.compressionExpansion*0.20+Math.max(q.v15,0)*4+19-distRisk*0.28);
  }

  function dataConfidence(q,sourceMeta={}){
    const age=ageMin(q.observedAt);
    let score=100;
    if(!Number.isFinite(age)) score-=100;
    if(!q.price) score-=45;
    if(!q.volume) score-=18;
    if(!q.avgVolume) score-=8;
    if(!q.floatShares) score-=8;
    if(age>6) score-=25;
    if(age>15) score-=35;
    if(sourceMeta.discoveryOnly) score-=20;
    return {score:clamp(score),ageMin:age,label:score>=82?'HIGH':score>=58?'MEDIUM':'LOW',fresh:Number.isFinite(age)&&age<=10};
  }

  function lifecycleFor(indices,previousState='DISCOVERED'){
    const {movement,ignition,continuation,distribution,risk}=indices;
    if(distribution>=70) return 'DISTRIBUTING';
    if(risk>=85&&movement<45) return 'CLOSED';
    if(continuation>=72&&ignition>=68&&movement>=70) return 'EXPANDING';
    if(ignition>=66&&movement>=62) return 'IGNITING';
    if(movement>=73&&ignition>=48&&distribution<50) return 'ARMED';
    if(movement>=58&&distribution<55) return 'ACCUMULATING';
    if(movement>=38) return 'WATCH';
    if(previousState==='ACCUMULATING'&&movement>=32) return 'WATCH';
    return 'DISCOVERED';
  }

  function stageFor(q){
    if(q.changePct>=28) return 'EXHAUSTION_RISK';
    if(q.changePct>=12) return 'LATE';
    if(q.changePct>=7) return 'IGNITION';
    if(q.changePct>=3) return 'PRE_IGNITION';
    if(q.changePct>=1) return 'WAKE_UP';
    return 'DISCOVERY';
  }

  function analyze(raw,context={},previous={}){
    const q=normalizeQuote(raw,context.source||'live');
    const f=deriveFeatures(q,context);
    const reactive=reactiveEngine(q,f);
    const anticipatory=anticipatoryEngine(q,f,context);
    const pattern=patternMemoryEngine(q,f);
    const catalystPresent=f.catalyst>=25||!!context.catalystAt;
    const movement=clamp(reactive.movement*0.52+anticipatory.movement*(catalystPresent?0.28:0.12)+pattern.movement*(catalystPresent?0.20:0.36));
    const ignition=clamp(reactive.ignition*0.50+anticipatory.ignition*(catalystPresent?0.30:0.10)+pattern.ignition*(catalystPresent?0.20:0.40));
    const distribution=distributionRisk(q,f);
    const continuation=continuationIndex(q,f,distribution);
    const risk=clamp(22+distribution*0.48+(reactive.noNews?12:0)+(q.floatShares>0&&q.floatShares<8e6?9:0)+(q.changePct>15?8:0));
    const dc=dataConfidence(q,context.sourceMeta||{});
    const lifecycle=lifecycleFor({movement,ignition,continuation,distribution,risk},previous.lifecycle);
    const firstSeen=previous.firstSeen||context.firstSeen||q.observedAt||null;
    const featureBook={
      velocity5m:feature(q.v5,q.observedAt,HALF_LIFE_MIN.velocity5m,'new 5m observation','market'),
      velocity15m:feature(q.v15,q.observedAt,HALF_LIFE_MIN.velocity15m,'new 15m observation','market'),
      tradesPerMin:feature(q.tradesPerMin,q.observedAt,HALF_LIFE_MIN.tradesPerMin,'new trade-rate observation','market'),
      volumeAcceleration:feature(f.volumeAcceleration,q.observedAt,HALF_LIFE_MIN.volumeAcceleration,'acceleration reversal','derived'),
      floatCapture:feature(f.floatTurnover*100,q.observedAt,HALF_LIFE_MIN.floatCapture,'float turnover normalization','derived'),
      extendedHoursPersistence:feature(f.extendedHoursPersistence,q.observedAt,HALF_LIFE_MIN.extendedHoursPersistence,'extended-hours reversal','derived'),
      accumulation:feature(f.accumulation,q.observedAt,HALF_LIFE_MIN.accumulation,'liquidity collapse / structure failure','derived'),
      catalyst:feature(f.catalyst,context.catalystObservedAt,HALF_LIFE_MIN.catalyst,'event resolved/cancelled','event'),
      formerRunner:feature(f.formerRunner,context.memoryObservedAt,HALF_LIFE_MIN.formerRunner,'memory expiry','memory'),
      sectorLeadLag:feature(f.sectorLeadLag,context.sectorObservedAt,HALF_LIFE_MIN.sectorLeadLag,'sector divergence','memory')
    };
    const why=[];
    if(f.accumulation>=60) why.push('تراكم سيولة');
    if(f.volumeAcceleration>=55) why.push('تسارع حجم التداول');
    if(f.compressionExpansion>=55) why.push('ضغط→تمدد');
    if(f.extendedHoursPersistence>=45) why.push('استمرارية خارج الجلسة');
    if(f.catalyst>=40) why.push('محفز قريب');
    if(f.formerRunner>=45) why.push('ذاكرة Former Runner');
    if(f.sectorLeadLag>=45) why.push('قيادة/تعاطف قطاعي');
    if(reactive.noNews) why.push('حركة بلا محفز معلن');
    if(!why.length) why.push('تحت المراقبة؛ الدليل غير مكتمل');
    return {
      id:q.symbol,symbol:q.symbol,price:q.price,changePct:q.changePct,observedAt:q.observedAt,
      firstSeen,lastObserved:q.observedAt,lifecycle,stage:stageFor(q),
      movementIndex:Math.round(movement),ignitionIndex:Math.round(ignition),continuationIndex:Math.round(continuation),distributionRisk:Math.round(distribution),riskScore:Math.round(risk),
      dataConfidence:dc,features:featureBook,rawFeatures:f,
      catalystClock:anticipatory.clock,catalystType:anticipatory.eventType,catalystAt:anticipatory.eventAt,
      unknownCatalyst:reactive.noNews,
      whyNow:why,
      invalidation:distribution>=70?'ارتفاع مخاطر التصريف/الإجهاد':'انهيار السيولة أو كسر البنية التي صنعت الحالة',
      trace:{reactive,anticipatory,pattern,weights:{reactive:0.52,anticipatory:catalystPresent?0.28:0.12,pattern:catalystPresent?0.20:0.36}},
      executable:false,
      modelNote:'المؤشرات 0-100 هي درجات نموذج تجريبي غير معايرة كاحتمالات إحصائية.'
    };
  }

  function mergeQuoteSources(payloads){
    const by=new Map();
    for(const p of payloads||[]){
      const rows=Array.isArray(p?.data)?p.data:Array.isArray(p?.quotes)?p.quotes:Array.isArray(p?.results)?p.results:Array.isArray(p)?p:[];
      for(const raw of rows){
        const q=normalizeQuote(raw,p?.source||raw?.source||'feed');
        if(!q.symbol||!q.price) continue;
        const old=by.get(q.symbol);
        if(!old){by.set(q.symbol,{raw:q.raw,observedAt:q.observedAt});continue;}
        const nextTs=q.observedAt?Date.parse(q.observedAt):NaN;
        const oldTs=old.observedAt?Date.parse(old.observedAt):NaN;
        if(Number.isFinite(nextTs)&&(!Number.isFinite(oldTs)||nextTs>=oldTs)) by.set(q.symbol,{raw:q.raw,observedAt:q.observedAt});
      }
    }
    return Array.from(by.values(),x=>x.raw);
  }

  function rank(cases){
    return [...cases].sort((a,b)=>{
      const pa=(a.lifecycle==='ARMED'?12:a.lifecycle==='IGNITING'?16:a.lifecycle==='ACCUMULATING'?7:0);
      const pb=(b.lifecycle==='ARMED'?12:b.lifecycle==='IGNITING'?16:b.lifecycle==='ACCUMULATING'?7:0);
      const sa=a.movementIndex*0.40+a.ignitionIndex*0.28+a.continuationIndex*0.18-a.distributionRisk*0.18-a.riskScore*0.08+pa;
      const sb=b.movementIndex*0.40+b.ignitionIndex*0.28+b.continuationIndex*0.18-b.distributionRisk*0.18-b.riskScore*0.08+pb;
      return sb-sa;
    });
  }

  function decayFeatureBook(book,at=Date.now()){
    const out={};
    for(const [k,v] of Object.entries(book||{})){
      out[k]={...v,currentWeight:+Math.pow(0.5,ageMin(v.observedAt,at)/Math.max(1,v.halfLifeMin)).toFixed(4),decayedValue:+decay(v.value,ageMin(v.observedAt,at),v.halfLifeMin).toFixed(3)};
    }
    return out;
  }

  return {LIFECYCLE,HALF_LIFE_MIN,clamp,num,ageMin,decay,normalizeQuote,deriveFeatures,reactiveEngine,anticipatoryEngine,patternMemoryEngine,distributionRisk,continuationIndex,dataConfidence,lifecycleFor,stageFor,analyze,mergeQuoteSources,rank,decayFeatureBook};
});