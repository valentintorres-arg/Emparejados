"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { mensajeDe } from "@/lib/api";
import { iniciales, type Tono } from "@/lib/formato";

// ─── Iconos ──────────────────────────────────────────────────────────────────

const ICONOS = {
  inicio: "M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM20 14v1M14 20h1",
  parejas: "M8.5 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM2.5 19.5c.5-3.4 2.9-5.2 6-5.2s5.5 1.8 6 5.2M16 11a2.8 2.8 0 1 0 0-5.6M17.5 14.4c2.3.4 3.7 2.1 4 5.1",
  trofeo: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.2 4.5 3.7 4.8M16 6h3.5c0 3-1.2 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4v3h-4z",
  partidos: "M5 6h14v13.5H5zM5 10h14M9 4v3M15 4v3",
  persona: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20c.7-4 3.5-6 7.5-6s6.8 2 7.5 6",
  bandeja: "M4 13.5 6.5 5h11L20 13.5V19H4zM4 13.5h4.5l1 2.5h5l1-2.5H20",
  registro: "M8 6h11M8 12h11M8 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  sede: "M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0c0 5 6.5 11 6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  escudo: "M12 3.5 5 6v5.5c0 4.3 2.8 7.6 7 9 4.2-1.4 7-4.7 7-9V6z",
  salir: "M10 5H5v14h5M14 8l4 4-4 4M18 12H9",
  descargar: "M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14",
  mas: "M12 5v14M5 12h14",
  camara: "M4 8h3.5L9 6h6l1.5 2H20v11H4zM12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  buscar: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20",
  atras: "M14.5 5.5 8 12l6.5 6.5",
  cerrar: "M6 6l12 12M18 6 6 18",
  ok: "M5 12.5 10 17.5 19.5 7",
  reloj: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2",
  editar: "M5 19h3.5L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5",
  llave: "M14.5 13.5a4.5 4.5 0 1 0-4.3-3.1L4 16.6V20h3.4v-2h2v-2h2l1.3-1.3c.6.5 1.1.8 1.8.8ZM16 8h.01",
  campana: "M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
} as const;

export type NombreDeIcono = keyof typeof ICONOS;

export function Icono({ nombre, className = "size-5" }: { nombre: NombreDeIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONOS[nombre]} />
    </svg>
  );
}

// ─── Botones ─────────────────────────────────────────────────────────────────

// Todo botón se tiene que reconocer como botón: fondo o borde marcado, nunca solo texto.
const VARIANTES = {
  primario: "bg-pista text-white shadow-boton hover:bg-pista-700 active:bg-pista-900",
  secundario: "bg-white text-pista border-2 border-pista/30 hover:border-pista hover:bg-pista-50",
  peligro: "bg-white text-mal border-2 border-mal/40 hover:border-mal hover:bg-mal-50",
  fantasma: "bg-pista-50 text-pista hover:bg-pista-100",
  claro: "bg-white text-pista hover:bg-pista-50",
} as const;

// Hasta el botón chico supera los 44 px de alto: se acierta con el dedo sin apuntar.
const TAMANOS = { normal: "min-h-13 px-5 text-base", chico: "min-h-12 px-4 text-[0.95rem]" } as const;

function Giro({ className = "size-[1.15em]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={`girando shrink-0 ${className}`} aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/** Enlace de texto: siempre subrayado, para que se note que se puede tocar. */
export const ENLACE = "font-semibold text-pista underline decoration-pista/40 decoration-2 underline-offset-4 hover:decoration-pista";

/** Tarjeta entera que lleva a otra pantalla. */
export const TARJETA_ENLACE =
  "rounded-2xl border border-linea bg-white shadow-tarjeta transition-colors hover:border-pista hover:bg-pista-50/40 active:bg-pista-50";

interface PropsDeBoton extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: keyof typeof VARIANTES;
  tamano?: keyof typeof TAMANOS;
  icono?: NombreDeIcono;
  cargando?: boolean;
  href?: string;
}

export function Boton({ variante = "primario", tamano = "normal", icono, cargando, href, className = "", children, disabled, ...resto }: PropsDeBoton) {
  const clases = `inline-flex items-center justify-center gap-2 rounded-xl text-center font-semibold leading-tight transition-colors disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`;
  const contenido = (
    <>
      {cargando ? <Giro /> : icono && <Icono nombre={icono} className="size-[1.25em] shrink-0" />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={clases}>
        {contenido}
      </Link>
    );
  }
  return (
    <button type="button" className={clases} disabled={disabled || cargando} aria-busy={cargando} {...resto}>
      {contenido}
    </button>
  );
}

// ─── Formularios ─────────────────────────────────────────────────────────────

export const CONTROL =
  "w-full min-h-13 rounded-xl border-2 border-borde bg-white px-4 text-base text-tinta placeholder:text-gris/80 focus:border-pista disabled:bg-fondo disabled:text-gris";

const ETIQUETA = "mb-1.5 block font-semibold";

interface PropsDeCampo extends React.InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ayuda?: string;
}

