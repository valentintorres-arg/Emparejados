import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { Publico, SesionActual, SoloAdmin, type Sesion } from '../comun/sesion.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class LocalidadDto {
  @Transform(recortar)
  @IsString()
  @Length(2, 80, { message: 'Escribí el nombre de la localidad.' })
  nombre!: string;

  @Transform(recortar)
  @IsString()
  @Length(2, 60, { message: 'Escribí la provincia.' })
  provincia!: string;
}

class ClubDto {
  @Transform(recortar)
  @IsString()
  @Length(2, 100, { message: 'Escribí el nombre del club.' })
  nombre!: string;

  @Transform(recortar)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  direccion?: string;

  @IsInt({ message: 'Elegí la localidad.' })
  localidadId!: number;

  /** Cantidad de canchas a crear como "Cancha 1", "Cancha 2", ... */
  @IsInt()
  @Min(0)
  @Max(30)
  canchas!: number;
}

class CanchaDto {
  @Transform(recortar)
  @IsString()
  @Length(1, 40, { message: 'Escribí el nombre de la cancha.' })
  nombre!: string;
}

/** Datos de referencia que usan los formularios: categorías, localidades, clubes y sus canchas. */
@Controller('catalogos')
export class CatalogosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Publico()
  @Get()
  async todos() {
    const [categorias, localidades, clubes] = await Promise.all([
      this.prisma.categoria.findMany({ orderBy: { orden: 'asc' } }),
      this.prisma.localidad.findMany({ orderBy: [{ provincia: 'asc' }, { nombre: 'asc' }] }),
      this.prisma.club.findMany({
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          direccion: true,
          localidad: { select: { id: true, nombre: true, provincia: true } },
          canchas: { select: { id: true, nombre: true, activa: true }, orderBy: { nombre: 'asc' } },
        },
      }),
    ]);
    return { categorias, localidades, clubes };
  }

  @SoloAdmin()
  @Post('localidades')
  crearLocalidad(@Body() dto: LocalidadDto) {
    return this.prisma.localidad.create({ data: dto });
  }

  @SoloAdmin()
  @Post('clubes')
  crearClub(@Body() dto: ClubDto, @SesionActual() sesion: Sesion) {
    return this.prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          nombre: dto.nombre,
          direccion: dto.direccion || null,
          localidadId: dto.localidadId,
          canchas: { create: Array.from({ length: dto.canchas }, (_, i) => ({ nombre: `Cancha ${i + 1}` })) },
        },
      });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'CREAR', 'club', club.id, { nombre: club.nombre });
      return club;
    });
  }

  @SoloAdmin()
  @Post('clubes/:id/canchas')
  crearCancha(@Param('id', ParseIntPipe) clubId: number, @Body() dto: CanchaDto) {
    return this.prisma.cancha.create({ data: { clubId, nombre: dto.nombre } });
  }
}
