"use client";

import { useState } from "react";
import useSWR from "swr";
import { EsqueletoLista } from "@/components/esqueletos";
import { Encabezado, FalloDeCarga, Paginador, Tarjeta, Vacio } from "@/components/ui";
import { traer } from "@/lib/api";
import { fechaYHora } from "@/lib/formato";
import type { Pagina, RegistroDeLog } from "@/lib/tipos";

// Qué pasó, dicho para la organización. Lo que no esté acá se muestra tal como se guardó.
const FALLOS: Record<string, string> = {
  "notificaciones/suscripcion": "No pudo activar las notificaciones: el teléfono no se conectó con el servicio de avisos",
  "notificaciones/guardado": "No pudo activar las notificaciones: no se guardó el teléfono",
};

/** "Chrome 158 en Android" a partir del texto largo que manda el navegador. */
function navegadorLegible(texto: string | null) {
  if (!texto) return "Navegador desconocido";
  const navegador = /(Edg|OPR|SamsungBrowser|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/.exec(texto);
  const nombres: Record<string, string> = { Edg: "Edge", OPR: "Opera", SamsungBrowser: "Samsung Internet", FxiOS: "Firefox", CriOS: "Chrome", Version: "Safari" };
  const sistema = /Android/.test(texto) ? "Android" : /iPhone|iPad|iPod/.test(texto) ? "iPhone o iPad" : /Windows/.test(texto) ? "Windows" : /Mac OS X/.test(texto) ? "Mac" : /Linux/.test(texto) ? "Linux" : null;
  if (!navegador) return sistema ?? texto;
  return `${nombres[navegador[1]] ?? navegador[1]} ${navegador[2]}${sistema ? ` en ${sistema}` : ""}`;
}

export default function Logs() {
  const [pagina, setPagina] = useState(1);
  const { data, error, mutate } = useSWR<Pagina<RegistroDeLog>>(`/logs?pagina=${pagina}`, traer, { keepPreviousData: true });

  return (
    <>
      <Encabezado titulo="Fallos en los teléfonos" volver="/admin" detalle="Lo que no le anduvo a alguien en su teléfono, para poder ayudarlo. Lo más reciente primero." />

      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !data ? (
        <EsqueletoLista />
      ) : data.items.length === 0 ? (
        <Vacio titulo="No hay fallos registrados">Cuando a alguien no le funcione algo en su teléfono, aparece acá.</Vacio>
      ) : (
        <Tarjeta>
          <ul className="divide-y divide-linea">
            {data.items.map((registro) => (
              <li key={registro.id} className="px-4 py-4 sm:px-5">
                <p className="text-lg font-bold leading-snug">{FALLOS[`${registro.origen}/${registro.codigo}`] ?? `${registro.origen}: ${registro.codigo}`}</p>
                <p className="mt-1 text-gris">
                  <span className="font-semibold text-tinta">{registro.usuario?.email ?? "Cuenta borrada"}</span>
                  <span className="mx-2">{fechaYHora(registro.fecha)}</span>
                  <span title={registro.navegador ?? undefined}>{navegadorLegible(registro.navegador)}</span>
                </p>
                <p className="mt-1.5 break-words text-sm text-gris">Detalle técnico: {registro.detalle}</p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {data && <Paginador pagina={data.pagina} paginas={data.paginas} cambiar={setPagina} />}
    </>
  );
}
