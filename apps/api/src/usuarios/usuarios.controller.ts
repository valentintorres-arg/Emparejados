import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
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
import { generarPasswordTemporal, hashearPassword } from '../comun/password.ts';
import { SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { EstadoUsuario, RolUsuario } from '../generated/prisma/enums.ts';
import { normalizarEmail } from '../jugadores/jugador.dto.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

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

  /** Alta de otra persona de la organización. La contraseña temporal se muestra una sola vez. */
  @Post('usuarios')
  async crearAdmin(@Body() dto: AltaAdminDto, @SesionActual() sesion: Sesion) {
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await hashearPassword(passwordTemporal);
    const usuario = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({ data: { email: dto.email, passwordHash, rol: 'ADMIN' }, select: usuarioEnLista });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'ALTA', 'usuario', creado.id, { email: dto.email, rol: 'ADMIN' });
      return creado;
    });
    return { usuario, passwordTemporal };
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

  @HttpCode(200)
  @Post('usuarios/:id/reset-password')
  async resetPassword(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await hashearPassword(passwordTemporal);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id }, data: { passwordHash } });
      await tx.sesion.updateMany({ where: { usuarioId: id, revocadaEn: null }, data: { revocadaEn: new Date() } });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'RESET_PASSWORD', 'usuario', id);
    });
    return { passwordTemporal };
  }

  @Get('auditoria')
  listarAuditoria(@Query() filtro: FiltroAuditoriaDto) {
    return this.auditoria.listar(filtro);
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
