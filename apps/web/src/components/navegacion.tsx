"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { traer } from "@/lib/api";
import { nombreCompleto } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { ResumenAdmin } from "@/lib/tipos";
import { Marca } from "./marca";
import { InstalarApp } from "./pwa";
import { Boton, Cargando, Icono, type NombreDeIcono } from "./ui";

interface Destino {
  href: string;
  texto: string;
  icono: NombreDeIcono;
  /** Solo en la barra lateral de escritorio; en el celular se llega desde Inicio. */
  soloEscritorio?: boolean;
}

const DE_JUGADOR: Destino[] = [
  { href: "/panel", texto: "Inicio", icono: "inicio" },
  { href: "/parejas", texto: "Parejas", icono: "parejas" },
  { href: "/partidos", texto: "Partidos", icono: "partidos" },
  { href: "/torneos", texto: "Torneos", icono: "trofeo" },
  { href: "/perfil", texto: "Mis datos", icono: "persona" },
];

const DE_ADMIN: Destino[] = [
  { href: "/admin", texto: "Inicio", icono: "inicio" },
  { href: "/admin/aprobaciones", texto: "Aprobaciones", icono: "bandeja" },
  { href: "/torneos", texto: "Torneos", icono: "trofeo" },
  { href: "/admin/jugadores", texto: "Jugadores", icono: "parejas" },
  { href: "/admin/sedes", texto: "Sedes", icono: "sede", soloEscritorio: true },
  { href: "/admin/usuarios", texto: "Usuarios", icono: "escudo", soloEscritorio: true },
  { href: "/admin/auditoria", texto: "Auditoría", icono: "registro", soloEscritorio: true },
];

const SOLO_JUGADOR = ["/panel", "/parejas", "/partidos", "/perfil"];

function estaActivo(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navegacion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, esAdmin, salir } = useSesion();
  const { data: resumen } = useSWR<ResumenAdmin>(esAdmin ? "/admin/resumen" : null, traer);

  const esPublica = pathname.startsWith("/torneos");
  const requiereAdmin = pathname.startsWith("/admin");
  const requiereJugador = SOLO_JUGADOR.some((ruta) => estaActivo(pathname, ruta));

  // A dónde mandar a quien no puede ver esta pantalla (null = puede verla).
  let destino: string | null = null;
  if (usuario === null && !esPublica) destino = `/login?volver=${encodeURIComponent(pathname)}`;
  else if (usuario && requiereAdmin && !esAdmin) destino = "/panel";
  else if (usuario && requiereJugador && !usuario.jugador) destino = "/admin";

  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);

  const destinos = usuario ? (esAdmin ? DE_ADMIN : DE_JUGADOR) : [];
  const pendientes = resumen ? resumen.parejasPorAprobar + resumen.inscripcionesPorAprobar : 0;
  const globo = (href: string) =>
    href === "/admin/aprobaciones" && pendientes > 0 ? (
      <span className="marcador inline-flex min-w-6 items-center justify-center rounded-full bg-pelota px-1.5 py-1 text-base text-tinta ring-2 ring-white" aria-label={`${pendientes} por resolver`}>
        {pendientes}
      </span>
    ) : null;

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Escritorio: barra lateral */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-pista text-white lg:flex">
        <Link href="/" className="px-5 py-6">
          <Marca />
        </Link>
        <nav aria-label="Principal" className="flex-1 space-y-1 overflow-y-auto px-3">
          {destinos.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              aria-current={estaActivo(pathname, d.href) ? "page" : undefined}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-lg font-semibold text-white/90 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white aria-[current=page]:text-pista"
            >
              <Icono nombre={d.icono} className="size-6" />
              <span className="flex-1">{d.texto}</span>
              {globo(d.href)}
            </Link>
          ))}
          {usuario === null && (
            <Link href="/torneos" aria-current="page" className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-3.5 text-lg font-semibold text-pista">
              <Icono nombre="trofeo" className="size-6" />
              Torneos
            </Link>
          )}
        </nav>
        <div className="space-y-3 border-t border-white/20 p-4">
          <InstalarApp claro className="w-full" />
          {usuario ? (
            <>
              <p className="break-words text-white/90" title={usuario.email}>
                {usuario.jugador ? nombreCompleto(usuario.jugador) : usuario.email}
              </p>
              <button
                type="button"
                onClick={salir}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-white/40 px-4 font-semibold text-white hover:bg-white/10"
              >
                <Icono nombre="salir" />
                Cerrar sesión
              </button>
            </>
          ) : (
            usuario === null && (
              <Boton href="/login" variante="claro" className="w-full">
                Ingresar
              </Boton>
            )
          )}
        </div>
      </aside>

      {/* Celular: barra superior */}
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 bg-pista px-4 py-2 text-white lg:hidden">
        <Link href="/">
          <Marca />
        </Link>
        {usuario === null && (
          <Boton href="/login" variante="claro" tamano="chico">
            Ingresar
          </Boton>
        )}
        {/* Con texto: un ícono solo no dice que cierra la sesión. */}
        {usuario && esAdmin && (
          <button type="button" onClick={salir} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-white/40 px-3 font-semibold hover:bg-white/10">
            <Icono nombre="salir" />
            Salir
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:pb-14 lg:pt-9">
        {usuario === undefined || destino ? <Cargando /> : children}
      </main>

      {/* Celular: barra inferior. El destino activo se marca con forma y peso, no solo con color. */}
      {usuario && (
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-linea bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(14_27_61/0.35)] lg:hidden"
        >
          {destinos
            .filter((d) => !d.soloEscritorio)
            .map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-current={estaActivo(pathname, d.href) ? "page" : undefined}
                className="group relative flex min-h-[4.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.85rem] font-semibold leading-tight text-gris aria-[current=page]:font-bold aria-[current=page]:text-pista"
              >
                <span className="flex h-8 w-14 items-center justify-center rounded-full group-aria-[current=page]:bg-pista group-aria-[current=page]:text-white">
                  <Icono nombre={d.icono} className="size-6" />
                </span>
                {d.texto}
                <span className="absolute right-[calc(50%-2rem)] top-0.5">{globo(d.href)}</span>
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}
