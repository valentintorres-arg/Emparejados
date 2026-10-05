import { Tarjeta } from "./ui";

// Esqueletos: mientras llegan los datos, cada pantalla muestra la silueta de lo
// que va a aparecer en lugar de un cartel de "Cargando". Cada uno copia la forma
// de su tarjeta, así el contenido no salta al llegar.

/** Bloque que late. Es decorativo: "Cargando" lo dice <Esqueleto>, una sola vez. */
function Hueso({ className = "" }: { className?: string }) {
  // El redondeo por defecto solo va si no se pide otro: dos clases de redondeo juntas no se pisan en orden.
  const redondeo = className.includes("rounded") ? "" : "rounded-lg";
  return <span aria-hidden="true" className={`block animate-pulse bg-linea ${redondeo} ${className}`} />;
}

function Esqueleto({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" className={`esqueleto ${className}`}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

const veces = (cantidad: number) => Array.from({ length: cantidad }, (_, i) => i);

const GRILLA = "grid grid-cols-1 gap-4 md:grid-cols-2";

// ─── Piezas ──────────────────────────────────────────────────────────────────

function PiezaEncabezado({ volver = false }: { volver?: boolean }) {
  return (
    <div className="mb-6">
      {volver && <Hueso className="mb-3 h-11 w-28 rounded-full" />}
      <Hueso className="h-9 w-3/5 max-w-sm" />
      <Hueso className="mt-3 h-5 w-4/5 max-w-md" />
    </div>
  );
}

/** Avatar redondo con el nombre y un renglón de detalle al lado. */
function PiezaPersona({ avatar = "size-12" }: { avatar?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Hueso className={`shrink-0 rounded-full ${avatar}`} />
      <div className="min-w-0 flex-1">
        <Hueso className="h-6 w-3/5" />
        <Hueso className="mt-2 h-5 w-2/5" />
      </div>
    </div>
  );
}

function PiezaPartido() {
  return (
    <Tarjeta className="overflow-hidden">
      <div className="px-4 pt-4 sm:px-5">
        <Hueso className="h-5 w-2/5" />
        <div className="mt-2 divide-y divide-linea">
          <div className="py-3.5">
            <Hueso className="h-6 w-4/5" />
          </div>
          <div className="py-3.5">
            <Hueso className="h-6 w-3/5" />
          </div>
        </div>
      </div>
      <div className="border-t border-linea bg-fondo/70 px-4 py-3.5 sm:px-5">
        <Hueso className="h-5 w-1/2" />
      </div>
    </Tarjeta>
  );
}

function PiezaCampos({ cantidad }: { cantidad: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {veces(cantidad).map((i) => (
        <div key={i}>
          <Hueso className="h-5 w-28" />
          <Hueso className="mt-2 h-13 rounded-xl" />
        </div>
      ))}
      <Hueso className="h-13 w-44 rounded-xl sm:col-span-2" />
    </div>
  );
}

// ─── Tarjetas en grilla ──────────────────────────────────────────────────────

export function EsqueletoTorneos({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <Esqueleto className={GRILLA}>
      {veces(cantidad).map((i) => (
        <Tarjeta key={i} className="p-5">
          <Hueso className="h-7 w-36 rounded-full" />
          <Hueso className="mt-3.5 h-7 w-3/4" />
          <Hueso className="mt-2.5 h-6 w-2/5" />
          <Hueso className="mt-4 h-5 w-3/5" />
          <Hueso className="mt-2.5 h-5 w-1/2" />
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-linea pt-3.5">
            <Hueso className="h-5 w-28" />
            <Hueso className="h-6 w-24" />
          </div>
          <Hueso className="mt-4 h-11 rounded-xl" />
        </Tarjeta>
      ))}
    </Esqueleto>
  );
}

export function EsqueletoPartidos({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <Esqueleto className={GRILLA}>
      {veces(cantidad).map((i) => (
        <PiezaPartido key={i} />
      ))}
    </Esqueleto>
  );
}

export function EsqueletoParejas({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <Esqueleto className={GRILLA}>
      {veces(cantidad).map((i) => (
        <Tarjeta key={i} className="p-4 sm:p-5">
          <PiezaPersona avatar="size-14" />
          <Hueso className="mt-4 h-7 w-40 rounded-full" />
          <Hueso className="mt-4 h-12 w-48 rounded-xl" />
        </Tarjeta>
      ))}
    </Esqueleto>
  );
}

/** Solicitudes por aprobar: dos integrantes (parejas) o el torneo y la pareja (inscripciones), y los dos botones. */
export function EsqueletoSolicitudes({ cantidad = 2, integrantes = false }: { cantidad?: number; integrantes?: boolean }) {
  return (
    <Esqueleto className={GRILLA}>
      {veces(cantidad).map((i) => (
        <Tarjeta key={i} className="p-5">
          {integrantes ? (
            <div className="space-y-3">
              <PiezaPersona />
              <PiezaPersona />
            </div>
          ) : (
            <>
              <Hueso className="h-6 w-3/5" />
              <Hueso className="mt-3 h-6 w-4/5" />
            </>
          )}
          <Hueso className="mt-4 h-5 w-3/4" />
          <div className="mt-5 flex gap-2.5">
            <Hueso className="h-13 flex-1 rounded-xl" />
            <Hueso className="h-13 flex-1 rounded-xl" />
          </div>
        </Tarjeta>
      ))}
    </Esqueleto>
  );
}

/** Los dos contadores de "Esperan tu decisión" en el inicio de la organización. */
export function EsqueletoPendientes() {
  return (
    <Esqueleto className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {veces(2).map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-linea bg-white/70 p-5">
          <Hueso className="size-16 shrink-0 rounded-2xl" />
          <div className="flex-1">
            <Hueso className="h-6 w-4/5" />
            <Hueso className="mt-2 h-5 w-3/5" />
          </div>
        </div>
      ))}
    </Esqueleto>
  );
}

