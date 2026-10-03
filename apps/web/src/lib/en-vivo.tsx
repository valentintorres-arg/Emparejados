"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";

/** Una acción suele dejar varios registros juntos: se espera este tiempo antes de actualizar. */
const ESPERA_MS = 400;

/**
 * Mantiene abierta una conexión de eventos con la API (/api/avisos/en-vivo):
 * cuando se confirma un cambio en la base, las pantallas vuelven a pedir sus
 * datos sin que nadie recargue. Con la app en segundo plano la conexión se
 * cierra para no gastar batería; al volver, SWR actualiza lo que está a la vista.
 */
export function EnVivo() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let fuente: EventSource | null = null;
    let espera = 0;

    // Sin datos nuevos: SWR vuelve a pedir lo que está en pantalla sin borrar lo que se ve.
    const actualizar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => void mutate(() => true), ESPERA_MS);
    };
    const abrir = () => {
      if (fuente) return;
      let reconexion = false;
      fuente = new EventSource("/api/avisos/en-vivo");
      fuente.addEventListener("cambio", actualizar);
      // Mientras estuvo cortada pudo cambiar algo.
      fuente.addEventListener("open", () => {
        if (reconexion) actualizar();
        reconexion = true;
      });
    };
    const cerrar = () => {
      fuente?.close();
      fuente = null;
    };
    const alCambiarVisibilidad = () => (document.visibilityState === "visible" ? abrir() : cerrar());

    alCambiarVisibilidad();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.clearTimeout(espera);
      cerrar();
    };
  }, [mutate]);

  return null;
}
