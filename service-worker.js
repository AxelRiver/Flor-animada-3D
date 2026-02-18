// service-worker.js
const CACHE_NAME = 'flor-3d-te-amo-v1.2';
const STATIC_ASSETS = [
  './',
  '.index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
  'Juanes - Es Por Ti (Official Music Video).mp3'   // ← cambia el nombre si es diferente
  // Si mueves el mp3 a una carpeta local, usa: './musica/Juanes - Es Por Ti (Official Music Video).mp3'
];

// Instalación → cachear archivos estáticos principales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-cargando assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('[Service Worker] Fallo al cachear', err))
  );
  // Saltar waiting → activar inmediatamente la nueva versión
  self.skipWaiting();
});

// Activación → limpiar cachés antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[Service Worker] Eliminando caché antigua:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Tomar control de la página inmediatamente
  self.clients.claim();
});

// Interceptar peticiones (estrategia Cache → Network fallback)
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no sean GET o que no vengan del mismo origen + cdn
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Para el audio → intentamos cache → red → fallback offline
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              // Guardamos en caché la respuesta si es válida
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, responseToCache));
              }
              return response;
            })
            .catch(() => {
              // Fallback si no hay red y no está en caché
              // Podrías devolver un audio de error o silencio si quisieras
              return new Response('', { status: 503 });
            });
        })
    );
    return;
  }

  // Para todo lo demás (HTML, CSS, JS inline) → Cache first, luego red
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devolver desde caché si existe
        if (response) return response;

        // Si no → ir a la red
        return fetch(event.request)
          .then(networkResponse => {
            // No cacheamos respuestas no exitosas ni cross-origin raras
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Cachear la respuesta para la próxima vez
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));

            return networkResponse;
          })
          .catch(() => {
            // Fallback offline básico (solo para HTML)
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Sin conexión', { status: 503 });
          });
      })
  );
});