import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { aplanarPartido, partidoCompleto } from '../comun/selecciones.ts';
import type { Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import type { ProgramacionAutomaticaDto, ProgramacionDto, ResultadoDto, SetDto } from './partido.dto.ts';

const DURACION_POR_DEFECTO_MIN = 90;
const DIAS_MAXIMOS_DE_AGENDA = 60;
const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

const jugadoresDeInscripcion = { select: { pareja: { select: { jugador1Id: true, jugador2Id: true } } } } as const;

type Intervalo = { inicio: number; fin: number };
const seSuperponen = (a: Intervalo, b: Intervalo) => a.inicio < b.fin && b.inicio < a.fin;

function setValido(set: SetDto, numero: number): boolean {
  const mayor = Math.max(set.gamesP1, set.gamesP2);
  const menor = Math.min(set.gamesP1, set.gamesP2);
  if (set.superTiebreak) {
    return numero === 3 && mayor >= 10 && mayor - menor >= 2 && (mayor === 10 || mayor - menor === 2);
  }
  return (mayor === 6 && menor <= 4) || (mayor === 7 && (menor === 5 || menor === 6));
}

/** Valida un partido al mejor de 3 sets y devuelve el lado ganador (1 o 2). */
export function ganadorPorSets(sets: SetDto[]): 1 | 2 {
  let ganados1 = 0;
  let ganados2 = 0;
  sets.forEach((set, i) => {
    if (!setValido(set, i + 1)) {
      throw new BadRequestException(
        `El set ${i + 1} (${set.gamesP1}-${set.gamesP2}) no es válido. Se acepta 6-0 a 6-4, 7-5, 7-6 o super tie-break a 10 en el tercero.`,
      );
    }
    if (ganados1 === 2 || ganados2 === 2) throw new BadRequestException('El partido ya estaba definido en dos sets: sobra el tercero.');
    if (set.gamesP1 > set.gamesP2) ganados1++;
    else ganados2++;
  });
  if (ganados1 < 2 && ganados2 < 2) throw new BadRequestException('Van un set por lado: falta cargar el tercero.');
  return ganados1 > ganados2 ? 1 : 2;
}

@Injectable()
export class PartidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async mios(jugadorId: number) {
    const deEsteJugador = { pareja: { OR: [{ jugador1Id: jugadorId }, { jugador2Id: jugadorId }] } };
    const partidos = await this.prisma.partido.findMany({
      where: { OR: [{ pareja1: deEsteJugador }, { pareja2: deEsteJugador }], torneo: { estado: { not: 'CANCELADO' } } },
      include: { ...partidoCompleto, torneo: { select: { id: true, nombre: true, sede: { select: { nombre: true } } } } },
      orderBy: [{ inicio: { sort: 'asc', nulls: 'last' } }, { numero: 'asc' }],
    });
    return partidos.map(aplanarPartido);
  }

  // ─── Programación ──────────────────────────────────────────────────────────

  async programar(id: number, dto: ProgramacionDto, sesion: Sesion) {
    const partido = await this.prisma.partido.findUnique({
      where: { id },
      include: {
        torneo: { select: { sedeId: true } },
        pareja1: jugadoresDeInscripcion,
        pareja2: jugadoresDeInscripcion,
      },
    });
    if (!partido) throw new NotFoundException('No encontramos ese partido.');
    if (partido.ganadorId) throw new ConflictException('El partido ya tiene resultado.');

    let data: Prisma.PartidoUncheckedUpdateInput = { canchaId: null, inicio: null, fin: null };
    if (dto.inicio !== null) {
      const cancha = await this.prisma.cancha.findUnique({ where: { id: dto.canchaId! } });
      if (!cancha || cancha.clubId !== partido.torneo.sedeId) throw new BadRequestException('Esa cancha no es de la sede del torneo.');

      const inicio = new Date(dto.inicio);
      const fin = new Date(inicio.getTime() + (dto.duracionMin ?? DURACION_POR_DEFECTO_MIN) * MINUTO);
      const jugadores = [partido.pareja1, partido.pareja2].flatMap((i) => (i ? [i.pareja.jugador1Id, i.pareja.jugador2Id] : []));
      await this.exigirJugadoresLibres(id, jugadores, inicio, fin);
      data = { canchaId: cancha.id, inicio, fin };
    }

    // La superposición de cancha la rechaza la base (partidos_cancha_sin_superposicion).
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.partido.update({ where: { id }, data, include: partidoCompleto });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'PROGRAMAR', 'partido', id, {
        canchaId: dto.canchaId,
        inicio: dto.inicio,
      });
      return aplanarPartido(actualizado);
    });
  }

  /**
   * Reparte los partidos sin horario en turnos consecutivos. Respeta el orden
   * del fixture (zonas antes que llaves, cada ronda después de la anterior) y
   * no pone a un jugador en dos canchas a la vez.
   */
  async programarAutomaticamente(torneoId: number, dto: ProgramacionAutomaticaDto, sesion: Sesion) {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id: torneoId },
      select: { estado: true, sede: { select: { canchas: { where: { activa: true }, select: { id: true } } } } },
    });
    if (!torneo) throw new NotFoundException('No encontramos ese torneo.');
    if (torneo.estado !== 'EN_CURSO') throw new ConflictException('Primero hay que sortear el fixture.');
    const canchasDeLaSede = new Set(torneo.sede.canchas.map((c) => c.id));
    if (!dto.canchaIds.every((id) => canchasDeLaSede.has(id))) {
      throw new BadRequestException('Alguna de las canchas elegidas no es de la sede del torneo.');
    }

    const desde = new Date(dto.desde);
    const [delTorneo, ocupados] = await Promise.all([
      this.prisma.partido.findMany({
        where: { torneoId },
        orderBy: { numero: 'asc' },
        include: { pareja1: jugadoresDeInscripcion, pareja2: jugadoresDeInscripcion, partidosAnteriores: { select: { id: true } } },
      }),
      // Todo lo ya agendado desde esa fecha, de cualquier torneo: ocupa canchas y jugadores.
      this.prisma.partido.findMany({
        where: { fin: { gt: desde }, estado: { in: ['PROGRAMADO', 'EN_JUEGO', 'FINALIZADO'] } },
        select: { canchaId: true, inicio: true, fin: true, pareja1: jugadoresDeInscripcion, pareja2: jugadoresDeInscripcion },
      }),
    ]);

    const jugadoresDe = (p: { pareja1: (typeof delTorneo)[number]['pareja1']; pareja2: (typeof delTorneo)[number]['pareja2'] }) =>
      [p.pareja1, p.pareja2].flatMap((i) => (i ? [i.pareja.jugador1Id, i.pareja.jugador2Id] : []));

    const agendaDeCancha = new Map<number, Intervalo[]>();
    const agendaDeJugador = new Map<number, Intervalo[]>();
    const ocupar = (mapa: Map<number, Intervalo[]>, clave: number, intervalo: Intervalo) =>
      mapa.set(clave, [...(mapa.get(clave) ?? []), intervalo]);
    const libre = (mapa: Map<number, Intervalo[]>, clave: number, intervalo: Intervalo) =>
      !(mapa.get(clave) ?? []).some((otro) => seSuperponen(otro, intervalo));
    for (const p of ocupados) {
      const intervalo = { inicio: p.inicio!.getTime(), fin: p.fin!.getTime() };
      if (p.canchaId) ocupar(agendaDeCancha, p.canchaId, intervalo);
      for (const jugador of jugadoresDe(p)) ocupar(agendaDeJugador, jugador, intervalo);
    }

    // Momento desde el que cada partido deja de bloquear a los que dependen de él.
    const finDe = new Map<number, number | null>(
      delTorneo.map((p) => [p.id, p.ganadorId ? 0 : (p.fin?.getTime() ?? null)]),
    );
    const deZona = delTorneo.filter((p) => p.instancia === 'ZONA').map((p) => p.id);
    const pendientes = delTorneo.filter((p) => !p.inicio && !p.ganadorId && p.estado === 'PROGRAMADO');
    const asignados: { id: number; canchaId: number; inicio: Date; fin: Date }[] = [];

    for (let dia = 0; dia < DIAS_MAXIMOS_DE_AGENDA && pendientes.length > 0; dia++) {
      for (let turno = 0; turno < dto.turnosPorDia && pendientes.length > 0; turno++) {
        const inicio = desde.getTime() + dia * DIA + turno * dto.duracionMin * MINUTO;
        const intervalo = { inicio, fin: inicio + dto.duracionMin * MINUTO };
        const terminoAntes = (id: number) => {
          const fin = finDe.get(id);
          return fin !== null && fin !== undefined && fin <= inicio;
        };

        for (const canchaId of dto.canchaIds) {
          if (!libre(agendaDeCancha, canchaId, intervalo)) continue;
          const indice = pendientes.findIndex(
            (p) =>
              p.partidosAnteriores.every((anterior) => terminoAntes(anterior.id)) &&
              (p.instancia === 'ZONA' || deZona.every(terminoAntes)) &&
              jugadoresDe(p).every((jugador) => libre(agendaDeJugador, jugador, intervalo)),
          );
          if (indice === -1) continue;

          const [partido] = pendientes.splice(indice, 1);
          ocupar(agendaDeCancha, canchaId, intervalo);
          for (const jugador of jugadoresDe(partido)) ocupar(agendaDeJugador, jugador, intervalo);
          finDe.set(partido.id, intervalo.fin);
          asignados.push({ id: partido.id, canchaId, inicio: new Date(intervalo.inicio), fin: new Date(intervalo.fin) });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const { id, ...horario } of asignados) await tx.partido.update({ where: { id }, data: horario });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'PROGRAMAR_AUTOMATICO', 'torneo', torneoId, {
        programados: asignados.length,
        sinProgramar: pendientes.length,
      });
    });
    return { programados: asignados.length, sinProgramar: pendientes.length };
  }

  async cambiarEstado(id: number, estado: 'PROGRAMADO' | 'EN_JUEGO' | 'SUSPENDIDO', sesion: Sesion) {
    const partido = await this.prisma.partido.findUnique({ where: { id } });
    if (!partido) throw new NotFoundException('No encontramos ese partido.');
    if (partido.ganadorId) throw new ConflictException('El partido ya tiene resultado.');
    if (estado === 'EN_JUEGO' && (!partido.pareja1Id || !partido.pareja2Id)) {
      throw new ConflictException('Todavía no se conocen las dos parejas de este partido.');
    }
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.partido.update({ where: { id }, data: { estado }, include: partidoCompleto });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'CAMBIAR_ESTADO', 'partido', id, { de: partido.estado, a: estado });
      return aplanarPartido(actualizado);
    });
  }

  // ─── Resultados ────────────────────────────────────────────────────────────

  /** Carga o corrige el resultado. El ganador pasa solo al partido siguiente de la llave. */
  async cargarResultado(id: number, dto: ResultadoDto, sesion: Sesion) {
    const partido = await this.prisma.partido.findUnique({
      where: { id },
      include: {
        torneo: { select: { id: true, estado: true, formato: true } },
        siguientePartido: { select: { id: true, ganadorId: true, estado: true } },
      },
    });
    if (!partido) throw new NotFoundException('No encontramos ese partido.');
    if (partido.torneo.estado !== 'EN_CURSO') throw new ConflictException('Solo se cargan resultados de torneos en curso.');
    if (!partido.pareja1Id || !partido.pareja2Id) {
      throw new ConflictException('Todavía no se conocen las dos parejas de este partido.');
    }
    if ((dto.wo === undefined) === (dto.sets === undefined)) {
      throw new BadRequestException('Cargá los sets o marcá el partido como W.O.');
    }

    const lado = dto.wo ?? ganadorPorSets(dto.sets!);
    const ganadorId = lado === 1 ? partido.pareja1Id : partido.pareja2Id;
    const esCorreccion = partido.ganadorId !== null;
    const siguiente = partido.siguientePartido;
    if (esCorreccion && partido.ganadorId !== ganadorId && siguiente && (siguiente.ganadorId || siguiente.estado === 'EN_JUEGO')) {
      throw new ConflictException('El ganador anterior ya jugó el partido siguiente: corregí primero ese resultado.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.setPartido.deleteMany({ where: { partidoId: id } });
      if (dto.sets) {
        await tx.setPartido.createMany({
          data: dto.sets.map((set, i) => ({
            partidoId: id,
            numero: i + 1,
            gamesP1: set.gamesP1,
            gamesP2: set.gamesP2,
            superTiebreak: set.superTiebreak ?? false,
          })),
        });
      }
      const actualizado = await tx.partido.update({
        where: { id },
        data: { estado: dto.wo ? 'WO' : 'FINALIZADO', ganadorId, cargadoPorId: sesion.usuarioId },
        include: partidoCompleto,
      });

      if (partido.siguientePartidoId) {
        await tx.partido.update({
          where: { id: partido.siguientePartidoId },
          data: partido.siguienteSlot === 1 ? { pareja1Id: ganadorId } : { pareja2Id: ganadorId },
        });
      }

      await this.auditoria.registrar(tx, sesion.usuarioId, esCorreccion ? 'CORREGIR_RESULTADO' : 'CARGAR_RESULTADO', 'partido', id, {
        resultado: dto.wo ? 'W.O.' : dto.sets!.map((s) => `${s.gamesP1}-${s.gamesP2}`).join(' '),
        ganadorId,
        ganadorAnterior: esCorreccion ? partido.ganadorId : undefined,
      });

      await this.finalizarTorneoSiCorresponde(tx, partido.torneo, actualizado.instancia);
      return aplanarPartido(actualizado);
    });
  }

  /** El torneo termina con la final; en round robin, con el último partido. */
  private async finalizarTorneoSiCorresponde(
    tx: Prisma.TransactionClient,
    torneo: { id: number; formato: string },
    instancia: string,
  ) {
    const termino =
      instancia === 'FINAL' ||
      (torneo.formato === 'ROUND_ROBIN' && (await tx.partido.count({ where: { torneoId: torneo.id, ganadorId: null } })) === 0);
    if (termino) await tx.torneo.update({ where: { id: torneo.id }, data: { estado: 'FINALIZADO' } });
  }

  private async exigirJugadoresLibres(partidoId: number, jugadores: number[], inicio: Date, fin: Date) {
    if (jugadores.length === 0) return;
    const conAlguno = { pareja: { OR: [{ jugador1Id: { in: jugadores } }, { jugador2Id: { in: jugadores } }] } };
    const choque = await this.prisma.partido.findFirst({
      where: {
        id: { not: partidoId },
        estado: { in: ['PROGRAMADO', 'EN_JUEGO'] },
        inicio: { lt: fin },
        fin: { gt: inicio },
        OR: [{ pareja1: conAlguno }, { pareja2: conAlguno }],
      },
      select: { numero: true, torneo: { select: { nombre: true } } },
    });
    if (choque) {
      throw new ConflictException(
        `Un jugador de este partido ya juega en ese horario (partido ${choque.numero} de "${choque.torneo.nombre}").`,
      );
    }
  }
}
