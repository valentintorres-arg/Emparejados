"use client";

import { FormularioTorneo } from "@/components/form-torneo";
import { Encabezado, Tarjeta } from "@/components/ui";

export default function NuevoTorneo() {
  return (
    <>
      <Encabezado titulo="Nuevo torneo" volver="/torneos" detalle="Se crea como borrador: nadie lo ve hasta que abras la inscripción." />
      <Tarjeta className="p-5">
        <FormularioTorneo />
      </Tarjeta>
    </>
  );
}
