"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Avatar, Boton, Cargando, CONTROL, Encabezado, Estado, FalloDeCarga, Icono, Paginador, Tarjeta, Vacio } from "@/components/ui";
import { traer } from "@/lib/api";
import { ESTADOS_USUARIO, nombreCompleto } from "@/lib/formato";
import type { Catalogos, Jugador, Pagina } from "@/lib/tipos";

export default function Jugadores() {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [clubId, setClubId] = useState("");
  const [pagina, setPagina] = useState(1);
  const { data: catalogos } = useSWR<Catalogos>("/catalogos", traer);

  // Busca al dejar de escribir, no en cada tecla.
  useEffect(() => {
    const espera = setTimeout(() => {
      setQ(texto.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  const consulta = new URLSearchParams({ pagina: String(pagina), ...(q && { q }), ...(categoriaId && { categoriaId }), ...(clubId && { clubId }) });
  const { data, error, mutate } = useSWR<Pagina<Jugador>>(`/jugadores?${consulta}`, traer, { keepPreviousData: true });

  return (
    <>
      <Encabezado titulo="Jugadores" detalle={data ? `${data.total} ${data.total === 1 ? "jugador" : "jugadores"}` : undefined}>
        <Boton href="/admin/jugadores/nuevo" icono="mas">
          Nuevo jugador
        </Boton>
      </Encabezado>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Buscar por nombre, apellido o DNI</span>
          <Icono nombre="buscar" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gris" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, apellido o DNI" className={`${CONTROL} pl-12`} />
        </label>
        <select
          aria-label="Categoría"
          value={categoriaId}
          onChange={(e) => {
            setCategoriaId(e.target.value);
            setPagina(1);
          }}
          className={CONTROL}
        >
          <option value="">Todas las categorías</option>
          {catalogos?.categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Club"
          value={clubId}
          onChange={(e) => {
            setClubId(e.target.value);
            setPagina(1);
          }}
          className={CONTROL}
        >
          <option value="">Todos los clubes</option>
          {catalogos?.clubes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !data ? (
        <Cargando />
      ) : data.items.length === 0 ? (
        <Vacio titulo="Ningún jugador coincide con la búsqueda">Probá con menos letras o quitá los filtros.</Vacio>
      ) : (
        <Tarjeta>
          <ul className="divide-y divide-linea">
            {data.items.map((jugador) => (
              <li key={jugador.id}>
                <Link href={`/admin/jugadores/${jugador.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-pista-50/50 sm:px-5 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                  <Avatar jugador={jugador} />
                  <span className="min-w-0">
                    <span className="block break-words text-lg font-bold leading-tight">
                      {jugador.apellido}, {jugador.nombre}
                    </span>
                    <span className="block text-gris">DNI {jugador.dni}</span>
                  </span>
                  <span className="hidden md:block">{jugador.categoria.nombre} categoría</span>
                  <span className="hidden text-gris md:block">{jugador.club?.nombre ?? "Sin club"}</span>
                  <span className="flex items-center gap-2">
                    <span className="marcador text-2xl md:hidden">{jugador.categoria.nombre}</span>
                    {jugador.usuario.estado !== "ACTIVO" && <Estado valor={ESTADOS_USUARIO[jugador.usuario.estado]} />}
                  </span>
                  <span className="sr-only">Ver la ficha de {nombreCompleto(jugador)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {data && <Paginador pagina={data.pagina} paginas={data.paginas} cambiar={setPagina} />}
    </>
  );
}
