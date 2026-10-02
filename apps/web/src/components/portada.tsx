import Link from "next/link";
import { Cancha, Marca } from "./marca";

/** Marco de las pantallas sin sesión (ingreso y registro): la cancha a un lado, el formulario al otro. */
export function Portada({ titulo, bajada, children, ancho = "max-w-sm" }: { titulo: string; bajada: string; children: React.ReactNode; ancho?: string }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative overflow-hidden bg-pista px-6 py-5 text-white lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:p-12">
        <Cancha className="pointer-events-none absolute -right-10 top-1/2 hidden h-[125%] -translate-y-1/2 rotate-12 text-white/15 lg:block" />
        <Link href="/" className="relative">
          <Marca />
        </Link>
        <div className="relative hidden lg:block">
          <p className="titulo max-w-md text-6xl">Tu pareja, tu torneo, tu próximo partido.</p>
          <p className="mt-5 max-w-sm text-xl text-white/90">
            Armá pareja escaneando un QR, anotate en los torneos del club y seguí el fixture desde el celular.
          </p>
        </div>
        <p className="relative hidden text-white/75 lg:block">Emparejados Pádel</p>
      </div>

      <main className="flex items-start justify-center px-5 py-9 lg:items-center lg:py-12">
        <div className={`w-full ${ancho}`}>
          <h1 className="titulo text-4xl">{titulo}</h1>
          <p className="mb-7 mt-2 text-lg text-gris">{bajada}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
