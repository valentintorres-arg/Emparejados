import type { Metadata } from "next";
import { Isotipo } from "@/components/marca";

export const metadata: Metadata = { title: "Sin conexión" };

/** La muestra el service worker cuando se abre una pantalla sin señal. */
export default function SinConexion() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Isotipo className="size-16" />
      <h1 className="titulo mt-6 text-4xl">No hay conexión</h1>
      <p className="mt-2 max-w-sm text-gris">
        Para ver parejas, partidos y resultados al día hace falta señal. Cuando vuelva, abrí la app de nuevo.
      </p>
      {/* Enlace común (no <Link>): fuerza un pedido a la red en lugar de navegar con lo guardado. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-pista px-5 font-semibold text-white">
        Reintentar
      </a>
    </main>
  );
}
