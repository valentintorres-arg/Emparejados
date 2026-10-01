"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Boton, Campo, Cargando, Dialogo, Encabezado, ErrorDeFormulario, FalloDeCarga, Icono, Paginador, Tarjeta, useAccion, useConfirmar, Vacio } from "@/components/ui";
import { api, mensajeDe, traer } from "@/lib/api";
import { fechaYHora, nombreCompleto } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { EstadoUsuario, Pagina, Rol, UsuarioAdmin } from "@/lib/tipos";

const CONTROL = "min-h-9 rounded-md border border-linea bg-white px-2 text-sm";

interface Credencial {
  email: string;
  password: string;
}

function Fila({ usuario, soyYo, recargar, mostrar }: { usuario: UsuarioAdmin; soyYo: boolean; recargar: () => void; mostrar: (c: Credencial) => void }) {
  const { ejecutar, enCurso } = useAccion();
  const confirmar = useConfirmar();
  const cambiar = (cambios: { rol?: Rol; estado?: EstadoUsuario }) =>
    ejecutar("cambio", () => api.patch(`/usuarios/${usuario.id}`, cambios), "Usuario actualizado.").then((ok) => ok && recargar());

  return (
    <li className="grid items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate font-bold">
          {usuario.email}
          {soyYo && <span className="ml-2 text-sm font-normal text-gris">(vos)</span>}
        </p>
        <p className="truncate text-sm text-gris">
          {usuario.jugador ? (
            <Link href={`/admin/jugadores/${usuario.jugador.id}`} className="text-pista hover:underline">
              {nombreCompleto(usuario.jugador)}
            </Link>
          ) : (
            "Sin ficha de jugador"
          )}
          <span className="ml-2">{usuario.ultimoLoginEn ? `Último ingreso: ${fechaYHora(usuario.ultimoLoginEn)}` : "Nunca ingresó"}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Rol de ${usuario.email}`} className={CONTROL} value={usuario.rol} disabled={soyYo || enCurso !== null} onChange={(e) => cambiar({ rol: e.target.value as Rol })}>
          <option value="JUGADOR">Jugador</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <select
          aria-label={`Estado de ${usuario.email}`}
          className={CONTROL}
          value={usuario.estado}
          disabled={soyYo || enCurso !== null}
          onChange={(e) => cambiar({ estado: e.target.value as EstadoUsuario })}
        >
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
          <option value="BLOQUEADO">Bloqueado</option>
        </select>
        <Boton
          tamano="chico"
          variante="secundario"
          cargando={enCurso === "reset"}
          onClick={async () => {
            const seguro = await confirmar({
              titulo: "¿Generar una contraseña nueva?",
              texto: `La contraseña actual de ${usuario.email} deja de servir y se cierran sus sesiones.`,
              confirmar: "Generar contraseña",
            });
            if (!seguro) return;
            let password = "";
            const ok = await ejecutar("reset", async () => {
              password = (await api.post<{ passwordTemporal: string }>(`/usuarios/${usuario.id}/reset-password`)).passwordTemporal;
            });
            if (ok) mostrar({ email: usuario.email, password });
          }}
        >
          Nueva contraseña
        </Boton>
      </div>
    </li>
  );
}

export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [credencial, setCredencial] = useState<Credencial | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const espera = setTimeout(() => {
      setQ(texto.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  const consulta = new URLSearchParams({ pagina: String(pagina), ...(q && { q }) });
  const { data, error: fallo, mutate } = useSWR<Pagina<UsuarioAdmin>>(`/usuarios?${consulta}`, traer, { keepPreviousData: true });

  return (
    <>
      <Encabezado titulo="Usuarios" volver="/admin" detalle="Roles, bloqueos y contraseñas.">
        <Boton icono="mas" onClick={() => setCreando(true)}>
          Nuevo administrador
        </Boton>
      </Encabezado>

      <label className="relative mb-4 block max-w-md">
        <span className="sr-only">Buscar por email</span>
        <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-3 size-5 text-gris" />
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por email" className="min-h-11 w-full rounded-md border border-linea bg-white pl-10 pr-3 text-base" />
      </label>

      {fallo ? (
        <FalloDeCarga error={fallo} reintentar={() => mutate()} />
      ) : !data ? (
        <Cargando />
      ) : data.items.length === 0 ? (
        <Vacio titulo="Ningún usuario coincide con la búsqueda" />
      ) : (
        <Tarjeta>
          <ul className="divide-y divide-linea">
            {data.items.map((usuario) => (
              <Fila key={usuario.id} usuario={usuario} soyYo={usuario.id === yo?.id} recargar={() => mutate()} mostrar={setCredencial} />
            ))}
          </ul>
        </Tarjeta>
      )}
      {data && <Paginador pagina={data.pagina} paginas={data.paginas} cambiar={setPagina} />}

      <Dialogo abierto={credencial !== null} cerrar={() => setCredencial(null)} titulo="Contraseña temporal">
        {credencial && (
          <>
            <p>Pasásela ahora a quien corresponde: no se vuelve a mostrar.</p>
            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-md bg-fondo p-4">
              <dt className="text-gris">Email</dt>
              <dd className="break-all font-semibold">{credencial.email}</dd>
              <dt className="text-gris">Contraseña</dt>
              <dd className="select-all font-mono text-lg font-bold tracking-wide">{credencial.password}</dd>
            </dl>
            <Boton className="mt-5 w-full" onClick={() => setCredencial(null)}>
              Listo, ya la anoté
            </Boton>
          </>
        )}
      </Dialogo>

      <Dialogo abierto={creando} cerrar={() => setCreando(false)} titulo="Nuevo administrador">
        <form
          className="space-y-4"
          onSubmit={async (evento) => {
            evento.preventDefault();
            setError(null);
            try {
              const r = await api.post<{ usuario: UsuarioAdmin; passwordTemporal: string }>("/usuarios", { email: new FormData(evento.currentTarget).get("email") });
              setCreando(false);
              setCredencial({ email: r.usuario.email, password: r.passwordTemporal });
              mutate();
            } catch (e) {
              setError(mensajeDe(e));
            }
          }}
        >
          <p className="text-sm text-gris">Va a poder aprobar parejas, crear torneos, cargar resultados y administrar usuarios.</p>
          <Campo etiqueta="Email" name="email" type="email" required />
          <ErrorDeFormulario mensaje={error} />
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setCreando(false)}>
              Cancelar
            </Boton>
            <Boton type="submit">Crear administrador</Boton>
          </div>
        </form>
      </Dialogo>
    </>
  );
}
