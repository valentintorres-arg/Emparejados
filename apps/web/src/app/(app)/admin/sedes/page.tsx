"use client";

import { useState } from "react";
import useSWR from "swr";
import { Boton, Campo, Cargando, Dialogo, Encabezado, ErrorDeFormulario, FalloDeCarga, PIE_DE_DIALOGO, Selector, Tarjeta, useAccion, useAviso, Vacio } from "@/components/ui";
import { api, mensajeDe, traer } from "@/lib/api";
import type { Catalogos, Club } from "@/lib/tipos";

function NuevaSede({ catalogos, abierto, cerrar, alTerminar }: { catalogos: Catalogos; abierto: boolean; cerrar: () => void; alTerminar: () => void }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [otraLocalidad, setOtraLocalidad] = useState(catalogos.localidades.length === 0);

  return (
    <Dialogo abierto={abierto} cerrar={cerrar} titulo="Nueva sede">
      <form
        className="space-y-4"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const f = new FormData(evento.currentTarget);
          setError(null);
          setEnviando(true);
          try {
            const localidadId = otraLocalidad
              ? (await api.post<{ id: number }>("/catalogos/localidades", { nombre: f.get("localidad"), provincia: f.get("provincia") })).id
              : Number(f.get("localidadId"));
            await api.post("/catalogos/clubes", { nombre: f.get("nombre"), direccion: f.get("direccion") || undefined, localidadId, canchas: Number(f.get("canchas")) });
            avisar("Sede creada.");
            alTerminar();
            cerrar();
          } catch (e) {
            setError(mensajeDe(e));
          } finally {
            setEnviando(false);
          }
        }}
      >
        <Campo etiqueta="Nombre del club" name="nombre" minLength={2} maxLength={100} required />
        <Campo etiqueta="Dirección" name="direccion" maxLength={160} />
        {otraLocalidad ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo etiqueta="Ciudad" name="localidad" required />
            <Campo etiqueta="Provincia" name="provincia" required />
          </div>
        ) : (
          <Selector etiqueta="Ciudad" name="localidadId" vacio="Elegí" required opciones={catalogos.localidades.map((l) => [l.id, `${l.nombre}, ${l.provincia}`] as const)} />
        )}
        {catalogos.localidades.length > 0 && (
          <button type="button" className="min-h-11 text-left font-semibold text-pista underline decoration-pista/40 decoration-2 underline-offset-4 hover:decoration-pista" onClick={() => setOtraLocalidad((v) => !v)}>
            {otraLocalidad ? "Elegir una ciudad ya cargada" : "La ciudad no está en la lista"}
          </button>
        )}
        <Campo etiqueta="Cantidad de canchas" name="canchas" type="number" min={1} max={30} defaultValue={2} required ayuda="Se crean como Cancha 1, Cancha 2, y así." />
        <ErrorDeFormulario mensaje={error} />
        <div className={PIE_DE_DIALOGO}>
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Crear sede
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function Sede({ club, recargar }: { club: Club; recargar: () => void }) {
  const { ejecutar, enCurso } = useAccion();
  const [agregando, setAgregando] = useState(false);
  return (
    <Tarjeta className="p-5">
      <h2 className="titulo text-2xl">{club.nombre}</h2>
      <p className="mt-1 text-gris">
        {club.direccion ? `${club.direccion}, ` : ""}
        {club.localidad.nombre}, {club.localidad.provincia}
      </p>
      <ul className="mt-4 flex flex-wrap items-center gap-2">
        {club.canchas.map((cancha) => (
          <li key={cancha.id} className="rounded-full border border-linea bg-fondo px-3.5 py-1.5 font-semibold">
            {cancha.nombre}
          </li>
        ))}
        <li>
          <Boton
            tamano="chico"
            variante="fantasma"
            icono="mas"
            onClick={() => setAgregando(true)}
          >
            Agregar cancha
          </Boton>
        </li>
      </ul>
      <Dialogo abierto={agregando} cerrar={() => setAgregando(false)} titulo={`Nueva cancha en ${club.nombre}`}>
        <form
          className="space-y-4"
          onSubmit={async (evento) => {
            evento.preventDefault();
            const nombre = String(new FormData(evento.currentTarget).get("nombre")).trim();
            if (await ejecutar("cancha", () => api.post(`/catalogos/clubes/${club.id}/canchas`, { nombre }), "Cancha agregada.")) {
              setAgregando(false);
              recargar();
            }
          }}
        >
          <Campo etiqueta="Nombre de la cancha" name="nombre" defaultValue={`Cancha ${club.canchas.length + 1}`} maxLength={40} required />
          <div className={PIE_DE_DIALOGO}>
            <Boton variante="secundario" onClick={() => setAgregando(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={enCurso === "cancha"}>
              Agregar cancha
            </Boton>
          </div>
        </form>
      </Dialogo>
    </Tarjeta>
  );
}

export default function Sedes() {
  const { data: catalogos, error, mutate } = useSWR<Catalogos>("/catalogos", traer);
  const [creando, setCreando] = useState(false);

  if (error) return <FalloDeCarga error={error} reintentar={() => mutate()} />;
  if (!catalogos) return <Cargando />;

  return (
    <>
      <Encabezado titulo="Sedes y canchas" volver="/admin" detalle="Los clubes donde se juegan los torneos.">
        <Boton icono="mas" onClick={() => setCreando(true)}>
          Nueva sede
        </Boton>
      </Encabezado>
      {catalogos.clubes.length === 0 ? (
        <Vacio titulo="Todavía no cargaste ninguna sede">Hace falta al menos una para crear un torneo.</Vacio>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {catalogos.clubes.map((club) => (
            <Sede key={club.id} club={club} recargar={() => mutate()} />
          ))}
        </div>
      )}
      <NuevaSede catalogos={catalogos} abierto={creando} cerrar={() => setCreando(false)} alTerminar={() => mutate()} />
    </>
  );
}
