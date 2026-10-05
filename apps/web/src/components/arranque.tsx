import { Cancha, Isotipo } from "./marca";

/**
 * Pantalla de arranque: lo primero que se ve al abrir la app instalada, mientras
 * se confirma la sesión. Sigue el azul de la pantalla que arma Android con el
 * ícono (manifest.ts), así el paso de una a la otra no se nota.
 */
export function Arranque() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-pista px-6 pb-[env(safe-area-inset-bottom)] text-center text-white">
      <Cancha className="pointer-events-none absolute left-1/2 top-1/2 h-[125%] -translate-x-1/2 -translate-y-1/2 rotate-12 text-white/10" />

      <div className="relative flex flex-col items-center">
        <Isotipo className="size-24 rounded-3xl shadow-flotante ring-2 ring-white/30" />
        <h1 className="marca mt-6 text-5xl">Emparejados</h1>
        <p className="titulo mt-4 max-w-72 text-2xl text-white/95">Tu pareja, tu torneo, tu próximo partido.</p>

        {/* Dos pelotas picando, la pareja del isotipo: avisan que la app está abriendo. */}
        <p role="status" className="mt-12 flex h-10 items-end gap-3">
          <span aria-hidden="true" className="picando size-4 rounded-full bg-pelota" />
          <span aria-hidden="true" className="picando size-4 rounded-full bg-pelota [animation-delay:180ms]" />
          <span className="sr-only">Abriendo la app…</span>
        </p>
      </div>

      <p className="absolute inset-x-0 bottom-[calc(1.75rem+env(safe-area-inset-bottom))] text-white/80">Pádel: parejas, torneos y partidos</p>
    </main>
  );
}
