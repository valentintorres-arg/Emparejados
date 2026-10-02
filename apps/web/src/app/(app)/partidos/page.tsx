"use client";

import Link from "next/link";
import useSWR from "swr";
import { TarjetaPartido } from "@/components/competencia";
import { Cargando, Encabezado, ENLACE, FalloDeCarga, Seccion, Vacio } from "@/components/ui";
import { traer } from "@/lib/api";
import type { Partido } from "@/lib/tipos";

function Lista({ partidos }: { partidos: Partido[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {partidos.map((partido) => (
        <TarjetaPartido
          key={partido.id}
          partido={partido}
          contexto={
            partido.torneo && (
              <Link href={`/torneos/${partido.torneo.id}`} className={ENLACE}>
                {partido.torneo.nombre}
              </Link>
            )
          }
        />
      ))}
    </div>
  );
}

export default function MisPartidos() {
  const { data: partidos, error, mutate } = useSWR<Partido[]>("/partidos/mios", traer);
  const porJugar = partidos?.filter((p) => p.ganadorId === null) ?? [];
  // Los jugados, del más reciente al más viejo.
  const jugados = (partidos?.filter((p) => p.ganadorId !== null) ?? []).reverse();

  return (
    <>
      <Encabezado titulo="Partidos" />
      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !partidos ? (
        <Cargando />
      ) : partidos.length === 0 ? (
        <Vacio titulo="Todavía no tenés partidos">
          Aparecen cuando tu pareja queda inscripta en un torneo y la organización sortea el fixture.
        </Vacio>
      ) : (
        <>
          <Seccion titulo="Por jugar">
            {porJugar.length > 0 ? <Lista partidos={porJugar} /> : <Vacio titulo="No tenés partidos pendientes" />}
          </Seccion>
          {jugados.length > 0 && (
            <Seccion titulo="Jugados">
              <Lista partidos={jugados} />
            </Seccion>
          )}
        </>
      )}
    </>
  );
}
