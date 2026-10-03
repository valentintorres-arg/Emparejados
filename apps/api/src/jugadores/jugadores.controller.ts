import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import { AltaJugadorDto, DatosJugadorDto, FiltroJugadoresDto, FotoDto } from './jugador.dto.ts';
import { JugadoresService } from './jugadores.service.ts';

function exigirJugador(sesion: Sesion): number {
  if (!sesion.jugadorId) throw new ForbiddenException('Esta función es para cuentas de jugador.');
  return sesion.jugadorId;
}

@Controller('jugadores')
export class JugadoresController {
  constructor(private readonly jugadores: JugadoresService) {}

  @SoloAdmin()
  @Get()
  listar(@Query() filtro: FiltroJugadoresDto) {
    return this.jugadores.listar(filtro);
  }

  @SoloAdmin()
  @Post()
  crear(@Body() dto: AltaJugadorDto, @SesionActual() sesion: Sesion) {
    return this.jugadores.crear(dto, sesion);
  }

  @Get('yo/qr')
  miQr(@SesionActual() sesion: Sesion) {
    return this.jugadores.miQr(exigirJugador(sesion));
  }

  @Post('yo/qr/regenerar')
  regenerarQr(@SesionActual() sesion: Sesion) {
    return this.jugadores.regenerarQr(exigirJugador(sesion));
  }

  @Get('por-qr/:token')
  porQr(@Param('token') token: string) {
    return this.jugadores.porQr(token);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.jugadores.obtener(id, sesion);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: DatosJugadorDto, @SesionActual() sesion: Sesion) {
    return this.jugadores.actualizar(id, dto, sesion);
  }

  /** La dirección cambia con cada foto nueva (?v=), así que se puede guardar para siempre. */
  @Get(':id/foto')
  async foto(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { contenido, tipo } = await this.jugadores.foto(id);
    res.set({ 'Content-Type': tipo, 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Length': String(contenido.length) });
    res.end(Buffer.from(contenido));
  }

  @Put(':id/foto')
  guardarFoto(@Param('id', ParseIntPipe) id: number, @Body() dto: FotoDto, @SesionActual() sesion: Sesion) {
    return this.jugadores.guardarFoto(id, dto.imagen, sesion);
  }

  @Delete(':id/foto')
  quitarFoto(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.jugadores.quitarFoto(id, sesion);
  }

  @SoloAdmin()
  @Delete(':id')
  darDeBaja(@Param('id', ParseIntPipe) id: number, @SesionActual() sesion: Sesion) {
    return this.jugadores.darDeBaja(id, sesion);
  }
}