// ─── Listados ────────────────────────────────────────────────────────────────

/** Una tarjeta con renglones separados por una línea: jugadores, usuarios, torneos abiertos. */
export function EsqueletoLista({ filas = 6, avatar = false }: { filas?: number; avatar?: boolean }) {
  return (
    <Esqueleto>
      <Tarjeta>
        <ul className="divide-y divide-linea">
          {veces(filas).map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              {avatar && <Hueso className="size-12 shrink-0 rounded-full" />}
              <div className="min-w-0 flex-1">
                {/* Anchos distintos por renglón: parejo se ve artificial. */}
                <Hueso className={`h-6 ${["w-3/5", "w-1/2", "w-2/3"][i % 3]}`} />
                <Hueso className="mt-2 h-5 w-2/5" />
              </div>
              <Hueso className="h-7 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </Tarjeta>
    </Esqueleto>
  );
}

/** Renglones sueltos con un botón a la derecha: las listas para elegir dentro de un diálogo. */
export function EsqueletoRenglones({ filas = 3 }: { filas?: number }) {
  return (
    <Esqueleto className="space-y-2">
      {veces(filas).map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-linea p-4">
          <div className="min-w-0 flex-1">
            <Hueso className="h-6 w-3/5" />
            <Hueso className="mt-2 h-5 w-4/5" />
          </div>
          <Hueso className="h-12 w-24 shrink-0 rounded-xl" />
        </div>
      ))}
    </Esqueleto>
  );
}

export function EsqueletoTabla({ filas = 8 }: { filas?: number }) {
  const columnas = "grid grid-cols-[7rem_minmax(0,1fr)] gap-4 px-4 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]";
  return (
    <Esqueleto>
      <Tarjeta className="overflow-hidden">
        <div className={`${columnas} border-b border-linea bg-fondo/70 py-3.5`}>
          <Hueso className="h-5 w-16" />
          <Hueso className="h-5 w-16" />
          <Hueso className="hidden h-5 w-20 md:block" />
          <Hueso className="hidden h-5 w-16 md:block" />
        </div>
        <div className="divide-y divide-linea">
          {veces(filas).map((i) => (
            <div key={i} className={`${columnas} py-4`}>
              <Hueso className="h-5" />
              <Hueso className={`h-5 ${["w-4/5", "w-3/5", "w-2/3"][i % 3]}`} />
              <Hueso className="hidden h-5 w-3/4 md:block" />
              <Hueso className="hidden h-5 md:block" />
            </div>
          ))}
        </div>
      </Tarjeta>
    </Esqueleto>
  );
}

