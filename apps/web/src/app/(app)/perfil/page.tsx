"use client";

import { useState } from "react";
import useSWR from "swr";
import { FormularioJugador } from "@/components/form-jugador";
import { ActivarNotificaciones } from "@/components/notificaciones";
import { InstalarApp } from "@/components/pwa";
import { Boton, Campo, Cargando, Encabezado, ErrorDeFormulario, FalloDeCarga, Seccion, Tarjeta, useAviso } from "@/components/ui";
import { api, mensajeDe, traer } from "@/lib/api";
import { fechaYHora } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { FichaJugador } from "@/lib/tipos";

function CambiarPassword() {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={async (evento) => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        const f = new FormData(formulario);
        setError(null);
        setEnviando(true);
        try {
          await api.post("/auth/password", { actual: f.get("actual"), nueva: f.get("nueva") });
          formulario.reset();
          avisar("Contraseña cambiada.");
        } catch (e) {
          setError(mensajeDe(e));
        } finally {
          setEnviando(false);
        }
      }}
    >
      <Campo etiqueta="Contraseña actual" name="actual" type="password" autoComplete="current-password" required />
      <Campo etiqueta="Contraseña nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required ayuda="Al menos 8 caracteres." />
      <div className="space-y-3 sm:col-span-2">
        <ErrorDeFormulario mensaje={error} />
        <Boton type="submit" variante="secundario" cargando={enviando}>
          Cambiar contraseña
        </Boton>
      </div>
    </form>
  );
}

export default function MisDatos() {
  const avisar = useAviso();
  const { usuario, salir, recargar } = useSesion();
  const miId = usuario!.jugador!.id;
  const { data: ficha, error, mutate } = useSWR<FichaJugador>(`/jugadores/${miId}`, traer);

  return (
    <>
      <Encabezado titulo="Mis datos" detalle={usuario!.email}>
        <InstalarApp className="lg:hidden" />
        <Boton variante="secundario" icono="salir" onClick={salir}>
          Cerrar sesión
        </Boton>
      </Encabezado>

      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !ficha ? (
        <Cargando />
      ) : (
        <>
          <Tarjeta className="mb-9 p-5 sm:p-6">
            <FormularioJugador
              modo="edicion"
              inicial={ficha}
              textoDelBoton="Guardar cambios"
              alEnviar={async (datos) => {
                await api.put(`/jugadores/${miId}`, datos);
                await Promise.all([mutate(), recargar()]);
                avisar("Datos guardados.");
              }}
            />
          </Tarjeta>

          <ActivarNotificaciones className="mb-9" />

          <Seccion titulo="Contraseña">
            <Tarjeta className="p-5 sm:p-6">
              <CambiarPassword />
            </Tarjeta>
          </Seccion>

          <p className="text-gris">
            Aceptaste el tratamiento de tus datos personales (Ley 25.326) el {fechaYHora(ficha.consentimientoAceptadoEn)}. Para pedir la baja de
            tu cuenta, escribile a la organización.
          </p>
        </>
      )}
    </>
  );
}
