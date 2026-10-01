import type { Prisma } from '../generated/prisma/client.ts';

// Formas de respuesta compartidas, para que todas las pantallas reciban
// jugadores, parejas y partidos con la misma estructura.

export const jugadorBasico = {
  id: true,
  nombre: true,
  apellido: true,
  fotoUrl: true,
  genero: true,
  categoria: { select: { id: true, nombre: true, orden: true } },
} satisfies Prisma.JugadorSelect;

export const parejaConJugadores = {
  id: true,
  estado: true,
  jugador1: { select: jugadorBasico },
  jugador2: { select: jugadorBasico },
} satisfies Prisma.ParejaSelect;

export const partidoCompleto = {
  sets: { orderBy: { numero: 'asc' } },
  cancha: { select: { id: true, nombre: true } },
  zona: { select: { id: true, nombre: true } },
  pareja1: { select: { siembra: true, pareja: { select: parejaConJugadores } } },
  pareja2: { select: { siembra: true, pareja: { select: parejaConJugadores } } },
} satisfies Prisma.PartidoInclude;

type PartidoCompleto = Prisma.PartidoGetPayload<{ include: typeof partidoCompleto }>;

/** Saca el nivel intermedio de la inscripción: pareja1 pasa a ser la pareja. */
export function aplanarPartido<T extends PartidoCompleto>(partido: T) {
  const { pareja1, pareja2, ...resto } = partido;
  return { ...resto, pareja1: pareja1?.pareja ?? null, pareja2: pareja2?.pareja ?? null };
}
