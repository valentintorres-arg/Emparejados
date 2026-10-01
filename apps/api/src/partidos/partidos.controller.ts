import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import { EstadoPartidoDto, ProgramacionAutomaticaDto, ProgramacionDto, ResultadoDto } from './partido.dto.ts';
import { PartidosService } from './partidos.service.ts';

@Controller('partidos')
export class PartidosController {
  constructor(private readonly partidos: PartidosService) {}

  @Get('mios')
  mios(@SesionActual() sesion: Sesion) {
    if (!sesion.jugadorId) throw new ForbiddenException('Esta función es para cuentas de jugador.');
    return this.partidos.mios(sesion.jugadorId);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post('programar-torneo/:torneoId')
  programarTorneo(
    @Param('torneoId', ParseIntPipe) torneoId: number,
    @Body() dto: ProgramacionAutomaticaDto,
    @SesionActual() sesion: Sesion,
  ) {
    return this.partidos.programarAutomaticamente(torneoId, dto, sesion);
  }

  @SoloAdmin()
  @Put(':id/programacion')
  programar(@Param('id', ParseIntPipe) id: number, @Body() dto: ProgramacionDto, @SesionActual() sesion: Sesion) {
    return this.partidos.programar(id, dto, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/estado')
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: EstadoPartidoDto, @SesionActual() sesion: Sesion) {
    return this.partidos.cambiarEstado(id, dto.estado, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/resultado')
  cargarResultado(@Param('id', ParseIntPipe) id: number, @Body() dto: ResultadoDto, @SesionActual() sesion: Sesion) {
    return this.partidos.cargarResultado(id, dto, sesion);
  }
}
