import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const POR_PAGINA = 20;

export class PaginaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pagina?: number;
}

export function rango(pagina = 1) {
  return { skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA };
}

export function paginar<T>(items: T[], total: number, pagina = 1) {
  return { items, total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/** Minúsculas y sin acentos: el mismo formato que la columna jugadores.busqueda. */
export function normalizarBusqueda(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}
