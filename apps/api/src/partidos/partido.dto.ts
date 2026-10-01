import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ProgramacionDto {
  /** null en inicio = quitar el partido de la agenda. */
  @ValidateIf((dto: ProgramacionDto) => dto.inicio !== null)
  @IsDateString({}, { message: 'Elegí día y hora.' })
  inicio!: string | null;

  @ValidateIf((dto: ProgramacionDto) => dto.inicio !== null)
  @IsInt({ message: 'Elegí la cancha.' })
  canchaId!: number | null;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(240)
  duracionMin?: number;
}

export class ProgramacionAutomaticaDto {
  @IsDateString({}, { message: 'Elegí día y hora del primer turno.' })
  desde!: string;

  @IsInt()
  @Min(30)
  @Max(240)
  duracionMin!: number;

  @IsInt()
  @Min(1, { message: 'Tiene que haber al menos un turno por día.' })
  @Max(16)
  turnosPorDia!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Elegí al menos una cancha.' })
  @IsInt({ each: true })
  canchaIds!: number[];
}

export class SetDto {
  @IsInt()
  @Min(0)
  @Max(99)
  gamesP1!: number;

  @IsInt()
  @Min(0)
  @Max(99)
  gamesP2!: number;

  @IsOptional()
  @IsBoolean()
  superTiebreak?: boolean;
}

export class ResultadoDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2, { message: 'Cargá al menos dos sets.' })
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SetDto)
  sets?: SetDto[];

  /** W.O.: lado que gana porque el rival no se presentó. */
  @IsOptional()
  @IsIn([1, 2])
  wo?: 1 | 2;
}

export class EstadoPartidoDto {
  @IsIn(['PROGRAMADO', 'EN_JUEGO', 'SUSPENDIDO'])
  estado!: 'PROGRAMADO' | 'EN_JUEGO' | 'SUSPENDIDO';
}
