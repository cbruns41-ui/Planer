const CACHE = 'miteinander-shell-v6';
const ASSETS = ['/', '/styles.css', '/mobile.css', '/people.css', '/viewport.css', '/app.js', '/screens.js', '/shell.js', '/calendar.js', '/domain.js', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
self.addEventListener('install', e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate', e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('miteinander-shell-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e=>{
 const url = new URL(e.request.url);
 if(e.request.method!=='GET' || url.origin!==self.location.origin || url.pathname.startsWith('/api/')) return;
 if(!ASSETS.includes(url.pathname)) return;
 e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return response;}).catch(async()=>await caches.match(e.request) || Response.error()));
});
