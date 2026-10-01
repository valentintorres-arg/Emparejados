// Service worker de Emparejados.
// - Los datos (/api) nunca se guardan: siempre van a la red.
// - Las pantallas se piden a la red y, si no hay conexión, se sirve la última
//   copia guardada o la página "sin conexión".
// - Los archivos estáticos con hash se sirven desde la copia local.

const VERSION = "v1";
const PANTALLAS = `emparejados-pantallas-${VERSION}`;
const ESTATICOS = `emparejados-estaticos-${VERSION}`;
const SIN_CONEXION = "/sin-conexion";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PANTALLAS)
      .then((cache) => cache.addAll([SIN_CONEXION, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== PANTALLAS && c !== ESTATICOS).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(PANTALLAS).then((cache) => cache.put(request, copia));
          }
          return respuesta;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(SIN_CONEXION))),
    );
    return;
  }

  const esEstatico = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (esEstatico) {
    event.respondWith(
      caches.match(request).then(
        (guardado) =>
          guardado ??
          fetch(request).then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(ESTATICOS).then((cache) => cache.put(request, copia));
            }
            return respuesta;
          }),
      ),
    );
  }
});