// ─── Fichas y formularios ────────────────────────────────────────────────────

export function EsqueletoFormulario({ campos = 6 }: { campos?: number }) {
  return (
    <Esqueleto>
      <PiezaCampos cantidad={campos} />
    </Esqueleto>
  );
}

/** "Mis datos": la foto, el formulario y la contraseña. */
export function EsqueletoPerfil() {
  return (
    <Esqueleto>
      <Tarjeta className="mb-9 flex flex-col items-center gap-4 p-5 sm:flex-row sm:gap-6 sm:p-6">
        <Hueso className="size-28 shrink-0 rounded-full" />
        <div className="w-full max-w-sm">
          <Hueso className="h-5" />
          <Hueso className="mt-2 h-5 w-3/4" />
        </div>
      </Tarjeta>
      <Tarjeta className="p-5 sm:p-6">
        <PiezaCampos cantidad={8} />
      </Tarjeta>
    </Esqueleto>
  );
}

// ─── Pantallas enteras ───────────────────────────────────────────────────────
// Para las que no pueden dibujar ni el título hasta tener los datos.

/** Ficha de un jugador: encabezado, foto con sus datos y las listas de abajo. */
export function EsqueletoFicha() {
  return (
    <Esqueleto>
      <PiezaEncabezado volver />
      <Tarjeta className="mb-9 flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        <Hueso className="size-28 shrink-0 rounded-full" />
        <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-5 min-[26rem]:grid-cols-2 xl:grid-cols-3">
          {veces(6).map((i) => (
            <div key={i}>
              <Hueso className="h-4 w-20" />
              <Hueso className="mt-2 h-6 w-4/5" />
            </div>
          ))}
        </div>
      </Tarjeta>
      <Hueso className="mb-3 h-7 w-40" />
      <Tarjeta className="divide-y divide-linea">
        {veces(3).map((i) => (
          <div key={i} className="px-4 py-4 sm:px-5">
            <Hueso className="h-6 w-3/5" />
          </div>
        ))}
      </Tarjeta>
    </Esqueleto>
  );
}

/** Detalle de un torneo: encabezado, pestañas y el fixture. */
export function EsqueletoTorneo() {
  return (
    <Esqueleto>
      <PiezaEncabezado volver />
      <div className="mb-6 flex flex-wrap gap-2">
        <Hueso className="h-12 w-28 rounded-full" />
        <Hueso className="h-12 w-24 rounded-full" />
        <Hueso className="h-12 w-28 rounded-full" />
      </div>
      <Hueso className="mb-3 h-7 w-44" />
      <div className={GRILLA}>
        {veces(4).map((i) => (
          <PiezaPartido key={i} />
        ))}
      </div>
    </Esqueleto>
  );
}

/** Encabezado y tarjetas en grilla: sedes, y cualquier pantalla mientras se confirma la sesión. */
export function EsqueletoPantalla({ volver = false }: { volver?: boolean }) {
  return (
    <Esqueleto>
      <PiezaEncabezado volver={volver} />
      <div className={GRILLA}>
        {veces(4).map((i) => (
          <Tarjeta key={i} className="p-5">
            <Hueso className="h-7 w-3/5" />
            <Hueso className="mt-3 h-5 w-4/5" />
            <Hueso className="mt-2.5 h-5 w-1/2" />
            <Hueso className="mt-5 h-11 rounded-xl" />
          </Tarjeta>
        ))}
      </div>
    </Esqueleto>
  );
}

/** Formulario dentro de su tarjeta, con el encabezado: editar un torneo. */
export function EsqueletoPantallaDeFormulario() {
  return (
    <Esqueleto>
      <PiezaEncabezado volver />
      <Tarjeta className="p-5">
        <PiezaCampos cantidad={8} />
      </Tarjeta>
    </Esqueleto>
  );
}
