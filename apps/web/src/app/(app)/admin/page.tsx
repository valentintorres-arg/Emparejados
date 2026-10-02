"use client";

import Link from "next/link";
import useSWR from "swr";
import { InstalarApp } from "@/components/pwa";
import { Boton, Cargando, Encabezado, Estado, Icono, type NombreDeIcono, Seccion, Tarjeta, TARJETA_ENLACE } from "@/components/ui";
import { traer } from "@/lib/api";
import { ESTADOS_TORNEO, RAMAS, rangoDeFechas } from "@/lib/formato";
import type { ResumenAdmin, TorneoResumen } from "@/lib/tipos";

function Pendiente({ href, cantidad, singular, plural }: { href: string; cantidad: number; singular: string; plural: string }) {
  const hay = cantidad > 0;
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border p-5 ${hay ? "border-pista bg-white shadow-tarjeta ring-2 ring-pista hover:bg-pista-50" : "border-linea bg-white/70"}`}
    >
      <span className={`marcador flex size-16 shrink-0 items-center justify-center rounded-2xl text-5xl ${hay ? "bg-pelota text-tinta" : "bg-fondo text-gris"}`}>{cantidad}</span>
      <span>
        <span className="block text-lg font-bold leading-tight">{cantidad === 1 ? singular : plural}</span>
        <span className="mt-0.5 block text-gris">{hay ? "Tocá para revisar" : "Nada por resolver"}</span>
      </span>
    </Link>
  );
}

const ACCESOS: { href: string; texto: string; detalle: string; icono: NombreDeIcono }[] = [
  { href: "/admin/jugadores", texto: "Jugadores", detalle: "Alta, búsqueda y fichas", icono: "parejas" },
  { href: "/torneos", texto: "Torneos", detalle: "Inscripciones, fixture y resultados", icono: "trofeo" },
  { href: "/admin/sedes", texto: "Sedes y canchas", detalle: "Clubes donde se juega", icono: "sede" },
  { href: "/admin/usuarios", texto: "Usuarios", detalle: "Roles, bloqueos y contraseñas", icono: "escudo" },
  { href: "/admin/auditoria", texto: "Auditoría", detalle: "Quién hizo qué y cuándo", icono: "registro" },
];

export default function InicioDeLaOrganizacion() {
  const { data: resumen } = useSWR<ResumenAdmin>("/admin/resumen", traer);
  const { data: torneos } = useSWR<TorneoResumen[]>("/torneos", traer);
  const vigentes = torneos?.filter((t) => t.estado === "EN_CURSO" || t.estado === "INSCRIPCION_ABIERTA" || t.estado === "BORRADOR");

  return (
    <>
      <Encabezado titulo="Organización" detalle={resumen ? `${resumen.jugadores} jugadores registrados` : undefined}>
        <InstalarApp className="lg:hidden" />
      </Encabezado>

      <Seccion titulo="Esperan tu decisión">
        {!resumen ? (
          <Cargando />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Pendiente href="/admin/aprobaciones" cantidad={resumen.parejasPorAprobar} singular="pareja por aprobar" plural="parejas por aprobar" />
            <Pendiente href="/admin/aprobaciones" cantidad={resumen.inscripcionesPorAprobar} singular="inscripción por aprobar" plural="inscripciones por aprobar" />
          </div>
        )}
      </Seccion>

      <Seccion
        titulo="Torneos abiertos"
        accion={
          <Boton href="/admin/torneos/nuevo" tamano="chico" variante="secundario" icono="mas">
            Nuevo torneo
          </Boton>
        }
      >
        {!vigentes ? (
          <Cargando />
        ) : (
          <Tarjeta>
            <ul className="divide-y divide-linea">
              {vigentes.map((torneo) => (
                <li key={torneo.id}>
                  <Link href={`/torneos/${torneo.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 hover:bg-pista-50/50 sm:px-5">
                    <span>
                      <span className="block text-lg font-bold leading-tight">{torneo.nombre}</span>
                      <span className="mt-0.5 block text-gris">
                        {torneo.categoria.nombre} {RAMAS[torneo.rama]}, {rangoDeFechas(torneo.fechaInicio, torneo.fechaFin)}
                      </span>
                    </span>
                    <Estado valor={ESTADOS_TORNEO[torneo.estado]} />
                  </Link>
                </li>
              ))}
              {vigentes.length === 0 && <li className="px-4 py-6 text-center text-gris">No hay torneos abiertos ni en curso.</li>}
            </ul>
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Todo lo demás">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCESOS.map((acceso) => (
            <li key={acceso.href}>
              <Link href={acceso.href} className={`flex h-full items-center gap-4 p-4 ${TARJETA_ENLACE}`}>
                <span className="rounded-xl bg-pista-50 p-3 text-pista">
                  <Icono nombre={acceso.icono} className="size-7" />
                </span>
                <span>
                  <span className="block text-lg font-bold leading-tight">{acceso.texto}</span>
                  <span className="mt-0.5 block text-gris">{acceso.detalle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>
    </>
  );
}
