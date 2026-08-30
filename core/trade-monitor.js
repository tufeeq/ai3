(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.TAGX3Trades=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='tagx3.myTrades.v1';
  const ALERT_KEY='tagx3.alerts.v1';
  const safeParse=(s,f)=>{try{return JSON.parse(s)||f}catch{return f}};
  const read=()=>safeParse(typeof localStorage!=='undefined'?localStorage.getItem(KEY):null,[]);
  const write=(rows)=>{if(typeof localStorage!=='undefined') localStorage.setItem(KEY,JSON.stringify(rows)); return rows;};
  const readAlerts=()=>safeParse(typeof localStorage!=='undefined'?localStorage.getItem(ALERT_KEY):null,[]);
  const writeAlerts=(rows)=>{if(typeof localStorage!=='undefined') localStorage.setItem(ALERT_KEY,JSON.stringify(rows.slice(0,100))); return rows;};

  function addTrade(input,caseSnapshot){
    const symbol=String(input.symbol||caseSnapshot?.symbol||'').toUpperCase().trim();
    const entryPrice=Number(input.entryPrice);
    if(!symbol||!(entryPrice>0)) throw new Error('symbol and positive entryPrice are required');
    const rows=read();
    const trade={
      id:`${symbol}-${Date.now()}`,symbol,entryPrice,quantity:Number(input.quantity)||null,
      enteredAt:input.enteredAt||new Date().toISOString(),personalStop:Number(input.personalStop)||null,
      notes:String(input.notes||''),status:'OPEN',
      entrySnapshot:caseSnapshot?compactSnapshot(caseSnapshot):null,
      lastSnapshot:caseSnapshot?compactSnapshot(caseSnapshot):null,
      mfePct:0,maePct:0,alerts:[],closedAt:null,exitPrice:null
    };
    rows.unshift(trade); write(rows); return trade;
  }

  function compactSnapshot(c){
    return {price:c.price,lifecycle:c.lifecycle,movementIndex:c.movementIndex,ignitionIndex:c.ignitionIndex,continuationIndex:c.continuationIndex,distributionRisk:c.distributionRisk,riskScore:c.riskScore,sharia:c.sharia?.status||'UNVERIFIED',dataConfidence:c.dataConfidence?.label||'LOW',dataFresh:c.dataConfidence?.fresh!==false,observedAt:c.observedAt,whyNow:c.whyNow||[]};
  }

  function alert(severity,type,message,trade,c){
    return {id:`${trade.id}-${type}-${Date.now()}`,tradeId:trade.id,symbol:trade.symbol,severity,type,message,createdAt:new Date().toISOString(),price:c?.price||null};
  }

  function evaluate(trade,c){
    if(!c||trade.status!=='OPEN') return {trade,alerts:[]};
    const prev=trade.lastSnapshot||trade.entrySnapshot||{};
    const alerts=[];
    const sh=c.sharia?.status||'UNVERIFIED';
    const explicitlyStale=c.dataConfidence?.fresh===false;
    const lowQuality=c.dataConfidence?.label==='LOW';

    if((lowQuality&&prev.dataConfidence!=='LOW')||(explicitlyStale&&prev.dataFresh!==false))
      alerts.push(alert('WARNING',explicitlyStale?'DATA_STALE':'DATA_DEGRADED',explicitlyStale?'بيانات السوق غير طازجة؛ تم تعليق تنبيهات السعر/الوقف ومقاييس MFE/MAE حتى وصول رصد سوقي حديث.':'جودة البيانات انخفضت؛ لا تعتمد على الإشارة دون تحقق إضافي.',trade,c));

    // Sharia evidence can change independently of quote freshness, so keep this safeguard active.
    if(prev.sharia&&prev.sharia!==sh) alerts.push(alert(sh==='NON_COMPLIANT'?'CRITICAL':'WARNING','SHARIA_CHANGED',`الحالة الشرعية تغيرت من ${prev.sharia} إلى ${sh}.`,trade,c));

    // Fail closed on explicitly stale market observations. Do not turn an old/session-final quote
    // into a live stop, lifecycle, thesis, P&L excursion, or entry/exit monitoring signal.
    if(explicitlyStale){
      trade.lastSnapshot={...prev,sharia:sh,dataConfidence:c.dataConfidence?.label||prev.dataConfidence||'LOW',dataFresh:false,observedAt:c.observedAt||prev.observedAt};
      trade.updatedAt=new Date().toISOString();
      trade.alerts=[...(alerts.map(a=>a.id)),...(trade.alerts||[])].slice(0,30);
      return {trade,alerts};
    }

    const p=(c.price-trade.entryPrice)/trade.entryPrice*100;
    trade.mfePct=Math.max(Number(trade.mfePct)||0,p);
    trade.maePct=Math.min(Number(trade.maePct)||0,p);
    if(trade.personalStop&&c.price<=trade.personalStop) alerts.push(alert('CRITICAL','PERSONAL_STOP',`السعر ${c.price.toFixed(4)} وصل/كسر وقفك الشخصي ${trade.personalStop}.`,trade,c));
    if(c.lifecycle==='DISTRIBUTING'&&prev.lifecycle!=='DISTRIBUTING') alerts.push(alert('CRITICAL','DISTRIBUTION','انتقلت الحالة إلى DISTRIBUTING؛ راجع الخروج/التخفيف فورًا.',trade,c));
    if(c.distributionRisk>=68&&Number(prev.distributionRisk||0)<68) alerts.push(alert('WARNING','TRIM_WATCH',`مخاطر التصريف ارتفعت إلى ${c.distributionRisk}/100.`,trade,c));
    if(c.continuationIndex<=38&&Number(prev.continuationIndex||100)>38) alerts.push(alert('WARNING','THESIS_WEAKENING',`استمرار الحركة هبط إلى ${c.continuationIndex}/100؛ الفرضية تضعف.`,trade,c));
    if(c.continuationIndex>=72&&Number(prev.continuationIndex||0)<72&&c.distributionRisk<45) alerts.push(alert('INFO','THESIS_STRENGTHENING',`الاستمرار تحسن إلى ${c.continuationIndex}/100 مع مخاطر تصريف منخفضة نسبيًا.`,trade,c));
    if(c.lifecycle==='IGNITING'&&prev.lifecycle!=='IGNITING') alerts.push(alert('INFO','IGNITION','الحالة دخلت مرحلة IGNITING.',trade,c));
    if(c.lifecycle==='EXPANDING'&&prev.lifecycle!=='EXPANDING') alerts.push(alert('INFO','EXPANSION','الحالة دخلت EXPANDING؛ راقب الاستمرار والتصريف.',trade,c));
    trade.lastSnapshot=compactSnapshot(c);
    trade.lastPrice=c.price; trade.pnlPct=p; trade.updatedAt=new Date().toISOString();
    trade.alerts=[...(alerts.map(a=>a.id)),...(trade.alerts||[])].slice(0,30);
    return {trade,alerts};
  }

  function updateAll(caseMap){
    const trades=read(); const freshAlerts=[];
    for(const t of trades){
      const {alerts}=evaluate(t,caseMap.get(t.symbol)); freshAlerts.push(...alerts);
    }
    write(trades);
    if(freshAlerts.length) writeAlerts([...freshAlerts,...readAlerts()]);
    return {trades,alerts:freshAlerts};
  }

  function closeTrade(id,exitPrice){
    const rows=read(); const t=rows.find(x=>x.id===id); if(!t) return null;
    const px=Number(exitPrice); if(!(px>0)) throw new Error('positive exit price required');
    t.status='CLOSED'; t.exitPrice=px; t.closedAt=new Date().toISOString(); t.realizedPct=(px-t.entryPrice)/t.entryPrice*100;
    write(rows); return t;
  }

  function removeTrade(id){ const rows=read().filter(x=>x.id!==id); write(rows); return rows; }
  function clearAlerts(){ writeAlerts([]); return []; }
  return {KEY,read,write,readAlerts,addTrade,compactSnapshot,evaluate,updateAll,closeTrade,removeTrade,clearAlerts};
});