"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormularioJugador } from "@/components/form-jugador";
import { Portada } from "@/components/portada";
import { ENLACE } from "@/components/ui";
import { api } from "@/lib/api";
import { rutaSegura, useSesion } from "@/lib/sesion";

function Registro() {
  const router = useRouter();
  const { recargar } = useSesion();
  // Si llegó leyendo el QR de un compañero sin tener cuenta, después de registrarse vuelve a armar la pareja.
  const volver = rutaSegura(useSearchParams().get("volver"));

  return (
    <Portada titulo="Crear tu cuenta" bajada="Con estos datos la organización te anota en los torneos." ancho="max-w-xl">
      <FormularioJugador
        modo="registro"
        textoDelBoton="Crear cuenta"
        alEnviar={async (datos) => {
          await api.post("/auth/registro", datos);
          await recargar();
          router.replace(volver ?? "/panel");
        }}
      />
      <p className="mt-7 border-t border-linea pt-6">
        ¿Ya tenés cuenta?{" "}
        <Link href={volver ? `/login?volver=${encodeURIComponent(volver)}` : "/login"} className={ENLACE}>
          Ingresar
        </Link>
      </p>
    </Portada>
  );
}

export default function PaginaDeRegistro() {
  return (
    <Suspense>
      <Registro />
    </Suspense>
  );
}
