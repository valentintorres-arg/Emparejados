import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { normalizarBusqueda, paginar, rango } from '../comun/paginacion.ts';
import { generarPasswordTemporal, generarToken, hashearPassword } from '../comun/password.ts';
import { jugadorBasico, parejaConJugadores, partidoCompleto, aplanarPartido } from '../comun/selecciones.ts';
import { esAdmin, type Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import type { AltaJugadorDto, DatosJugadorDto, FiltroJugadoresDto } from './jugador.dto.ts';

/** Versión del texto de consentimiento (Ley 25.326) que acepta el jugador. */
export const VERSION_CONSENTIMIENTO = '2026-10';

const fichaJugador = {
  id: true,
  usuarioId: true,
  nombre: true,
  apellido: true,
  dni: true,
  fechaNacimiento: true,
  genero: true,
  telefono: true,
  manoHabil: true,
  posicion: true,
  fotoUrl: true,
  creadoEn: true,
  eliminadoEn: true,
  consentimientoAceptadoEn: true,
  categoria: { select: { id: true, nombre: true, orden: true } },
  club: { select: { id: true, nombre: true } },
  localidad: { select: { id: true, nombre: true, provincia: true } },
  usuario: { select: { email: true, estado: true, rol: true } },
} satisfies Prisma.JugadorSelect;

export function datosDeJugador(dto: DatosJugadorDto) {
  return {
    nombre: dto.nombre,
    apellido: dto.apellido,
    dni: dto.dni,
    fechaNacimiento: new Date(dto.fechaNacimiento),
    genero: dto.genero,
    telefono: dto.telefono,
    localidadId: dto.localidadId ?? null,
    clubId: dto.clubId ?? null,
    categoriaId: dto.categoriaId,
    manoHabil: dto.manoHabil,
    posicion: dto.posicion,
    fotoUrl: dto.fotoUrl ?? null,
  };
}

@Injectable()
export class JugadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroJugadoresDto) {
    const where: Prisma.JugadorWhereInput = {
      eliminadoEn: null,
      categoriaId: filtro.categoriaId,
      clubId: filtro.clubId,
      // Cada palabra debe aparecer en "apellido nombre dni"; usa el índice de trigramas.
      AND: normalizarBusqueda(filtro.q ?? '').map((palabra) => ({ busqueda: { contains: palabra } })),
    };
    const [items, total] = await Promise.all([
      this.prisma.jugador.findMany({
        where,
        select: fichaJugador,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        ...rango(filtro.pagina),
      }),
      this.prisma.jugador.count({ where }),
    ]);
    return paginar(items, total, filtro.pagina);
  }

  async crear(dto: AltaJugadorDto, sesion: Sesion) {
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await hashearPassword(passwordTemporal);
    const jugador = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email: dto.email,
          passwordHash,
          jugador: {
            create: {
              ...datosDeJugador(dto),
              consentimientoVersion: VERSION_CONSENTIMIENTO,
              consentimientoAceptadoEn: new Date(),
              qrTokens: { create: { token: generarToken() } },
            },
          },
        },
        select: { jugador: { select: fichaJugador } },
      });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'ALTA', 'jugador', usuario.jugador!.id, {
        email: dto.email,
      });
      return usuario.jugador!;
    });
    return { jugador, passwordTemporal };
  }

  /** Ficha con historial de parejas, torneos y partidos. */
  async obtener(id: number, sesion: Sesion) {
    this.exigirAccesoAFicha(id, sesion);
    const jugador = await this.prisma.jugador.findUnique({ where: { id }, select: fichaJugador });
    if (!jugador) throw new NotFoundException('No encontramos a ese jugador.');

    const deEsteJugador: Prisma.ParejaWhereInput = { OR: [{ jugador1Id: id }, { jugador2Id: id }] };
    const [parejas, inscripciones, partidos] = await Promise.all([
      this.prisma.pareja.findMany({
        where: deEsteJugador,
        select: { ...parejaConJugadores, creadaEn: true, motivoRechazo: true },
        orderBy: { creadaEn: 'desc' },
      }),
      this.prisma.inscripcion.findMany({
        where: { pareja: deEsteJugador },
        select: {
          id: true,
          estado: true,
          pareja: { select: parejaConJugadores },
          torneo: { select: { id: true, nombre: true, estado: true, fechaInicio: true, fechaFin: true } },
        },
        orderBy: { creadaEn: 'desc' },
      }),
      this.prisma.partido.findMany({
        where: {
          estado: { in: ['FINALIZADO', 'WO'] },
          OR: [{ pareja1: { pareja: deEsteJugador } }, { pareja2: { pareja: deEsteJugador } }],
        },
        include: { ...partidoCompleto, torneo: { select: { id: true, nombre: true } } },
        orderBy: { inicio: 'desc' },
        take: 50,
      }),
    ]);
    return { ...jugador, parejas, inscripciones, partidos: partidos.map(aplanarPartido) };
  }

  async actualizar(id: number, dto: DatosJugadorDto, sesion: Sesion) {
    this.exigirAccesoAFicha(id, sesion);
    const datos: Partial<ReturnType<typeof datosDeJugador>> = datosDeJugador(dto);
    if (!esAdmin(sesion)) {
      // El DNI identifica al jugador y la categoría define en qué torneos entra:
      // solo los cambia la organización.
      delete datos.dni;
      delete datos.categoriaId;
    }
    return this.prisma.$transaction(async (tx) => {
      const jugador = await tx.jugador.update({ where: { id }, data: datos, select: fichaJugador });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'EDICION', 'jugador', id);
      return jugador;
    });
  }

  /** Baja lógica: el jugador conserva su historial pero ya no puede entrar ni usar su QR. */
  async darDeBaja(id: number, sesion: Sesion) {
    return this.prisma.$transaction(async (tx) => {
      const ahora = new Date();
      const jugador = await tx.jugador.update({
        where: { id },
        data: { eliminadoEn: ahora, usuario: { update: { estado: 'INACTIVO' } } },
        select: { id: true, usuarioId: true },
      });
      await tx.qrToken.updateMany({ where: { jugadorId: id, revocadoEn: null }, data: { revocadoEn: ahora } });
      await tx.sesion.updateMany({ where: { usuarioId: jugador.usuarioId, revocadaEn: null }, data: { revocadaEn: ahora } });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'BAJA', 'jugador', id);
      return { id };
    });
  }

  async miQr(jugadorId: number) {
    const vigente = await this.prisma.qrToken.findFirst({ where: { jugadorId, revocadoEn: null } });
    const qr = vigente ?? (await this.prisma.qrToken.create({ data: { jugadorId, token: generarToken() } }));
    return { token: qr.token, creadoEn: qr.creadoEn };
  }

  /** Revoca el QR actual y emite uno nuevo (por ejemplo, si se compartió de más). */
  async regenerarQr(jugadorId: number) {
    const qr = await this.prisma.$transaction(async (tx) => {
      await tx.qrToken.updateMany({ where: { jugadorId, revocadoEn: null }, data: { revocadoEn: new Date() } });
      return tx.qrToken.create({ data: { jugadorId, token: generarToken() } });
    });
    return { token: qr.token, creadoEn: qr.creadoEn };
  }

  /** Lo que ve quien escanea un QR: solo datos deportivos, nunca DNI ni contacto. */
  async porQr(token: string) {
    const qr = await this.prisma.qrToken.findFirst({
      where: { token, revocadoEn: null, jugador: { eliminadoEn: null } },
      select: { jugador: { select: { ...jugadorBasico, club: { select: { nombre: true } } } } },
    });
    if (!qr) throw new NotFoundException('Ese código QR no es válido o fue reemplazado por uno nuevo.');
    return qr.jugador;
  }

  private exigirAccesoAFicha(jugadorId: number, sesion: Sesion) {
    if (!esAdmin(sesion) && sesion.jugadorId !== jugadorId) {
      throw new ForbiddenException('Solo podés ver tu propia ficha.');
    }
  }
}
