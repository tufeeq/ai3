(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
const inflight=new Map();
const memory=new Map();
const CACHE='tagx3-runtime-v3';
const BOOT_AT=performance.now();
const INTEL_PATH=new URL('./data/intelligence.json',location.href).pathname;
const TARGETS=['/ai/tag/data/',INTEL_PATH];
const LIVE='/ai/tag/data/live-quotes.json';
const CORE=[LIVE,INTEL_PATH];
const OPTIONAL=[
  '/ai/tag/data/tagx2-sentinel.json',
  '/ai/tag/data/coverage-rescue.json',
  '/ai/tag/data/sec-catalysts.json',
  '/ai/tag/data/sharia.json',
  '/ai/tag/data/sharia-v4-challenger.json',
  '/ai/tag/data/tagx2-top20-audit.json'
];
const isTarget=u=>TARGETS.some(p=>u.pathname.startsWith(p)||u.pathname===p);
const isCore=p=>CORE.includes(p);
const isOptional=p=>OPTIONAL.includes(p);
function normalize(input){
  const raw=typeof input==='string'?input:input?.url;
  const u=new URL(raw,location.href);
  if(u.origin===location.origin&&isTarget(u))u.searchParams.delete('v');
  return u;
}
function responseFrom(rec){return new Response(rec.body,{status:rec.status||200,statusText:rec.statusText||'OK',headers:rec.headers||{'content-type':'application/json'}})}
async function readCache(url){
  if(memory.has(url))return memory.get(url);
  if(!('caches'in window))return null;
  try{const c=await caches.open(CACHE),r=await c.match(url);if(!r)return null;const body=await r.text();const rec={body,status:r.status,statusText:r.statusText,headers:{'content-type':r.headers.get('content-type')||'application/json'}};memory.set(url,rec);return rec}catch{return null}
}
async function writeCache(url,rec){
  memory.set(url,rec);
  if(!('caches'in window))return;
  try{const c=await caches.open(CACHE);await c.put(url,responseFrom(rec))}catch{}
}
async function network(url,init={},timeoutMs=1800,persist=true){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await nativeFetch(url,{...init,cache:init.cache||'default',signal:controller.signal});
    const body=await r.text();
    const rec={body,status:r.status,statusText:r.statusText,headers:{'content-type':r.headers.get('content-type')||'application/json','x-tagx-live-source':r.headers.get('x-tagx-live-source')||'','x-tagx-live-updated-at':r.headers.get('x-tagx-live-updated-at')||''}};
    if(r.ok&&persist)writeCache(url,rec);
    return rec;
  }finally{clearTimeout(timer)}
}
function warm(url,init,timeout=4500){
  if(inflight.has(url))return;
  const p=network(url,init,timeout).catch(()=>null).finally(()=>inflight.delete(url));
  inflight.set(url,p);
}
function deferredResponse(){return new Response('{"deferred":true}',{status:503,statusText:'Deferred during fast boot',headers:{'content-type':'application/json'}})}
window.fetch=async function(input,init={}){
  let u;try{u=normalize(input)}catch{return nativeFetch(input,init)}
  if(u.origin!==location.origin||!isTarget(u))return nativeFetch(input,init);
  const url=u.href,path=u.pathname;

  // Trading-critical live quotes are NETWORK-FIRST and NEVER served from the
  // persistent runtime cache. The upstream live-source guard already reconciles
  // Pages vs raw GitHub and returns the newest timestamped snapshot. If that
  // request fails, fail closed rather than resurrecting an old trading snapshot.
  if(path===LIVE){
    const rec=await network(url,{...init,cache:'no-store'},3200,false).catch(()=>null);
    return rec&&rec.status>=200&&rec.status<300?responseFrom(rec):deferredResponse();
  }

  const cached=await readCache(url);
  if(cached){warm(url,init,isCore(path)?2200:4500);return responseFrom(cached)}

  // Do not let secondary research feeds block first paint. Warm them silently.
  if(isOptional(path)&&performance.now()-BOOT_AT<12000){
    warm(url,init,4500);
    return deferredResponse();
  }

  if(inflight.has(url)){
    const rec=await Promise.race([inflight.get(url),new Promise(r=>setTimeout(()=>r(null),isCore(path)?1800:900))]);
    return rec?responseFrom(rec):deferredResponse();
  }

  const timeout=isCore(path)?1800:1200;
  const p=network(url,init,timeout).catch(()=>null).finally(()=>inflight.delete(url));
  inflight.set(url,p);
  const rec=await p;
  return rec?responseFrom(rec):deferredResponse();
};

// Warm only non-live visible data. Live quotes must be requested through the
// network-first branch above so a previous-session CacheStorage entry can never
// win the first render.
for(const p of CORE.filter(p=>p!==LIVE))warm(new URL(p,location.href).href,{},2200);
})();
