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

/**
 * No se pudo activar. `paso` dice dónde falló: "suscripcion" es el teléfono contra
 * el servicio de notificaciones de su navegador; "guardado", contra nuestra API.
 */
export class FalloDeNotificaciones extends Error {
  constructor(
    public readonly paso: "suscripcion" | "guardado",
    public readonly detalle: string,
  ) {
    super(detalle);
  }
}

/** Deja el fallo en el log de la API: desde el teléfono de otra persona no hay otra forma de verlo. */
async function fallo(paso: FalloDeNotificaciones["paso"], causa: unknown) {
  const detalle = (causa instanceof Error ? `${causa.name}: ${causa.message}` : String(causa)).slice(0, 300);
  await api.post("/avisos/fallo", { paso, detalle }).catch(() => {});
  return new FalloDeNotificaciones(paso, detalle);
}

const ESPERA_REINTENTO_MS = 1500;

/** Pide permiso y suscribe este dispositivo. Tiene que llamarse desde un toque de la persona. */
export async function activarNotificaciones(): Promise<EstadoDeNotificaciones> {
  const clave = await clavePublica();
  const reg = await registro();
  if (!clave || !reg) return "no-disponible";
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso === "denied" ? "bloqueado" : "apagado";

  let suscripcion: PushSubscription;
  try {
    // Una suscripción vieja pudo hacerse con otra clave del servidor: se arranca de cero.
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    const opciones = { userVisibleOnly: true, applicationServerKey: claveEnBytes(clave) };
    // El servicio del navegador a veces rechaza el primer pedido y acepta el siguiente.
    suscripcion = await reg.pushManager.subscribe(opciones).catch(async () => {
      await new Promise((listo) => setTimeout(listo, ESPERA_REINTENTO_MS));
      return reg.pushManager.subscribe(opciones);
    });
  } catch (causa) {
    throw await fallo("suscripcion", causa);
  }

  try {
    await api.post("/avisos/suscripcion", datosDe(suscripcion));
  } catch (causa) {
    throw await fallo("guardado", causa);
  }
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
