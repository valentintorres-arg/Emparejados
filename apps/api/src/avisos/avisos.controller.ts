import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { Publico, type Sesion, SesionActual } from '../comun/sesion.ts';
import { CambiosService } from './cambios.service.ts';
import { PushService } from './push.service.ts';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export class BajaDeSuscripcionDto {
  @Matches(/^https:\/\//, { message: 'La suscripción no es válida.' })
  @MaxLength(1000)
  endpoint!: string;
}

/** Lo que entrega el navegador al suscribirse (PushSubscription.toJSON), sin la fecha de vencimiento. */
export class SuscripcionDto extends BajaDeSuscripcionDto {
  @Matches(BASE64URL, { message: 'La suscripción no es válida.' })
  @MaxLength(200)
  p256dh!: string;

  @Matches(BASE64URL, { message: 'La suscripción no es válida.' })
  @MaxLength(100)
  auth!: string;
}

/** Lo que manda la web cuando un teléfono no logra activar las notificaciones. */
export class FalloDeSuscripcionDto {
  @IsIn(['suscripcion', 'guardado'])
  paso!: string;

  @IsString()
  @MaxLength(300)
  detalle!: string;
}

/** Cada cuánto se manda un comentario vacío para que el túnel y los proxies no corten la conexión. */
const LATIDO_MS = 25_000;

@Controller('avisos')
export class AvisosController {
  constructor(
    private readonly cambios: CambiosService,
    private readonly push: PushService,
  ) {}

  /**
   * Eventos del servidor (SSE): cada cambio confirmado en la base llega a las
   * pantallas abiertas para que vuelvan a pedir sus datos. Solo dice qué tipo
   * de cosa cambió, nunca los datos: por eso puede ser público.
   */
  @Publico()
  @Get('en-vivo')
  enVivo(@Req() req: Request, @Res() res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: que ningún intermediario comprima ni junte los eventos.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Si se corta, el navegador reintenta a los 5 segundos.
    res.write('retry: 5000\n\n');
    const suscripcion = this.cambios.cambios$.subscribe(({ entidad, accion }) => {
      res.write(`event: cambio\ndata: ${JSON.stringify({ entidad, accion })}\n\n`);
    });
    const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);
    req.on('close', () => {
      clearInterval(latido);
      suscripcion.unsubscribe();
    });
  }

  /** Clave pública VAPID para suscribirse. null = notificaciones apagadas en este servidor. */
  @Publico()
  @Get('clave')
  clave() {
    return { clave: this.push.clavePublica };
  }

  @Post('suscripcion')
  @HttpCode(204)
  async suscribir(@SesionActual() sesion: Sesion, @Body() dto: SuscripcionDto) {
    await this.push.guardar(sesion.usuarioId, { endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth });
  }

  /** Al cerrar sesión o desactivar los avisos en ese dispositivo. */
  @Post('suscripcion/baja')
  @HttpCode(204)
  async darDeBaja(@SesionActual() sesion: Sesion, @Body() dto: BajaDeSuscripcionDto) {
    await this.push.borrar(sesion.usuarioId, dto.endpoint);
  }

  /** Un teléfono no pudo activar los avisos: se guarda para poder diagnosticarlo. */
  @Post('fallo')
  @HttpCode(204)
  async fallo(@SesionActual() sesion: Sesion, @Body() dto: FalloDeSuscripcionDto, @Req() req: Request) {
    await this.push.registrarFallo(sesion.usuarioId, dto.paso, dto.detalle, String(req.headers['user-agent'] ?? ''));
  }
}
