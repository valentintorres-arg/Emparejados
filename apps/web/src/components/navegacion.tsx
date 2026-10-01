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
      <span className="marcador rounded-full bg-pelota px-1.5 py-0.5 text-xs text-tinta" aria-label={`${pendientes} por resolver`}>
        {pendientes}
      </span>
    ) : null;

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Escritorio: barra lateral */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-pista text-white lg:flex">
        <Link href="/" className="px-5 py-5">
          <Marca />
        </Link>
        <nav aria-label="Principal" className="flex-1 space-y-0.5 px-3">
          {destinos.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              aria-current={estaActivo(pathname, d.href) ? "page" : undefined}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 font-semibold text-white/80 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white aria-[current=page]:text-pista"
            >
              <Icono nombre={d.icono} />
              <span className="flex-1">{d.texto}</span>
              {globo(d.href)}
            </Link>
          ))}
          {usuario === null && (
            <Link href="/torneos" aria-current="page" className="flex items-center gap-3 rounded-md bg-white px-3 py-2.5 font-semibold text-pista">
              <Icono nombre="trofeo" />
              Torneos
            </Link>
          )}
        </nav>
        <div className="space-y-3 border-t border-white/15 p-4">
          <InstalarApp claro />
          {usuario ? (
            <>
              <p className="truncate text-sm text-white/75" title={usuario.email}>
                {usuario.jugador ? nombreCompleto(usuario.jugador) : usuario.email}
              </p>
              <button type="button" onClick={salir} className="flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
                <Icono nombre="salir" className="size-4" />
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
      <header className="sticky top-0 z-30 flex items-center justify-between bg-pista px-4 py-2.5 text-white lg:hidden">
        <Link href="/">
          <Marca />
        </Link>
        {usuario === null && (
          <Boton href="/login" variante="claro" tamano="chico">
            Ingresar
          </Boton>
        )}
        {usuario && esAdmin && (
          <button type="button" onClick={salir} aria-label="Cerrar sesión" className="rounded-md p-2 hover:bg-white/10">
            <Icono nombre="salir" />
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
        {usuario === undefined || destino ? <Cargando /> : children}
      </main>

      {/* Celular: barra inferior */}
      {usuario && (
        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-linea bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {destinos
            .filter((d) => !d.soloEscritorio)
            .map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-current={estaActivo(pathname, d.href) ? "page" : undefined}
                className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold text-gris aria-[current=page]:text-pista"
              >
                <Icono nombre={d.icono} className="size-6" />
                {d.texto}
                <span className="absolute right-[calc(50%-1.4rem)] top-1">{globo(d.href)}</span>
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}
