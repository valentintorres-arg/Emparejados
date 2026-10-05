"use client";

import Link from "next/link";
import useSWR from "swr";
import { EsqueletoTorneos } from "@/components/esqueletos";
import { Boton, Encabezado, Estado, FalloDeCarga, Icono, TARJETA_ENLACE, Vacio } from "@/components/ui";
import { traer } from "@/lib/api";
import { ESTADOS_TORNEO, FORMATOS, RAMAS, rangoDeFechas } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { TorneoResumen } from "@/lib/tipos";

export default function Torneos() {
  const { esAdmin } = useSesion();
  const { data: torneos, error, mutate } = useSWR<TorneoResumen[]>("/torneos", traer);

  return (
    <>
      <Encabezado titulo="Torneos" detalle="Fixture, posiciones y resultados de cada torneo.">
        {esAdmin && (
          <Boton href="/admin/torneos/nuevo" icono="mas">
            Nuevo torneo
          </Boton>
        )}
      </Encabezado>

      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !torneos ? (
        <EsqueletoTorneos />
      ) : torneos.length === 0 ? (
        <Vacio titulo="Todavía no hay torneos publicados">{esAdmin ? "Creá el primero con el botón de arriba." : "Cuando la organización publique uno, aparece acá."}</Vacio>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {torneos.map((torneo) => (
            <li key={torneo.id}>
              <Link href={`/torneos/${torneo.id}`} className={`flex h-full flex-col p-5 ${TARJETA_ENLACE}`}>
                <span>
                  <Estado valor={ESTADOS_TORNEO[torneo.estado]} />
                </span>
                <span className="titulo mt-2.5 text-2xl">{torneo.nombre}</span>
                <span className="mt-1 text-lg font-semibold text-pista">
                  {torneo.categoria.nombre} {RAMAS[torneo.rama]}
                </span>
                <span className="mt-3 flex items-start gap-2.5 text-gris">
                  <Icono nombre="partidos" className="mt-0.5 size-5 shrink-0" />
                  {rangoDeFechas(torneo.fechaInicio, torneo.fechaFin)}
                </span>
                <span className="mt-1.5 flex items-start gap-2.5 text-gris">
                  <Icono nombre="sede" className="mt-0.5 size-5 shrink-0" />
                  {torneo.sede.nombre}, {torneo.sede.localidad.nombre}
                </span>
                <span className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-linea pt-3.5">
                  <span className="text-gris">{FORMATOS[torneo.formato]}</span>
                  <span>
                    <span className="marcador text-2xl">{torneo.inscriptas ?? 0}</span>
                    <span className="text-gris"> de {torneo.cupoMaximo} parejas</span>
                  </span>
                </span>
                <span className="mt-4 flex min-h-11 items-center justify-center gap-1 rounded-xl bg-pista-50 font-semibold text-pista">
                  Ver el torneo
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
