import {
  BadRequestException,
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { generarToken, hashearPassword } from '../comun/password.ts';
import { Publico } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { EstadoUsuario, RolUsuario } from '../generated/prisma/enums.ts';
import { AltaJugadorDto, DatosJugadorDto, normalizarEmail } from '../jugadores/jugador.dto.ts';
import { datosDeJugador, VERSION_CONSENTIMIENTO } from '../jugadores/jugadores.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CodigosService, provisoria } from '../usuarios/codigos.service.ts';

// Conexión con el sistema de licencias (licenses.onlineturnos.ar/admin): desde
// ahí el administrador general ve los usuarios de Emparejados y, para cualquiera
// (también la organización), genera códigos para cambiar la contraseña o se la
// blanquea con una provisoria. También da de alta cuentas de la organización,
// les cambia el email, el rol y el estado, y las elimina; y da de alta y edita
// jugadores con la misma ficha que el formulario de la app.
//
// No usa la sesión de la app: el panel de licencias manda
// "Authorization: Bearer <CLAVE_INTEGRACION>" (la misma clave en el .env de los
// dos sistemas). Sin esa variable, todo esto responde 503.

const digest = (texto: string) => createHash('sha256').update(texto).digest();

@Injectable()
class ClaveDeIntegracion implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const clave = process.env.CLAVE_INTEGRACION;
    if (!clave || clave.length < 32) throw new ServiceUnavailableException('La conexión con el sistema de licencias no está configurada.');
    const recibida = /^Bearer (.+)$/.exec(ctx.switchToHttp().getRequest<Request>().headers.authorization ?? '')?.[1] ?? '';
    // Se comparan los hashes: mismo largo siempre y sin cortar antes en el primer carácter distinto.
    if (!timingSafeEqual(digest(recibida), digest(clave))) throw new UnauthorizedException('Clave de integración incorrecta.');
    return true;
  }
}

class FiltroDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

class CodigoDto {
  /** Email de quien lo genera en el panel de licencias (lo verifica Cloudflare Access allá). */
  @IsEmail()
  @MaxLength(200)
  generadoPor!: string;
}

class AltaDto extends CodigoDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  @MaxLength(200)
  email!: string;
}

class CambiosDto extends CodigoDto {
  @IsOptional()
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;
}

/** Los mismos datos que carga la organización en el formulario de alta de la app. */
class AltaJugadorDeLicenciasDto extends AltaJugadorDto {
  @IsEmail()
  @MaxLength(200)
  generadoPor!: string;
}

class FichaDto extends DatosJugadorDto {
  @IsEmail()
  @MaxLength(200)
  generadoPor!: string;
}

const MAXIMO_EN_LISTA = 200;

// Es una función porque el filtro del código vigente depende de la hora del pedido.
const seleccionDeUsuario = () =>
  ({
    id: true,
    email: true,
    rol: true,
    estado: true,
    ultimoLoginEn: true,
    debeCambiarPassword: true,
    jugador: { select: { nombre: true, apellido: true } },
    codigosPassword: { where: { usadoEn: null, venceEn: { gt: new Date() } }, select: { venceEn: true } },
  }) satisfies Prisma.UsuarioSelect;

type UsuarioDeIntegracion = Prisma.UsuarioGetPayload<{ select: ReturnType<typeof seleccionDeUsuario> }>;

const aFila = <T extends UsuarioDeIntegracion>({ codigosPassword, ...usuario }: T) => ({
  ...usuario,
  codigoVigenteHasta: codigosPassword[0]?.venceEn ?? null,
});

// La ficha completa, con los ids de categoría, club y ciudad: lo que precarga el formulario del panel.
const fichaParaEditar = {
  id: true,
  nombre: true,
  apellido: true,
  dni: true,
  fechaNacimiento: true,
  genero: true,
  telefono: true,
  manoHabil: true,
  posicion: true,
  categoriaId: true,
  clubId: true,
  localidadId: true,
} satisfies Prisma.JugadorSelect;

type Tx = Prisma.TransactionClient;

/** La base no dejó borrar la fila porque otras la referencian (FK con RESTRICT). */
function esPorHistorial(error: unknown) {
  const e = error as { code?: string; meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } };
  const codigos = [e?.code, e?.meta?.driverAdapterError?.cause?.originalCode];
  return codigos.some((codigo) => codigo === 'P2003' || codigo === '23503' || codigo === '23001');
}

