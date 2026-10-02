"use client";

import { ESTADOS_PARTIDO, horario, INSTANCIAS, nombreDePareja } from "@/lib/formato";
import type { FilaPosicion, ParejaBasica, Partido } from "@/lib/tipos";
import { Estado, Icono, Tarjeta } from "./ui";

// Piezas del fixture: el partido como tablero de resultados, la llave de
// eliminación y la tabla de posiciones de una zona.

/** La pelota marca al ganador, igual que en un tablero de cancha. */
function Pelota({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3.5 shrink-0 rounded-full ${visible ? "bg-pelota ring-1 ring-tinta/50" : "bg-transparent"}`}
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
    <div className="flex items-center gap-3 py-2.5">
      <Pelota visible={gano} />
      {/* El nombre no se corta: si no entra, baja a otro renglón. */}
      <span className={`min-w-0 flex-1 break-words text-lg leading-snug ${gano ? "font-bold" : terminado ? "text-gris" : "font-semibold"}`}>
        {pareja ? nombreDePareja(pareja) : <span className="font-normal text-gris">A definir</span>}
        {gano && <span className="sr-only"> (ganó)</span>}
      </span>
      <span className="flex gap-1.5">
        {partido.sets.map((set) => {
          const propios = lado === 1 ? set.gamesP1 : set.gamesP2;
          const rivales = lado === 1 ? set.gamesP2 : set.gamesP1;
          return (
            <span
              key={set.numero}
              className={`marcador flex h-10 w-8 items-center justify-center rounded-lg text-3xl ${propios > rivales ? "bg-pista-50 text-tinta" : "text-gris"}`}
            >
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
    <Tarjeta className={`flex h-full flex-col overflow-hidden ${partido.estado === "EN_JUEGO" ? "border-tinta/40 ring-2 ring-pelota" : ""}`}>
      <div className="flex-1 px-4 pt-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-gris">
          <span className="min-w-0">
            <span className="font-bold text-pista">{descripcionDePartido(partido)}</span>
            <span className="mx-2">Partido {partido.numero}</span>
            {contexto && <span className="block">{contexto}</span>}
          </span>
          {mostrarEstado && <Estado valor={ESTADOS_PARTIDO[partido.estado]} />}
        </div>
        <div className="mt-1 divide-y divide-linea">
          <FilaDeMarcador pareja={partido.pareja1} lado={1} partido={partido} />
          <FilaDeMarcador pareja={partido.pareja2} lado={2} partido={partido} />
        </div>
      </div>
      <div className="mt-1 border-t border-linea bg-fondo/70 px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-gris">
          <Icono nombre="reloj" className="size-5 shrink-0" />
          {partido.inicio ? (
            <span>
              <span className="font-bold capitalize text-tinta">{horario(partido.inicio)}</span>
              {partido.cancha && <span className="ml-2">{partido.cancha.nombre}</span>}
            </span>
          ) : (
            "Sin horario todavía"
          )}
        </p>
        {acciones && <div className="mt-3 flex flex-wrap gap-2 empty:hidden">{acciones}</div>}
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
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Pelota visible={gano} />
        <span className={`min-w-0 flex-1 break-words leading-snug ${gano ? "font-bold" : partido.ganadorId ? "text-gris" : "font-semibold"}`}>
          {pareja ? nombreDePareja(pareja) : <span className="font-normal text-gris">A definir</span>}
        </span>
        <span className="marcador text-xl">{resumenDeSets(partido, lado)}</span>
      </div>
    );
  };
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-linea bg-fondo/70 px-3 py-1.5 text-sm text-gris">
        <span className="font-bold text-pista">{INSTANCIAS[partido.instancia]}</span>
        <span className="truncate capitalize">{partido.inicio ? horario(partido.inicio) : `Partido ${partido.numero}`}</span>
      </div>
      <div className="divide-y divide-linea">
        {fila(partido.pareja1, 1)}
        {fila(partido.pareja2, 2)}
      </div>
    </>
  );
  const clases = `block w-72 overflow-hidden rounded-xl border bg-white text-left shadow-tarjeta ${partido.estado === "EN_JUEGO" ? "border-tinta/40 ring-2 ring-pelota" : "border-linea"}`;
  return alElegir ? (
    <button type="button" onClick={() => alElegir(partido)} className={`${clases} hover:border-pista hover:bg-pista-50/40`}>
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
                  <div key={p.id} className={`rama py-2 ${cantidad === 2 ? (i === 0 ? "rama-arriba" : "rama-abajo") : ""}`}>
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
    <>
      {/* En el celular la llave no entra a lo ancho: se avisa que sigue hacia el costado. */}
      {deLlave.length > 1 && <p className="mb-3 text-gris lg:hidden">Deslizá hacia el costado para ver las rondas que siguen hasta la final.</p>}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" tabIndex={0} role="group" aria-label="Llave del torneo">
        <div className="inline-block min-w-full">
          {dibujar(final)}
        </div>
      </div>
    </>
  );
}

// ─── Posiciones ──────────────────────────────────────────────────────────────

export function TablaPosiciones({ nombre, filas, clasifican = 0 }: { nombre: string; filas: FilaPosicion[]; clasifican?: number }) {
  return (
    <Tarjeta className="overflow-hidden">
      <table className="w-full">
        <caption className="titulo border-b border-linea bg-fondo/70 px-4 py-3 text-left text-xl">Zona {nombre}</caption>
        <thead>
          <tr className="text-left text-sm text-gris">
            <th scope="col" className="py-2.5 pl-4 font-semibold">Pareja</th>
            {/* Las palabras enteras cuando hay lugar; en el celular, la sigla con su aclaración al pie. */}
            <th scope="col" className="px-2 text-center font-semibold">
              <span className="sm:hidden" aria-hidden="true">PJ</span>
              <span className="max-sm:sr-only">Jugados</span>
            </th>
            <th scope="col" className="px-2 text-center font-semibold">
              <span className="sm:hidden" aria-hidden="true">PG</span>
              <span className="max-sm:sr-only">Ganados</span>
            </th>
            <th scope="col" className="hidden px-2 text-center font-semibold sm:table-cell" title="Diferencia de sets">Sets</th>
            <th scope="col" className="hidden px-2 text-center font-semibold sm:table-cell" title="Diferencia de games">Games</th>
            <th scope="col" className="py-2.5 pl-2 pr-4 text-right font-semibold">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={fila.parejaId} className="border-t border-linea">
              <th scope="row" className={`py-3 pl-4 text-left font-semibold leading-snug ${i < clasifican ? "shadow-[inset_5px_0_0_var(--color-pista)]" : ""}`}>
                <span className="flex items-center gap-3">
                  <span className="marcador w-4 shrink-0 text-xl text-gris">{i + 1}</span>
                  <span className="min-w-0 break-words">{nombreDePareja(fila.pareja)}</span>
                </span>
              </th>
              <td className="px-2 text-center">{fila.jugados}</td>
              <td className="px-2 text-center">{fila.ganados}</td>
              <td className="hidden px-2 text-center sm:table-cell">{fila.setsFavor - fila.setsContra}</td>
              <td className="hidden px-2 text-center sm:table-cell">{fila.gamesFavor - fila.gamesContra}</td>
              <td className="marcador py-3 pl-2 pr-4 text-right text-2xl">{fila.puntos}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-linea px-4 py-2 text-sm text-gris sm:hidden">PJ: partidos jugados. PG: partidos ganados.</p>
    </Tarjeta>
  );
}
