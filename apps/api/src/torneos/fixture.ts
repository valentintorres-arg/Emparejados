import { randomInt } from 'node:crypto';
import type { Instancia } from '../generated/prisma/enums.ts';

// Funciones puras del armado de fixtures: no tocan la base, así se pueden
// probar solas y reutilizar desde la carga de datos de ejemplo.

export function mezclar<T>(items: readonly T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ─── Zonas ───────────────────────────────────────────────────────────────────

/**
 * Zonas de 3 parejas; las que sobran completan zonas de 4. Con menos de 6
 * parejas queda una sola zona. El reparto es en serpentina para que los
 * cabezas de serie caigan en zonas distintas.
 */
export function repartirEnZonas<T>(sembrados: readonly T[]): T[][] {
  const cantidad = Math.max(1, Math.floor(sembrados.length / 3));
  const zonas: T[][] = Array.from({ length: cantidad }, () => []);
  sembrados.forEach((item, i) => {
    const vuelta = Math.floor(i / cantidad);
    const posicion = i % cantidad;
    zonas[vuelta % 2 === 0 ? posicion : cantidad - 1 - posicion].push(item);
  });
  return zonas;
}

export const nombreDeZona = (indice: number) => String.fromCharCode(65 + indice);

/** Todos contra todos por fechas (método del círculo): nadie juega dos veces en la misma fecha. */
export function fechasTodosContraTodos<T>(items: readonly T[]): [T, T][][] {
  const lista: (T | null)[] = [...items];
  if (lista.length % 2 === 1) lista.push(null);
  const n = lista.length;
  const fechas: [T, T][][] = [];
  for (let fecha = 0; fecha < n - 1; fecha++) {
    const cruces: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i];
      const b = lista[n - 1 - i];
      if (a !== null && b !== null) cruces.push([a, b]);
    }
    fechas.push(cruces);
    // El primero queda fijo y el resto rota un lugar.
    lista.splice(1, 0, lista.pop()!);
  }
  return fechas;
}

// ─── Posiciones ──────────────────────────────────────────────────────────────

export interface PartidoJugado {
  pareja1Id: number | null;
  pareja2Id: number | null;
  ganadorId: number | null;
  estado: string;
  sets: { gamesP1: number; gamesP2: number }[];
}

export interface Posicion {
  parejaId: number;
  jugados: number;
  ganados: number;
  perdidos: number;
  setsFavor: number;
  setsContra: number;
  gamesFavor: number;
  gamesContra: number;
  puntos: number;
}

const PUNTOS_GANADO = 2;
const PUNTOS_PERDIDO = 1;
// Quien no se presenta (W.O.) no suma.
const PUNTOS_WO = 0;

/** Orden: puntos, diferencia de sets, diferencia de games. */
export function calcularPosiciones(parejaIds: readonly number[], partidos: readonly PartidoJugado[]): Posicion[] {
  const tabla = new Map<number, Posicion>(
    parejaIds.map((parejaId) => [
      parejaId,
      { parejaId, jugados: 0, ganados: 0, perdidos: 0, setsFavor: 0, setsContra: 0, gamesFavor: 0, gamesContra: 0, puntos: 0 },
    ]),
  );

  for (const partido of partidos) {
    if (partido.ganadorId === null || partido.pareja1Id === null || partido.pareja2Id === null) continue;
    const lados = [
      { fila: tabla.get(partido.pareja1Id), propio: 'gamesP1', rival: 'gamesP2' },
      { fila: tabla.get(partido.pareja2Id), propio: 'gamesP2', rival: 'gamesP1' },
    ] as const;
    for (const { fila, propio, rival } of lados) {
      if (!fila) continue;
      const gano = partido.ganadorId === fila.parejaId;
      fila.jugados++;
      if (gano) fila.ganados++;
      else fila.perdidos++;
      fila.puntos += gano ? PUNTOS_GANADO : partido.estado === 'WO' ? PUNTOS_WO : PUNTOS_PERDIDO;
      for (const set of partido.sets) {
        fila.gamesFavor += set[propio];
        fila.gamesContra += set[rival];
        if (set[propio] > set[rival]) fila.setsFavor++;
        else fila.setsContra++;
      }
    }
  }

  return [...tabla.values()].sort(compararPosiciones);
}

export function compararPosiciones(a: Posicion, b: Posicion): number {
  return (
    b.puntos - a.puntos ||
    b.setsFavor - b.setsContra - (a.setsFavor - a.setsContra) ||
    b.gamesFavor - b.gamesContra - (a.gamesFavor - a.gamesContra) ||
    a.parejaId - b.parejaId
  );
}

