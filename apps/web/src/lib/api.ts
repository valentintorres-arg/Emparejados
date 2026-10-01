// Cliente de la API. Todas las rutas son relativas a /api (ver next.config.ts).
// La sesión viaja en cookies httpOnly: acá no se maneja ningún token.

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly errores?: string[],
  ) {
    super(mensaje);
  }
}

// Rutas de sesión que no deben reintentarse tras un 401.
const SIN_REINTENTO = ["/auth/login", "/auth/registro", "/auth/refrescar", "/auth/salir"];

// Varias pantallas pueden recibir 401 a la vez: todas esperan el mismo refresco.
let refresco: Promise<boolean> | null = null;

function refrescarSesion(): Promise<boolean> {
  refresco ??= fetch("/api/auth/refrescar", { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refresco = null;
    });
  return refresco;
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown, reintentar = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { "content-type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "No hay conexión. Revisá tu señal y probá de nuevo.");
  }

  // El token de acceso dura 15 minutos: si venció, se renueva y se repite el pedido.
  if (res.status === 401 && reintentar && !SIN_REINTENTO.includes(ruta) && (await refrescarSesion())) {
    return pedir<T>(metodo, ruta, cuerpo, false);
  }

  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : undefined;
  if (!res.ok) {
    throw new ErrorApi(res.status, datos?.mensaje ?? "Algo falló. Probá de nuevo.", datos?.errores);
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>("GET", ruta),
  post: <T>(ruta: string, cuerpo: unknown = {}) => pedir<T>("POST", ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>("PUT", ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>("PATCH", ruta, cuerpo),
  del: <T>(ruta: string) => pedir<T>("DELETE", ruta),
};

/** Para useSWR: la clave es la ruta. */
export const traer = <T>(ruta: string) => api.get<T>(ruta);

export const mensajeDe = (error: unknown) =>
  error instanceof Error ? error.message : "Algo falló. Probá de nuevo.";
