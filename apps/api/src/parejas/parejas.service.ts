import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { paginar, rango } from '../comun/paginacion.ts';
import { jugadorBasico } from '../comun/selecciones.ts';
import { esAdmin, type Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import type { EstadoPareja } from '../generated/prisma/enums.ts';
import { JugadoresService } from '../jugadores/jugadores.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const parejaDetalle = {
  id: true,
  estado: true,
  creadaPorId: true,
  creadaEn: true,
  confirmadaEn: true,
  resueltaEn: true,
  motivoRechazo: true,
  jugador1: { select: { ...jugadorBasico, club: { select: { nombre: true } } } },
  jugador2: { select: { ...jugadorBasico, club: { select: { nombre: true } } } },
} satisfies Prisma.ParejaSelect;

@Injectable()
export class ParejasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly jugadores: JugadoresService,
  ) {}

  /** El jugador escaneó el QR de otro: nace una pareja pendiente. */
  async crearPorQr(token: string, sesion: Sesion) {
    const yo = sesion.jugadorId!;
    const otro = await this.jugadores.porQr(token);
    if (otro.id === yo) throw new BadRequestException('Ese es tu propio QR. Escaneá el de tu compañero.');

    const [jugador1Id, jugador2Id] = yo < otro.id ? [yo, otro.id] : [otro.id, yo];
    return this.prisma.$transaction(async (tx) => {
      const pareja = await tx.pareja.create({
        data: { jugador1Id, jugador2Id, creadaPorId: yo },
        select: parejaDetalle,
      });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'CREAR', 'pareja', pareja.id);
      return pareja;
    });
  }

  mias(jugadorId: number) {
    return this.prisma.pareja.findMany({
      where: { OR: [{ jugador1Id: jugadorId }, { jugador2Id: jugadorId }] },
      select: parejaDetalle,
      orderBy: { creadaEn: 'desc' },
    });
  }

  async listar(filtro: { estado?: EstadoPareja; pagina?: number }) {
    const where: Prisma.ParejaWhereInput = { estado: filtro.estado };
    const [items, total] = await Promise.all([
      // Las más antiguas primero: es el orden de atención de la bandeja.
      this.prisma.pareja.findMany({ where, select: parejaDetalle, orderBy: { creadaEn: 'asc' }, ...rango(filtro.pagina) }),
      this.prisma.pareja.count({ where }),
    ]);
    return paginar(items, total, filtro.pagina);
  }

  /** Confirma el integrante que NO creó la pareja. */
  async confirmar(id: number, sesion: Sesion) {
    const pareja = await this.buscar(id);
    this.exigirIntegrante(pareja, sesion);
    if (pareja.creadaPorId === sesion.jugadorId) {
      throw new ForbiddenException('La pareja la tiene que confirmar tu compañero.');
    }
    if (pareja.estado !== 'PENDIENTE') throw new ConflictException('Esta pareja ya no está pendiente de confirmación.');
    return this.cambiar(id, sesion, 'CONFIRMAR', { estado: 'CONFIRMADA', confirmadaEn: new Date() });
  }

  /** Antes de la aprobación, cualquiera de los dos puede bajarse. */
  async declinar(id: number, sesion: Sesion) {
    const pareja = await this.buscar(id);
    this.exigirIntegrante(pareja, sesion);
    if (pareja.estado !== 'PENDIENTE' && pareja.estado !== 'CONFIRMADA') {
      throw new ConflictException('Esta pareja ya fue resuelta.');
    }
    const motivo = pareja.creadaPorId === sesion.jugadorId ? 'Cancelada por quien la propuso.' : 'No aceptada por el compañero.';
    return this.cambiar(id, sesion, 'DECLINAR', { estado: 'RECHAZADA', motivoRechazo: motivo });
  }

  async aprobar(id: number, sesion: Sesion) {
    const pareja = await this.buscar(id);
    if (pareja.estado !== 'CONFIRMADA') {
      throw new ConflictException(
        pareja.estado === 'PENDIENTE'
          ? 'Falta que el compañero confirme la pareja.'
          : 'Esta pareja ya fue resuelta.',
      );
    }
    return this.cambiar(id, sesion, 'APROBAR', {
      estado: 'ACTIVA',
      resueltaPorId: sesion.usuarioId,
      resueltaEn: new Date(),
    });
  }

  async rechazar(id: number, motivo: string, sesion: Sesion) {
    const pareja = await this.buscar(id);
    if (pareja.estado !== 'PENDIENTE' && pareja.estado !== 'CONFIRMADA') {
      throw new ConflictException('Esta pareja ya fue resuelta.');
    }
    return this.cambiar(
      id,
      sesion,
      'RECHAZAR',
      { estado: 'RECHAZADA', motivoRechazo: motivo, resueltaPorId: sesion.usuarioId, resueltaEn: new Date() },
      { motivo },
    );
  }

  async disolver(id: number, sesion: Sesion) {
    const pareja = await this.buscar(id);
    if (!esAdmin(sesion)) this.exigirIntegrante(pareja, sesion);
    if (pareja.estado !== 'ACTIVA') throw new ConflictException('Solo se puede disolver una pareja activa.');

    const enCompetencia = await this.prisma.inscripcion.findFirst({
      where: {
        parejaId: id,
        estado: { in: ['PENDIENTE', 'APROBADA', 'EN_ESPERA'] },
        torneo: { estado: { in: ['INSCRIPCION_ABIERTA', 'EN_CURSO'] } },
      },
      select: { torneo: { select: { nombre: true } } },
    });
    if (enCompetencia) {
      throw new ConflictException(
        `La pareja está inscripta en "${enCompetencia.torneo.nombre}". Dala de baja del torneo antes de disolverla.`,
      );
    }
    return this.cambiar(id, sesion, 'DISOLVER', { estado: 'DISUELTA', disueltaEn: new Date() });
  }

  private async buscar(id: number) {
    const pareja = await this.prisma.pareja.findUnique({ where: { id } });
    if (!pareja) throw new NotFoundException('No encontramos esa pareja.');
    return pareja;
  }

  private exigirIntegrante(pareja: { jugador1Id: number; jugador2Id: number }, sesion: Sesion) {
    if (sesion.jugadorId !== pareja.jugador1Id && sesion.jugadorId !== pareja.jugador2Id) {
      throw new ForbiddenException('No sos parte de esta pareja.');
    }
  }

  private cambiar(
    id: number,
    sesion: Sesion,
    accion: string,
    data: Prisma.ParejaUncheckedUpdateInput,
    detalle?: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pareja = await tx.pareja.update({ where: { id }, data, select: parejaDetalle });
      await this.auditoria.registrar(tx, sesion.usuarioId, accion, 'pareja', id, detalle);
      return pareja;
    });
  }
}
