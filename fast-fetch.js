(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
const inflight=new Map();
const memory=new Map();
const CACHE='tagx3-runtime-v1';
const TARGETS=['/ai/tag/data/','/data/intelligence.json'];
const isTarget=u=>TARGETS.some(p=>u.pathname.startsWith(p)||u.pathname===p);
function normalize(input){
  const raw=typeof input==='string'?input:input?.url;
  const u=new URL(raw,location.href);
  if(u.origin===location.origin&&isTarget(u)) u.searchParams.delete('v');
  return u;
}
function responseFrom(rec){return new Response(rec.body,{status:rec.status||200,statusText:rec.statusText||'OK',headers:rec.headers||{'content-type':'application/json'}})}
async function readCache(url){
  if(memory.has(url)) return memory.get(url);
  if(!('caches' in window)) return null;
  try{const c=await caches.open(CACHE),r=await c.match(url);if(!r)return null;const body=await r.text();const rec={body,status:r.status,statusText:r.statusText,headers:{'content-type':r.headers.get('content-type')||'application/json'}};memory.set(url,rec);return rec}catch{return null}
}
async function writeCache(url,rec){
  memory.set(url,rec);
  if(!('caches' in window))return;
  try{const c=await caches.open(CACHE);await c.put(url,responseFrom(rec))}catch{}
}
async function network(url,init={},timeoutMs=5000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await nativeFetch(url,{...init,cache:'default',signal:controller.signal});
    const body=await r.text();
    const rec={body,status:r.status,statusText:r.statusText,headers:{'content-type':r.headers.get('content-type')||'application/json'}};
    if(r.ok) await writeCache(url,rec);
    return rec;
  } finally {clearTimeout(timer)}
}
async function refreshBehind(url,init){
  if(inflight.has(url))return inflight.get(url);
  const p=network(url,init,5000).catch(()=>null).finally(()=>inflight.delete(url));
  inflight.set(url,p);return p;
}
window.fetch=async function(input,init={}){
  let u;try{u=normalize(input)}catch{return nativeFetch(input,init)}
  if(u.origin!==location.origin||!isTarget(u)) return nativeFetch(input,init);
  const url=u.href;
  const cached=await readCache(url);
  if(cached){refreshBehind(url,init);return responseFrom(cached)}
  if(inflight.has(url)){const rec=await inflight.get(url);return rec?responseFrom(rec):nativeFetch(url,{...init,cache:'default'})}
  const p=network(url,init,u.pathname.includes('live-quotes')?5000:2800).catch(()=>null).finally(()=>inflight.delete(url));
  inflight.set(url,p);
  const rec=await p;
  if(rec)return responseFrom(rec);
  return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
};
})();
