// Service worker de Emparejados.
// - Los datos (/api) nunca se guardan: siempre van a la red.
// - Las pantallas se piden a la red y, si no hay conexión, se sirve la última
//   copia guardada o la página "sin conexión".
// - Los archivos estáticos con hash se sirven desde la copia local.
// - Muestra las notificaciones push que manda la API y, al tocarlas, abre la
//   pantalla que corresponde.

const VERSION = "v2";
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

// ─── Notificaciones push ─────────────────────────────────────────────────────
// La API manda { titulo, cuerpo, url, etiqueta } (apps/api/src/avisos/push.service.ts).

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { cuerpo: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(aviso.titulo || "Emparejados", {
      body: aviso.cuerpo || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/insignia-96.png",
      lang: "es-AR",
      // Con la misma etiqueta, el aviso nuevo reemplaza al anterior y vuelve a sonar.
      tag: aviso.etiqueta,
      renotify: Boolean(aviso.etiqueta),
      data: { url: aviso.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (ventanas) => {
      // Si la app ya está abierta, se usa esa ventana en lugar de abrir otra.
      const abierta = ventanas.find((ventana) => new URL(ventana.url).origin === self.location.origin);
      if (abierta) {
        const navegada = await abierta.navigate(destino).catch(() => null);
        return (navegada || abierta).focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
