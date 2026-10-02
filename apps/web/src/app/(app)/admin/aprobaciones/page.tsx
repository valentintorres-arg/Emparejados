"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { DialogoMotivo } from "@/components/dialogos";
import { Avatar, Boton, Cargando, Encabezado, FalloDeCarga, Seccion, Tarjeta, useAccion, Vacio } from "@/components/ui";
import { api, traer } from "@/lib/api";
import { fechaYHora, nombreCompleto, nombreDePareja } from "@/lib/formato";
import type { Inscripcion, JugadorBasico, Pagina, Pareja } from "@/lib/tipos";

type InscripcionPendiente = Inscripcion & { torneo: { id: number; nombre: string; cupoMaximo: number } };

function Integrante({ jugador }: { jugador: JugadorBasico }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar jugador={jugador} />
      <span className="min-w-0">
        <span className="block break-words text-lg font-bold leading-tight">{nombreCompleto(jugador)}</span>
        <span className="block text-gris">
          {jugador.categoria.nombre}
          {jugador.club ? `, ${jugador.club.nombre}` : ""}
        </span>
      </span>
    </span>
  );
}

/** Tarjeta con Aprobar / Rechazar, igual para parejas e inscripciones. */
function Solicitud({ ruta, titulo, children, alResolver }: { ruta: string; titulo: string; children: React.ReactNode; alResolver: () => void }) {
  const { ejecutar, enCurso } = useAccion();
  const [rechazando, setRechazando] = useState(false);
  return (
    <Tarjeta className="flex flex-col p-5">
      <div className="flex-1">{children}</div>
      <div className="mt-5 flex gap-2.5">
        <Boton className="flex-1" icono="ok" cargando={enCurso === "aprobar"} onClick={() => ejecutar("aprobar", () => api.post(`${ruta}/aprobar`), "Aprobada.").then((ok) => ok && alResolver())}>
          Aprobar
        </Boton>
        <Boton className="flex-1" variante="peligro" onClick={() => setRechazando(true)}>
          Rechazar
        </Boton>
      </div>
      <DialogoMotivo
        titulo={titulo}
        abierto={rechazando}
        cerrar={() => setRechazando(false)}
        alConfirmar={async (motivo) => {
          await api.post(`${ruta}/rechazar`, { motivo });
          alResolver();
        }}
      />
    </Tarjeta>
  );
}

export default function Aprobaciones() {
  const { mutate } = useSWRConfig();
  const parejas = useSWR<Pagina<Pareja>>("/parejas?estado=CONFIRMADA", traer);
  const esperando = useSWR<Pagina<Pareja>>("/parejas?estado=PENDIENTE", traer);
  const inscripciones = useSWR<InscripcionPendiente[]>("/inscripciones?estado=PENDIENTE", traer);

  const alResolver = () => {
    parejas.mutate();
    inscripciones.mutate();
    mutate("/admin/resumen");
  };

  const error = parejas.error ?? inscripciones.error;
  if (error) return <FalloDeCarga error={error} reintentar={alResolver} />;

  return (
    <>
      <Encabezado titulo="Aprobaciones" detalle="Nada queda activo hasta que lo aprobás." />

      <Seccion titulo="Parejas confirmadas por los dos jugadores">
        {!parejas.data ? (
          <Cargando />
        ) : parejas.data.items.length === 0 ? (
          <Vacio titulo="No hay parejas esperando aprobación" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {parejas.data.items.map((pareja) => (
              <Solicitud key={pareja.id} ruta={`/parejas/${pareja.id}`} titulo={`Rechazar a ${nombreDePareja(pareja)}`} alResolver={alResolver}>
                <div className="space-y-3">
                  <Integrante jugador={pareja.jugador1} />
                  <Integrante jugador={pareja.jugador2} />
                </div>
                <p className="mt-3 text-gris">Confirmada el {pareja.confirmadaEn ? fechaYHora(pareja.confirmadaEn) : ""}</p>
              </Solicitud>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Inscripciones a torneos">
        {!inscripciones.data ? (
          <Cargando />
        ) : inscripciones.data.length === 0 ? (
          <Vacio titulo="No hay inscripciones por resolver" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {inscripciones.data.map((inscripcion) => (
              <Solicitud key={inscripcion.id} ruta={`/inscripciones/${inscripcion.id}`} titulo={`Rechazar a ${nombreDePareja(inscripcion.pareja)}`} alResolver={alResolver}>
                <Link href={`/torneos/${inscripcion.torneo.id}`} className="titulo text-xl text-pista underline decoration-pista/40 decoration-2 underline-offset-4 hover:decoration-pista">
                  {inscripcion.torneo.nombre}
                </Link>
                <p className="mt-1.5 text-lg font-semibold leading-snug">
                  {nombreCompleto(inscripcion.pareja.jugador1)} y {nombreCompleto(inscripcion.pareja.jugador2)}
                </p>
                <p className="mt-1 text-gris">
                  {inscripcion.pareja.jugador1.categoria.nombre} y {inscripcion.pareja.jugador2.categoria.nombre}. Pidieron lugar el {fechaYHora(inscripcion.creadaEn)}.
                </p>
                <p className="mt-2 text-gris">Si el cupo de {inscripcion.torneo.cupoMaximo} parejas ya está completo, al aprobarla pasa a lista de espera.</p>
              </Solicitud>
            ))}
          </div>
        )}
      </Seccion>

      {esperando.data && esperando.data.items.length > 0 && (
        <Seccion titulo="Todavía sin confirmar por el compañero">
          <Tarjeta>
            <ul className="divide-y divide-linea">
              {esperando.data.items.map((pareja) => (
                <li key={pareja.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-4 sm:px-5">
                  <span className="font-semibold">
                    {nombreCompleto(pareja.jugador1)} y {nombreCompleto(pareja.jugador2)}
                  </span>
                  <span className="text-gris">Propuesta el {fechaYHora(pareja.creadaEn)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
          <p className="mt-3 text-gris">Aparecen arriba para aprobar cuando el segundo jugador las confirma desde su cuenta.</p>
        </Seccion>
      )}
    </>
  );
}
