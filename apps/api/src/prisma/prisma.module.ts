import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { PrismaService } from './prisma.service.ts';

// Global: todos los módulos leen la base y registran auditoría.
@Global()
@Module({
  providers: [PrismaService, AuditoriaService],
  exports: [PrismaService, AuditoriaService],
})
export class PrismaModule {}
