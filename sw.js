const CACHE_NAME = 'ejecomercio-v61.0'; // Actualizado para forzar la recarga
const IMG_CACHE = 'ejecomercio-img'; // fotos de Storage; no se borra al cambiar de versión

// 1. SOLO archivos locales críticos para la instalación
// (Evitamos poner CDNs aquí para no romper la instalación por CORS)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/00-sw-register.js',
  './js/01-firebase-state.js',
  './js/02-auth-sync.js',
  './js/03-status.js',
  './js/04-credit-dates-surcharges.js',
  './js/05-storage.js',
  './js/05a-cloud-chunks.js',
  './js/05b-cloud-backups.js',
  './js/05c-local-images.js',
  './js/06-security.js',
  './js/07-products.js',
  './js/08-rates-utils.js',
  './js/09-pos-cart.js',
  './js/10-credit-payments.js',
  './js/11-render.js',
  './js/12-navigation-backup.js',
  './js/13-images-scanner.js',
  './js/13a-storage-images.js',
  './js/14-pos-search.js',
  './js/15-credits.js',
  './js/16-tools.js',
  './js/17-encryption.js',
  './js/18-credit-history.js',
  './js/19-dashboard.js',
  './js/20-credit-mode.js',
  './js/21-receipts.js',
  './js/22-ui.js',
  './js/23-inventory-pdf.js',
  './js/24-fiscal.js',
  './js/25-catalog.js',
  './js/26-clients.js',
  './js/27-profit.js',
  './js/28-orders.js',
  './icon-192.png',
  './icon-512.png'
  // Nota: Los sonidos o imágenes locales también deberían ir aquí si son críticos
];

// 2. INSTALACIÓN: Pre-cachear solo lo local y seguro
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando ' + CACHE_NAME + '...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Forzar activación inmediata
});

// 3. ACTIVACIÓN: Limpiar cachés viejas
self.addEventListener('activate', (e) => {
  // Versiones anteriores guardaron el JSON de la vitrina en la caché de fotos: se borra para no mostrarlo viejo
  e.waitUntil(caches.open(IMG_CACHE).then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => r.url.includes('catalogo%2F')).map((r) => c.delete(r))))));
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME && key !== IMG_CACHE) {
          console.log('[Service Worker] Borrando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim(); // Tomar control de las pestañas abiertas
});

// 4. INTERCEPTOR DE RED
// - Archivos propios: red primero, con respaldo en caché (offline).
// - CDN de la lista (con versión fija en index.html): caché primero.
// - Todo lo demás (Firestore, OpenFoodFacts, tasas, imágenes externas): directo a la red, sin caché.
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'cdn.tailwindcss.com'];

function isCdnRequest(url) {
  if (url.hostname === 'www.gstatic.com') return url.pathname.startsWith('/firebasejs/');
  return CDN_HOSTS.includes(url.hostname);
}

// Guarda solo respuestas correctas (ok) u opacas (scripts/estilos de CDN sin CORS); nunca errores
function cacheIfValid(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (e) => {
  // La Cache API solo guarda GET http(s); lo demás (POST de Firebase, chrome-extension://) pasa directo
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => cacheIfValid(e.request, res))
        .catch(() => caches.match(e.request))
    );
  } else if (url.hostname === 'firebasestorage.googleapis.com' && url.searchParams.get('alt') === 'media' && url.pathname.includes('/o/users%2F')) {
    // Fotos de producto: el enlace lleva el hash y nunca cambia -> caché primero, en una caché que sobrevive a las versiones.
    // Solo alt=media: las demás llamadas GET del SDK (listAll, metadatos, enlace) van siempre a la red.
    e.respondWith(
      caches.open(IMG_CACHE).then((cache) => cache.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(e.request, res.clone());
        return res;
      })))
    );
  } else if (isCdnRequest(url)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => cacheIfValid(e.request, res)))
    );
  }
});
