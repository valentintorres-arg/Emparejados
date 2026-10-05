"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { BotonCodigoPassword } from "@/components/codigo-password";
import { TarjetaPartido } from "@/components/competencia";
import { EsqueletoFicha } from "@/components/esqueletos";
import { FormularioJugador } from "@/components/form-jugador";
import { CambiarFoto } from "@/components/foto";
import { Avatar, Boton, Encabezado, ENLACE, Estado, FalloDeCarga, Seccion, Tarjeta, useAccion, useAviso, useConfirmar, Vacio } from "@/components/ui";
import { api, traer } from "@/lib/api";
import { ESTADOS_INSCRIPCION, ESTADOS_PAREJA, ESTADOS_USUARIO, fecha, nombreCompleto, rangoDeFechas } from "@/lib/formato";
import type { FichaJugador } from "@/lib/tipos";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-gris">{etiqueta}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

export default function FichaDeJugador() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const avisar = useAviso();
  const confirmar = useConfirmar();
  const { ejecutar, enCurso } = useAccion();
  const { data: ficha, error, mutate } = useSWR<FichaJugador>(`/jugadores/${id}`, traer);
  const [editando, setEditando] = useState(false);

  if (error) return <FalloDeCarga error={error} reintentar={() => mutate()} />;
  if (!ficha) return <EsqueletoFicha />;

  const deBaja = ficha.eliminadoEn !== null;
  const otro = (pareja: FichaJugador["parejas"][number]) => (pareja.jugador1.id === ficha.id ? pareja.jugador2 : pareja.jugador1);

  return (
    <>
      <Encabezado titulo={nombreCompleto(ficha)} volver="/admin/jugadores" detalle={`${ficha.categoria.nombre} categoría${ficha.club ? `, ${ficha.club.nombre}` : ""}`}>
        {deBaja ? (
          <Estado valor={["Dado de baja", "mal"]} />
        ) : (
          <>
            <Boton variante="secundario" icono="editar" onClick={() => setEditando((v) => !v)}>
              {editando ? "Cerrar edición" : "Editar"}
            </Boton>
            {ficha.usuario.rol === "JUGADOR" && ficha.usuario.estado === "ACTIVO" && <BotonCodigoPassword usuarioId={ficha.usuarioId} quien={nombreCompleto(ficha)} />}
            <Boton
              variante="peligro"
              cargando={enCurso === "baja"}
              onClick={() =>
                confirmar({
                  titulo: `¿Dar de baja a ${nombreCompleto(ficha)}?`,
                  texto: "Ya no va a poder ingresar ni usar su QR. Su historial se conserva.",
                  confirmar: "Dar de baja",
                  peligro: true,
                }).then((si) => si && ejecutar("baja", () => api.del(`/jugadores/${ficha.id}`), "Jugador dado de baja.").then((ok) => ok && router.replace("/admin/jugadores")))
              }
            >
              Dar de baja
            </Boton>
          </>
        )}
      </Encabezado>

      {editando ? (
        <Tarjeta className="mb-9 p-5 sm:p-6">
          <FormularioJugador
            modo="edicion"
            esAdmin
            inicial={ficha}
            textoDelBoton="Guardar cambios"
            alEnviar={async (datos) => {
              await api.put(`/jugadores/${ficha.id}`, datos);
              await mutate();
              setEditando(false);
              avisar("Datos guardados.");
            }}
          />
        </Tarjeta>
      ) : (
        <Tarjeta className="mb-9 flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
          {deBaja ? <Avatar jugador={ficha} className="size-28 text-3xl" /> : <CambiarFoto jugador={ficha} alCambiar={() => mutate()} />}
          <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-4 min-[26rem]:grid-cols-2 xl:grid-cols-3">
            <Dato etiqueta="DNI">{ficha.dni}</Dato>
            <Dato etiqueta="Nacimiento">{fecha(ficha.fechaNacimiento)}</Dato>
            <Dato etiqueta="Género">{ficha.genero.charAt(0) + ficha.genero.slice(1).toLowerCase()}</Dato>
            <Dato etiqueta="Teléfono">
              <a href={`https://wa.me/${ficha.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className={ENLACE}>
                {ficha.telefono}
              </a>
            </Dato>
            <Dato etiqueta="Email">
              <span className="break-all">{ficha.usuario.email}</span>
            </Dato>
            <Dato etiqueta="Cuenta">
              <Estado valor={ESTADOS_USUARIO[ficha.usuario.estado]} />
            </Dato>
            <Dato etiqueta="Ciudad">{ficha.localidad ? `${ficha.localidad.nombre}, ${ficha.localidad.provincia}` : "Sin especificar"}</Dato>
            <Dato etiqueta="Mano hábil">{ficha.manoHabil === "DERECHA" ? "Derecha" : "Izquierda"}</Dato>
            <Dato etiqueta="Posición">{ficha.posicion === "DRIVE" ? "Drive" : "Revés"}</Dato>
          </dl>
        </Tarjeta>
      )}

      <Seccion titulo="Parejas">
        {ficha.parejas.length === 0 ? (
          <Vacio titulo="No armó ninguna pareja todavía" />
        ) : (
          <Tarjeta>
            <ul className="divide-y divide-linea">
              {ficha.parejas.map((pareja) => (
                <li key={pareja.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
                  <span>
                    Con{" "}
                    <Link href={`/admin/jugadores/${otro(pareja).id}`} className={ENLACE}>
                      {nombreCompleto(otro(pareja))}
                    </Link>
                    {pareja.motivoRechazo && <span className="block text-gris">{pareja.motivoRechazo}</span>}
                  </span>
                  <Estado valor={ESTADOS_PAREJA[pareja.estado]} />
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Torneos">
        {ficha.inscripciones.length === 0 ? (
          <Vacio titulo="No se inscribió en ningún torneo" />
        ) : (
          <Tarjeta>
            <ul className="divide-y divide-linea">
              {ficha.inscripciones.map((inscripcion) => (
                <li key={inscripcion.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
                  <span>
                    <Link href={`/torneos/${inscripcion.torneo.id}`} className={ENLACE}>
                      {inscripcion.torneo.nombre}
                    </Link>
                    <span className="block text-gris">{rangoDeFechas(inscripcion.torneo.fechaInicio, inscripcion.torneo.fechaFin)}</span>
                  </span>
                  <Estado valor={ESTADOS_INSCRIPCION[inscripcion.estado]} />
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Partidos jugados">
        {ficha.partidos.length === 0 ? (
          <Vacio titulo="Todavía no jugó ningún partido" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ficha.partidos.map((partido) => (
              <TarjetaPartido key={partido.id} partido={partido} contexto={partido.torneo?.nombre} />
            ))}
          </div>
        )}
      </Seccion>
    </>
  );
}