// ─── Llaves ──────────────────────────────────────────────────────────────────

const INSTANCIAS: Record<number, Instancia> = {
  1: 'FINAL',
  2: 'SEMIFINAL',
  4: 'CUARTOS',
  8: 'OCTAVOS',
  16: 'DIECISEISAVOS',
};

export const MAXIMO_EN_LLAVE = 32;

/** Posiciones de una llave de `tamano` lugares: el 1 y el 2 solo se cruzan en la final. */
export function ordenDeLlave(tamano: number): number[] {
  let orden = [1];
  while (orden.length < tamano) {
    const total = orden.length * 2 + 1;
    orden = orden.flatMap((cabeza) => [cabeza, total - cabeza]);
  }
  return orden;
}

export interface PartidoDeLlave {
  ronda: number;
  indice: number;
  instancia: Instancia;
  pareja1Id: number | null;
  pareja2Id: number | null;
  /** Partido de la ronda siguiente al que avanza el ganador. */
  siguiente: { ronda: number; indice: number; slot: 1 | 2 } | null;
}

/**
 * Arma la llave completa a partir de las parejas en orden de siembra.
 * Si no alcanzan para llenarla, los mejores sembrados pasan la primera ronda
 * sin jugar: ese partido no se crea y la pareja ya figura en la ronda siguiente.
 */
export function planearLlave(sembrados: readonly number[]): PartidoDeLlave[] {
  let tamano = 2;
  while (tamano < sembrados.length) tamano *= 2;
  const lugares = ordenDeLlave(tamano).map((cabeza) => sembrados[cabeza - 1] ?? null);
  const rondas = Math.log2(tamano);

  const partidos = new Map<string, PartidoDeLlave>();
  const clave = (ronda: number, indice: number) => `${ronda}-${indice}`;
  for (let ronda = 0; ronda < rondas; ronda++) {
    const cantidad = tamano / 2 ** (ronda + 1);
    for (let indice = 0; indice < cantidad; indice++) {
      partidos.set(clave(ronda, indice), {
        ronda,
        indice,
        instancia: INSTANCIAS[cantidad],
        pareja1Id: ronda === 0 ? lugares[indice * 2] : null,
        pareja2Id: ronda === 0 ? lugares[indice * 2 + 1] : null,
        siguiente:
          ronda < rondas - 1
            ? { ronda: ronda + 1, indice: Math.floor(indice / 2), slot: indice % 2 === 0 ? 1 : 2 }
            : null,
      });
    }
  }

  if (rondas > 1) {
    for (let indice = 0; indice < tamano / 2; indice++) {
      const partido = partidos.get(clave(0, indice))!;
      const unica = partido.pareja1Id ?? partido.pareja2Id;
      if (partido.pareja1Id !== null && partido.pareja2Id !== null) continue;
      const destino = partidos.get(clave(partido.siguiente!.ronda, partido.siguiente!.indice))!;
      if (partido.siguiente!.slot === 1) destino.pareja1Id = unica;
      else destino.pareja2Id = unica;
      partidos.delete(clave(0, indice));
    }
  }

  return [...partidos.values()].sort((a, b) => a.ronda - b.ronda || a.indice - b.indice);
}

interface Clasificada {
  parejaId: number;
  zonaId: number;
}

/**
 * Siembra de la llave posterior a las zonas: primero los ganadores de zona y
 * después los segundos. Se rota el orden de los segundos hasta que ninguna
 * pareja se cruce en su primer partido con la que ya enfrentó en su zona.
 */
export function sembrarClasificadas(primeros: readonly Clasificada[], segundos: readonly Clasificada[]): number[] {
  const zonaDe = new Map([...primeros, ...segundos].map((c) => [c.parejaId, c.zonaId]));
  let mejor: number[] = [];
  let menosCruces = Infinity;
  for (let giro = 0; giro < Math.max(1, segundos.length); giro++) {
    const rotados = [...segundos.slice(giro), ...segundos.slice(0, giro)];
    const siembra = [...primeros, ...rotados].map((c) => c.parejaId);
    const cruces = planearLlave(siembra).filter(
      (p) => p.pareja1Id !== null && p.pareja2Id !== null && zonaDe.get(p.pareja1Id) === zonaDe.get(p.pareja2Id),
    ).length;
    if (cruces < menosCruces) {
      menosCruces = cruces;
      mejor = siembra;
    }
  }
  return mejor;
}
