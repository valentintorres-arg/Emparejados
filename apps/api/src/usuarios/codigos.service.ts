import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { hashearPassword } from '../comun/password.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

// Mismo formato que los códigos de recuperación del sistema de licencias:
// corto para dictarlo por teléfono, sin 0/O ni 1/I/L, de un solo uso y con
// vencimiento. 31^8 combinaciones con 5 intentos.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Contraseña provisoria del blanqueo: en minúsculas y sin guiones, para escribirla en el teléfono sin cambiar de teclado.
const LARGO_PROVISORIA = 10;
const VIGENCIA_HORAS = 24;
export const INTENTOS_MAXIMOS = 5;

const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
const provisoria = () => Array.from({ length: LARGO_PROVISORIA }, () => ALFABETO[randomInt(ALFABETO.length)]).join('').toLowerCase();
const normalizar = (codigo: string) => codigo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const hashDe = (codigo: string) => createHash('sha256').update(normalizar(codigo)).digest('hex');

/** Quién genera el código: un usuario de la app, o el administrador general (su email) desde el sistema de licencias. */
export type Autor = { usuarioId: number } | { externo: string };

export interface CodigoGenerado {
  codigo: string;
  venceEn: Date;
  email: string;
}

type Tx = Prisma.TransactionClient;

const MENSAJE_INVALIDO = 'El email o el código no son correctos, o el código ya venció. Pedí uno nuevo si hace falta.';

@Injectable()
export class CodigosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Genera un código nuevo para ese usuario. Si tenía otro sin usar, deja de servir. */
  generar(usuarioId: number, autor: Autor): Promise<CodigoGenerado> {
    return this.prisma.$transaction((tx) => this.generarEn(tx, usuarioId, autor));
  }

  /** Igual que generar, dentro de una transacción ya abierta (alta de usuario y código en un solo paso). */
  async generarEn(tx: Tx, usuarioId: number, autor: Autor): Promise<CodigoGenerado> {
    const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, estado: true } });
    if (!usuario) throw new NotFoundException('No encontramos ese usuario.');
    if (usuario.estado !== 'ACTIVO') throw new ConflictException('La cuenta no está activa: activala antes de generar un código.');

    await tx.codigoPassword.deleteMany({ where: { usuarioId, usadoEn: null } });
    const codigo = `${grupo()}-${grupo()}`;
    const venceEn = new Date(Date.now() + VIGENCIA_HORAS * 3600_000);
    await tx.codigoPassword.create({
      data: {
        usuarioId,
        codigoHash: hashDe(codigo),
        venceEn,
        ...('usuarioId' in autor ? { generadoPorId: autor.usuarioId } : { generadoPorExterno: autor.externo }),
      },
    });
    // La auditoría exige un usuario de la app como autor; los del administrador general quedan en la fila del código.
    if ('usuarioId' in autor) await this.auditoria.registrar(tx, autor.usuarioId, 'GENERAR_CODIGO_PASSWORD', 'usuario', usuarioId);
    return { codigo, venceEn, email: usuario.email };
  }

  /**
   * Canjea el código y deja la contraseña nueva. Devuelve el usuario para abrirle
   * sesión. Cierra las sesiones que tuviera abiertas en otros dispositivos.
   */
  async canjear(email: string, codigo: string, nueva: string) {
    const passwordHash = await hashearPassword(nueva);
    const resultado = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { email },
        select: { id: true, rol: true, estado: true, jugador: { select: { id: true } } },
      });
      if (!usuario) return { error: MENSAJE_INVALIDO } as const;
      // FOR UPDATE: dos intentos a la vez no pueden usar el mismo código ni pasarse de intentos.
      const [pendiente] = await tx.$queryRaw<{ id: number; codigo_hash: string; intentos_fallidos: number }[]>`
        SELECT id, codigo_hash, intentos_fallidos FROM codigos_password
        WHERE usuario_id = ${usuario.id} AND usado_en IS NULL AND vence_en > now() AND intentos_fallidos < ${INTENTOS_MAXIMOS}
        FOR UPDATE`;
      if (!pendiente) return { error: MENSAJE_INVALIDO } as const;

      const coincide = timingSafeEqual(Buffer.from(pendiente.codigo_hash, 'hex'), Buffer.from(hashDe(codigo), 'hex'));
      if (!coincide) {
        const intentos = pendiente.intentos_fallidos + 1;
        await tx.codigoPassword.update({ where: { id: pendiente.id }, data: { intentosFallidos: intentos } });
        return {
          error: intentos >= INTENTOS_MAXIMOS ? 'El código no es correcto y ya se intentó demasiadas veces: quedó anulado. Pedí uno nuevo.' : MENSAJE_INVALIDO,
        } as const;
      }
      if (usuario.estado !== 'ACTIVO') return { error: 'Tu cuenta no está activa. Hablá con la organización.' } as const;

      await tx.codigoPassword.update({ where: { id: pendiente.id }, data: { usadoEn: new Date() } });
      await tx.usuario.update({ where: { id: usuario.id }, data: { passwordHash, debeCambiarPassword: false, ultimoLoginEn: new Date() } });
      await tx.sesion.updateMany({ where: { usuarioId: usuario.id, revocadaEn: null }, data: { revocadaEn: new Date() } });
      await this.auditoria.registrar(tx, usuario.id, 'CAMBIAR_PASSWORD_CON_CODIGO', 'usuario', usuario.id);
      return { usuario } as const;
    });
    // El intento fallido queda guardado: por eso el error se lanza fuera de la transacción.
    if ('error' in resultado) throw new BadRequestException(resultado.error);
    return resultado.usuario;
  }

  /**
   * Blanqueo, desde el sistema de licencias: deja una contraseña provisoria que
   * se muestra una sola vez a quien la pidió. La persona entra con ella y la app
   * le hace elegir la suya antes de seguir. Cierra sus sesiones y anula el código
   * sin usar que tuviera.
   */
  async blanquear(usuarioId: number, externo: string): Promise<{ password: string; email: string }> {
    const password = provisoria();
    const passwordHash = await hashearPassword(password);
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, estado: true } });
      if (!usuario) throw new NotFoundException('No encontramos ese usuario.');
      if (usuario.estado !== 'ACTIVO') throw new ConflictException('La cuenta no está activa: activala antes de blanquear la contraseña.');

      await tx.usuario.update({ where: { id: usuarioId }, data: { passwordHash, debeCambiarPassword: true } });
      await tx.sesion.updateMany({ where: { usuarioId, revocadaEn: null }, data: { revocadaEn: new Date() } });
      await tx.codigoPassword.deleteMany({ where: { usuarioId, usadoEn: null } });
      // La auditoría exige un usuario de la app: va la cuenta afectada, y en el detalle quién lo pidió.
      await this.auditoria.registrar(tx, usuarioId, 'PASSWORD_BLANQUEADA', 'usuario', usuarioId, { por: externo });
      return { password, email: usuario.email };
    });
  }
}
