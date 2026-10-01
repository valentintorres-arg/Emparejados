import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

// Nombre de la restricción de la base -> mensaje para la persona que usa la app.
// Los nombres salen de schema.prisma y de la migración reglas_de_integridad.
const MENSAJES: Record<string, string> = {
  usuarios_email_key: 'Ya existe una cuenta con ese email.',
  usuarios_email_formato: 'El email no tiene un formato válido.',
  jugadores_dni_key: 'Ya hay un jugador registrado con ese DNI.',
  jugadores_dni_formato: 'El DNI debe tener 7 u 8 números, sin puntos.',
  jugadores_telefono_formato: 'El teléfono debe tener entre 8 y 15 números.',
  jugadores_usuario_id_key: 'Ese usuario ya tiene una ficha de jugador.',
  parejas_jugador1_id_jugador2_id_key: 'Esa pareja ya existe o está esperando aprobación.',
  parejas_orden_canonico: 'Una pareja necesita dos jugadores distintos.',
  inscripciones_torneo_id_pareja_id_key: 'La pareja ya está inscripta en este torneo.',
  inscripciones_torneo_id_siembra_key: 'Ya hay otra pareja con ese número de siembra.',
  partidos_cancha_sin_superposicion: 'La cancha ya está ocupada en ese horario.',
  partidos_horario_ordenado: 'El partido tiene que terminar después de empezar.',
  sets_resultado_valido: 'Un set no es válido. Se acepta 6-0 a 6-4, 7-5, 7-6 o super tie-break a 10.',
  sets_super_tiebreak_solo_tercero: 'El super tie-break solo puede ser el tercer set.',
  torneos_fechas_ordenadas: 'El torneo no puede terminar antes de empezar.',
  torneos_cupo_minimo: 'El cupo tiene que ser de al menos 2 parejas.',
  localidades_provincia_nombre_key: 'Esa localidad ya existe.',
  clubes_localidad_id_nombre_key: 'Ya existe un club con ese nombre en la localidad.',
  canchas_club_id_nombre_key: 'El club ya tiene una cancha con ese nombre.',
};

interface ErrorPg {
  codigo: string;
  mensaje: string;
}

function leerErrorPg(error: unknown): ErrorPg | null {
  const e = error as { code?: string; message?: string; meta?: { driverAdapterError?: { cause?: Record<string, unknown> } } };
  const causa = e?.meta?.driverAdapterError?.cause;
  const codigo = String(causa?.originalCode ?? e?.code ?? '');
  // Clase 23 de PostgreSQL: violaciones de integridad.
  if (!codigo.startsWith('23')) return null;
  return { codigo, mensaje: String(causa?.originalMessage ?? e?.message ?? '') };
}

@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (error instanceof HttpException) {
      if (error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        return res.status(429).json({ mensaje: 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.' });
      }
      const cuerpo = error.getResponse();
      const detalle = typeof cuerpo === 'string' ? cuerpo : (cuerpo as { message?: string | string[] }).message;
      const errores = Array.isArray(detalle) ? detalle : undefined;
      const mensaje = errores ? errores[0] : (detalle ?? error.message);
      return res.status(error.getStatus()).json({ mensaje, errores });
    }

    if ((error as { code?: string })?.code === 'P2025') {
      return res.status(HttpStatus.NOT_FOUND).json({ mensaje: 'No se encontró lo que buscabas.' });
    }

    const pg = leerErrorPg(error);
    if (pg) {
      const restriccion = /constraint "([^"]+)"/.exec(pg.mensaje)?.[1];
      // Los triggers ya levantan el error con un mensaje en castellano.
      const esDeTrigger = !restriccion && !/violates|null value/.test(pg.mensaje);
      const mensaje =
        (restriccion && MENSAJES[restriccion]) ??
        (esDeTrigger ? pg.mensaje : 'Los datos no cumplen una regla del sistema.');
      const estado = pg.codigo === '23514' || pg.codigo === '23502' ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT;
      return res.status(estado).json({ mensaje, regla: restriccion });
    }

    this.log.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ mensaje: 'Algo falló de nuestro lado. Probá de nuevo.' });
  }
}
