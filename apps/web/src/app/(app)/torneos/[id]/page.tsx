"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Llave, TablaPosiciones, TarjetaPartido } from "@/components/competencia";
import { DialogoAgenda, DialogoHorario, DialogoInscribirPareja, DialogoMotivo, DialogoResultado } from "@/components/dialogos";
import { EsqueletoTorneo } from "@/components/esqueletos";
import { Boton, Encabezado, ENLACE, Estado, FalloDeCarga, Icono, Seccion, Tarjeta, useAccion, useConfirmar, Vacio } from "@/components/ui";
import { api, traer } from "@/lib/api";
import { dia, ESTADOS_INSCRIPCION, ESTADOS_TORNEO, fechaYHora, FORMATOS, nombreCompleto, nombreDePareja, RAMAS, rangoDeFechas, resumenDePago } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { EstadoInscripcion, Inscripcion, Pareja, Partido, TorneoDetalle, TorneoResumen } from "@/lib/tipos";

type Pestana = "fixture" | "llave" | "posiciones" | "parejas" | "reglamento";

const VIGENTES: EstadoInscripcion[] = ["PENDIENTE", "APROBADA", "EN_ESPERA"];

// ─── Campeones ───────────────────────────────────────────────────────────────

function parejaCampeona(torneo: TorneoDetalle) {
  if (torneo.estado !== "FINALIZADO") return null;
  const final = torneo.partidos.find((p) => p.instancia === "FINAL");
  if (final?.ganadorId) return final.ganadorId === final.pareja1?.id ? final.pareja1 : final.pareja2;
  return torneo.zonas[0]?.posiciones[0]?.pareja ?? null;
}

/** Cuántos jugadores de las parejas inscriptas ya pagaron. Solo la organización recibe los pagos. */
const jugadoresQuePagaron = (torneo: TorneoDetalle) =>
  torneo.inscripciones.filter((i) => i.estado === "APROBADA").reduce((total, i) => total + (i.pagos?.length ?? 0), 0);

// ─── Gestión de la organización ──────────────────────────────────────────────

