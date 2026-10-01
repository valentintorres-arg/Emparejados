import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.ts';
import { AuthService, DURACION_ACCESO_SEG } from './auth/auth.service.ts';
import { CatalogosController } from './catalogos/catalogos.controller.ts';
import { AuthGuard } from './comun/auth.guard.ts';
import { FiltroErrores } from './comun/filtro-errores.ts';
import { JugadoresController } from './jugadores/jugadores.controller.ts';
import { JugadoresService } from './jugadores/jugadores.service.ts';
import { ParejasController } from './parejas/parejas.controller.ts';
import { ParejasService } from './parejas/parejas.service.ts';
import { PartidosController } from './partidos/partidos.controller.ts';
import { PartidosService } from './partidos/partidos.service.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { InscripcionesController, TorneosController } from './torneos/torneos.controller.ts';
import { TorneosService } from './torneos/torneos.service.ts';
import { UsuariosController } from './usuarios/usuarios.controller.ts';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: DURACION_ACCESO_SEG },
    }),
    // Límite general por IP; el login y el registro tienen uno más estricto.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
  ],
  controllers: [
    AuthController,
    CatalogosController,
    JugadoresController,
    ParejasController,
    TorneosController,
    InscripcionesController,
    PartidosController,
    UsuariosController,
  ],
  providers: [
    AuthService,
    JugadoresService,
    ParejasService,
    TorneosService,
    PartidosService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: FiltroErrores },
  ],
})
export class AppModule {}