export function Campo({ etiqueta, ayuda, className = "", ...resto }: PropsDeCampo) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <input id={id} className={CONTROL} aria-describedby={ayuda ? `${id}-ayuda` : undefined} {...resto} />
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1.5 text-sm text-gris">
          {ayuda}
        </p>
      )}
    </div>
  );
}

interface PropsDeSelector extends React.SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  opciones: readonly (readonly [valor: string | number, texto: string])[];
  vacio?: string;
}

export function Selector({ etiqueta, opciones, vacio, className = "", ...resto }: PropsDeSelector) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <select id={id} className={CONTROL} {...resto}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AreaDeTexto({ etiqueta, className = "", ...resto }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <textarea id={id} className={`${CONTROL} py-3`} rows={4} {...resto} />
    </div>
  );
}

export function ErrorDeFormulario({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-mal/30 bg-mal-50 px-4 py-3 font-semibold text-mal">
      {mensaje}
    </p>
  );
}

// ─── Piezas de presentación ──────────────────────────────────────────────────

const TONOS: Record<Tono, string> = {
  neutro: "bg-fondo text-gris border-linea",
  pista: "bg-pista-50 text-pista border-pista/20",
  ok: "bg-ok-50 text-ok border-ok/20",
  mal: "bg-mal-50 text-mal border-mal/20",
  aviso: "bg-aviso-50 text-aviso border-aviso/20",
  // Lo que está pasando ahora lleva el amarillo de la pelota.
  vivo: "bg-pelota text-tinta border-tinta/15",
};

export function Estado({ valor }: { valor: readonly [string, Tono] }) {
  const [texto, tono] = valor;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold ${TONOS[tono]}`}>
      {texto}
    </span>
  );
}

export function Tarjeta({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-linea bg-white shadow-tarjeta ${className}`}>{children}</div>;
}

/** Foto de perfil si la hay; si no (o si no carga), las iniciales. Decorativa: el nombre siempre está al lado. */
export function Avatar({
  jugador,
  className = "size-12 text-base",
}: {
  jugador: { nombre: string; apellido: string; fotoUrl?: string | null };
  className?: string;
}) {
  const [fallida, setFallida] = useState<string | null>(null);
  const clases = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pista-50 font-bold text-pista ring-1 ring-pista/15 ${className}`;
  if (jugador.fotoUrl && fallida !== jugador.fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- la sirve la API, ya achicada y con su propia caché
      <img src={jugador.fotoUrl} alt="" loading="lazy" className={`${clases} object-cover`} onError={() => setFallida(jugador.fotoUrl ?? null)} />
    );
  }
  return (
    <span aria-hidden="true" className={clases}>
      {iniciales(jugador)}
    </span>
  );
}

export function Encabezado({ titulo, detalle, volver, children }: { titulo: string; detalle?: React.ReactNode; volver?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
      <div className="min-w-0">
        {volver && (
          <Link
            href={volver}
            className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-pista/30 bg-white py-1 pl-3 pr-4 font-semibold text-pista hover:border-pista hover:bg-pista-50"
          >
            <Icono nombre="atras" />
            Volver
          </Link>
        )}
        <h1 className="titulo text-3xl sm:text-4xl">{titulo}</h1>
        {detalle && <div className="mt-1.5 text-gris">{detalle}</div>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="titulo text-2xl">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-linea bg-white/70 px-5 py-9 text-center">
      <p className="text-lg font-semibold">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-gris">{children}</div>}
    </div>
  );
}

export function Cargando({ texto = "Cargando" }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-3 py-10 text-lg text-gris">
      <Giro className="size-6 text-pista" />
      {texto}…
    </p>
  );
}

export function FalloDeCarga({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border-2 border-mal/30 bg-mal-50 px-5 py-7 text-center">
      <p className="text-lg font-semibold text-mal">{mensajeDe(error)}</p>
      {reintentar && (
        <Boton variante="secundario" className="mt-4" onClick={reintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Paginador({ pagina, paginas, cambiar }: { pagina: number; paginas: number; cambiar: (pagina: number) => void }) {
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-5 flex flex-wrap items-center justify-center gap-3">
      <Boton variante="secundario" tamano="chico" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>
        Anterior
      </Boton>
      <span className="font-semibold text-gris">
        Página {pagina} de {paginas}
      </span>
      <Boton variante="secundario" tamano="chico" disabled={pagina >= paginas} onClick={() => cambiar(pagina + 1)}>
        Siguiente
      </Boton>
    </nav>
  );
}

// ─── Diálogo ─────────────────────────────────────────────────────────────────

/** Fila de botones al pie de un diálogo: apilados en el celular, con la acción principal arriba. */
export const PIE_DE_DIALOGO = "mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end";

export function Dialogo({ abierto, cerrar, titulo, children }: { abierto: boolean; cerrar: () => void; titulo: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={cerrar}
      onClick={(e) => e.target === ref.current && cerrar()}
      className="m-auto w-[min(34rem,calc(100vw-1.5rem))] rounded-3xl bg-white p-0 text-tinta shadow-flotante max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      {abierto && (
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="titulo pt-1.5 text-2xl">{titulo}</h2>
            <button type="button" onClick={cerrar} aria-label="Cerrar" className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-fondo text-tinta hover:bg-pista-50">
              <Icono nombre="cerrar" className="size-6" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ─── Avisos ──────────────────────────────────────────────────────────────────

interface Aviso {
  id: number;
  texto: string;
  tono: "ok" | "mal";
}

const ContextoDeAvisos = createContext<(texto: string, tono?: Aviso["tono"]) => void>(() => {});

export function ProveedorDeAvisos({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tono: Aviso["tono"] = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((actuales) => [...actuales.slice(-2), { id, texto, tono }]);
    setTimeout(() => setAvisos((actuales) => actuales.filter((a) => a.id !== id)), tono === "mal" ? 10000 : 6000);
  }, []);

  return (
    <ContextoDeAvisos.Provider value={avisar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {avisos.map((aviso) => (
          <p
            key={aviso.id}
            className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-5 py-4 font-semibold shadow-flotante ${aviso.tono === "ok" ? "bg-tinta text-white" : "bg-mal text-white"}`}
          >
            {aviso.tono === "ok" && (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pelota text-tinta">
                <Icono nombre="ok" className="size-4" />
              </span>
            )}
            {aviso.texto}
          </p>
        ))}
      </div>
    </ContextoDeAvisos.Provider>
  );
}

