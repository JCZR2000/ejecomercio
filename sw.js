const CACHE_NAME = 'ejecomercio-v45.0'; // Actualizado para forzar la recarga

// 1. SOLO archivos locales críticos para la instalación
// (Evitamos poner CDNs aquí para no romper la instalación por CORS)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
  // Nota: Los sonidos o imágenes locales también deberían ir aquí si son críticos
];

// 2. INSTALACIÓN: Pre-cachear solo lo local y seguro
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando v45.0...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Forzar activación inmediata
});

// 3. ACTIVACIÓN: Limpiar cachés viejas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Borrando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim(); // Tomar control de las pestañas abiertas
});

// 4. INTERCEPTOR DE RED (Estrategia: Stale-While-Revalidate / Cache Dinámico)
self.addEventListener('fetch', (e) => {
  // Ignorar peticiones que no sean http/https (ej. chrome-extension://)
  if (!e.request.url.startsWith('http')) return;

  // B. FILTRO DE MÉTODO (¡LA SOLUCIÓN!): 
  // Si no es GET (ej: POST de Firebase), no hacemos nada y dejamos que pase directo.
  // La Cache API NO soporta guardar peticiones POST.
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // A. ESTRATEGIA: Network First con Fallback a Caché (Para datos frescos)
      // Intentamos ir a la red primero para tener siempre la última versión
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          // Si la respuesta es válida, la guardamos en caché (Cacheo Dinámico)
          // Esto guardará Tailwind, Firebase, FontAwesome, etc. la primera vez que carguen.
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            // Solo cacheamos respuestas 'basic' (mismo origen) de forma segura aquí
            // Para CDNs (cors/opaque), necesitamos manejarlo con cuidado o confiar en el caché del navegador
          }

          // Clonamos la respuesta porque se usa dos veces (browser y cache)
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Si falla la red (OFFLINE), devolvemos lo que haya en caché
          return cachedResponse;
        });

      // Si tenemos algo en caché, podríamos devolverlo rápido, pero en tu caso
      // prefiero que intente la red primero para asegurar actualizaciones de precios/lógica.
      // Si quieres velocidad pura, devolvemos cachedResponse || fetchPromise.
      // Pero para asegurar consistencia, usaremos el fetchPromise primero (Network First).
      return fetchPromise.catch(() => cachedResponse);
    })
  );
});