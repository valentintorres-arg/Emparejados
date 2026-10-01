import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PaginaDto } from '../comun/paginacion.ts';
import { SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import { EstadoPareja } from '../generated/prisma/enums.ts';
import { ParejasService } from './parejas.service.ts';

class CrearParejaDto {
  @IsString()
  @Length(16, 64, { message: 'El código QR no es válido.' })
  token!: string;
}

export class MotivoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 300, { message: 'Escribí el motivo del rechazo.' })
  motivo!: string;
}

class FiltroParejasDto extends PaginaDto {
  @IsOptional()
  @IsEnum(EstadoPareja)
  estado?: EstadoPareja;
}

function exigirJugador(sesion: Sesion) {
  if (!sesion.jugadorId) throw new ForbiddenException('Esta función es para cuentas de jugador.');
}

@Controller('parejas')
export class ParejasController {
  constructor(private readonly parejas: ParejasService) {}

  @Post()
  crear(@Body() dto: CrearParejaDto, @SesionActual() sesion: Sesion) {
    exigirJugador(sesion);
    return this.parejas.crearPorQr(dto.token, sesion);
  }

  @Get('mias')
  mias(@SesionActual() sesion: Sesion) {
    exigirJugador(sesion);
    return this.parejas.mias(sesion.jugadorId!);
  }

  @SoloAdmin()
  @Get()
  listar(@Query() filtro: FiltroParejasDto) {
    return this.parejas.listar(filtro);
  }

  @HttpCode(200)
  @Post(':id/confirmar')
  confirmar(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.parejas.confirmar(id, sesion);
  }

  @HttpCode(200)
  @Post(':id/declinar')
  declinar(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.parejas.declinar(id, sesion);
  }

  @HttpCode(200)
  @Post(':id/disolver')
  disolver(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.parejas.disolver(id, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.parejas.aprobar(id, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/rechazar')
  rechazar(@Param('id', ParseIntPipe) id: number, @Body() dto: MotivoDto, @SesionActual() sesion: Sesion) {
    return this.parejas.rechazar(id, dto.motivo, sesion);
  }
}
