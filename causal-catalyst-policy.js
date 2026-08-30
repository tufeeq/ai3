(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports) module.exports=api;
else { root.TAGX3CausalCatalystPolicy=api; api.install(root); }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const toMs=v=>{const t=new Date(v||0).getTime();return Number.isFinite(t)?t:null};
function observationTime(raw){return raw?.observedAt||raw?.timestampET||raw?.timestampUTC||raw?.timestamp||raw?.updatedAt||null}
function catalystKnownAt(context){return context?.catalystObservedAt||context?.acceptedAt||context?.filedAt||null}
function causalContext(raw,context={}){
  const obs=toMs(observationTime(raw)),known=toMs(catalystKnownAt(context));
  if(obs==null||known==null||known<=obs)return context;
  const clean={...context};
  delete clean.catalystScore;delete clean.catalystAt;delete clean.catalystType;delete clean.daysToCatalyst;delete clean.catalystObservedAt;delete clean.acceptedAt;delete clean.filedAt;
  clean.catalystCausalGuard={blocked:true,reason:'CATALYST_KNOWN_AFTER_OBSERVATION',observationAt:observationTime(raw),catalystKnownAt:catalystKnownAt(context)};
  return clean;
}
function install(root){
  const E=root?.TAGX3Engine;
  if(!E||typeof E.analyze!=='function'||root.__TAGX3_CAUSAL_CATALYST_POLICY__)return false;
  root.__TAGX3_CAUSAL_CATALYST_POLICY__=true;
  const base=E.analyze.bind(E);
  E.analyze=function(raw,context={},previous={}){return base(raw,causalContext(raw,context),previous)};
  return true;
}
return {observationTime,catalystKnownAt,causalContext,install};
});
