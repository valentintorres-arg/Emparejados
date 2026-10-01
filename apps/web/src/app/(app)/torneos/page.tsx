"use client";

import Link from "next/link";
import useSWR from "swr";
import { Boton, Cargando, Encabezado, Estado, FalloDeCarga, Vacio } from "@/components/ui";
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
        <Cargando />
      ) : torneos.length === 0 ? (
        <Vacio titulo="Todavía no hay torneos publicados">{esAdmin ? "Creá el primero con el botón de arriba." : "Cuando la organización publique uno, aparece acá."}</Vacio>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {torneos.map((torneo) => (
            <li key={torneo.id}>
              <Link href={`/torneos/${torneo.id}`} className="flex h-full flex-col rounded-lg border border-linea bg-white p-4 hover:border-pista">
                <span className="flex items-start justify-between gap-3">
                  <span className="titulo text-2xl">{torneo.nombre}</span>
                  <Estado valor={ESTADOS_TORNEO[torneo.estado]} />
                </span>
                <span className="mt-1 font-semibold">
                  {torneo.categoria.nombre} {RAMAS[torneo.rama]}
                </span>
                <span className="mt-2 text-sm text-gris">{rangoDeFechas(torneo.fechaInicio, torneo.fechaFin)}</span>
                <span className="text-sm text-gris">
                  {torneo.sede.nombre}, {torneo.sede.localidad.nombre}
                </span>
                <span className="mt-3 flex items-center justify-between gap-3 border-t border-linea pt-3 text-sm">
                  <span className="text-gris">{FORMATOS[torneo.formato]}</span>
                  <span>
                    <span className="marcador text-lg">{torneo.inscriptas ?? 0}</span>
                    <span className="text-gris"> de {torneo.cupoMaximo} parejas</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
