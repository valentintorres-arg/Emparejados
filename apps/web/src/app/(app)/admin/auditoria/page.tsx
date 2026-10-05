"use client";

import { useState } from "react";
import useSWR from "swr";
import { EsqueletoTabla } from "@/components/esqueletos";
import { CONTROL, Encabezado, FalloDeCarga, Paginador, Tarjeta, Vacio } from "@/components/ui";
import { traer } from "@/lib/api";
import { accionLegible, fechaYHora } from "@/lib/formato";
import type { Pagina, RegistroAuditoria } from "@/lib/tipos";

const ENTIDADES = ["jugador", "pareja", "torneo", "inscripcion", "partido", "usuario", "club"];

/** "motivo: Categoría incorrecta, parejas: 8" a partir del detalle guardado. */
function detalleLegible(detalle: RegistroAuditoria["detalle"]) {
  if (!detalle) return "";
  return Object.entries(detalle)
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([clave, valor]) => `${clave}: ${String(valor)}`)
    .join(", ");
}

export default function Auditoria() {
  const [entidad, setEntidad] = useState("");
  const [pagina, setPagina] = useState(1);
  const consulta = new URLSearchParams({ pagina: String(pagina), ...(entidad && { entidad }) });
  const { data, error, mutate } = useSWR<Pagina<RegistroAuditoria>>(`/auditoria?${consulta}`, traer, { keepPreviousData: true });

  return (
    <>
      <Encabezado titulo="Auditoría" volver="/admin" detalle="Cada cambio queda registrado y no se puede editar ni borrar.">
        <select
          aria-label="Filtrar por tipo"
          value={entidad}
          onChange={(e) => {
            setEntidad(e.target.value);
            setPagina(1);
          }}
          className={`${CONTROL} capitalize sm:w-auto`}
        >
          <option value="">Todo</option>
          {ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </Encabezado>

      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !data ? (
        <EsqueletoTabla />
      ) : data.items.length === 0 ? (
        <Vacio titulo="No hay registros de ese tipo" />
      ) : (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[46rem]">
            <thead>
              <tr className="border-b border-linea bg-fondo/70 text-left text-sm text-gris">
                <th scope="col" className="px-4 py-3 font-semibold">Cuándo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Quién</th>
                <th scope="col" className="px-4 py-3 font-semibold">Qué hizo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {data.items.map((registro) => (
                <tr key={registro.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3.5 text-gris">{fechaYHora(registro.fecha)}</td>
                  <td className="px-4 py-3.5">{registro.usuario.email}</td>
                  <td className="px-4 py-3.5 font-semibold">
                    {accionLegible(registro.accion)}
                    <span className="ml-1 font-normal text-gris">
                      ({registro.entidad}
                      {registro.entidadId ? ` ${registro.entidadId}` : ""})
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gris">{detalleLegible(registro.detalle)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
      {data && <Paginador pagina={data.pagina} paginas={data.paginas} cambiar={setPagina} />}
    </>
  );
}
