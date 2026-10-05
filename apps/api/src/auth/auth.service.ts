import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { generarToken, hashearPassword, verificarPassword } from '../comun/password.ts';
import type { Sesion } from '../comun/sesion.ts';
import type { EstadoUsuario, RolUsuario } from '../generated/prisma/enums.ts';
import type { RegistroDto } from '../jugadores/jugador.dto.ts';
import { datosDeJugador, VERSION_CONSENTIMIENTO } from '../jugadores/jugadores.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CodigosService } from '../usuarios/codigos.service.ts';

export const DURACION_ACCESO_SEG = 15 * 60;
export const DURACION_REFRESCO_SEG = 30 * 24 * 60 * 60;

export interface Credenciales {
  acceso: string;
  refresco: string;
}

interface Origen {
  userAgent?: string;
  ip?: string;
}

const hashDeToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Se verifica contra este hash cuando el email no existe, para que la respuesta
// tarde lo mismo y no revele qué emails están registrados.
const HASH_SENUELO = await hashearPassword(generarToken());

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly codigos: CodigosService,
  ) {}

  async login(email: string, password: string, origen: Origen): Promise<Credenciales> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, rol: true, estado: true, passwordHash: true, jugador: { select: { id: true } } },
    });
    const coincide = await verificarPassword(password, usuario?.passwordHash ?? HASH_SENUELO);
    if (!usuario || !coincide) throw new UnauthorizedException('El email o la contraseña no coinciden.');
    this.exigirActivo(usuario.estado);

    await this.prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLoginEn: new Date() } });
    return this.abrirSesion(usuario.id, usuario.rol, usuario.jugador?.id ?? null, origen);
  }

  async registrar(dto: RegistroDto, origen: Origen): Promise<Credenciales> {
    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        passwordHash: await hashearPassword(dto.password),
        ultimoLoginEn: new Date(),
        jugador: {
          create: {
            ...datosDeJugador(dto),
            consentimientoVersion: VERSION_CONSENTIMIENTO,
            consentimientoAceptadoEn: new Date(),
            qrTokens: { create: { token: generarToken() } },
          },
        },
      },
      select: { id: true, rol: true, jugador: { select: { id: true } } },
    });
    return this.abrirSesion(usuario.id, usuario.rol, usuario.jugador!.id, origen);
  }

  /** Cambia el refresh token por uno nuevo (rotación): el anterior deja de servir. */
  async refrescar(refresco: string | undefined, origen: Origen): Promise<Credenciales> {
    if (!refresco) throw new UnauthorizedException('Iniciá sesión para continuar.');
    const sesion = await this.prisma.sesion.findUnique({
      where: { tokenHash: hashDeToken(refresco) },
      select: {
        id: true,
        revocadaEn: true,
        expiraEn: true,
        usuario: { select: { id: true, rol: true, estado: true, jugador: { select: { id: true } } } },
      },
    });
    if (!sesion || sesion.revocadaEn || sesion.expiraEn < new Date()) {
      throw new UnauthorizedException('Tu sesión venció. Iniciá sesión de nuevo.');
    }
    this.exigirActivo(sesion.usuario.estado);

    await this.prisma.sesion.update({ where: { id: sesion.id }, data: { revocadaEn: new Date() } });
    const { id, rol, jugador } = sesion.usuario;
    return this.abrirSesion(id, rol, jugador?.id ?? null, origen);
  }

  async cerrar(refresco: string | undefined) {
    if (!refresco) return;
    await this.prisma.sesion.updateMany({
      where: { tokenHash: hashDeToken(refresco), revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
  }

  async yo(sesion: Sesion) {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: sesion.usuarioId },
      select: {
        id: true,
        email: true,
        rol: true,
        debeCambiarPassword: true,
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
            categoria: { select: { id: true, nombre: true, orden: true } },
            club: { select: { id: true, nombre: true } },
          },
        },
      },
    });
  }

  async cambiarPassword(sesion: Sesion, actual: string, nueva: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: sesion.usuarioId } });
    // También con una contraseña provisoria: una sesión abierta antes del blanqueo vive
    // hasta que vence su token de acceso, y no puede elegir la contraseña sin conocerla.
    if (!(await verificarPassword(actual, usuario.passwordHash))) {
      throw new BadRequestException(usuario.debeCambiarPassword ? 'La contraseña provisoria no coincide.' : 'La contraseña actual no coincide.');
    }
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: await hashearPassword(nueva), debeCambiarPassword: false },
    });
  }

  /** "¿Olvidaste tu contraseña?": canjea el código, deja la contraseña nueva y abre sesión. */
  async cambiarConCodigo(email: string, codigo: string, nueva: string, origen: Origen): Promise<Credenciales> {
    const usuario = await this.codigos.canjear(email, codigo, nueva);
    return this.abrirSesion(usuario.id, usuario.rol, usuario.jugador?.id ?? null, origen);
  }

  private exigirActivo(estado: EstadoUsuario) {
    if (estado === 'BLOQUEADO') throw new ForbiddenException('Tu cuenta está bloqueada. Hablá con la organización.');
    if (estado === 'INACTIVO') throw new ForbiddenException('Tu cuenta está inactiva. Hablá con la organización.');
  }

  private async abrirSesion(usuarioId: number, rol: RolUsuario, jugadorId: number | null, origen: Origen) {
    const refresco = generarToken(32);
    await this.prisma.sesion.create({
      data: {
        usuarioId,
        tokenHash: hashDeToken(refresco),
        userAgent: origen.userAgent?.slice(0, 255),
        ip: origen.ip,
        expiraEn: new Date(Date.now() + DURACION_REFRESCO_SEG * 1000),
      },
    });
    const acceso = await this.jwt.signAsync({ sub: usuarioId, rol, jid: jugadorId });
    return { acceso, refresco };
  }
}
