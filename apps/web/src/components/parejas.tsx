"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, traer } from "@/lib/api";
import { companero, ESTADOS_PAREJA, FORMATOS, nombreCompleto, RAMAS, rangoDeFechas } from "@/lib/formato";
import type { Pareja, TorneoResumen } from "@/lib/tipos";
import { Avatar, Boton, Cargando, Dialogo, Estado, Tarjeta, useAccion, useConfirmar, Vacio } from "./ui";

/** Qué falta para que la pareja quede activa, dicho desde el punto de vista del jugador. */
function situacion(pareja: Pareja, miId: number, nombreDelOtro: string): string | null {
  const laCreeYo = pareja.creadaPorId === miId;
  switch (pareja.estado) {
    case "PENDIENTE":
      return laCreeYo ? `Falta que ${nombreDelOtro} la confirme desde su cuenta.` : `${nombreDelOtro} te propuso armar pareja.`;
    case "CONFIRMADA":
      return "Los dos confirmaron. Falta que la organización la apruebe.";
    case "RECHAZADA":
      return pareja.motivoRechazo;
    default:
      return null;
  }
}

export function TarjetaDePareja({ pareja, miId }: { pareja: Pareja; miId: number }) {
  const { mutate } = useSWRConfig();
  const { ejecutar, enCurso } = useAccion();
  const confirmar = useConfirmar();
  const [inscribiendo, setInscribiendo] = useState(false);
  const otro = companero(pareja, miId);
  const meToca = pareja.estado === "PENDIENTE" && pareja.creadaPorId !== miId;
  const detalle = situacion(pareja, miId, otro.nombre);

  const accion = (nombre: string, exito: string) =>
    ejecutar(nombre, () => api.post(`/parejas/${pareja.id}/${nombre}`), exito).then((ok) => ok && mutate("/parejas/mias"));

  return (
    <Tarjeta className={`p-4 ${meToca ? "border-pista shadow-[inset_4px_0_0_var(--color-pista)]" : ""}`}>
      <div className="flex items-center gap-3">
        <Avatar jugador={otro} className="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{nombreCompleto(otro)}</p>
          <p className="truncate text-sm text-gris">
            {otro.categoria.nombre} categoría{otro.club ? `, ${otro.club.nombre}` : ""}
          </p>
        </div>
        <Estado valor={ESTADOS_PAREJA[pareja.estado]} />
      </div>
      {detalle && <p className="mt-3 text-sm text-gris">{detalle}</p>}

      <div className="mt-3 flex flex-wrap gap-2 empty:hidden">
        {meToca && (
          <>
            <Boton tamano="chico" icono="ok" cargando={enCurso === "confirmar"} onClick={() => accion("confirmar", "Pareja confirmada. Ahora la aprueba la organización.")}>
              Confirmar pareja
            </Boton>
            <Boton tamano="chico" variante="secundario" cargando={enCurso === "declinar"} onClick={() => accion("declinar", "Propuesta no aceptada.")}>
              No aceptar
            </Boton>
          </>
        )}
        {!meToca && (pareja.estado === "PENDIENTE" || pareja.estado === "CONFIRMADA") && (
          <Boton tamano="chico" variante="secundario" cargando={enCurso === "declinar"} onClick={() => accion("declinar", "Propuesta cancelada.")}>
            Cancelar propuesta
          </Boton>
        )}
        {pareja.estado === "ACTIVA" && (
          <>
            <Boton tamano="chico" icono="trofeo" onClick={() => setInscribiendo(true)}>
              Inscribir en un torneo
            </Boton>
            <Boton
              tamano="chico"
              variante="peligro"
              cargando={enCurso === "disolver"}
              onClick={() =>
                confirmar({
                  titulo: `¿Disolver la pareja con ${otro.nombre}?`,
                  texto: "Queda en tu historial, pero ya no van a poder anotarse juntos.",
                  confirmar: "Disolver pareja",
                  peligro: true,
                }).then((si) => si && accion("disolver", "Pareja disuelta."))
              }
            >
              Disolver
            </Boton>
          </>
        )}
      </div>

      <DialogoInscribir pareja={pareja} abierto={inscribiendo} cerrar={() => setInscribiendo(false)} />
    </Tarjeta>
  );
}

function DialogoInscribir({ pareja, abierto, cerrar }: { pareja: Pareja; abierto: boolean; cerrar: () => void }) {
  const { mutate } = useSWRConfig();
  const { ejecutar, enCurso } = useAccion();
  const { data: torneos } = useSWR<TorneoResumen[]>(abierto ? "/torneos" : null, traer);
  const abiertos = torneos?.filter((t) => t.estado === "INSCRIPCION_ABIERTA");

  const inscribir = async (torneo: TorneoResumen) => {
    const ok = await ejecutar(
      `t${torneo.id}`,
      () => api.post(`/torneos/${torneo.id}/inscripciones`, { parejaId: pareja.id }),
      `Solicitud enviada para ${torneo.nombre}. La organización la tiene que aprobar.`,
    );
    if (ok) {
      mutate("/inscripciones/mias");
      cerrar();
    }
  };

  return (
    <Dialogo abierto={abierto} cerrar={cerrar} titulo="Inscribir en un torneo">
      {!abiertos ? (
        <Cargando />
      ) : abiertos.length === 0 ? (
        <Vacio titulo="No hay torneos con inscripción abierta">Cuando la organización abra uno, lo vas a ver acá.</Vacio>
      ) : (
        <ul className="space-y-2">
          {abiertos.map((torneo) => (
            <li key={torneo.id} className="flex items-center justify-between gap-3 rounded-md border border-linea p-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{torneo.nombre}</p>
                <p className="text-sm text-gris">
                  {torneo.categoria.nombre} {RAMAS[torneo.rama]}, {FORMATOS[torneo.formato].toLowerCase()}
                </p>
                <p className="text-sm text-gris">{rangoDeFechas(torneo.fechaInicio, torneo.fechaFin)}</p>
              </div>
              <Boton tamano="chico" cargando={enCurso === `t${torneo.id}`} onClick={() => inscribir(torneo)}>
                Inscribir
              </Boton>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-gris">
        ¿Querés ver el detalle antes?{" "}
        <Link href="/torneos" className="font-semibold text-pista hover:underline">
          Ir a torneos
        </Link>
      </p>
    </Dialogo>
  );
}
