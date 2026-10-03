import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { normalizarBusqueda, paginar, rango } from '../comun/paginacion.ts';
import { generarToken, hashearPassword } from '../comun/password.ts';
import { jugadorBasico, parejaConJugadores, partidoCompleto, aplanarPartido } from '../comun/selecciones.ts';
import { esAdmin, type Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CodigosService } from '../usuarios/codigos.service.ts';
import type { AltaJugadorDto, DatosJugadorDto, FiltroJugadoresDto } from './jugador.dto.ts';

/** Techo de la foto de perfil (igual que el CHECK fotos_jugadores_tamano). El navegador la manda de unos 20 KB. */
const TAMANO_MAXIMO_FOTO = 200 * 1024;

/** Se mira el contenido, no lo que dice el navegador: solo JPG y WebP. */
function tipoDeImagen(datos: Buffer): 'image/jpeg' | 'image/webp' | null {
  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'image/jpeg';
  if (datos.length >= 12 && datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

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
  };
}

@Injectable()
export class JugadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly codigos: CodigosService,
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

  /** Alta por la organización. El jugador entra por primera vez con un código de un solo uso y elige su contraseña. */
  async crear(dto: AltaJugadorDto, sesion: Sesion) {
    // Contraseña al azar que nadie conoce: la cuenta queda usable solo con el código.
    const passwordHash = await hashearPassword(generarToken());
    return this.prisma.$transaction(async (tx) => {
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
      const { codigo, venceEn } = await this.codigos.generarEn(tx, usuario.jugador!.usuarioId, { usuarioId: sesion.usuarioId });
      return { jugador: usuario.jugador!, codigo, venceEn };
    });
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

  // ─── Foto de perfil ────────────────────────────────────────────────────────

  async foto(id: number) {
    const foto = await this.prisma.fotoJugador.findUnique({ where: { jugadorId: id }, select: { contenido: true, tipo: true } });
    if (!foto) throw new NotFoundException('Ese jugador no tiene foto.');
    return foto;
  }

  /** La sube el propio jugador o la organización. Cada versión tiene su propia dirección, así el navegador la guarda sin preguntar. */
  async guardarFoto(id: number, base64: string, sesion: Sesion) {
    this.exigirAccesoAFicha(id, sesion, 'Solo podés cambiar tu propia foto.');
    const contenido = Buffer.from(base64, 'base64');
    const tipo = tipoDeImagen(contenido);
    if (!tipo) throw new BadRequestException('La foto tiene que ser una imagen JPG o WebP.');
    if (contenido.length > TAMANO_MAXIMO_FOTO) throw new BadRequestException('La foto es demasiado grande.');
    const fotoUrl = `/api/jugadores/${id}/foto?v=${Date.now()}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.fotoJugador.upsert({
        where: { jugadorId: id },
        create: { jugadorId: id, contenido, tipo },
        update: { contenido, tipo, actualizadaEn: new Date() },
      });
      await tx.jugador.update({ where: { id }, data: { fotoUrl } });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'CAMBIAR_FOTO', 'jugador', id, { bytes: contenido.length });
      return { fotoUrl };
    });
  }

  async quitarFoto(id: number, sesion: Sesion) {
    this.exigirAccesoAFicha(id, sesion, 'Solo podés cambiar tu propia foto.');
    await this.prisma.$transaction(async (tx) => {
      await tx.fotoJugador.deleteMany({ where: { jugadorId: id } });
      await tx.jugador.update({ where: { id }, data: { fotoUrl: null } });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'QUITAR_FOTO', 'jugador', id);
    });
    return { fotoUrl: null };
  }

  private exigirAccesoAFicha(jugadorId: number, sesion: Sesion, mensaje = 'Solo podés ver tu propia ficha.') {
    if (!esAdmin(sesion) && sesion.jugadorId !== jugadorId) throw new ForbiddenException(mensaje);
  }
}
