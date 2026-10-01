"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Portada } from "@/components/portada";
import { InstalarApp } from "@/components/pwa";
import { Boton, Campo, ErrorDeFormulario } from "@/components/ui";
import { api, mensajeDe } from "@/lib/api";
import { useSesion } from "@/lib/sesion";

// Accesos de un toque para recorrer la app con los datos de ejemplo.
// NEXT_PUBLIC_DEMO=1 muestra los dos; "jugador", solo el del jugador (para un
// servidor público, donde la cuenta de la organización tiene su propia clave).
const MODO_DEMO = process.env.NEXT_PUBLIC_DEMO;
const CUENTAS_DEMO = [
  { rol: "Organización", email: "admin@emparejados.test", password: "admin1234" },
  { rol: "Jugador", email: "jugador@emparejados.test", password: "jugador1234" },
].filter((cuenta) => MODO_DEMO === "1" || (MODO_DEMO === "jugador" && cuenta.rol === "Jugador"));
const DEMO = CUENTAS_DEMO.length > 0;

/** Solo se vuelve a rutas internas: evita que un enlace armado mande a otro sitio. */
const rutaSegura = (ruta: string | null) => (ruta && ruta.startsWith("/") && !ruta.startsWith("//") ? ruta : null);

function Ingreso() {
  const router = useRouter();
  const volver = rutaSegura(useSearchParams().get("volver"));
  const { usuario, esAdmin, recargar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) router.replace(volver ?? (esAdmin ? "/admin" : "/panel"));
  }, [usuario, esAdmin, volver, router]);

  const ingresar = async (email: string, password: string) => {
    setError(null);
    setEnviando(true);
    try {
      await api.post("/auth/login", { email, password });
      await recargar();
    } catch (e) {
      setError(mensajeDe(e));
      setEnviando(false);
    }
  };

  return (
    <Portada titulo="Ingresar" bajada="Entrá con tu email y tu contraseña.">
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          const f = new FormData(evento.currentTarget);
          ingresar(String(f.get("email")), String(f.get("password")));
        }}
      >
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required />
        <ErrorDeFormulario mensaje={error} />
        <Boton type="submit" cargando={enviando} className="w-full">
          Ingresar
        </Boton>
      </form>

      {DEMO && (
        <div className="mt-6 rounded-lg border border-dashed border-pista/40 bg-pista-50/60 p-4">
          <p className="text-sm font-semibold">Probá la app con datos de ejemplo</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CUENTAS_DEMO.map((cuenta) => (
              <Boton key={cuenta.rol} variante="secundario" tamano="chico" disabled={enviando} onClick={() => ingresar(cuenta.email, cuenta.password)}>
                Entrar como {cuenta.rol.toLowerCase()}
              </Boton>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3 border-t border-linea pt-5 text-sm">
        <p>
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" className="font-semibold text-pista underline-offset-2 hover:underline">
            Registrate como jugador
          </Link>
        </p>
        <p>
          <Link href="/torneos" className="font-semibold text-pista underline-offset-2 hover:underline">
            Ver torneos y resultados sin ingresar
          </Link>
        </p>
        <InstalarApp />
      </div>
    </Portada>
  );
}

export default function PaginaDeIngreso() {
  return (
    <Suspense>
      <Ingreso />
    </Suspense>
  );
}
