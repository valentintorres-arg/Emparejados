import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Publico, SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import { MotivoDto } from '../parejas/parejas.controller.ts';
import { EstadoTorneoDto, FiltroInscripcionesDto, InscribirDto, SiembraDto, TorneoDto } from './torneo.dto.ts';
import { TorneosService } from './torneos.service.ts';

@Controller('torneos')
export class TorneosController {
  constructor(private readonly torneos: TorneosService) {}

  @Publico()
  @Get()
  listar(@SesionActual() sesion?: Sesion) {
    return this.torneos.listar(sesion);
  }

  @Publico()
  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion?: Sesion) {
    return this.torneos.detalle(id, sesion);
  }

  @SoloAdmin()
  @Post()
  crear(@Body() dto: TorneoDto, @SesionActual() sesion: Sesion) {
    return this.torneos.crear(dto, sesion);
  }

  @SoloAdmin()
  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: TorneoDto, @SesionActual() sesion: Sesion) {
    return this.torneos.actualizar(id, dto, sesion);
  }

  @SoloAdmin()
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.torneos.eliminar(id, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/estado')
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: EstadoTorneoDto, @SesionActual() sesion: Sesion) {
    return this.torneos.cambiarEstado(id, dto.estado, sesion);
  }

  @Post(':id/inscripciones')
  inscribir(@Param('id', ParseIntPipe) id: number, @Body() dto: InscribirDto, @SesionActual() sesion: Sesion) {
    return this.torneos.inscribir(id, dto.parejaId, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/sorteo')
  sortear(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.torneos.sortear(id, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/llaves')
  generarLlaves(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.torneos.generarLlaves(id, sesion);
  }
}

@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly torneos: TorneosService) {}

  @SoloAdmin()
  @Get()
  listar(@Query() filtro: FiltroInscripcionesDto) {
    return this.torneos.listarInscripciones(filtro.estado ?? 'PENDIENTE');
  }

  @Get('mias')
  mias(@SesionActual() sesion: Sesion) {
    if (!sesion.jugadorId) throw new ForbiddenException('Esta función es para cuentas de jugador.');
    return this.torneos.misInscripciones(sesion.jugadorId);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.torneos.aprobarInscripcion(id, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/rechazar')
  rechazar(@Param('id', ParseIntPipe) id: number, @Body() dto: MotivoDto, @SesionActual() sesion: Sesion) {
    return this.torneos.rechazarInscripcion(id, dto.motivo, sesion);
  }

  @HttpCode(200)
  @Post(':id/baja')
  baja(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.torneos.darDeBajaInscripcion(id, sesion);
  }

  @SoloAdmin()
  @HttpCode(200)
  @Post(':id/siembra')
  sembrar(@Param('id', ParseIntPipe) id: number, @Body() dto: SiembraDto, @SesionActual() sesion: Sesion) {
    return this.torneos.sembrar(id, dto.siembra, sesion);
  }
}
