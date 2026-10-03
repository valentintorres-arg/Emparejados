import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import { COOKIE_ACCESO, COOKIE_REFRESCO } from '../comun/auth.guard.ts';
import { Publico, SesionActual, type Sesion } from '../comun/sesion.ts';
import { normalizarEmail, RegistroDto } from '../jugadores/jugador.dto.ts';
import { AuthService, type Credenciales, DURACION_ACCESO_SEG, DURACION_REFRESCO_SEG } from './auth.service.ts';

class LoginDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  email!: string;

  @IsString()
  @MaxLength(100)
  password!: string;
}

class PasswordConCodigoDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  email!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9s-]{8,12}$/, { message: 'El código tiene 8 letras y números, por ejemplo ABCD-2345.' })
  codigo!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres.' })
  @MaxLength(100)
  nueva!: string;
}

class CambiarPasswordDto {
  @IsString()
  @MaxLength(100)
  actual!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres.' })
  @MaxLength(100)
  nueva!: string;
}

const origenDe = (req: Request) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

function opciones(): CookieOptions {
  // httpOnly: el JavaScript de la página nunca ve los tokens.
  return { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' };
}

function ponerCookies(res: Response, credenciales: Credenciales) {
  res.cookie(COOKIE_ACCESO, credenciales.acceso, { ...opciones(), path: '/', maxAge: DURACION_ACCESO_SEG * 1000 });
  // El refresh token solo viaja a las rutas de sesión.
  res.cookie(COOKIE_REFRESCO, credenciales.refresco, {
    ...opciones(),
    path: '/api/auth',
    maxAge: DURACION_REFRESCO_SEG * 1000,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // El límite es por IP y en un club todos salen por el mismo wifi: tiene que
  // frenar un ataque de fuerza bruta sin trabar a un grupo que entra a la vez.
  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    ponerCookies(res, await this.auth.login(dto.email, dto.password, origenDe(req)));
    return { ok: true };
  }

  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('registro')
  async registro(@Body() dto: RegistroDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    ponerCookies(res, await this.auth.registrar(dto, origenDe(req)));
    return { ok: true };
  }

  /** Con el código de un solo uso que dio la organización (o el administrador general). */
  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password-con-codigo')
  async passwordConCodigo(@Body() dto: PasswordConCodigoDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    ponerCookies(res, await this.auth.cambiarConCodigo(dto.email, dto.codigo, dto.nueva, origenDe(req)));
    return { ok: true };
  }

  @Publico()
  @HttpCode(200)
  @Post('refrescar')
  async refrescar(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    ponerCookies(res, await this.auth.refrescar(req.cookies?.[COOKIE_REFRESCO], origenDe(req)));
    return { ok: true };
  }

  @Publico()
  @HttpCode(200)
  @Post('salir')
  async salir(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.cerrar(req.cookies?.[COOKIE_REFRESCO]);
    res.clearCookie(COOKIE_ACCESO, { ...opciones(), path: '/' });
    res.clearCookie(COOKIE_REFRESCO, { ...opciones(), path: '/api/auth' });
    return { ok: true };
  }

  @Get('yo')
  yo(@SesionActual() sesion: Sesion) {
    return this.auth.yo(sesion);
  }

  @HttpCode(200)
  @Post('password')
  async cambiarPassword(@Body() dto: CambiarPasswordDto, @SesionActual() sesion: Sesion) {
    await this.auth.cambiarPassword(sesion, dto.actual, dto.nueva);
    return { ok: true };
  }
}
