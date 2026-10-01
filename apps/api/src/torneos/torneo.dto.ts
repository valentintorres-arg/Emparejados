import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { EstadoInscripcion, EstadoTorneo, FormatoTorneo, Rama } from '../generated/prisma/enums.ts';

export class TorneoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 120, { message: 'El nombre del torneo debe tener al menos 3 letras.' })
  nombre!: string;

  @IsInt({ message: 'Elegí la sede.' })
  sedeId!: number;

  @IsInt({ message: 'Elegí la categoría.' })
  categoriaId!: number;

  @IsEnum(Rama, { message: 'Elegí la rama.' })
  rama!: Rama;

  @IsEnum(FormatoTorneo, { message: 'Elegí el formato.' })
  formato!: FormatoTorneo;

  @IsInt()
  @Min(2, { message: 'El cupo tiene que ser de al menos 2 parejas.' })
  @Max(64, { message: 'El cupo máximo es de 64 parejas.' })
  cupoMaximo!: number;

  @IsDateString({}, { message: 'Elegí la fecha de inicio.' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'Elegí la fecha de fin.' })
  fechaFin!: string;

  @IsDateString({}, { message: 'Elegí la fecha límite de inscripción.' })
  fechaLimiteInscripcion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  reglamento?: string;
}

export class EstadoTorneoDto {
  @IsEnum(EstadoTorneo)
  estado!: EstadoTorneo;
}

export class InscribirDto {
  @IsInt({ message: 'Elegí la pareja.' })
  parejaId!: number;
}

export class SiembraDto {
  @ValidateIf((dto: SiembraDto) => dto.siembra !== null)
  @IsInt()
  @Min(1)
  @Max(64)
  siembra!: number | null;
}

export class FiltroInscripcionesDto {
  @IsOptional()
  @IsEnum(EstadoInscripcion)
  estado?: EstadoInscripcion;
}
