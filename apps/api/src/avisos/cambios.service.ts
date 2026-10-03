import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { Subject } from 'rxjs';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

/** Un registro de auditoría recién confirmado: qué se hizo, sobre qué y quién. */
export interface Cambio {
  id: number;
  usuarioId: number;
  accion: string;
  entidad: string;
  entidadId: number | null;
  detalle: Prisma.JsonValue;
}

const ESPERA_INICIAL_MS = 1_000;
const ESPERA_MAXIMA_MS = 30_000;

/**
 * Escucha el canal "auditoria" de PostgreSQL: el trigger auditoria_avisar manda
 * el id de cada registro cuando se confirma su transacción. Usa una conexión
 * propia (LISTEN no funciona con el pool de Prisma) y se reconecta sola si la
 * base se reinicia.
 */
@Injectable()
export class CambiosService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Cambios');
  private readonly flujo = new Subject<Cambio>();
  readonly cambios$ = this.flujo.asObservable();
  private cliente: pg.Client | null = null;
  private cerrando = false;
  private espera = ESPERA_INICIAL_MS;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.escuchar();
  }

  async onModuleDestroy() {
    this.cerrando = true;
    await this.cliente?.end().catch(() => {});
    this.flujo.complete();
  }

  private async escuchar() {
    if (this.cerrando) return;
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    let reintentando = false;
    const reintentar = (motivo: string) => {
      if (reintentando || this.cerrando) return;
      reintentando = true;
      this.log.warn(`Sin escucha de cambios (${motivo}). Reintento en ${this.espera / 1000} s.`);
      cliente.end().catch(() => {});
      setTimeout(() => void this.escuchar(), this.espera);
      this.espera = Math.min(this.espera * 2, ESPERA_MAXIMA_MS);
    };

    cliente.on('notification', (aviso) => void this.alAvisar(aviso.payload));
    cliente.on('error', (error) => reintentar(error.message));
    cliente.on('end', () => reintentar('la base cerró la conexión'));
    try {
      await cliente.connect();
      await cliente.query('LISTEN auditoria');
      this.cliente = cliente;
      this.espera = ESPERA_INICIAL_MS;
    } catch (error) {
      reintentar(error instanceof Error ? error.message : String(error));
    }
  }

  private async alAvisar(contenido: string | undefined) {
    const id = Number(contenido);
    if (!Number.isInteger(id)) return;
    try {
      const registro = await this.prisma.auditoria.findUnique({
        where: { id },
        select: { id: true, usuarioId: true, accion: true, entidad: true, entidadId: true, detalle: true },
      });
      if (registro) this.flujo.next(registro);
    } catch (error) {
      this.log.warn(`No se pudo leer el registro de auditoría ${id}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
