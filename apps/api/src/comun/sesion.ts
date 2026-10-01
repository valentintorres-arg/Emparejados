import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { RolUsuario } from '../generated/prisma/enums.ts';

export interface Sesion {
  usuarioId: number;
  rol: RolUsuario;
  /** null cuando el usuario es un admin sin ficha de jugador. */
  jugadorId: number | null;
}

export type PeticionConSesion = Request & { sesion?: Sesion };

export const ES_PUBLICO = 'esPublico';
/** Ruta accesible sin iniciar sesión. Si hay sesión válida, igual se carga. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

export const ROLES = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES, roles);
export const SoloAdmin = () => Roles('ADMIN');

export const SesionActual = createParamDecorator((_: unknown, ctx: ExecutionContext): Sesion | undefined => {
  return ctx.switchToHttp().getRequest<PeticionConSesion>().sesion;
});

export function esAdmin(sesion: Sesion | undefined): boolean {
  return sesion?.rol === 'ADMIN';
}
