"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { EsqueletoPantallaDeFormulario } from "@/components/esqueletos";
import { FormularioTorneo } from "@/components/form-torneo";
import { Encabezado, FalloDeCarga, Tarjeta } from "@/components/ui";
import { traer } from "@/lib/api";
import type { TorneoDetalle } from "@/lib/tipos";

export default function EditarTorneo() {
  const { id } = useParams<{ id: string }>();
  const { data: torneo, error, mutate } = useSWR<TorneoDetalle>(`/torneos/${id}`, traer);

  if (error) return <FalloDeCarga error={error} reintentar={() => mutate()} />;
  if (!torneo) return <EsqueletoPantallaDeFormulario />;

  return (
    <>
      <Encabezado titulo="Editar torneo" volver={`/torneos/${id}`} detalle={torneo.nombre} />
      <Tarjeta className="p-5">
        <FormularioTorneo inicial={torneo} />
      </Tarjeta>
    </>
  );
}