export const useAviso = () => useContext(ContextoDeAvisos);

// ─── Confirmaciones ──────────────────────────────────────────────────────────

interface Pregunta {
  titulo: string;
  texto?: string;
  /** Texto del botón que confirma: el nombre de la acción, no "Aceptar". */
  confirmar: string;
  peligro?: boolean;
}

const ContextoDeConfirmacion = createContext<(pregunta: Pregunta) => Promise<boolean>>(async () => false);

export function ProveedorDeConfirmacion({ children }: { children: React.ReactNode }) {
  const [pregunta, setPregunta] = useState<(Pregunta & { resolver: (respuesta: boolean) => void }) | null>(null);
  const preguntar = useCallback((nueva: Pregunta) => new Promise<boolean>((resolver) => setPregunta({ ...nueva, resolver })), []);
  const responder = (respuesta: boolean) => {
    pregunta?.resolver(respuesta);
    setPregunta(null);
  };

  return (
    <ContextoDeConfirmacion.Provider value={preguntar}>
      {children}
      <Dialogo abierto={pregunta !== null} cerrar={() => responder(false)} titulo={pregunta?.titulo ?? ""}>
        {pregunta?.texto && <p className="text-lg text-gris">{pregunta.texto}</p>}
        <div className={PIE_DE_DIALOGO}>
          <Boton variante="secundario" onClick={() => responder(false)}>
            Volver
          </Boton>
          <Boton variante={pregunta?.peligro ? "peligro" : "primario"} onClick={() => responder(true)}>
            {pregunta?.confirmar}
          </Boton>
        </div>
      </Dialogo>
    </ContextoDeConfirmacion.Provider>
  );
}

/** Pregunta antes de una acción que no se puede deshacer. Devuelve true si la persona confirma. */
export const useConfirmar = () => useContext(ContextoDeConfirmacion);

/**
 * Ejecuta una acción contra la API mostrando el resultado como aviso.
 * Devuelve true si salió bien, para que el llamador cierre diálogos o recargue.
 */
export function useAccion() {
  const avisar = useAviso();
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const ejecutar = useCallback(
    async (clave: string, accion: () => Promise<unknown>, exito?: string): Promise<boolean> => {
      setEnCurso(clave);
      try {
        await accion();
        if (exito) avisar(exito);
        return true;
      } catch (error) {
        avisar(mensajeDe(error), "mal");
        return false;
      } finally {
        setEnCurso(null);
      }
    },
    [avisar],
  );
  return { ejecutar, enCurso };
}
