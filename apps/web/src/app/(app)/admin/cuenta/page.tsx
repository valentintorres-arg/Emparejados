"use client";

import { CambiarPassword } from "@/components/cambiar-password";
import { ActivarNotificaciones } from "@/components/notificaciones";
import { Boton, Encabezado, Seccion, Tarjeta } from "@/components/ui";
import { useSesion } from "@/lib/sesion";

/** La cuenta de quien administra: no tiene ficha de jugador, así que "Mis datos" no le sirve. */
export default function MiCuenta() {
  const { usuario, salir } = useSesion();

  return (
    <>
      <Encabezado titulo="Mi cuenta" volver="/admin" detalle={usuario!.email}>
        <Boton variante="secundario" icono="salir" onClick={salir}>
          Cerrar sesión
        </Boton>
      </Encabezado>

      <Seccion titulo="Contraseña">
        <Tarjeta className="p-5 sm:p-6">
          <CambiarPassword />
        </Tarjeta>
      </Seccion>

      <ActivarNotificaciones />
    </>
  );
}
