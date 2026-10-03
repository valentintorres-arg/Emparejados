import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.ts';

/** Lo que muestra el teléfono. Lo arma el service worker de la web (public/sw.js). */
export interface Aviso {
  titulo: string;
  cuerpo: string;
  /** Pantalla que se abre al tocar la notificación. */
  url: string;
  /** Avisos con la misma etiqueta se reemplazan en el teléfono en lugar de apilarse. */
  etiqueta?: string;
}

export interface DatosDeSuscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Un día: si el teléfono está apagado más tiempo, el aviso ya no sirve. */
const VIGENCIA_SEG = 60 * 60 * 24;

/**
 * Notificaciones push con el estándar Web Push. Las claves VAPID identifican al
 * servidor ante Google, Apple y Mozilla; sin ellas las notificaciones quedan
 * apagadas y el resto de la app funciona igual.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');
  readonly clavePublica: string | null = null;

  constructor(private readonly prisma: PrismaService) {
    const publica = process.env.VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;
    if (!publica || !privada) {
      this.log.warn('Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY: las notificaciones push quedan apagadas.');
      return;
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://emparejados.onlineturnos.ar', publica, privada);
    this.clavePublica = publica;
  }

  /** El mismo dispositivo con otra cuenta: la suscripción pasa a la cuenta nueva. */
  async guardar(usuarioId: number, datos: DatosDeSuscripcion) {
    await this.prisma.suscripcionPush.upsert({
      where: { endpoint: datos.endpoint },
      create: { usuarioId, ...datos },
      update: { usuarioId, p256dh: datos.p256dh, auth: datos.auth },
    });
  }

  async borrar(usuarioId: number, endpoint: string) {
    await this.prisma.suscripcionPush.deleteMany({ where: { usuarioId, endpoint } });
  }

  /** Manda el aviso a todos los dispositivos de esos usuarios. Nunca falla: los errores quedan en el log. */
  async enviar(usuarioIds: number[], aviso: Aviso) {
    if (!this.clavePublica || usuarioIds.length === 0) return;
    const suscripciones = await this.prisma.suscripcionPush.findMany({
      where: { usuarioId: { in: usuarioIds }, usuario: { estado: 'ACTIVO' } },
    });
    const contenido = JSON.stringify(aviso);
    await Promise.all(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, contenido, { TTL: VIGENCIA_SEG });
        } catch (error) {
          const estado = (error as { statusCode?: number }).statusCode;
          // 404 y 410: el navegador anuló la suscripción (se desinstaló la app o se borraron los datos).
          if (estado === 404 || estado === 410) {
            await this.prisma.suscripcionPush.delete({ where: { id: s.id } }).catch(() => {});
          } else {
            this.log.warn(`No se pudo enviar un aviso al usuario ${s.usuarioId}: ${error instanceof Error ? error.message : error}`);
          }
        }
      }),
    );
  }
}