@Publico()
@UseGuards(ClaveDeIntegracion)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('integracion')
export class IntegracionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codigos: CodigosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** La organización primero; dentro de cada grupo, por email. */
  @Get('usuarios')
  async usuarios(@Query() filtro: FiltroDto) {
    const q = filtro.q?.trim().toLowerCase();
    const where: Prisma.UsuarioWhereInput = q
      ? {
          OR: [
            { email: { contains: q } },
            { jugador: { busqueda: { contains: q.normalize('NFD').replace(/[̀-ͯ]/g, '') } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        orderBy: [{ rol: 'asc' }, { email: 'asc' }],
        take: MAXIMO_EN_LISTA,
        select: seleccionDeUsuario(),
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return { total, items: items.map(aFila) };
  }

  /** Lo que necesitan los formularios del panel: categorías, ciudades y clubes. */
  @Get('catalogos')
  async catalogos() {
    const [categorias, localidades, clubes] = await Promise.all([
      this.prisma.categoria.findMany({ select: { id: true, nombre: true }, orderBy: { orden: 'asc' } }),
      this.prisma.localidad.findMany({ select: { id: true, nombre: true, provincia: true }, orderBy: [{ provincia: 'asc' }, { nombre: 'asc' }] }),
      this.prisma.club.findMany({ select: { id: true, nombre: true, localidad: { select: { nombre: true } } }, orderBy: { nombre: 'asc' } }),
    ]);
    return { categorias, localidades, clubes };
  }

  /** Una cuenta con su ficha de jugador completa (si la tiene), para editarla. */
  @Get('usuarios/:id')
  usuario(@Param('id', ParseIntPipe) id: number) {
    return this.conFicha(this.prisma, id);
  }

  /**
   * Alta de un jugador con su ficha, igual que cuando lo carga la organización
   * desde la app. Devuelve una contraseña provisoria que se muestra una sola vez.
   */
  @Post('jugadores')
  async crearJugador(@Body() dto: AltaJugadorDeLicenciasDto) {
    const password = provisoria();
    const passwordHash = await hashearPassword(password);
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email: dto.email,
          passwordHash,
          debeCambiarPassword: true,
          jugador: {
            create: {
              ...datosDeJugador(dto),
              consentimientoVersion: VERSION_CONSENTIMIENTO,
              consentimientoAceptadoEn: new Date(),
              qrTokens: { create: { token: generarToken() } },
            },
          },
        },
        select: { ...seleccionDeUsuario(), jugador: { select: fichaParaEditar } },
      });
      await this.auditoria.registrar(tx, usuario.id, 'ALTA', 'jugador', usuario.jugador!.id, { por: dto.generadoPor.toLowerCase(), email: dto.email });
      return { usuario: aFila(usuario), password };
    });
  }

  /** Cambia la ficha del jugador de esa cuenta. Como la organización, puede cambiar también el DNI y la categoría. */
  @Put('usuarios/:id/jugador')
  async actualizarJugador(@Param('id', ParseIntPipe) id: number, @Body() dto: FichaDto) {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id }, select: { jugador: { select: { id: true } } } });
      if (!usuario) throw new NotFoundException('No encontramos ese usuario.');
      if (!usuario.jugador) throw new ConflictException('Esta cuenta no tiene ficha de jugador.');
      await tx.jugador.update({ where: { id: usuario.jugador.id }, data: datosDeJugador(dto) });
      await this.auditoria.registrar(tx, id, 'EDICION', 'jugador', usuario.jugador.id, { por: dto.generadoPor.toLowerCase() });
      return this.conFicha(tx, id);
    });
  }

  /**
   * Alta de una cuenta de la organización. Devuelve una contraseña provisoria
   * que se muestra una sola vez: al entrar con ella, la app le hace elegir la suya.
   */
  @Post('usuarios')
  async crear(@Body() dto: AltaDto) {
    const password = provisoria();
    const passwordHash = await hashearPassword(password);
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { email: dto.email, passwordHash, rol: 'ADMIN', debeCambiarPassword: true },
        select: seleccionDeUsuario(),
      });
      // La auditoría exige un usuario de la app: va la cuenta afectada, y en el detalle quién lo pidió.
      await this.auditoria.registrar(tx, usuario.id, 'ALTA', 'usuario', usuario.id, { por: dto.generadoPor.toLowerCase(), email: dto.email, rol: 'ADMIN' });
      return { usuario: aFila(usuario), password };
    });
  }

  /** Cambia el email, el rol o el estado. Lo que no viene, queda como está. */
  @Patch('usuarios/:id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiosDto) {
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.usuario.findUnique({
        where: { id },
        select: { email: true, rol: true, estado: true, jugador: { select: { id: true, eliminadoEn: true } } },
      });
      if (!actual) throw new NotFoundException('No encontramos ese usuario.');

      const cambios: { email?: string; rol?: RolUsuario; estado?: EstadoUsuario } = {};
      if (dto.email !== undefined && dto.email !== actual.email.toLowerCase()) cambios.email = dto.email;
      if (dto.rol !== undefined && dto.rol !== actual.rol) cambios.rol = dto.rol;
      if (dto.estado !== undefined && dto.estado !== actual.estado) cambios.estado = dto.estado;
      if (Object.keys(cambios).length === 0) throw new BadRequestException('No hay nada para cambiar.');

      if (cambios.rol === 'JUGADOR' && !actual.jugador) {
        throw new ConflictException('Esta cuenta no tiene ficha de jugador: no puede quedar con rol de jugador.');
      }
      const eraDeLaOrganizacion = actual.rol === 'ADMIN' && actual.estado === 'ACTIVO';
      const sigueSiendolo = (cambios.rol ?? actual.rol) === 'ADMIN' && (cambios.estado ?? actual.estado) === 'ACTIVO';
      if (eraDeLaOrganizacion && !sigueSiendolo) await this.exigirOtroAdministrador(tx, id);

      const ahora = new Date();
      const usuario = await tx.usuario.update({ where: { id }, data: cambios, select: seleccionDeUsuario() });
      if (cambios.estado && cambios.estado !== 'ACTIVO') {
        // Una cuenta bloqueada o inactiva pierde sus sesiones abiertas.
        await tx.sesion.updateMany({ where: { usuarioId: id, revocadaEn: null }, data: { revocadaEn: ahora } });
      }
      if (cambios.estado === 'ACTIVO' && actual.jugador?.eliminadoEn) {
        // Reactivar a un jugador dado de baja le devuelve la ficha.
        await tx.jugador.update({ where: { id: actual.jugador.id }, data: { eliminadoEn: null } });
      }
      await this.auditoria.registrar(tx, id, 'EDITAR', 'usuario', id, { por: dto.generadoPor.toLowerCase(), ...cambios });
      return aFila(usuario);
    });
  }

  /**
   * Elimina la cuenta. Si nunca hizo nada, se borra de la base. Si ya dejó
   * historial (ficha de jugador, torneos, auditoría…) la base no deja borrarla:
   * queda dada de baja, sin poder entrar, y se puede reactivar editándola.
   */
  @HttpCode(200)
  @Post('usuarios/:id/eliminar')
  async eliminar(@Param('id', ParseIntPipe) id: number, @Body() dto: CodigoDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: { email: true, rol: true, estado: true } });
    if (!usuario) throw new NotFoundException('No encontramos ese usuario.');
    const esDeLaOrganizacion = usuario.rol === 'ADMIN' && usuario.estado === 'ACTIVO';

    try {
      await this.prisma.$transaction(async (tx) => {
        if (esDeLaOrganizacion) await this.exigirOtroAdministrador(tx, id);
        // Sesiones, códigos y avisos se van con la cuenta (ON DELETE CASCADE).
        await tx.usuario.delete({ where: { id } });
      });
      return { email: usuario.email, borrado: true };
    } catch (error) {
      if (!esPorHistorial(error)) throw error;
    }

    if (usuario.estado === 'INACTIVO') {
      throw new ConflictException('La cuenta ya está dada de baja. Tiene historial en Emparejados, así que no se puede borrar del todo.');
    }
    return this.prisma.$transaction(async (tx) => {
      if (esDeLaOrganizacion) await this.exigirOtroAdministrador(tx, id);
      const ahora = new Date();
      await tx.usuario.update({ where: { id }, data: { estado: 'INACTIVO' } });
      await tx.sesion.updateMany({ where: { usuarioId: id, revocadaEn: null }, data: { revocadaEn: ahora } });
      await tx.codigoPassword.deleteMany({ where: { usuarioId: id, usadoEn: null } });
      // Igual que la baja de un jugador desde la app: la ficha deja de aparecer y su QR deja de servir.
      const jugador = await tx.jugador.findUnique({ where: { usuarioId: id }, select: { id: true, eliminadoEn: true } });
      if (jugador && !jugador.eliminadoEn) {
        await tx.jugador.update({ where: { id: jugador.id }, data: { eliminadoEn: ahora } });
        await tx.qrToken.updateMany({ where: { jugadorId: jugador.id, revocadoEn: null }, data: { revocadoEn: ahora } });
      }
      await this.auditoria.registrar(tx, id, 'BAJA', 'usuario', id, { por: dto.generadoPor.toLowerCase() });
      return { email: usuario.email, borrado: false };
    });
  }

  @HttpCode(200)
  @Post('usuarios/:id/codigo-password')
  codigo(@Param('id', ParseIntPipe) id: number, @Body() dto: CodigoDto) {
    return this.codigos.generar(id, { externo: dto.generadoPor.toLowerCase() });
  }

  @HttpCode(200)
  @Post('usuarios/:id/blanquear-password')
  blanquear(@Param('id', ParseIntPipe) id: number, @Body() dto: CodigoDto) {
    return this.codigos.blanquear(id, dto.generadoPor.toLowerCase());
  }

  private async conFicha(db: Tx | PrismaService, id: number) {
    const usuario = await db.usuario.findUnique({
      where: { id },
      select: { ...seleccionDeUsuario(), jugador: { select: fichaParaEditar } },
    });
    if (!usuario) throw new NotFoundException('No encontramos ese usuario.');
    return aFila(usuario);
  }

  /**
   * La app no puede quedar sin nadie de la organización que pueda entrar. El
   * candado pone en fila estos cambios: dos pedidos a la vez no pueden sacar a
   * los dos últimos administradores.
   */
  private async exigirOtroAdministrador(tx: Tx, id: number) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('administradores'))`;
    const otros = await tx.usuario.count({ where: { rol: 'ADMIN', estado: 'ACTIVO', id: { not: id } } });
    if (otros === 0) {
      throw new ConflictException('Es la única cuenta activa de la organización: antes dale acceso a otra persona.');
    }
  }
}
