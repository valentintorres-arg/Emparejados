"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, traer } from "./api";
import type { Yo } from "./tipos";

interface Sesion {
  /** undefined mientras se averigua; null si no hay sesión. */
  usuario: Yo | null | undefined;
  esAdmin: boolean;
  recargar: () => Promise<unknown>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorDeSesion({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<Yo>("/auth/yo", traer, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const { mutate: limpiar } = useSWRConfig();

  const salir = useCallback(async () => {
    await api.post("/auth/salir");
    // Vacía todo lo guardado: la próxima persona no ve datos de la anterior.
    await limpiar(() => true, undefined, { revalidate: false });
    // Recarga completa a propósito: no queda en memoria ningún estado de la sesión anterior.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, [limpiar]);

  const valor = useMemo<Sesion>(() => {
    const usuario = isLoading ? undefined : error ? null : (data ?? null);
    return { usuario, esAdmin: usuario?.rol === "ADMIN", recargar: () => mutate(), salir };
  }, [data, error, isLoading, mutate, salir]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error("useSesion se usa dentro de ProveedorDeSesion");
  return sesion;
}
