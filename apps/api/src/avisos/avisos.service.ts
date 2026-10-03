import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Subscription } from 'rxjs';
import type { EstadoInscripcion } from '../generated/prisma/enums.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CambiosService, type Cambio } from './cambios.service.ts';
import { type Aviso, PushService } from './push.service.ts';

interface Destino {
  usuarioIds: number[];
  aviso: Aviso;
}

const jugador = { select: { id: true, usuarioId: true, nombre: true, apellido: true } } as const;
type Jugador = { id: number; usuarioId: number; nombre: string; apellido: string };

const integrantes = { select: { jugador1: jugador, jugador2: jugador } } as const;
const VIGENTES: EstadoInscripcion[] = ['PENDIENTE', 'APROBADA', 'EN_ESPERA'];

const nombre = (j: Jugador) => `${j.nombre} ${j.apellido}`;
const nombreDePareja = (p: { jugador1: Jugador; jugador2: Jugador }) => `${p.jugador1.apellido} / ${p.jugador2.apellido}`;
const usuariosDe = (...parejas: ({ jugador1: Jugador; jugador2: Jugador } | null | undefined)[]) =>
  parejas.flatMap((p) => (p ? [p.jugador1.usuarioId, p.jugador2.usuarioId] : []));

/** "sábado 10 de octubre, 18:30", en hora de Argentina. */
function horario(fecha: Date) {
  const opciones = { timeZone: 'America/Argentina/Buenos_Aires' } as const;
  const dia = fecha.toLocaleDateString('es-AR', { ...opciones, weekday: 'long', day: 'numeric', month: 'long' });
  const hora = fecha.toLocaleTimeString('es-AR', { ...opciones, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia}, ${hora}`;
}

/** "6-4 3-6 10-8" visto desde la otra pareja: "4-6 6-3 8-10". */
const darVuelta = (resultado: string) =>
  resultado === 'W.O.' ? resultado : resultado.split(' ').map((set) => set.split('-').reverse().join('-')).join(' ');

/**
 * Decide a quién notificar por cada cambio que registra la auditoría y con qué
 * texto. Nunca se notifica a quien hizo el cambio.
 */
@Injectable()
export class AvisosService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Avisos');
  private suscripcion: Subscription | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cambios: CambiosService,
    private readonly push: PushService,
  ) {}

  onModuleInit() {
    if (!this.push.clavePublica) return;
    this.suscripcion = this.cambios.cambios$.subscribe((cambio) => void this.notificar(cambio));
  }

  onModuleDestroy() {
    this.suscripcion?.unsubscribe();
  }

  private async notificar(cambio: Cambio) {
    try {
      const destinos = await this.destinos(cambio);
      for (const { usuarioIds, aviso } of destinos) {
        const otros = [...new Set(usuarioIds)].filter((id) => id !== cambio.usuarioId);
        await this.push.enviar(otros, aviso);
      }
    } catch (error) {
      this.log.warn(`No se pudo notificar ${cambio.entidad} ${cambio.accion}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private destinos(cambio: Cambio): Promise<Destino[]> {
    const id = cambio.entidadId;
    if (id === null) return Promise.resolve([]);
    switch (cambio.entidad) {
      case 'pareja':
        return this.dePareja(id, cambio);
      case 'inscripcion':
        return this.deInscripcion(id, cambio);
      case 'torneo':
        return this.deTorneo(id, cambio);
      case 'partido':
        return this.dePartido(id, cambio);
      default:
        return Promise.resolve([]);
    }
  }

  // ─── Parejas ───────────────────────────────────────────────────────────────

  private async dePareja(id: number, { accion }: Cambio): Promise<Destino[]> {
    const pareja = await this.prisma.pareja.findUnique({
      where: { id },
      select: { creadaPorId: true, motivoRechazo: true, ...integrantes.select },
    });
    if (!pareja) return [];
    const { jugador1, jugador2 } = pareja;
    const creador = pareja.creadaPorId === jugador1.id ? jugador1 : jugador2;
    const invitado = creador === jugador1 ? jugador2 : jugador1;
    const url = '/parejas';
    // Un aviso por integrante, nombrando al compañero.
    const aCadaUno = (armar: (yo: Jugador, otro: Jugador) => Aviso) => [
      { usuarioIds: [jugador1.usuarioId], aviso: armar(jugador1, jugador2) },
      { usuarioIds: [jugador2.usuarioId], aviso: armar(jugador2, jugador1) },
    ];

    switch (accion) {
      case 'CREAR':
        return [
          {
            usuarioIds: [invitado.usuarioId],
            aviso: { titulo: 'Te propusieron armar pareja', cuerpo: `${nombre(creador)} quiere jugar con vos. Confirmalo desde la app.`, url, etiqueta: `pareja-${id}` },
          },
        ];
      case 'CONFIRMAR':
        return [
          {
            usuarioIds: [creador.usuarioId],
            aviso: { titulo: `${invitado.nombre} confirmó la pareja`, cuerpo: 'Ahora la tiene que aprobar la organización.', url, etiqueta: `pareja-${id}` },
          },
          {
            usuarioIds: await this.administradores(),
            aviso: { titulo: 'Pareja para aprobar', cuerpo: `${nombre(jugador1)} y ${nombre(jugador2)}.`, url: '/admin/aprobaciones' },
          },
        ];
      case 'DECLINAR':
        return aCadaUno((_, otro) => ({ titulo: 'Pareja cancelada', cuerpo: `La pareja con ${nombre(otro)} no sigue: ${pareja.motivoRechazo ?? ''}`.trim(), url, etiqueta: `pareja-${id}` }));
      case 'APROBAR':
        return aCadaUno((_, otro) => ({ titulo: '¡Pareja aprobada!', cuerpo: `Ya podés anotarte en un torneo con ${nombre(otro)}.`, url, etiqueta: `pareja-${id}` }));
      case 'RECHAZAR':
        return aCadaUno((_, otro) => ({ titulo: 'La organización rechazó la pareja', cuerpo: `Con ${nombre(otro)}. Motivo: ${pareja.motivoRechazo ?? 'sin detalle'}.`, url, etiqueta: `pareja-${id}` }));
      case 'DISOLVER':
        return aCadaUno((_, otro) => ({ titulo: 'Pareja disuelta', cuerpo: `La pareja con ${nombre(otro)} quedó disuelta.`, url, etiqueta: `pareja-${id}` }));
      default:
        return [];
    }
  }

  // ─── Inscripciones ─────────────────────────────────────────────────────────

  private async deInscripcion(id: number, { accion, usuarioId }: Cambio): Promise<Destino[]> {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      select: { motivoRechazo: true, torneo: { select: { id: true, nombre: true } }, pareja: integrantes },
    });
    if (!inscripcion) return [];
    const { torneo, pareja } = inscripcion;
    const jugadores = usuariosDe(pareja);
    const url = `/torneos/${torneo.id}`;
    const etiqueta = `inscripcion-${id}`;

    switch (accion) {
      case 'INSCRIBIR': {
        // Si la anotó la organización, enseguida llega APROBAR o LISTA_DE_ESPERA: ese es el aviso.
        if (await this.esAdministrador(usuarioId)) return [];
        return [
          {
            usuarioIds: await this.administradores(),
            aviso: { titulo: 'Inscripción para aprobar', cuerpo: `${nombreDePareja(pareja)} en ${torneo.nombre}.`, url: '/admin/aprobaciones' },
          },
          { usuarioIds: jugadores, aviso: { titulo: 'Te anotaron en un torneo', cuerpo: `Tu compañero pidió lugar en ${torneo.nombre}. Falta que lo apruebe la organización.`, url, etiqueta } },
        ];
      }
      case 'APROBAR':
      case 'PROMOVER_DE_ESPERA':
        return [{ usuarioIds: jugadores, aviso: { titulo: 'Inscripción aprobada', cuerpo: `Ya están anotados en ${torneo.nombre}.`, url, etiqueta } }];
      case 'LISTA_DE_ESPERA':
        return [{ usuarioIds: jugadores, aviso: { titulo: 'Quedaron en lista de espera', cuerpo: `El cupo de ${torneo.nombre} está completo. Si se libera un lugar, entran.`, url, etiqueta } }];
      case 'RECHAZAR':
        return [{ usuarioIds: jugadores, aviso: { titulo: 'Inscripción rechazada', cuerpo: `${torneo.nombre}. Motivo: ${inscripcion.motivoRechazo ?? 'sin detalle'}.`, url, etiqueta } }];
      case 'BAJA':
        return [{ usuarioIds: jugadores, aviso: { titulo: 'Inscripción dada de baja', cuerpo: `La pareja ya no está anotada en ${torneo.nombre}.`, url, etiqueta } }];
      default:
        return [];
    }
  }

  // ─── Torneos ───────────────────────────────────────────────────────────────

  private async deTorneo(id: number, { accion, detalle }: Cambio): Promise<Destino[]> {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id },
      select: { nombre: true, rama: true, categoria: { select: { orden: true, nombre: true } } },
    });
    if (!torneo) return [];
    const url = `/torneos/${id}`;
    const inscriptos = (estados: EstadoInscripcion[]) => this.jugadoresInscriptos(id, estados);
    const a = (detalle as { a?: string } | null)?.a;

    switch (accion) {
      case 'CAMBIAR_ESTADO':
        if (a === 'INSCRIPCION_ABIERTA') {
          return [
            {
              usuarioIds: await this.habilitadosPara(torneo),
              aviso: { titulo: 'Nuevo torneo con inscripción abierta', cuerpo: `${torneo.nombre}, ${torneo.categoria.nombre}. Anotate con tu pareja.`, url },
            },
          ];
        }
        if (a === 'CANCELADO') {
          return [{ usuarioIds: await inscriptos(VIGENTES), aviso: { titulo: 'Torneo cancelado', cuerpo: `La organización canceló ${torneo.nombre}.`, url } }];
        }
        return [];
      case 'SORTEAR':
        return [{ usuarioIds: await inscriptos(['APROBADA']), aviso: { titulo: 'Ya está el fixture', cuerpo: `Mirá contra quién jugás en ${torneo.nombre}.`, url } }];
      case 'GENERAR_LLAVES':
        return [{ usuarioIds: await inscriptos(['APROBADA']), aviso: { titulo: 'Se armaron las llaves', cuerpo: `Terminaron las zonas de ${torneo.nombre}. Mirá cómo sigue.`, url } }];
      case 'PROGRAMAR_AUTOMATICO':
        return [{ usuarioIds: await inscriptos(['APROBADA']), aviso: { titulo: 'Hay horarios nuevos', cuerpo: `Se armó la agenda de ${torneo.nombre}. Fijate cuándo jugás.`, url: '/partidos' } }];
      default:
        return [];
    }
  }

  // ─── Partidos ──────────────────────────────────────────────────────────────

  private async dePartido(id: number, { accion, detalle }: Cambio): Promise<Destino[]> {
    const partido = await this.prisma.partido.findUnique({
      where: { id },
      select: {
        inicio: true,
        cancha: { select: { nombre: true } },
        torneo: { select: { nombre: true } },
        pareja1: { select: { parejaId: true, pareja: integrantes } },
        pareja2: { select: { parejaId: true, pareja: integrantes } },
      },
    });
    if (!partido) return [];
    const p1 = partido.pareja1?.pareja;
    const p2 = partido.pareja2?.pareja;
    const todos = usuariosDe(p1, p2);
    const url = '/partidos';
    const etiqueta = `partido-${id}`;
    const { de, a, resultado, ganadorId } = (detalle ?? {}) as { de?: string; a?: string; resultado?: string; ganadorId?: number };

    switch (accion) {
      case 'PROGRAMAR':
        return [
          {
            usuarioIds: todos,
            aviso: partido.inicio
              ? { titulo: 'Tenés partido', cuerpo: `${partido.torneo.nombre}: ${horario(partido.inicio)}${partido.cancha ? `, ${partido.cancha.nombre}` : ''}.`, url, etiqueta }
              : { titulo: 'Tu partido quedó sin horario', cuerpo: `${partido.torneo.nombre}. Te avisamos cuando tenga día y cancha.`, url, etiqueta },
          },
        ];
      case 'CAMBIAR_ESTADO':
        if (a === 'SUSPENDIDO') return [{ usuarioIds: todos, aviso: { titulo: 'Partido suspendido', cuerpo: `${partido.torneo.nombre}. La organización avisa cuándo se reanuda.`, url, etiqueta } }];
        if (de === 'SUSPENDIDO') return [{ usuarioIds: todos, aviso: { titulo: 'Se reanuda tu partido', cuerpo: `${partido.torneo.nombre}.`, url, etiqueta } }];
        return [];
      case 'CARGAR_RESULTADO':
      case 'CORREGIR_RESULTADO': {
        if (!p1 || !p2 || !resultado) return [];
        const titulo = accion === 'CARGAR_RESULTADO' ? 'Resultado cargado' : 'Resultado corregido';
        // Cada pareja lee el marcador desde su lado.
        const paraPareja = (propia: typeof p1, rival: typeof p1, parejaId: number | undefined, marcador: string): Destino => ({
          usuarioIds: usuariosDe(propia),
          aviso: { titulo, cuerpo: `${parejaId === ganadorId ? 'Ganaron' : 'Perdieron'} ${marcador} contra ${nombreDePareja(rival)}.`, url: '/partidos', etiqueta },
        });
        return [
          paraPareja(p1, p2, partido.pareja1?.parejaId, resultado),
          paraPareja(p2, p1, partido.pareja2?.parejaId, darVuelta(resultado)),
        ];
      }
      default:
        return [];
    }
  }

  // ─── Consultas ─────────────────────────────────────────────────────────────

  private async administradores() {
    const admins = await this.prisma.usuario.findMany({ where: { rol: 'ADMIN', estado: 'ACTIVO' }, select: { id: true } });
    return admins.map((u) => u.id);
  }

  private async esAdministrador(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { rol: true } });
    return usuario?.rol === 'ADMIN';
  }

  private async jugadoresInscriptos(torneoId: number, estados: EstadoInscripcion[]) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { torneoId, estado: { in: estados } },
      select: { pareja: integrantes },
    });
    return inscripciones.flatMap((i) => usuariosDe(i.pareja));
  }

  /** Jugadores que pueden anotarse: de esa categoría o una inferior, y de la rama del torneo. */
  private async habilitadosPara(torneo: { rama: string; categoria: { orden: number } }) {
    const jugadores = await this.prisma.jugador.findMany({
      where: {
        eliminadoEn: null,
        categoria: { orden: { gte: torneo.categoria.orden } },
        ...(torneo.rama === 'MIXTO' ? {} : { genero: torneo.rama as 'MASCULINO' | 'FEMENINO' }),
      },
      select: { usuarioId: true },
    });
    return jugadores.map((j) => j.usuarioId);
  }
}
