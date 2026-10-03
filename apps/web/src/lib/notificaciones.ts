// Notificaciones push: suscripción de este dispositivo y baja al cerrar sesión.
// El service worker (public/sw.js) es el que las muestra.

import { api } from "./api";

export type EstadoDeNotificaciones =
  | "cargando"
  /** El servidor no tiene claves, o el navegador no soporta notificaciones. */
  | "no-disponible"
  /** iPhone o iPad con la app abierta en Safari: solo funcionan con la app instalada. */
  | "instalar-primero"
  | "bloqueado"
  | "apagado"
  | "activado";

/** La clave VAPID llega en base64url; el navegador la pide en bytes. */
function claveEnBytes(base64url: string) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const binario = atob((base64url + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function datosDe(suscripcion: PushSubscription) {
  const { endpoint, keys } = suscripcion.toJSON();
  return { endpoint: endpoint!, p256dh: keys!.p256dh, auth: keys!.auth };
}

function esIosEnNavegador() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !instalada;
}

const soportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function clavePublica() {
  return (await api.get<{ clave: string | null }>("/avisos/clave").catch(() => ({ clave: null }))).clave;
}

/** El service worker solo se registra en producción (components/pwa.tsx): en desarrollo no hay notificaciones. */
async function registro() {
  if (process.env.NODE_ENV !== "production" || !soportado()) return null;
  return navigator.serviceWorker.ready;
}

export async function estadoDeNotificaciones(): Promise<EstadoDeNotificaciones> {
  if (!(await clavePublica())) return "no-disponible";
  if (!soportado()) return esIosEnNavegador() ? "instalar-primero" : "no-disponible";
  const reg = await registro();
  if (!reg) return "no-disponible";
  if (Notification.permission === "denied") return "bloqueado";
  const actual = await reg.pushManager.getSubscription();
  if (!actual || Notification.permission !== "granted") return "apagado";
  // Se vuelve a guardar en cada visita: si en este teléfono entró otra persona, los avisos pasan a ser de quien está ahora.
  await api.post("/avisos/suscripcion", datosDe(actual)).catch(() => {});
  return "activado";
}

/** Pide permiso y suscribe este dispositivo. Tiene que llamarse desde un toque de la persona. */
export async function activarNotificaciones(): Promise<EstadoDeNotificaciones> {
  const clave = await clavePublica();
  const reg = await registro();
  if (!clave || !reg) return "no-disponible";
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso === "denied" ? "bloqueado" : "apagado";
  // Una suscripción vieja pudo hacerse con otra clave del servidor: se arranca de cero.
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  const suscripcion = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveEnBytes(clave) });
  await api.post("/avisos/suscripcion", datosDe(suscripcion));
  return "activado";
}

/** Deja de recibir avisos en este dispositivo. También se usa al cerrar sesión; nunca falla. */
export async function desactivarNotificaciones() {
  try {
    if (!soportado()) return;
    const suscripcion = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (!suscripcion) return;
    await api.post("/avisos/suscripcion/baja", { endpoint: suscripcion.endpoint }).catch(() => {});
    await suscripcion.unsubscribe();
  } catch {
    // Cerrar sesión no puede depender de esto.
  }
}
