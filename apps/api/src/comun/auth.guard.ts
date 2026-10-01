import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { RolUsuario } from '../generated/prisma/enums.ts';
import { ES_PUBLICO, type PeticionConSesion, ROLES } from './sesion.ts';

export const COOKIE_ACCESO = 'emp_at';
export const COOKIE_REFRESCO = 'emp_rt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, destinos);
    const roles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES, destinos);
    const req = ctx.switchToHttp().getRequest<PeticionConSesion>();

    const token: string | undefined = req.cookies?.[COOKIE_ACCESO];
    if (token) {
      try {
        const datos = await this.jwt.verifyAsync<{ sub: number; rol: RolUsuario; jid: number | null }>(token);
        req.sesion = { usuarioId: datos.sub, rol: datos.rol, jugadorId: datos.jid };
      } catch {
        // Token vencido o inválido: se trata como si no hubiera sesión.
      }
    }

    if (esPublico) return true;
    if (!req.sesion) throw new UnauthorizedException('Iniciá sesión para continuar.');
    if (roles?.length && !roles.includes(req.sesion.rol)) {
      throw new ForbiddenException('No tenés permiso para hacer esto.');
    }
    return true;
  }
}