function Gestion({ torneo, recargar }: { torneo: TorneoDetalle; recargar: () => void }) {
  const router = useRouter();
  const { ejecutar, enCurso } = useAccion();
  const confirmar = useConfirmar();
  const [dialogo, setDialogo] = useState<"agenda" | "inscribir" | null>(null);

  const aprobadas = torneo.inscripciones.filter((i) => i.estado === "APROBADA").length;
  const sinPagar = aprobadas * 2 - jugadoresQuePagaron(torneo);
  const porResolver = torneo.inscripciones.filter((i) => i.estado === "PENDIENTE").length;
  const sinHorario = torneo.partidos.filter((p) => !p.inicio && !p.ganadorId).length;
  const deZonaSinJugar = torneo.partidos.filter((p) => p.instancia === "ZONA" && !p.ganadorId).length;
  const tieneLlave = torneo.partidos.some((p) => p.instancia !== "ZONA");

  const cambiarEstado = (estado: string, exito: string) =>
    ejecutar(estado, () => api.post(`/torneos/${torneo.id}/estado`, { estado }), exito).then((ok) => ok && recargar());

  let guia: string;
  switch (torneo.estado) {
    case "BORRADOR":
      guia = "El torneo todavía no es público. Abrí la inscripción para que las parejas se anoten.";
      break;
    case "INSCRIPCION_ABIERTA":
      guia =
        aprobadas < 2
          ? `Hay ${aprobadas} de ${torneo.cupoMaximo} parejas aprobadas. Hacen falta al menos 2 para sortear.`
          : `Hay ${aprobadas} de ${torneo.cupoMaximo} parejas aprobadas${porResolver ? ` y ${porResolver} solicitudes sin resolver` : ""}. Al sortear se cierra la inscripción y se arma el fixture.`;
      break;
    case "EN_CURSO":
      guia = sinHorario
        ? `Quedan ${sinHorario} partidos sin día ni cancha.`
        : torneo.formato === "ZONAS_Y_LLAVES" && !tieneLlave
          ? deZonaSinJugar
            ? `Faltan ${deZonaSinJugar} resultados de zona para poder generar las llaves.`
            : "Las zonas terminaron. Generá las llaves con los dos primeros de cada una."
          : "Cargá los resultados desde el fixture: cada ganador pasa solo a la ronda siguiente.";
      break;
    default:
      return null;
  }

  return (
    <Tarjeta className="mb-7 border-pista/30 bg-pista-50 p-5">
      <h2 className="titulo text-xl">Gestión del torneo</h2>
      <p className="mt-1 text-lg">{guia}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {torneo.estado === "BORRADOR" && (
          <Boton tamano="chico" cargando={enCurso === "INSCRIPCION_ABIERTA"} onClick={() => cambiarEstado("INSCRIPCION_ABIERTA", "Inscripción abierta. El torneo ya es público.")}>
            Abrir inscripción
          </Boton>
        )}
        {torneo.estado === "INSCRIPCION_ABIERTA" && (
          <>
            <Boton
              tamano="chico"
              disabled={aprobadas < 2}
              cargando={enCurso === "sorteo"}
              onClick={() =>
                confirmar({
                  titulo: `¿Sortear con ${aprobadas} parejas?`,
                  texto: `Se cierra la inscripción, se arma el fixture y ya no se pueden agregar parejas.${
                    sinPagar > 0 ? ` Todavía ${sinPagar === 1 ? "falta pagar 1 jugador" : `faltan pagar ${sinPagar} jugadores`}: lo podés anotar después.` : ""
                  }`,
                  confirmar: "Sortear fixture",
                }).then((si) => si && ejecutar("sorteo", () => api.post(`/torneos/${torneo.id}/sorteo`), "Fixture sorteado.").then((ok) => ok && recargar()))
              }
            >
              Sortear fixture
            </Boton>
            <Boton tamano="chico" variante="secundario" icono="mas" onClick={() => setDialogo("inscribir")}>
              Inscribir pareja
            </Boton>
            <Boton tamano="chico" variante="fantasma" cargando={enCurso === "BORRADOR"} onClick={() => cambiarEstado("BORRADOR", "El torneo volvió a borrador.")}>
              Volver a borrador
            </Boton>
          </>
        )}
        {torneo.estado === "EN_CURSO" && (
          <>
            {sinHorario > 0 && (
              <Boton tamano="chico" icono="reloj" onClick={() => setDialogo("agenda")}>
                Armar la agenda
              </Boton>
            )}
            {torneo.formato === "ZONAS_Y_LLAVES" && !tieneLlave && (
              <Boton
                tamano="chico"
                variante={sinHorario > 0 ? "secundario" : "primario"}
                disabled={deZonaSinJugar > 0}
                cargando={enCurso === "llaves"}
                onClick={() => ejecutar("llaves", () => api.post(`/torneos/${torneo.id}/llaves`), "Llaves generadas.").then((ok) => ok && recargar())}
              >
                Generar llaves
              </Boton>
            )}
            <Boton
              tamano="chico"
              variante="fantasma"
              cargando={enCurso === "FINALIZADO"}
              onClick={() =>
                confirmar({ titulo: "¿Dar el torneo por finalizado?", texto: "Ya no se van a poder cargar ni corregir resultados.", confirmar: "Finalizar torneo" }).then(
                  (si) => si && cambiarEstado("FINALIZADO", "Torneo finalizado."),
                )
              }
            >
              Finalizar torneo
            </Boton>
          </>
        )}
        {torneo.estado !== "EN_CURSO" && (
          <Boton tamano="chico" variante="secundario" icono="editar" href={`/admin/torneos/${torneo.id}/editar`}>
            Editar datos
          </Boton>
        )}
        {torneo.estado === "BORRADOR" ? (
          <Boton
            tamano="chico"
            variante="peligro"
            cargando={enCurso === "borrar"}
            onClick={() =>
              confirmar({ titulo: `¿Borrar "${torneo.nombre}"?`, texto: "No se puede deshacer.", confirmar: "Borrar torneo", peligro: true }).then(
                (si) => si && ejecutar("borrar", () => api.del(`/torneos/${torneo.id}`), "Torneo borrado.").then((ok) => ok && router.replace("/torneos")),
              )
            }
          >
            Borrar
          </Boton>
        ) : (
          <Boton
            tamano="chico"
            variante="peligro"
            cargando={enCurso === "CANCELADO"}
            onClick={() =>
              confirmar({
                titulo: `¿Cancelar "${torneo.nombre}"?`,
                texto: "Queda visible como cancelado y no se puede reabrir.",
                confirmar: "Cancelar torneo",
                peligro: true,
              }).then((si) => si && cambiarEstado("CANCELADO", "Torneo cancelado."))
            }
          >
            Cancelar torneo
          </Boton>
        )}
      </div>
      <DialogoAgenda torneo={torneo} abierto={dialogo === "agenda"} cerrar={() => setDialogo(null)} alTerminar={recargar} />
      <DialogoInscribirPareja torneo={torneo} abierto={dialogo === "inscribir"} cerrar={() => setDialogo(null)} alTerminar={recargar} />
    </Tarjeta>
  );
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

function Fixture({ torneo, esAdmin, recargar }: { torneo: TorneoDetalle; esAdmin: boolean; recargar: () => void }) {
  const { ejecutar, enCurso } = useAccion();
  const [resultado, setResultado] = useState<Partido | null>(null);
  const [horario, setHorario] = useState<Partido | null>(null);
  const editable = esAdmin && torneo.estado === "EN_CURSO";

  // Agrupa por día de juego; los que no tienen horario van al final.
  const grupos = new Map<string, Partido[]>();
  const ordenados = [...torneo.partidos].sort((a, b) => (a.inicio ?? "9").localeCompare(b.inicio ?? "9") || a.numero - b.numero);
  for (const partido of ordenados) {
    const clave = partido.inicio ? dia(partido.inicio) : "Sin horario";
    grupos.set(clave, [...(grupos.get(clave) ?? []), partido]);
  }

  const cambiarEstado = (partido: Partido, estado: string) =>
    ejecutar(`${partido.id}-${estado}`, () => api.post(`/partidos/${partido.id}/estado`, { estado })).then((ok) => ok && recargar());

  const acciones = (partido: Partido) => {
    if (!editable) return null;
    const conParejas = partido.pareja1 !== null && partido.pareja2 !== null;
    const sinResultado = partido.ganadorId === null;
    return (
      <>
        {sinResultado && partido.estado === "PROGRAMADO" && conParejas && (
          <Boton tamano="chico" variante="fantasma" cargando={enCurso === `${partido.id}-EN_JUEGO`} onClick={() => cambiarEstado(partido, "EN_JUEGO")}>
            Empezó
          </Boton>
        )}
        {sinResultado && partido.estado !== "SUSPENDIDO" && partido.inicio && (
          <Boton tamano="chico" variante="fantasma" cargando={enCurso === `${partido.id}-SUSPENDIDO`} onClick={() => cambiarEstado(partido, "SUSPENDIDO")}>
            Suspender
          </Boton>
        )}
        {partido.estado === "SUSPENDIDO" && (
          <Boton tamano="chico" variante="fantasma" cargando={enCurso === `${partido.id}-PROGRAMADO`} onClick={() => cambiarEstado(partido, "PROGRAMADO")}>
            Reanudar
          </Boton>
        )}
        {sinResultado && (
          <Boton tamano="chico" variante="secundario" onClick={() => setHorario(partido)}>
            Horario
          </Boton>
        )}
        {conParejas && (
          <Boton tamano="chico" variante={sinResultado ? "primario" : "secundario"} onClick={() => setResultado(partido)}>
            {sinResultado ? "Cargar resultado" : "Corregir"}
          </Boton>
        )}
      </>
    );
  };

  return (
    <>
      {[...grupos].map(([titulo, partidos]) => (
        <section key={titulo} className="mb-8">
          <h3 className="titulo mb-3 text-xl first-letter:uppercase">{titulo}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {partidos.map((partido) => (
              <TarjetaPartido key={partido.id} partido={partido} acciones={acciones(partido)} />
            ))}
          </div>
        </section>
      ))}
      <DialogoResultado partido={resultado} cerrar={() => setResultado(null)} alTerminar={recargar} />
      <DialogoHorario partido={horario} canchas={torneo.sede.canchas} cerrar={() => setHorario(null)} alTerminar={recargar} />
    </>
  );
}

// ─── Parejas inscriptas ──────────────────────────────────────────────────────

function FilaDeInscripcion({ inscripcion, torneo, esAdmin, recargar }: { inscripcion: Inscripcion; torneo: TorneoDetalle; esAdmin: boolean; recargar: () => void }) {
  const { ejecutar, enCurso } = useAccion();
  const [rechazando, setRechazando] = useState(false);
  const abierta = esAdmin && torneo.estado === "INSCRIPCION_ABIERTA";
  const ruta = `/inscripciones/${inscripcion.id}`;
  const { pareja } = inscripcion;

  const hacer = (accion: string, cuerpo: unknown, exito: string) =>
    ejecutar(accion, () => api.post(`${ruta}/${accion}`, cuerpo), exito).then((ok) => ok && recargar());

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-4 sm:px-5">
      {inscripcion.siembra !== null && (
        <span className="marcador flex size-9 shrink-0 items-center justify-center rounded-full bg-pista text-xl text-white" title="Cabeza de serie">
          {inscripcion.siembra}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block break-words text-lg font-semibold leading-snug">
          {nombreCompleto(pareja.jugador1)} y {nombreCompleto(pareja.jugador2)}
        </span>
        <span className="text-gris">
          {pareja.jugador1.categoria.nombre} y {pareja.jugador2.categoria.nombre}
          {inscripcion.motivoRechazo && `. Motivo: ${inscripcion.motivoRechazo}`}
        </span>
      </span>
      {esAdmin && <Estado valor={ESTADOS_INSCRIPCION[inscripcion.estado]} />}
      {abierta && (
        <span className="flex w-full flex-wrap gap-2 sm:w-auto">
          {(inscripcion.estado === "PENDIENTE" || inscripcion.estado === "EN_ESPERA") && (
            <Boton tamano="chico" cargando={enCurso === "aprobar"} onClick={() => hacer("aprobar", {}, "Inscripción resuelta.")}>
              Aprobar
            </Boton>
          )}
          {inscripcion.estado === "APROBADA" && (
            <label className="flex items-center gap-2 font-semibold text-gris">
              Siembra
              <input
                type="number"
                min={1}
                max={64}
                defaultValue={inscripcion.siembra ?? ""}
                aria-label={`Siembra de ${nombreDePareja(pareja)}`}
                className="marcador h-11 w-16 rounded-xl border-2 border-borde bg-white text-center text-2xl text-tinta"
                onBlur={(e) => {
                  const siembra = e.target.value === "" ? null : Number(e.target.value);
                  if (siembra !== inscripcion.siembra) hacer("siembra", { siembra }, "Siembra guardada.");
                }}
              />
            </label>
          )}
          {VIGENTES.includes(inscripcion.estado) && (
            <Boton tamano="chico" variante="peligro" onClick={() => setRechazando(true)}>
              Rechazar
            </Boton>
          )}
        </span>
      )}
      {esAdmin && <Pagos inscripcion={inscripcion} recargar={recargar} />}
      <DialogoMotivo
        titulo={`Rechazar a ${nombreDePareja(pareja)}`}
        abierto={rechazando}
        cerrar={() => setRechazando(false)}
        alConfirmar={async (motivo) => {
          await api.post(`${ruta}/rechazar`, { motivo });
          recargar();
        }}
      />
    </li>
  );
}

/** Solo la organización: anota quién pagó la inscripción, jugador por jugador o la pareja entera. */
function Pagos({ inscripcion, recargar }: { inscripcion: Inscripcion; recargar: () => void }) {
  const { ejecutar, enCurso } = useAccion();
  const pagaron = new Set((inscripcion.pagos ?? []).map((p) => p.jugadorId));
  // Rechazada o dada de baja: solo queda corregir un pago que ya estaba anotado.
  const vigente = VIGENTES.includes(inscripcion.estado);
  if (!vigente && pagaron.size === 0) return null;

  const anotar = (clave: string, cuerpo: { pago: boolean; jugadorId?: number }) =>
    ejecutar(clave, () => api.post(`/inscripciones/${inscripcion.id}/pago`, cuerpo)).then((ok) => ok && recargar());

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="mr-1 font-semibold text-gris">{resumenDePago(inscripcion)}</span>
      {[inscripcion.pareja.jugador1, inscripcion.pareja.jugador2].map((jugador) => {
        const pago = pagaron.has(jugador.id);
        return (
          <button
            key={jugador.id}
            type="button"
            aria-pressed={pago}
            disabled={enCurso !== null || (!pago && !vigente)}
            onClick={() => anotar(`j${jugador.id}`, { pago: !pago, jugadorId: jugador.id })}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-borde bg-white px-4 text-left text-[0.95rem] font-semibold leading-tight text-gris transition-colors hover:border-pista disabled:pointer-events-none disabled:opacity-50 aria-pressed:border-ok aria-pressed:bg-ok-50 aria-pressed:text-ok"
          >
            {pago && <Icono nombre="ok" className="size-5 shrink-0" />}
            {nombreCompleto(jugador)}: {pago ? "pagó" : "no pagó"}
          </button>
        );
      })}
      {vigente && pagaron.size < 2 && (
        <Boton tamano="chico" variante="secundario" cargando={enCurso === "pareja"} disabled={enCurso !== null} onClick={() => anotar("pareja", { pago: true })}>
          Pagaron los dos
        </Boton>
      )}
    </div>
  );
}

/** Lo que ve un jugador mientras la inscripción está abierta: anotarse o darse de baja. */
function MiInscripcion({ torneo, miId }: { torneo: TorneoDetalle; miId: number }) {
  const { ejecutar, enCurso } = useAccion();
  const confirmar = useConfirmar();
  const { data: mias, mutate } = useSWR<(Inscripcion & { torneo: TorneoResumen })[]>("/inscripciones/mias", traer);
  const { data: parejas } = useSWR<Pareja[]>("/parejas/mias", traer);
  if (!mias || !parejas) return null;

  const vigente = mias.find((i) => i.torneoId === torneo.id && VIGENTES.includes(i.estado));
  const activas = parejas.filter((p) => p.estado === "ACTIVA");

  return (
    <Tarjeta className="mb-6 border-pista/30 bg-pista-50 p-5">
      {vigente ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg">
            Estás anotado con <strong>{nombreDePareja(vigente.pareja)}</strong>.
          </p>
          <span className="flex flex-wrap items-center gap-2.5">
            <Estado valor={ESTADOS_INSCRIPCION[vigente.estado]} />
            <Boton
              tamano="chico"
              variante="peligro"
              cargando={enCurso === "baja"}
              onClick={() =>
                confirmar({ titulo: "¿Dar de baja la inscripción?", texto: "Tu pareja deja su lugar en este torneo.", confirmar: "Dar de baja", peligro: true }).then(
                  (si) => si && ejecutar("baja", () => api.post(`/inscripciones/${vigente.id}/baja`), "Inscripción dada de baja.").then((ok) => void (ok && mutate())),
                )
              }
            >
              Darme de baja
            </Boton>
          </span>
        </div>
      ) : activas.length === 0 ? (
        <p className="text-lg">
          Para anotarte necesitás una pareja activa.{" "}
          <Link href="/parejas" className={ENLACE}>
            Armá tu pareja
          </Link>
        </p>
      ) : (
        <>
          <p className="titulo text-xl">Anotate en este torneo</p>
          <p className="mt-1 text-gris">La inscripción cierra el {fechaYHora(torneo.fechaLimiteInscripcion)}. La organización tiene que aprobarla.</p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {activas.map((pareja) => (
              <Boton
                key={pareja.id}
                cargando={enCurso === `p${pareja.id}`}
                onClick={() => ejecutar(`p${pareja.id}`, () => api.post(`/torneos/${torneo.id}/inscripciones`, { parejaId: pareja.id }), "Solicitud enviada.").then((ok) => void (ok && mutate()))}
              >
                Inscribirme con {(pareja.jugador1.id === miId ? pareja.jugador2 : pareja.jugador1).nombre}
              </Boton>
            ))}
          </div>
        </>
      )}
    </Tarjeta>
  );
}

