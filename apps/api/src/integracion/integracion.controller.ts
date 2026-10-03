import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Publico } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CodigosService } from '../usuarios/codigos.service.ts';

// Conexión con el sistema de licencias (licenses.onlineturnos.ar/admin): desde
// ahí el administrador general ve los usuarios de Emparejados y genera códigos
// para cambiar la contraseña de cualquiera, también de la organización.
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

const MAXIMO_EN_LISTA = 200;

@Publico()
@UseGuards(ClaveDeIntegracion)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('integracion')
export class IntegracionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codigos: CodigosService,
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
        select: {
          id: true,
          email: true,
          rol: true,
          estado: true,
          ultimoLoginEn: true,
          jugador: { select: { nombre: true, apellido: true } },
          codigosPassword: { where: { usadoEn: null, venceEn: { gt: new Date() } }, select: { venceEn: true } },
        },
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return {
      total,
      items: items.map(({ codigosPassword, ...usuario }) => ({ ...usuario, codigoVigenteHasta: codigosPassword[0]?.venceEn ?? null })),
    };
  }

  @HttpCode(200)
  @Post('usuarios/:id/codigo-password')
  codigo(@Param('id', ParseIntPipe) id: number, @Body() dto: CodigoDto) {
    return this.codigos.generar(id, { externo: dto.generadoPor.toLowerCase() });
  }
}
