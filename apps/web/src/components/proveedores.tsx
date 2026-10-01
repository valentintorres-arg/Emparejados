"use client";

import { SWRConfig } from "swr";
import { ErrorApi } from "@/lib/api";
import { ProveedorDeSesion } from "@/lib/sesion";
import { ProveedorDeAvisos, ProveedorDeConfirmacion } from "./ui";

export function Proveedores({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        // Un 4xx no se arregla reintentando; un corte de red, sí.
        shouldRetryOnError: (error) => !(error instanceof ErrorApi) || error.estado === 0 || error.estado >= 500,
        errorRetryCount: 2,
      }}
    >
      <ProveedorDeSesion>
        <ProveedorDeAvisos>
          <ProveedorDeConfirmacion>{children}</ProveedorDeConfirmacion>
        </ProveedorDeAvisos>
      </ProveedorDeSesion>
    </SWRConfig>
  );
}
