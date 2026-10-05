"use client";

import useSWR from "swr";
import { EsqueletoParejas } from "@/components/esqueletos";
import { TarjetaDePareja } from "@/components/parejas";
import { Boton, Encabezado, FalloDeCarga, Seccion, Vacio } from "@/components/ui";
import { traer } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import type { Pareja } from "@/lib/tipos";

export default function MisParejas() {
  const { usuario } = useSesion();
  const miId = usuario!.jugador!.id;
  const { data: parejas, error, mutate } = useSWR<Pareja[]>("/parejas/mias", traer);

  const enTramite = parejas?.filter((p) => p.estado === "PENDIENTE" || p.estado === "CONFIRMADA") ?? [];
  const activas = parejas?.filter((p) => p.estado === "ACTIVA") ?? [];
  const historial = parejas?.filter((p) => p.estado === "RECHAZADA" || p.estado === "DISUELTA") ?? [];

  return (
    <>
      <Encabezado titulo="Parejas" detalle="Podés tener varias, pero una sola por torneo.">
        <Boton href="/parejas/escanear" icono="camara">
          Armar una pareja nueva
        </Boton>
      </Encabezado>

      {error ? (
        <FalloDeCarga error={error} reintentar={() => mutate()} />
      ) : !parejas ? (
        <EsqueletoParejas />
      ) : parejas.length === 0 ? (
        <Vacio titulo="Todavía no armaste ninguna pareja">
          Juntate con tu compañero y escaneá su código QR. Lo encuentra en la pantalla de inicio de su cuenta.
        </Vacio>
      ) : (
        <>
          {enTramite.length > 0 && (
            <Seccion titulo="En trámite">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {enTramite.map((p) => (
                  <TarjetaDePareja key={p.id} pareja={p} miId={miId} />
                ))}
              </div>
            </Seccion>
          )}
          {activas.length > 0 && (
            <Seccion titulo="Activas">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activas.map((p) => (
                  <TarjetaDePareja key={p.id} pareja={p} miId={miId} />
                ))}
              </div>
            </Seccion>
          )}
          {historial.length > 0 && (
            <Seccion titulo="Historial">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {historial.map((p) => (
                  <TarjetaDePareja key={p.id} pareja={p} miId={miId} />
                ))}
              </div>
            </Seccion>
          )}
        </>
      )}
    </>
  );
}
