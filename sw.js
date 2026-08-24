/* Service worker de FORJA: hace que la app se pueda ABRIR sin internet.
   Sin esto, sin señal no hay ni siquiera página — el navegador no tiene
   de dónde bajar index.html/bundle.js. Estrategia: red primero, y si la
   red falla (o no hay conexión), se sirve la última copia buena que
   quedó guardada en la caché de una visita anterior con conexión.

   Solo intercepta pedidos GET del propio origen (el shell de la app:
   index.html, bundle.js, manifest, íconos). Nunca toca las llamadas a
   Supabase ni a la API de Anthropic — esas siguen su curso normal y las
   maneja el respaldo local de sGet/sSet/sDel dentro de la app. */
const CACHE_NAME = "forja-shell-v2";
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // si alguna falla (ej. sin red en el primer install), no bloquea el resto
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // los POST/DELETE a Supabase pasan de largo
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Anthropic, fuentes: intactos

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          // bundle.js se pide con ?v=NN distinto en cada build (para saltar
          // el Cache-Control: immutable del CDN) — cache.put lo guarda con
          // esa URL exacta como clave, así que sin este borrado la caché
          // del service worker iba acumulando UNA ENTRADA POR CADA VERSIÓN
          // visitada alguna vez, para siempre. El respaldo de más abajo usa
          // ignoreSearch (necesario: no sabe qué ?v= pedir sin red), y con
          // varias versiones conviviendo, matchear por ruta sin importar la
          // query es ambiguo — puede devolver una vieja en vez de la última
          // buena. Por eso, antes de guardar la nueva, se borra cualquier
          // otra copia de esta misma ruta.
          const stale = (await cache.keys()).filter((k) => {
            const ku = new URL(k.url);
            return ku.origin === url.origin && ku.pathname === url.pathname && ku.search !== url.search;
          });
          await Promise.all(stale.map((k) => cache.delete(k)));
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await cache.match("/index.html", { ignoreSearch: true });
          if (shell) return shell;
        }
        throw e;
      }
    })
  );
});
