"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { BotonCodigoPassword, type CodigoGenerado, MostrarCodigo } from "@/components/codigo-password";
import { EsqueletoLista } from "@/components/esqueletos";
import { Boton, Campo, CONTROL, Dialogo, Encabezado, ErrorDeFormulario, FalloDeCarga, Icono, Paginador, PIE_DE_DIALOGO, Tarjeta, useAccion, Vacio } from "@/components/ui";
import { api, mensajeDe, traer } from "@/lib/api";
import { fechaYHora, nombreCompleto } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { EstadoUsuario, Pagina, Rol, UsuarioAdmin } from "@/lib/tipos";

const LISTA = "min-h-11 rounded-xl border-2 border-borde bg-white px-3 text-base disabled:bg-fondo disabled:text-gris";

function Fila({ usuario, soyYo, recargar }: { usuario: UsuarioAdmin; soyYo: boolean; recargar: () => void }) {
  const { ejecutar, enCurso } = useAccion();
  const cambiar = (cambios: { rol?: Rol; estado?: EstadoUsuario }) =>
    ejecutar("cambio", () => api.patch(`/usuarios/${usuario.id}`, cambios), "Usuario actualizado.").then((ok) => ok && recargar());

  return (
    <li className="grid items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="break-all text-lg font-bold leading-tight">
          {usuario.email}
          {soyYo && <span className="ml-2 text-base font-normal text-gris">(vos)</span>}
        </p>
        <p className="mt-0.5 text-gris">
          {usuario.jugador ? (
            <Link href={`/admin/jugadores/${usuario.jugador.id}`} className="font-semibold text-pista underline decoration-pista/40 decoration-2 underline-offset-4 hover:decoration-pista">
              {nombreCompleto(usuario.jugador)}
            </Link>
          ) : (
            "Sin ficha de jugador"
          )}
          <span className="ml-2">{usuario.ultimoLoginEn ? `Último ingreso: ${fechaYHora(usuario.ultimoLoginEn)}` : "Nunca ingresó"}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Rol de ${usuario.email}`} className={LISTA} value={usuario.rol} disabled={soyYo || enCurso !== null} onChange={(e) => cambiar({ rol: e.target.value as Rol })}>
          <option value="JUGADOR">Jugador</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <select
          aria-label={`Estado de ${usuario.email}`}
          className={LISTA}
          value={usuario.estado}
          disabled={soyYo || enCurso !== null}
          onChange={(e) => cambiar({ estado: e.target.value as EstadoUsuario })}
        >
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
          <option value="BLOQUEADO">Bloqueado</option>
        </select>
        {/* Los códigos de otras personas de la organización los genera el administrador general, desde el sistema de licencias. */}
        {!soyYo && usuario.rol === "JUGADOR" && usuario.estado === "ACTIVO" && (
          <BotonCodigoPassword tamano="chico" usuarioId={usuario.id} quien={usuario.jugador ? nombreCompleto(usuario.jugador) : usuario.email} />
        )}
      </div>
    </li>
  );
}

export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [alta, setAlta] = useState<CodigoGenerado | null>(null);
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
      <Encabezado
        titulo="Usuarios"
        volver="/admin"
        detalle="Roles, bloqueos y códigos para cambiar la contraseña. El código de otra persona de la organización lo genera el administrador general."
      >
        <Boton icono="mas" onClick={() => setCreando(true)}>
          Nuevo administrador
        </Boton>
      </Encabezado>

      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Buscar por email</span>
        <Icono nombre="buscar" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gris" />
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por email" className={`${CONTROL} pl-12`} />
      </label>

      {fallo ? (
        <FalloDeCarga error={fallo} reintentar={() => mutate()} />
      ) : !data ? (
        <EsqueletoLista />
      ) : data.items.length === 0 ? (
        <Vacio titulo="Ningún usuario coincide con la búsqueda" />
      ) : (
        <Tarjeta>
          <ul className="divide-y divide-linea">
            {data.items.map((usuario) => (
              <Fila key={usuario.id} usuario={usuario} soyYo={usuario.id === yo?.id} recargar={() => mutate()} />
            ))}
          </ul>
        </Tarjeta>
      )}
      {data && <Paginador pagina={data.pagina} paginas={data.paginas} cambiar={setPagina} />}

      <Dialogo abierto={alta !== null} cerrar={() => setAlta(null)} titulo="Administrador creado">
        {alta && (
          <>
            <p className="mb-4">Para entrar por primera vez y elegir su contraseña, usa este código:</p>
            <MostrarCodigo {...alta} />
            <Boton className="mt-6 w-full" onClick={() => setAlta(null)}>
              Listo, ya lo pasé
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
              const r = await api.post<{ usuario: UsuarioAdmin; codigo: string; venceEn: string }>("/usuarios", { email: new FormData(evento.currentTarget).get("email") });
              setCreando(false);
              setAlta({ codigo: r.codigo, venceEn: r.venceEn, email: r.usuario.email });
              mutate();
            } catch (e) {
              setError(mensajeDe(e));
            }
          }}
        >
          <p className="text-gris">Va a poder aprobar parejas, crear torneos, cargar resultados y administrar usuarios.</p>
          <Campo etiqueta="Email" name="email" type="email" required />
          <ErrorDeFormulario mensaje={error} />
          <div className={PIE_DE_DIALOGO}>
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
