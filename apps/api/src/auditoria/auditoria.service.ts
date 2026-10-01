import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.ts';
import { paginar, rango } from '../comun/paginacion.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

type Cliente = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Se llama dentro de la misma transacción que el cambio que registra. */
  registrar(
    db: Cliente,
    usuarioId: number,
    accion: string,
    entidad: string,
    entidadId: number | null,
    detalle?: Prisma.InputJsonValue,
  ) {
    return db.auditoria.create({ data: { usuarioId, accion, entidad, entidadId, detalle } });
  }

  async listar(filtro: { entidad?: string; usuarioId?: number; pagina?: number }) {
    const where: Prisma.AuditoriaWhereInput = {
      entidad: filtro.entidad || undefined,
      usuarioId: filtro.usuarioId,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        orderBy: { fecha: 'desc' },
        include: { usuario: { select: { email: true } } },
        ...rango(filtro.pagina),
      }),
      this.prisma.auditoria.count({ where }),
    ]);
    return paginar(items, total, filtro.pagina);
  }
}
