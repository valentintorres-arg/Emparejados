import {
  Body,
  ConflictException,
  ForbiddenException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { PaginaDto, paginar, rango } from '../comun/paginacion.ts';
import { generarToken, hashearPassword } from '../comun/password.ts';
import { SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { EstadoUsuario, RolUsuario } from '../generated/prisma/enums.ts';
import { normalizarEmail } from '../jugadores/jugador.dto.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CodigosService } from './codigos.service.ts';

class FiltroUsuariosDto extends PaginaDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;
}

class CambiosUsuarioDto {
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;
}

class AltaAdminDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  email!: string;
}

class FiltroAuditoriaDto extends PaginaDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entidad?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usuarioId?: number;
}

const usuarioEnLista = {
  id: true,
  email: true,
  rol: true,
  estado: true,
  ultimoLoginEn: true,
  creadoEn: true,
  jugador: { select: { id: true, nombre: true, apellido: true } },
} satisfies Prisma.UsuarioSelect;

@SoloAdmin()
@Controller()
export class UsuariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly codigos: CodigosService,
  ) {}

  @Get('usuarios')
  async listar(@Query() filtro: FiltroUsuariosDto) {
    const where: Prisma.UsuarioWhereInput = {
      rol: filtro.rol,
      estado: filtro.estado,
      email: filtro.q ? { contains: filtro.q.trim().toLowerCase() } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.usuario.findMany({ where, select: usuarioEnLista, orderBy: { email: 'asc' }, ...rango(filtro.pagina) }),
      this.prisma.usuario.count({ where }),
    ]);
    return paginar(items, total, filtro.pagina);
  }

  /**
   * Alta de otra persona de la organización. No recibe contraseña: entra por
   * primera vez con un código de un solo uso y elige la suya.
   */
  @Post('usuarios')
  async crearAdmin(@Body() dto: AltaAdminDto, @SesionActual() sesion: Sesion) {
    // Contraseña al azar que nadie conoce: la cuenta queda usable solo con el código.
    const passwordHash = await hashearPassword(generarToken());
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({ data: { email: dto.email, passwordHash, rol: 'ADMIN' }, select: usuarioEnLista });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'ALTA', 'usuario', usuario.id, { email: dto.email, rol: 'ADMIN' });
      const { codigo, venceEn } = await this.codigos.generarEn(tx, usuario.id, { usuarioId: sesion.usuarioId });
      return { usuario, codigo, venceEn };
    });
  }

  @Patch('usuarios/:id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiosUsuarioDto, @SesionActual() sesion: Sesion) {
    if (id === sesion.usuarioId) throw new ConflictException('No podés cambiar tu propio rol ni tu estado.');
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({ where: { id }, data: { rol: dto.rol, estado: dto.estado }, select: usuarioEnLista });
      // Un usuario bloqueado o inactivo pierde sus sesiones abiertas.
      if (dto.estado && dto.estado !== 'ACTIVO') {
        await tx.sesion.updateMany({ where: { usuarioId: id, revocadaEn: null }, data: { revocadaEn: new Date() } });
      }
      await this.auditoria.registrar(tx, sesion.usuarioId, 'EDITAR', 'usuario', id, { rol: dto.rol, estado: dto.estado });
      return usuario;
    });
  }

  /**
   * Código de un solo uso para que un jugador elija una contraseña nueva.
   * Los códigos de otras personas de la organización los genera solo el
   * administrador general, desde el sistema de licencias: así un administrador
   * no puede quedarse con la cuenta de otro.
   */
  @HttpCode(200)
  @Post('usuarios/:id/codigo-password')
  async codigoPassword(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: { rol: true } });
    if (!usuario) throw new NotFoundException('No encontramos ese usuario.');
    if (usuario.rol !== 'JUGADOR') {
      throw new ForbiddenException('El código para otra persona de la organización lo genera el administrador general.');
    }
    return this.codigos.generar(id, { usuarioId: sesion.usuarioId });
  }

  @Get('auditoria')
  listarAuditoria(@Query() filtro: FiltroAuditoriaDto) {
    return this.auditoria.listar(filtro);
  }

  /** Fallos de los teléfonos (hoy, al activar las notificaciones), del más reciente al más viejo. */
  @Get('logs')
  async listarLogs(@Query() filtro: PaginaDto) {
    const [items, total] = await Promise.all([
      this.prisma.log.findMany({
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        include: { usuario: { select: { email: true } } },
        ...rango(filtro.pagina),
      }),
      this.prisma.log.count(),
    ]);
    return paginar(items, total, filtro.pagina);
  }

  /** Números del tablero de la organización. */
  @Get('admin/resumen')
  async resumen() {
    const [parejasPorAprobar, inscripcionesPorAprobar, torneosEnCurso, torneosAbiertos, jugadores] = await Promise.all([
      this.prisma.pareja.count({ where: { estado: 'CONFIRMADA' } }),
      this.prisma.inscripcion.count({ where: { estado: 'PENDIENTE', torneo: { estado: 'INSCRIPCION_ABIERTA' } } }),
      this.prisma.torneo.count({ where: { estado: 'EN_CURSO' } }),
      this.prisma.torneo.count({ where: { estado: 'INSCRIPCION_ABIERTA' } }),
      this.prisma.jugador.count({ where: { eliminadoEn: null } }),
    ]);
    return { parejasPorAprobar, inscripcionesPorAprobar, torneosEnCurso, torneosAbiertos, jugadores };
  }
}
