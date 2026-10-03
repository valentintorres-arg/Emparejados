"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Portada } from "@/components/portada";
import { Boton, Campo, ENLACE, ErrorDeFormulario } from "@/components/ui";
import { api, mensajeDe } from "@/lib/api";
import { rutaSegura, useSesion } from "@/lib/sesion";

function Recuperar() {
  const router = useRouter();
  const volver = rutaSegura(useSearchParams().get("volver"));
  const { recargar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <Portada titulo="Elegí una contraseña nueva" bajada="Con el código de un solo uso que te pasó la organización.">
      <form
        className="space-y-5"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const f = new FormData(evento.currentTarget);
          if (f.get("nueva") !== f.get("repetida")) {
            setError("Las dos contraseñas no coinciden.");
            return;
          }
          setError(null);
          setEnviando(true);
          try {
            // Si sale bien, la API ya deja la sesión abierta.
            await api.post("/auth/password-con-codigo", { email: f.get("email"), codigo: f.get("codigo"), nueva: f.get("nueva") });
            const yo = (await recargar()) as { rol?: string } | undefined;
            router.replace(volver ?? (yo?.rol === "ADMIN" ? "/admin" : "/panel"));
          } catch (e) {
            setError(mensajeDe(e));
            setEnviando(false);
          }
        }}
      >
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Código"
          name="codigo"
          required
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-2345"
          className="[&_input]:text-2xl [&_input]:font-bold [&_input]:uppercase [&_input]:tracking-widest"
          ayuda="8 letras y números. Sirve una sola vez."
        />
        <Campo etiqueta="Contraseña nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required ayuda="Al menos 8 caracteres." />
        <Campo etiqueta="Repetí la contraseña nueva" name="repetida" type="password" autoComplete="new-password" minLength={8} required />
        <ErrorDeFormulario mensaje={error} />
        <Boton type="submit" cargando={enviando} className="w-full">
          Guardar y entrar
        </Boton>
      </form>

      <div className="mt-7 space-y-3 border-t border-linea pt-6">
        <p className="text-gris">¿No tenés código? Pedíselo a la organización de tu club.</p>
        <p>
          <Link href={volver ? `/login?volver=${encodeURIComponent(volver)}` : "/login"} className={ENLACE}>
            Volver a ingresar
          </Link>
        </p>
      </div>
    </Portada>
  );
}

export default function PaginaRecuperar() {
  return (
    <Suspense>
      <Recuperar />
    </Suspense>
  );
}