function Parejas({ torneo, esAdmin, recargar }: { torneo: TorneoDetalle; esAdmin: boolean; recargar: () => void }) {
  const grupos: [string, EstadoInscripcion[]][] = esAdmin
    ? [
        ["Solicitudes por resolver", ["PENDIENTE"]],
        ["Lista de espera", ["EN_ESPERA"]],
        ["Inscriptas", ["APROBADA"]],
        ["Rechazadas y bajas", ["RECHAZADA", "BAJA"]],
      ]
    : [["Inscriptas", ["APROBADA"]]];

  const conParejas = grupos
    .map(([titulo, estados]) => [titulo, torneo.inscripciones.filter((i) => estados.includes(i.estado))] as const)
    .filter(([, lista]) => lista.length > 0);

  const inscriptas = torneo.inscripciones.filter((i) => i.estado === "APROBADA");

  if (conParejas.length === 0) return <Vacio titulo="Todavía no hay parejas inscriptas" />;
  return (
    <>
      {esAdmin && inscriptas.length > 0 && (
        <p className="mb-5 text-lg">
          Pagos: <strong>{jugadoresQuePagaron(torneo)} de {inscriptas.length * 2}</strong> jugadores inscriptos ya pagaron ({inscriptas.filter((i) => i.pagos?.length === 2).length} de{" "}
          {inscriptas.length} parejas completas). Solo lo ve la organización.
        </p>
      )}
      {conParejas.map(([titulo, lista]) => (
        <Seccion key={titulo} titulo={`${titulo} (${lista.length})`}>
          <Tarjeta>
            <ul className="divide-y divide-linea">
              {lista.map((inscripcion) => (
                <FilaDeInscripcion key={inscripcion.id} inscripcion={inscripcion} torneo={torneo} esAdmin={esAdmin} recargar={recargar} />
              ))}
            </ul>
          </Tarjeta>
        </Seccion>
      ))}
    </>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PaginaDeTorneo() {
  const { id } = useParams<{ id: string }>();
  const { usuario, esAdmin } = useSesion();
  const { data: torneo, error, mutate } = useSWR<TorneoDetalle>(`/torneos/${id}`, traer, {
    // Con el torneo en curso, los resultados se refrescan solos.
    refreshInterval: (actual) => (actual?.estado === "EN_CURSO" ? 30_000 : 0),
  });
  const [elegida, setElegida] = useState<Pestana | null>(null);
  const [resultado, setResultado] = useState<Partido | null>(null);

  if (error) return <FalloDeCarga error={error} reintentar={() => mutate()} />;
  if (!torneo) return <EsqueletoTorneo />;

  const recargar = () => void mutate();
  const tieneLlave = torneo.partidos.some((p) => p.instancia !== "ZONA");
  const pestanas: [Pestana, string][] = [
    ...(torneo.partidos.length > 0 ? ([["fixture", "Fixture"]] as [Pestana, string][]) : []),
    ...(tieneLlave ? ([["llave", "Llave"]] as [Pestana, string][]) : []),
    ...(torneo.zonas.length > 0 ? ([["posiciones", "Posiciones"]] as [Pestana, string][]) : []),
    ["parejas", "Parejas"],
    ...(torneo.reglamento ? ([["reglamento", "Reglamento"]] as [Pestana, string][]) : []),
  ];
  const pestana = elegida && pestanas.some(([p]) => p === elegida) ? elegida : pestanas[0][0];
  const campeona = parejaCampeona(torneo);
  const inscripcionAbierta = torneo.estado === "INSCRIPCION_ABIERTA";

  return (
    <>
      <Encabezado
        titulo={torneo.nombre}
        volver="/torneos"
        detalle={
          <>
            <span className="font-semibold text-tinta">
              {torneo.categoria.nombre} {RAMAS[torneo.rama]}
            </span>
            <span className="mx-2">{FORMATOS[torneo.formato]}</span>
            <br />
            {rangoDeFechas(torneo.fechaInicio, torneo.fechaFin)}, {torneo.sede.nombre} ({torneo.sede.localidad.nombre})
          </>
        }
      >
        <Estado valor={ESTADOS_TORNEO[torneo.estado]} />
      </Encabezado>

      {campeona && (
        <div className="mb-7 flex items-center gap-4 rounded-2xl bg-pista px-5 py-5 text-white shadow-tarjeta">
          <span aria-hidden="true" className="size-7 shrink-0 rounded-full bg-pelota ring-4 ring-white/20" />
          <div>
            <p className="font-semibold text-white/90">Campeones</p>
            <p className="titulo text-2xl sm:text-3xl">
              {nombreCompleto(campeona.jugador1)} y {nombreCompleto(campeona.jugador2)}
            </p>
          </div>
        </div>
      )}

      {esAdmin && <Gestion torneo={torneo} recargar={recargar} />}

      <div role="tablist" aria-label="Secciones del torneo" className="mb-6 flex flex-wrap gap-2">
        {pestanas.map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setElegida(clave)}
            className="min-h-12 whitespace-nowrap rounded-full border-2 border-pista/30 bg-white px-5 text-lg font-semibold text-pista hover:border-pista hover:bg-pista-50 aria-selected:border-pista aria-selected:bg-pista aria-selected:text-white"
          >
            {texto}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {pestana === "fixture" && <Fixture torneo={torneo} esAdmin={esAdmin} recargar={recargar} />}

        {pestana === "llave" && (
          <>
            <Llave partidos={torneo.partidos} alElegir={esAdmin && torneo.estado === "EN_CURSO" ? (p) => p.pareja1 && p.pareja2 && setResultado(p) : undefined} />
            <DialogoResultado partido={resultado} cerrar={() => setResultado(null)} alTerminar={recargar} />
          </>
        )}

        {pestana === "posiciones" && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {torneo.zonas.map((zona) => (
                <TablaPosiciones key={zona.id} nombre={zona.nombre} filas={zona.posiciones} clasifican={torneo.formato === "ZONAS_Y_LLAVES" ? 2 : 0} />
              ))}
            </div>
            <p className="mt-4 text-gris">
              Partido ganado suma 2 puntos; perdido, 1; no presentarse, 0. Si hay empate se define por diferencia de sets y después de games.
              {torneo.formato === "ZONAS_Y_LLAVES" && " Los dos primeros de cada zona pasan a la llave."}
            </p>
          </>
        )}

        {pestana === "parejas" && (
          <>
            {inscripcionAbierta && usuario?.jugador && !esAdmin && <MiInscripcion torneo={torneo} miId={usuario.jugador.id} />}
            {inscripcionAbierta && usuario === null && (
              <Tarjeta className="mb-6 border-pista/30 bg-pista-50 p-5 text-lg">
                <Link href={`/login?volver=/torneos/${torneo.id}`} className={ENLACE}>
                  Ingresá para inscribir a tu pareja
                </Link>
              </Tarjeta>
            )}
            <Parejas torneo={torneo} esAdmin={esAdmin} recargar={recargar} />
          </>
        )}

        {pestana === "reglamento" && (
          <Tarjeta className="p-5 sm:p-6">
            <p className="max-w-prose whitespace-pre-line text-lg leading-relaxed">{torneo.reglamento}</p>
          </Tarjeta>
        )}
      </div>
    </>
  );
}
