"use client";

import { useState } from "react";
import { FormularioJugador } from "@/components/form-jugador";
import { Boton, Encabezado, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { nombreCompleto } from "@/lib/formato";
import type { Jugador } from "@/lib/tipos";

interface Alta {
  jugador: Jugador;
  passwordTemporal: string;
}

export default function NuevoJugador() {
  const [alta, setAlta] = useState<Alta | null>(null);

  if (alta) {
    return (
      <>
        <Encabezado titulo="Jugador creado" volver="/admin/jugadores" />
        <Tarjeta className="max-w-xl p-5">
          <p>
            <strong>{nombreCompleto(alta.jugador)}</strong> ya puede ingresar con estos datos. Pasáselos ahora: la contraseña no se vuelve a
            mostrar.
          </p>
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl bg-fondo p-4">
            <dt className="text-gris">Email</dt>
            <dd className="break-all font-semibold">{alta.jugador.usuario.email}</dd>
            <dt className="text-gris">Contraseña</dt>
            <dd className="select-all font-mono text-lg font-bold tracking-wide">{alta.passwordTemporal}</dd>
          </dl>
          <p className="mt-3 text-sm text-gris">Desde “Mis datos” puede cambiarla por una propia.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Boton href={`/admin/jugadores/${alta.jugador.id}`}>Ver la ficha</Boton>
            <Boton variante="secundario" onClick={() => setAlta(null)}>
              Cargar otro jugador
            </Boton>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <Encabezado titulo="Nuevo jugador" volver="/admin/jugadores" detalle="Se crea su cuenta con una contraseña temporal." />
      <Tarjeta className="p-5">
        <FormularioJugador modo="alta" textoDelBoton="Crear jugador" alEnviar={async (datos) => setAlta(await api.post<Alta>("/jugadores", datos))} />
      </Tarjeta>
    </>
  );
}
