// CargaYa · service worker: permite instalar la app en el teléfono y abrirla aunque falle la señal.
// Siempre intenta la red primero (para no quedarse con versiones viejas); si no hay señal, usa la última copia.
const CACHE='cargaya-v2.26';
const BASE=['vendedor.html','comprador.html','admin.html','carretillero.html','ayuda-vendedor.html','ayuda-comprador.html','ayuda-admin.html','ayuda-carretillero.html','app.js','app.css','config.js','lib/supabase-2.119.0.js','lib/qrcode.js','lib/jsQR.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(BASE).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{const r=e.request;const u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('version.json'))return;
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match(u.pathname.split('/').pop()||'index.html'))))});

// ---- Avisos push: llegan aunque la app esté cerrada ----
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={titulo:'CargaYa',texto:e.data?e.data.text():''}}
  const mod=(d.url||'').replace('.html','')||'vendedor';
  e.waitUntil(self.registration.showNotification(d.titulo||'CargaYa',{body:d.texto||'',tag:d.tag||undefined,renotify:!!d.tag,
    icon:`icon-${mod}-192.png`,badge:`icon-${mod}-192.png`,data:{url:d.url||'vendedor.html'},
    requireInteraction:!!d.urgente,vibrate:d.urgente?[400,150,400,150,400]:[200,100,200]}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'vendedor.html',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>x.url.split('?')[0]===url);if(c)return c.focus();return self.clients.openWindow(url)}))});
