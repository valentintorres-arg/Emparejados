"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormularioJugador } from "@/components/form-jugador";
import { Portada } from "@/components/portada";
import { ENLACE } from "@/components/ui";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";

export default function PaginaDeRegistro() {
  const router = useRouter();
  const { recargar } = useSesion();

  return (
    <Portada titulo="Crear tu cuenta" bajada="Con estos datos la organización te anota en los torneos." ancho="max-w-xl">
      <FormularioJugador
        modo="registro"
        textoDelBoton="Crear cuenta"
        alEnviar={async (datos) => {
          await api.post("/auth/registro", datos);
          await recargar();
          router.replace("/panel");
        }}
      />
      <p className="mt-7 border-t border-linea pt-6">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className={ENLACE}>
          Ingresar
        </Link>
      </p>
    </Portada>
  );
}
