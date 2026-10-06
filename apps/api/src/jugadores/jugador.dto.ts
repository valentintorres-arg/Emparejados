import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginaDto } from '../comun/paginacion.ts';
import { Genero, ManoHabil, PosicionJuego } from '../generated/prisma/enums.ts';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const soloNumeros = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[^\d+]/g, '') : value;
const vacioANull = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : value);

export const normalizarEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class DatosJugadorDto {
  @Transform(recortar)
  @IsString()
  @Length(1, 60, { message: 'Escribí el nombre.' })
  nombre!: string;

  @Transform(recortar)
  @IsString()
  @Length(1, 60, { message: 'Escribí el apellido.' })
  apellido!: string;

  @Transform(soloNumeros)
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 números, sin puntos.' })
  dni!: string;

  @IsDateString({}, { message: 'Elegí la fecha de nacimiento.' })
  fechaNacimiento!: string;

  @IsIn([Genero.MASCULINO, Genero.FEMENINO], { message: 'Elegí el género.' })
  genero!: Genero;

  @Transform(soloNumeros)
  @Matches(/^\+?\d{8,15}$/, { message: 'El teléfono debe tener entre 8 y 15 números.' })
  telefono!: string;

  @Transform(vacioANull)
  @IsOptional()
  @IsInt()
  localidadId?: number | null;

  @Transform(vacioANull)
  @IsOptional()
  @IsInt()
  clubId?: number | null;

  @IsInt({ message: 'Elegí la categoría.' })
  categoriaId!: number;

  @IsEnum(ManoHabil, { message: 'Elegí la mano hábil.' })
  manoHabil!: ManoHabil;

  @IsEnum(PosicionJuego, { message: 'Elegí la posición preferida.' })
  posicion!: PosicionJuego;

}

/** Foto de perfil ya recortada y achicada por el navegador, en base64. */
export class FotoDto {
  @IsString()
  @MaxLength(280_000, { message: 'La foto es demasiado grande.' })
  imagen!: string;
}

export class RegistroDto extends DatosJugadorDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(100)
  password!: string;

  @Equals(true, { message: 'Para registrarte tenés que aceptar el tratamiento de tus datos personales.' })
  consentimiento!: boolean;
}

/** Alta hecha por un admin: la contraseña es opcional (se genera una temporal). */
export class AltaJugadorDto extends DatosJugadorDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Escribí un email válido.' })
  email!: string;

  @Equals(true, { message: 'Confirmá que el jugador dio su consentimiento para el tratamiento de datos.' })
  consentimiento!: boolean;
}

export class FiltroJugadoresDto extends PaginaDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoriaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clubId?: number;
}
