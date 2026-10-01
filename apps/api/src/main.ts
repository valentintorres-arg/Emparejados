import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

for (const variable of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[variable]) throw new Error(`Falta la variable de entorno ${variable}.`);
}

// Import dinámico: el módulo lee process.env al cargarse, después de la validación.
const { AppModule } = await import('./app.module.ts');

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.setGlobalPrefix('api');
// Detrás del proxy de Next y del túnel: la IP real llega en X-Forwarded-For.
app.set('trust proxy', true);
app.use(helmet());
app.use(cookieParser());
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
app.enableShutdownHooks();

const puerto = Number(process.env.PORT ?? 4000);
await app.listen(puerto);
console.log(`API de Emparejados escuchando en el puerto ${puerto}`);
