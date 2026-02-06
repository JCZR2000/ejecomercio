const CACHE_NAME = 'ejecomercio-v43.6'; // Actualizado para forzar la recarga

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
  console.log('[Service Worker] Instalando v43.6...');
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
// 4. INTERCEPTOR DE RED
self.addEventListener('fetch', (e) => {
  // A. EXCLUSIÓN DE FIREBASE (CRÍTICO)
  // Dejamos pasar todo lo que vaya a los servidores de Google sin tocarlo.
  const url = new URL(e.request.url);
  if (url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com')) {
    return; // El SW ignora esto y deja que la red fluya directo.
  }

  // B. FILTRO DE PROTOCOLO Y MÉTODO
  if (!e.request.url.startsWith('http')) return;
  if (e.request.method !== 'GET') return;

  // C. ESTRATEGIA DE CACHÉ (Network First)
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Clonar y guardar solo si es válida y básica
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si falla la red, devolvemos caché
        return caches.match(e.request);
      })
  );
});