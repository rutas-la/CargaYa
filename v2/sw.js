// CargaYa · service worker: permite instalar la app en el teléfono y abrirla aunque falle la señal.
// Siempre intenta la red primero (para no quedarse con versiones viejas); si no hay señal, usa la última copia.
const CACHE='cargaya-v2.7';
const BASE=['vendedor.html','comprador.html','admin.html','ayuda-vendedor.html','ayuda-comprador.html','ayuda-admin.html','app.js','app.css','config.js','lib/supabase-2.119.0.js','lib/qrcode.js','lib/jsQR.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(BASE).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{const r=e.request;const u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('version.json'))return;
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match(u.pathname.split('/').pop()||'index.html'))))});
