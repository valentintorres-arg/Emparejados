"use client";

import { useState } from "react";
import { FormularioJugador } from "@/components/form-jugador";
import { MostrarCodigo } from "@/components/codigo-password";
import { Boton, Encabezado, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { nombreCompleto } from "@/lib/formato";
import type { Jugador } from "@/lib/tipos";

interface Alta {
  jugador: Jugador;
  codigo: string;
  venceEn: string;
}

export default function NuevoJugador() {
  const [alta, setAlta] = useState<Alta | null>(null);

  if (alta) {
    return (
      <>
        <Encabezado titulo="Jugador creado" volver="/admin/jugadores" />
        <Tarjeta className="max-w-xl p-5">
          <p className="mb-4">
            Para entrar por primera vez, <strong>{nombreCompleto(alta.jugador)}</strong> elige su contraseña con este código:
          </p>
          <MostrarCodigo codigo={alta.codigo} email={alta.jugador.usuario.email} venceEn={alta.venceEn} />
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
      <Encabezado titulo="Nuevo jugador" volver="/admin/jugadores" detalle="Se crea su cuenta y te damos un código para que elija su contraseña." />
      <Tarjeta className="p-5">
        <FormularioJugador modo="alta" textoDelBoton="Crear jugador" alEnviar={async (datos) => setAlta(await api.post<Alta>("/jugadores", datos))} />
      </Tarjeta>
    </>
  );
}
