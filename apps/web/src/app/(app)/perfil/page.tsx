"use client";

import useSWR from "swr";
import { CambiarPassword } from "@/components/cambiar-password";
import { EsqueletoPerfil } from "@/components/esqueletos";
import { CambiarFoto } from "@/components/foto";
import { FormularioJugador } from "@/components/form-jugador";
import { ActivarNotificaciones } from "@/components/notificaciones";
import { InstalarApp } from "@/components/pwa";
import { Boton, Encabezado, FalloDeCarga, Seccion, Tarjeta, useAviso } from "@/components/ui";
import { api, traer } from "@/lib/api";
import { fechaYHora } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { FichaJugador } from "@/lib/tipos";

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
        <EsqueletoPerfil />
      ) : (
        <>
          <Tarjeta className="mb-9 flex flex-col items-center gap-3 p-5 sm:flex-row sm:gap-6 sm:p-6">
            <CambiarFoto jugador={ficha} alCambiar={() => void Promise.all([mutate(), recargar()])} />
            <p className="max-w-sm text-center text-gris sm:text-left">Tu foto la ven tu compañero y la organización. Elegí una donde se te vea bien la cara.</p>
          </Tarjeta>

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
