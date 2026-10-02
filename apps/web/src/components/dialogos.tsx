"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, mensajeDe, traer } from "@/lib/api";
import { deInputLocal, nombreDePareja, paraInputLocal } from "@/lib/formato";
import type { Cancha, Pagina, Pareja, Partido, TorneoDetalle } from "@/lib/tipos";
import { descripcionDePartido } from "./competencia";
import { AreaDeTexto, Boton, Campo, Cargando, Dialogo, ErrorDeFormulario, Paginador, PIE_DE_DIALOGO, Selector, useAviso, Vacio } from "./ui";

// Diálogos de la organización: rechazar con motivo, cargar resultados y armar la agenda.

/** Envoltorio común: maneja envío, error y cierre. */
function useEnvio(alTerminar: () => void, cerrar: () => void) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (accion: () => Promise<unknown>, exito: string) => {
    setError(null);
    setEnviando(true);
    try {
      await accion();
      avisar(exito);
      alTerminar();
      cerrar();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };
  return { error, enviando, enviar };
}

export function DialogoMotivo({ titulo, abierto, cerrar, alConfirmar }: { titulo: string; abierto: boolean; cerrar: () => void; alConfirmar: (motivo: string) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialogo abierto={abierto} cerrar={cerrar} titulo={titulo}>
      <form
        className="space-y-4"
        onSubmit={async (evento) => {
          evento.preventDefault();
          setError(null);
          setEnviando(true);
          try {
            await alConfirmar(String(new FormData(evento.currentTarget).get("motivo")));
            cerrar();
          } catch (e) {
            setError(mensajeDe(e));
          } finally {
            setEnviando(false);
          }
        }}
      >
        <AreaDeTexto etiqueta="Motivo del rechazo" name="motivo" required minLength={3} maxLength={300} placeholder="Los jugadores lo van a ver en su cuenta." />
        <ErrorDeFormulario mensaje={error} />
        <div className={PIE_DE_DIALOGO}>
          <Boton variante="secundario" onClick={cerrar}>
            Volver
          </Boton>
          <Boton type="submit" variante="peligro" cargando={enviando}>
            Rechazar
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Resultado ───────────────────────────────────────────────────────────────

const SETS = [1, 2, 3] as const;

export function DialogoResultado({ partido, cerrar, alTerminar }: { partido: Partido | null; cerrar: () => void; alTerminar: () => void }) {
  return (
    <Dialogo abierto={partido !== null} cerrar={cerrar} titulo={partido?.ganadorId ? "Corregir resultado" : "Cargar resultado"}>
      {partido && <FormularioResultado key={partido.id} partido={partido} cerrar={cerrar} alTerminar={alTerminar} />}
    </Dialogo>
  );
}

function FormularioResultado({ partido, cerrar, alTerminar }: { partido: Partido; cerrar: () => void; alTerminar: () => void }) {
  const { error, enviando, enviar } = useEnvio(alTerminar, cerrar);
  const [wo, setWo] = useState<"" | "1" | "2">(partido.estado === "WO" ? (partido.ganadorId === partido.pareja1Id ? "1" : "2") : "");
  const [superTiebreak, setSuperTiebreak] = useState(partido.sets[2]?.superTiebreak ?? false);
  const nombres = [nombreDePareja(partido.pareja1!), nombreDePareja(partido.pareja2!)];

  const guardar = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    let cuerpo: unknown;
    if (wo) {
      cuerpo = { wo: Number(wo) };
    } else {
      const sets = SETS.map((n) => ({ p1: f.get(`s${n}p1`), p2: f.get(`s${n}p2`), n }))
        .filter((s) => s.p1 !== "" || s.p2 !== "")
        .map((s) => ({ gamesP1: Number(s.p1), gamesP2: Number(s.p2), ...(s.n === 3 && superTiebreak && { superTiebreak: true }) }));
      cuerpo = { sets };
    }
    enviar(() => api.post(`/partidos/${partido.id}/resultado`, cuerpo), "Resultado guardado.");
  };

  return (
    <form onSubmit={guardar} className="space-y-5">
      <p className="text-gris">
        {descripcionDePartido(partido)}, partido {partido.numero}. Escribí los games de cada pareja en cada set.
      </p>

      <fieldset disabled={wo !== ""} className="disabled:opacity-40">
        <legend className="sr-only">Games por set</legend>
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.5rem)] items-center gap-x-2 gap-y-2.5">
          <span />
          {SETS.map((n) => (
            <span key={n} className="text-center text-sm font-semibold text-gris">
              Set {n}
            </span>
          ))}
          {([1, 2] as const).map((lado) => (
            <div key={lado} className="contents">
              <span className="break-words font-semibold leading-snug">{nombres[lado - 1]}</span>
              {SETS.map((n) => {
                const previo = partido.sets.find((s) => s.numero === n);
                return (
                  <input
                    key={n}
                    name={`s${n}p${lado}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    defaultValue={previo ? (lado === 1 ? previo.gamesP1 : previo.gamesP2) : ""}
                    aria-label={`Set ${n}, ${nombres[lado - 1]}`}
                    className="marcador h-14 w-full rounded-xl border-2 border-borde bg-white text-center text-3xl focus:border-pista"
                  />
                );
              })}
            </div>
          ))}
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={superTiebreak} onChange={(e) => setSuperTiebreak(e.target.checked)} className="size-6 shrink-0 accent-pista" />
          El tercer set fue un super tie-break a 10
        </label>
      </fieldset>

      <Selector
        etiqueta="¿Se definió sin jugar?"
        value={wo}
        onChange={(e) => setWo(e.target.value as "" | "1" | "2")}
        opciones={[
          ["", "No, se jugó"],
          ["1", `W.O.: gana ${nombres[0]}`],
          ["2", `W.O.: gana ${nombres[1]}`],
        ]}
      />

      <ErrorDeFormulario mensaje={error} />
      <div className={PIE_DE_DIALOGO}>
        <Boton variante="secundario" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={enviando}>
          Guardar resultado
        </Boton>
      </div>
    </form>
  );
}

// ─── Horario de un partido ───────────────────────────────────────────────────

export function DialogoHorario({ partido, canchas, cerrar, alTerminar }: { partido: Partido | null; canchas: Cancha[]; cerrar: () => void; alTerminar: () => void }) {
  return (
    <Dialogo abierto={partido !== null} cerrar={cerrar} titulo="Día, hora y cancha">
      {partido && <FormularioHorario key={partido.id} partido={partido} canchas={canchas} cerrar={cerrar} alTerminar={alTerminar} />}
    </Dialogo>
  );
}

function FormularioHorario({ partido, canchas, cerrar, alTerminar }: { partido: Partido; canchas: Cancha[]; cerrar: () => void; alTerminar: () => void }) {
  const { error, enviando, enviar } = useEnvio(alTerminar, cerrar);
  const duracionActual = partido.inicio && partido.fin ? Math.round((Date.parse(partido.fin) - Date.parse(partido.inicio)) / 60000) : 90;

  return (
    <form
      className="space-y-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        const f = new FormData(evento.currentTarget);
        enviar(
          () =>
            api.put(`/partidos/${partido.id}/programacion`, {
              inicio: deInputLocal(String(f.get("inicio"))),
              canchaId: Number(f.get("canchaId")),
              duracionMin: Number(f.get("duracionMin")),
            }),
          "Horario guardado.",
        );
      }}
    >
      <p className="text-gris">
        {descripcionDePartido(partido)}, partido {partido.numero}
      </p>
      <Campo etiqueta="Día y hora de inicio" name="inicio" type="datetime-local" defaultValue={partido.inicio ? paraInputLocal(partido.inicio) : ""} required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Selector etiqueta="Cancha" name="canchaId" defaultValue={partido.canchaId ?? ""} vacio="Elegí" required opciones={canchas.map((c) => [c.id, c.nombre] as const)} />
        <Campo etiqueta="Duración (minutos)" name="duracionMin" type="number" min={30} max={240} step={15} defaultValue={duracionActual} required />
      </div>
      <ErrorDeFormulario mensaje={error} />
      <div className={PIE_DE_DIALOGO}>
        {partido.inicio && (
          <Boton
            variante="fantasma"
            className="sm:mr-auto"
            disabled={enviando}
            onClick={() => enviar(() => api.put(`/partidos/${partido.id}/programacion`, { inicio: null, canchaId: null }), "Partido sin horario.")}
          >
            Quitar horario
          </Boton>
        )}
        <Boton variante="secundario" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={enviando}>
          Guardar horario
        </Boton>
      </div>
    </form>
  );
}

// ─── Agenda automática ───────────────────────────────────────────────────────

export function DialogoAgenda({ torneo, abierto, cerrar, alTerminar }: { torneo: TorneoDetalle; abierto: boolean; cerrar: () => void; alTerminar: () => void }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const sinHorario = torneo.partidos.filter((p) => !p.inicio && !p.ganadorId).length;

  return (
    <Dialogo abierto={abierto} cerrar={cerrar} titulo="Armar la agenda">
      <form
        className="space-y-4"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const f = new FormData(evento.currentTarget);
          setError(null);
          setEnviando(true);
          try {
            const r = await api.post<{ programados: number; sinProgramar: number }>(`/partidos/programar-torneo/${torneo.id}`, {
              desde: deInputLocal(String(f.get("desde"))),
              duracionMin: Number(f.get("duracionMin")),
              turnosPorDia: Number(f.get("turnosPorDia")),
              canchaIds: f.getAll("canchas").map(Number),
            });
            avisar(
              r.sinProgramar > 0
                ? `Se programaron ${r.programados} partidos. Quedaron ${r.sinProgramar} sin lugar: sumá turnos o canchas.`
                : `Se programaron ${r.programados} partidos.`,
            );
            alTerminar();
            cerrar();
          } catch (e) {
            setError(mensajeDe(e));
          } finally {
            setEnviando(false);
          }
        }}
      >
        <p className="text-gris">
          Reparte los {sinHorario} partidos sin horario en turnos seguidos, sin poner a un jugador en dos canchas a la vez ni pisar canchas
          ocupadas. Después podés mover cualquier partido a mano.
        </p>
        <Campo etiqueta="Primer turno" name="desde" type="datetime-local" defaultValue={`${torneo.fechaInicio.slice(0, 10)}T18:00`} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Duración del turno (min)" name="duracionMin" type="number" min={30} max={240} step={15} defaultValue={90} required />
          <Campo etiqueta="Turnos por día" name="turnosPorDia" type="number" min={1} max={16} defaultValue={4} required />
        </div>
        <fieldset>
          <legend className="mb-1.5 font-semibold">Canchas de {torneo.sede.nombre}</legend>
          <div className="flex flex-wrap gap-2">
            {torneo.sede.canchas.map((cancha) => (
              <label key={cancha.id} className="flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-borde px-4 font-semibold has-checked:border-pista has-checked:bg-pista-50">
                <input type="checkbox" name="canchas" value={cancha.id} defaultChecked className="size-6 shrink-0 accent-pista" />
                {cancha.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorDeFormulario mensaje={error} />
        <div className={PIE_DE_DIALOGO}>
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando} disabled={sinHorario === 0}>
            Programar partidos
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

// ─── Inscribir una pareja desde la organización ──────────────────────────────

export function DialogoInscribirPareja({ torneo, abierto, cerrar, alTerminar }: { torneo: TorneoDetalle; abierto: boolean; cerrar: () => void; alTerminar: () => void }) {
  const avisar = useAviso();
  const [pagina, setPagina] = useState(1);
  const [enCurso, setEnCurso] = useState<number | null>(null);
  const { data } = useSWR<Pagina<Pareja>>(abierto ? `/parejas?estado=ACTIVA&pagina=${pagina}` : null, traer);
  const yaAnotadas = new Set(torneo.inscripciones.filter((i) => ["PENDIENTE", "APROBADA", "EN_ESPERA"].includes(i.estado)).map((i) => i.pareja.id));

  const inscribir = async (pareja: Pareja) => {
    setEnCurso(pareja.id);
    try {
      const r = await api.post<{ estado: string }>(`/torneos/${torneo.id}/inscripciones`, { parejaId: pareja.id });
      avisar(r.estado === "EN_ESPERA" ? "Cupo completo: la pareja quedó en lista de espera." : "Pareja inscripta.");
      alTerminar();
    } catch (e) {
      avisar(mensajeDe(e), "mal");
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <Dialogo abierto={abierto} cerrar={cerrar} titulo="Inscribir una pareja">
      {!data ? (
        <Cargando />
      ) : data.items.length === 0 ? (
        <Vacio titulo="No hay parejas activas" />
      ) : (
        <>
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {data.items.map((pareja) => (
              <li key={pareja.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linea px-4 py-3">
                <span className="min-w-0">
                  <span className="block break-words font-semibold leading-snug">{nombreDePareja(pareja)}</span>
                  <span className="text-sm text-gris">
                    {pareja.jugador1.categoria.nombre} y {pareja.jugador2.categoria.nombre}
                  </span>
                </span>
                {yaAnotadas.has(pareja.id) ? (
                  <span className="font-semibold text-gris">Ya anotada</span>
                ) : (
                  <Boton tamano="chico" variante="secundario" cargando={enCurso === pareja.id} onClick={() => inscribir(pareja)}>
                    Inscribir
                  </Boton>
                )}
              </li>
            ))}
          </ul>
          <Paginador pagina={data.pagina} paginas={data.paginas} cambiar={setPagina} />
        </>
      )}
    </Dialogo>
  );
}
