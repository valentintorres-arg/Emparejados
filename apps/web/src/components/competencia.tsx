"use client";

import { ESTADOS_PARTIDO, horario, INSTANCIAS, nombreDePareja } from "@/lib/formato";
import type { FilaPosicion, ParejaBasica, Partido } from "@/lib/tipos";
import { Estado, Tarjeta } from "./ui";

// Piezas del fixture: el partido como tablero de resultados, la llave de
// eliminación y la tabla de posiciones de una zona.

/** La pelota marca al ganador, igual que en un tablero de cancha. */
function Pelota({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${visible ? "bg-pelota ring-1 ring-tinta/40" : "bg-transparent"}`}
    />
  );
}

export function descripcionDePartido(partido: Partido) {
  return partido.instancia === "ZONA" ? `Zona ${partido.zona?.nombre ?? ""}` : INSTANCIAS[partido.instancia];
}

function FilaDeMarcador({ pareja, lado, partido }: { pareja: ParejaBasica | null; lado: 1 | 2; partido: Partido }) {
  const gano = pareja !== null && partido.ganadorId === pareja.id;
  const terminado = partido.ganadorId !== null;
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Pelota visible={gano} />
      <span className={`min-w-0 flex-1 truncate ${gano ? "font-bold" : terminado ? "text-gris" : "font-medium"}`}>
        {pareja ? nombreDePareja(pareja) : <span className="font-normal text-gris">A definir</span>}
        {gano && <span className="sr-only"> (ganó)</span>}
      </span>
      <span className="flex gap-3">
        {partido.sets.map((set) => {
          const propios = lado === 1 ? set.gamesP1 : set.gamesP2;
          const rivales = lado === 1 ? set.gamesP2 : set.gamesP1;
          return (
            <span key={set.numero} className={`marcador w-6 text-center text-2xl ${propios > rivales ? "text-tinta" : "text-gris/60"}`}>
              {propios}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export function TarjetaPartido({ partido, contexto, acciones }: { partido: Partido; contexto?: React.ReactNode; acciones?: React.ReactNode }) {
  const mostrarEstado = partido.estado !== "PROGRAMADO" && partido.estado !== "FINALIZADO";
  return (
    <Tarjeta className={partido.estado === "EN_JUEGO" ? "border-tinta/30 shadow-[inset_4px_0_0_var(--color-pelota)]" : ""}>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between gap-2 text-sm text-gris">
          <span className="min-w-0 truncate">
            <span className="font-semibold text-tinta">{descripcionDePartido(partido)}</span>
            <span className="mx-1.5">Partido {partido.numero}</span>
            {contexto}
          </span>
          {mostrarEstado && <Estado valor={ESTADOS_PARTIDO[partido.estado]} />}
        </div>
        <div className="mt-1 divide-y divide-linea">
          <FilaDeMarcador pareja={partido.pareja1} lado={1} partido={partido} />
          <FilaDeMarcador pareja={partido.pareja2} lado={2} partido={partido} />
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-linea bg-fondo/50 px-4 py-2 text-sm">
        <span className="text-gris">
          {partido.inicio ? (
            <>
              <span className="font-semibold capitalize text-tinta">{horario(partido.inicio)}</span>
              {partido.cancha && <span className="ml-2">{partido.cancha.nombre}</span>}
            </>
          ) : (
            "Sin horario todavía"
          )}
        </span>
        {acciones && <span className="flex flex-wrap gap-2">{acciones}</span>}
      </div>
    </Tarjeta>
  );
}

// ─── Llave ───────────────────────────────────────────────────────────────────

// Espacio medio (U+2002): la tipografía condensada casi no separa con un espacio común.
const ESPACIO_ENTRE_SETS = String.fromCharCode(0x2002);

function resumenDeSets(partido: Partido, lado: 1 | 2) {
  if (partido.estado === "WO") return partido.ganadorId === (lado === 1 ? partido.pareja1Id : partido.pareja2Id) ? "W.O." : "";
  return partido.sets.map((s) => (lado === 1 ? s.gamesP1 : s.gamesP2)).join(ESPACIO_ENTRE_SETS);
}

function CajaDeLlave({ partido, alElegir }: { partido: Partido; alElegir?: (partido: Partido) => void }) {
  const fila = (pareja: ParejaBasica | null, lado: 1 | 2) => {
    const gano = pareja !== null && partido.ganadorId === pareja.id;
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Pelota visible={gano} />
        <span className={`min-w-0 flex-1 truncate text-sm ${gano ? "font-bold" : partido.ganadorId ? "text-gris" : ""}`}>
          {pareja ? nombreDePareja(pareja) : <span className="text-gris">A definir</span>}
        </span>
        <span className="marcador text-base">{resumenDeSets(partido, lado)}</span>
      </div>
    );
  };
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-linea bg-fondo/60 px-2.5 py-1 text-xs text-gris">
        <span className="font-semibold text-tinta">{INSTANCIAS[partido.instancia]}</span>
        <span className="truncate capitalize">{partido.inicio ? horario(partido.inicio) : `Partido ${partido.numero}`}</span>
      </div>
      <div className="divide-y divide-linea">
        {fila(partido.pareja1, 1)}
        {fila(partido.pareja2, 2)}
      </div>
    </>
  );
  const clases = `block w-56 overflow-hidden rounded-md border bg-white text-left ${partido.estado === "EN_JUEGO" ? "border-tinta/40 shadow-[inset_4px_0_0_var(--color-pelota)]" : "border-linea"}`;
  return alElegir ? (
    <button type="button" onClick={() => alElegir(partido)} className={`${clases} hover:border-pista`}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

/** Dibuja la llave desde la final hacia atrás, siguiendo a qué partido avanza cada ganador. */
export function Llave({ partidos, alElegir }: { partidos: Partido[]; alElegir?: (partido: Partido) => void }) {
  const deLlave = partidos.filter((p) => p.instancia !== "ZONA");
  const final = deLlave.find((p) => p.siguientePartidoId === null);
  if (!final) return null;
  const previo = (partido: Partido, slot: 1 | 2) =>
    deLlave.find((p) => p.siguientePartidoId === partido.id && p.siguienteSlot === slot);

  const dibujar = (partido: Partido): React.ReactNode => {
    const previos = [previo(partido, 1), previo(partido, 2)];
    const cantidad = previos.filter(Boolean).length;
    return (
      <div className="flex items-center">
        {cantidad > 0 && (
          <div className="flex flex-col items-end">
            {previos.map(
              (p, i) =>
                p && (
                  <div key={p.id} className={`rama py-1.5 ${cantidad === 2 ? (i === 0 ? "rama-arriba" : "rama-abajo") : ""}`}>
                    {dibujar(p)}
                  </div>
                ),
            )}
          </div>
        )}
        <div className={cantidad > 0 ? "llave-destino" : ""}>
          <CajaDeLlave partido={partido} alElegir={alElegir} />
        </div>
      </div>
    );
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" tabIndex={0} role="group" aria-label="Llave del torneo">
      <div className="inline-block min-w-full">
        {dibujar(final)}
      </div>
    </div>
  );
}

// ─── Posiciones ──────────────────────────────────────────────────────────────

export function TablaPosiciones({ nombre, filas, clasifican = 0 }: { nombre: string; filas: FilaPosicion[]; clasifican?: number }) {
  return (
    <Tarjeta className="overflow-hidden">
      <table className="w-full text-sm">
        <caption className="titulo border-b border-linea bg-fondo/60 px-4 py-2 text-left text-lg">Zona {nombre}</caption>
        <thead>
          <tr className="text-left text-xs text-gris">
            <th scope="col" className="py-2 pl-4 font-semibold">Pareja</th>
            <th scope="col" className="px-2 text-center font-semibold" title="Partidos jugados">PJ</th>
            <th scope="col" className="px-2 text-center font-semibold" title="Partidos ganados">PG</th>
            <th scope="col" className="hidden px-2 text-center font-semibold sm:table-cell" title="Diferencia de sets">Sets</th>
            <th scope="col" className="hidden px-2 text-center font-semibold sm:table-cell" title="Diferencia de games">Games</th>
            <th scope="col" className="py-2 pl-2 pr-4 text-right font-semibold">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={fila.parejaId} className="border-t border-linea">
              <th scope="row" className={`py-2.5 pl-4 text-left font-semibold ${i < clasifican ? "shadow-[inset_4px_0_0_var(--color-pista)]" : ""}`}>
                <span className="marcador mr-2.5 inline-block w-4 text-base text-gris">{i + 1}</span>
                {nombreDePareja(fila.pareja)}
              </th>
              <td className="px-2 text-center">{fila.jugados}</td>
              <td className="px-2 text-center">{fila.ganados}</td>
              <td className="hidden px-2 text-center sm:table-cell">{fila.setsFavor - fila.setsContra}</td>
              <td className="hidden px-2 text-center sm:table-cell">{fila.gamesFavor - fila.gamesContra}</td>
              <td className="marcador py-2.5 pl-2 pr-4 text-right text-xl">{fila.puntos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}
