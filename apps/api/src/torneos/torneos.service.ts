import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.ts';
import { aplanarPartido, parejaConJugadores, partidoCompleto } from '../comun/selecciones.ts';
import { esAdmin, type Sesion } from '../comun/sesion.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import type { EstadoInscripcion, EstadoTorneo } from '../generated/prisma/enums.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import {
  calcularPosiciones,
  compararPosiciones,
  fechasTodosContraTodos,
  MAXIMO_EN_LLAVE,
  mezclar,
  nombreDeZona,
  planearLlave,
  type Posicion,
  repartirEnZonas,
  sembrarClasificadas,
} from './fixture.ts';
import type { PagoDto, TorneoDto } from './torneo.dto.ts';

const TRANSICIONES: Record<EstadoTorneo, EstadoTorneo[]> = {
  BORRADOR: ['INSCRIPCION_ABIERTA', 'CANCELADO'],
  INSCRIPCION_ABIERTA: ['BORRADOR', 'CANCELADO'],
  EN_CURSO: ['FINALIZADO', 'CANCELADO'],
  FINALIZADO: [],
  CANCELADO: [],
};

const VIGENTES: EstadoInscripcion[] = ['PENDIENTE', 'APROBADA', 'EN_ESPERA'];

const torneoResumen = {
  id: true,
  nombre: true,
  rama: true,
  formato: true,
  estado: true,
  cupoMaximo: true,
  fechaInicio: true,
  fechaFin: true,
  fechaLimiteInscripcion: true,
  sede: { select: { id: true, nombre: true, localidad: { select: { nombre: true } } } },
  categoria: { select: { id: true, nombre: true, orden: true } },
} satisfies Prisma.TorneoSelect;

const inscripcionDetalle = {
  id: true,
  estado: true,
  siembra: true,
  zonaId: true,
  torneoId: true,
  creadaEn: true,
  motivoRechazo: true,
  pareja: { select: parejaConJugadores },
} satisfies Prisma.InscripcionSelect;

// Los pagos solo viajan en las respuestas para la organización.
const inscripcionConPagos = {
  ...inscripcionDetalle,
  pagos: { select: { jugadorId: true, registradoEn: true } },
} satisfies Prisma.InscripcionSelect;

type Tx = Prisma.TransactionClient;

@Injectable()
export class TorneosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ─── Torneos ───────────────────────────────────────────────────────────────

  async listar(sesion?: Sesion) {
    const torneos = await this.prisma.torneo.findMany({
      // Los borradores solo los ve la organización.
      where: esAdmin(sesion) ? {} : { estado: { not: 'BORRADOR' } },
      select: { ...torneoResumen, _count: { select: { inscripciones: { where: { estado: 'APROBADA' } } } } },
      orderBy: { fechaInicio: 'desc' },
    });
    return torneos.map(({ _count, ...torneo }) => ({ ...torneo, inscriptas: _count.inscripciones }));
  }

  /** Todo lo que muestra la página pública del torneo: inscriptas, zonas con posiciones y fixture. */
  async detalle(id: number, sesion?: Sesion) {
    const torneo = await this.prisma.torneo.findUnique({
      where: { id },
      select: {
        ...torneoResumen,
        reglamento: true,
        sede: {
          select: {
            id: true,
            nombre: true,
            direccion: true,
            localidad: { select: { nombre: true } },
            canchas: { where: { activa: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } },
          },
        },
        zonas: { select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } },
        inscripciones: {
          where: esAdmin(sesion) ? {} : { estado: 'APROBADA' },
          select: esAdmin(sesion) ? inscripcionConPagos : inscripcionDetalle,
          orderBy: [{ siembra: { sort: 'asc', nulls: 'last' } }, { creadaEn: 'asc' }],
        },
        partidos: { include: partidoCompleto, orderBy: { numero: 'asc' } },
      },
    });
    if (!torneo || (torneo.estado === 'BORRADOR' && !esAdmin(sesion))) {
      throw new NotFoundException('No encontramos ese torneo.');
    }

    const parejas = new Map(torneo.inscripciones.map((i) => [i.pareja.id, i.pareja]));
    const zonas = torneo.zonas.map((zona) => {
      const integrantes = torneo.inscripciones.filter((i) => i.zonaId === zona.id).map((i) => i.pareja.id);
      const jugados = torneo.partidos.filter((p) => p.zonaId === zona.id);
      return {
        ...zona,
        posiciones: calcularPosiciones(integrantes, jugados).map((fila) => ({ ...fila, pareja: parejas.get(fila.parejaId)! })),
      };
    });

    return { ...torneo, zonas, partidos: torneo.partidos.map(aplanarPartido) };
  }

  async crear(dto: TorneoDto, sesion: Sesion) {
    return this.prisma.$transaction(async (tx) => {
      const torneo = await tx.torneo.create({
        data: { ...this.datos(dto), creadoPorId: sesion.usuarioId },
        select: torneoResumen,
      });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'CREAR', 'torneo', torneo.id, { nombre: torneo.nombre });
      return torneo;
    });
  }

  async actualizar(id: number, dto: TorneoDto, sesion: Sesion) {
    const actual = await this.buscar(id);
    if (actual.estado === 'FINALIZADO' || actual.estado === 'CANCELADO') {
      throw new ConflictException('Un torneo finalizado o cancelado ya no se puede editar.');
    }
    const yaSorteado = actual.estado === 'EN_CURSO';
    if (yaSorteado && (dto.formato !== actual.formato || dto.categoriaId !== actual.categoriaId || dto.rama !== actual.rama)) {
      throw new ConflictException('Con el fixture ya armado no se puede cambiar el formato, la categoría ni la rama.');
    }
    const aprobadas = await this.prisma.inscripcion.count({ where: { torneoId: id, estado: 'APROBADA' } });
    if (dto.cupoMaximo < aprobadas) {
      throw new ConflictException(`Ya hay ${aprobadas} parejas aprobadas: el cupo no puede ser menor.`);
    }
    return this.prisma.$transaction(async (tx) => {
      const torneo = await tx.torneo.update({ where: { id }, data: this.datos(dto), select: torneoResumen });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'EDITAR', 'torneo', id);
      return torneo;
    });
  }

  /** Solo se borra un borrador vacío; cualquier otro torneo se cancela para conservar el historial. */
  async eliminar(id: number, sesion: Sesion) {
    const torneo = await this.buscar(id);
    if (torneo.estado !== 'BORRADOR') throw new ConflictException('Solo se puede borrar un torneo en borrador. Podés cancelarlo.');
    const inscripciones = await this.prisma.inscripcion.count({ where: { torneoId: id } });
    if (inscripciones > 0) throw new ConflictException('El torneo ya tiene inscripciones. Podés cancelarlo.');
    await this.prisma.$transaction(async (tx) => {
      await tx.torneo.delete({ where: { id } });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'BORRAR', 'torneo', id, { nombre: torneo.nombre });
    });
    return { id };
  }

  async cambiarEstado(id: number, estado: EstadoTorneo, sesion: Sesion) {
    const torneo = await this.buscar(id);
    if (!TRANSICIONES[torneo.estado].includes(estado)) {
      throw new ConflictException(
        estado === 'EN_CURSO'
          ? 'El torneo pasa a "en curso" cuando se sortea el fixture.'
          : 'El torneo no puede pasar a ese estado desde el actual.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.torneo.update({ where: { id }, data: { estado }, select: torneoResumen });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'CAMBIAR_ESTADO', 'torneo', id, { de: torneo.estado, a: estado });
      return actualizado;
    });
  }

  // ─── Inscripciones ─────────────────────────────────────────────────────────

  async inscribir(torneoId: number, parejaId: number, sesion: Sesion) {
    const [torneo, pareja] = await Promise.all([
      this.prisma.torneo.findUnique({ where: { id: torneoId }, include: { categoria: true } }),
      this.prisma.pareja.findUnique({
        where: { id: parejaId },
        include: { jugador1: { include: { categoria: true } }, jugador2: { include: { categoria: true } } },
      }),
    ]);
    if (!torneo) throw new NotFoundException('No encontramos ese torneo.');
    if (!pareja) throw new NotFoundException('No encontramos esa pareja.');

    const admin = esAdmin(sesion);
    if (!admin && sesion.jugadorId !== pareja.jugador1Id && sesion.jugadorId !== pareja.jugador2Id) {
      throw new ForbiddenException('Solo podés inscribir una pareja de la que sos parte.');
    }
    if (torneo.estado !== 'INSCRIPCION_ABIERTA') throw new ConflictException('La inscripción a este torneo no está abierta.');
    if (!admin && torneo.fechaLimiteInscripcion < new Date()) {
      throw new ConflictException('Ya pasó la fecha límite de inscripción.');
    }
    if (pareja.estado !== 'ACTIVA') throw new ConflictException('La pareja tiene que estar aprobada por la organización para inscribirse.');

    const jugadores = [pareja.jugador1, pareja.jugador2];
    // orden 1 = categoría más alta: nadie juega un torneo de categoría inferior a la suya.
    const fueraDeCategoria = jugadores.find((j) => j.categoria.orden < torneo.categoria.orden);
    if (fueraDeCategoria) {
      throw new ConflictException(
        `${fueraDeCategoria.nombre} ${fueraDeCategoria.apellido} es de ${fueraDeCategoria.categoria.nombre} y este torneo es de ${torneo.categoria.nombre}.`,
      );
    }
    const generos = jugadores.map((j) => j.genero);
    const ramaValida =
      torneo.rama === 'MIXTO' ? generos[0] !== generos[1] : generos.every((g) => g === torneo.rama);
    if (!ramaValida) {
      throw new ConflictException(
        torneo.rama === 'MIXTO'
          ? 'En un torneo mixto la pareja tiene que ser de un jugador y una jugadora.'
          : `Este torneo es de rama ${torneo.rama.toLowerCase()}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Una pareja rechazada o dada de baja se vuelve a anotar sobre la misma fila.
      const inscripcion = await tx.inscripcion.upsert({
        where: { torneoId_parejaId: { torneoId, parejaId } },
        create: { torneoId, parejaId, solicitadaPorId: sesion.usuarioId },
        update: { estado: 'PENDIENTE', motivoRechazo: null, resueltaPorId: null, resueltaEn: null },
        select: { id: true, estado: true },
      });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'INSCRIBIR', 'inscripcion', inscripcion.id, { torneoId, parejaId });
      // Si la anota la organización, no hace falta un segundo paso de aprobación.
      if (admin) return this.resolver(tx, inscripcion.id, torneo.cupoMaximo, sesion);
      return tx.inscripcion.findUniqueOrThrow({ where: { id: inscripcion.id }, select: inscripcionDetalle });
    });
  }

  /** Bandeja de la organización: inscripciones de todos los torneos en un estado dado. */
  listarInscripciones(estado: EstadoInscripcion) {
    return this.prisma.inscripcion.findMany({
      where: { estado, torneo: { estado: 'INSCRIPCION_ABIERTA' } },
      select: { ...inscripcionConPagos, torneo: { select: { id: true, nombre: true, cupoMaximo: true } } },
      orderBy: { creadaEn: 'asc' },
    });
  }

  misInscripciones(jugadorId: number) {
    return this.prisma.inscripcion.findMany({
      where: { pareja: { OR: [{ jugador1Id: jugadorId }, { jugador2Id: jugadorId }] } },
      select: { ...inscripcionDetalle, torneo: { select: torneoResumen } },
      orderBy: { creadaEn: 'desc' },
    });
  }

  async aprobarInscripcion(id: number, sesion: Sesion) {
    const inscripcion = await this.buscarInscripcion(id);
    if (inscripcion.estado !== 'PENDIENTE' && inscripcion.estado !== 'EN_ESPERA') {
      throw new ConflictException('Esta inscripción ya fue resuelta.');
    }
    this.exigirInscripcionAbierta(inscripcion.torneo.estado);
    return this.prisma.$transaction((tx) => this.resolver(tx, id, inscripcion.torneo.cupoMaximo, sesion));
  }

  async rechazarInscripcion(id: number, motivo: string, sesion: Sesion) {
    const inscripcion = await this.buscarInscripcion(id);
    if (!VIGENTES.includes(inscripcion.estado)) throw new ConflictException('Esta inscripción ya fue resuelta.');
    this.exigirInscripcionAbierta(inscripcion.torneo.estado);
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.inscripcion.update({
        where: { id },
        data: { estado: 'RECHAZADA', motivoRechazo: motivo, resueltaPorId: sesion.usuarioId, resueltaEn: new Date() },
        select: inscripcionDetalle,
      });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'RECHAZAR', 'inscripcion', id, { motivo });
      if (inscripcion.estado === 'APROBADA') await this.promoverEnEspera(tx, inscripcion.torneoId, sesion);
      return actualizada;
    });
  }

  /** La pareja se baja del torneo. Si ocupaba un lugar, entra la primera de la lista de espera. */
  async darDeBajaInscripcion(id: number, sesion: Sesion) {
    const inscripcion = await this.buscarInscripcion(id);
    const integrante = sesion.jugadorId === inscripcion.pareja.jugador1Id || sesion.jugadorId === inscripcion.pareja.jugador2Id;
    if (!esAdmin(sesion) && !integrante) throw new ForbiddenException('No sos parte de esta pareja.');
    if (!VIGENTES.includes(inscripcion.estado)) throw new ConflictException('Esta inscripción ya no está vigente.');
    if (inscripcion.torneo.estado !== 'INSCRIPCION_ABIERTA') {
      throw new ConflictException('Con el torneo en curso no se da de baja la inscripción: cargá W.O. en los partidos que falten.');
    }
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.inscripcion.update({ where: { id }, data: { estado: 'BAJA', siembra: null }, select: inscripcionDetalle });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'BAJA', 'inscripcion', id);
      if (inscripcion.estado === 'APROBADA') await this.promoverEnEspera(tx, inscripcion.torneoId, sesion);
      return actualizada;
    });
  }

  async sembrar(id: number, siembra: number | null, sesion: Sesion) {
    const inscripcion = await this.buscarInscripcion(id);
    if (inscripcion.estado !== 'APROBADA') throw new ConflictException('Solo se siembran parejas aprobadas.');
    this.exigirInscripcionAbierta(inscripcion.torneo.estado);
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.inscripcion.update({ where: { id }, data: { siembra }, select: inscripcionDetalle });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'SEMBRAR', 'inscripcion', id, { siembra });
      return actualizada;
    });
  }

  /**
   * La organización anota quién pagó la inscripción, antes o después de aprobarla
   * y también con el torneo ya empezado. Sin jugador, vale para toda la pareja.
   */
  async registrarPago(id: number, dto: PagoDto, sesion: Sesion) {
    const inscripcion = await this.buscarInscripcion(id);
    const integrantes = [inscripcion.pareja.jugador1Id, inscripcion.pareja.jugador2Id];
    if (dto.jugadorId !== undefined && !integrantes.includes(dto.jugadorId)) {
      throw new BadRequestException('Ese jugador no es parte de la pareja inscripta.');
    }
    // Sacar un pago mal anotado se puede siempre; anotar uno, solo si la inscripción sigue en pie.
    if (dto.pago && !VIGENTES.includes(inscripcion.estado)) {
      throw new ConflictException('Esta inscripción ya no está vigente: no se le anotan pagos.');
    }
    const jugadorIds = dto.jugadorId !== undefined ? [dto.jugadorId] : integrantes;
    return this.prisma.$transaction(async (tx) => {
      const { count } = dto.pago
        ? await tx.pagoInscripcion.createMany({
            data: jugadorIds.map((jugadorId) => ({ inscripcionId: id, jugadorId, registradoPorId: sesion.usuarioId })),
            skipDuplicates: true,
          })
        : await tx.pagoInscripcion.deleteMany({ where: { inscripcionId: id, jugadorId: { in: jugadorIds } } });
      if (count > 0) {
        await this.auditoria.registrar(tx, sesion.usuarioId, dto.pago ? 'REGISTRAR_PAGO' : 'QUITAR_PAGO', 'inscripcion', id, { jugadorIds });
      }
      return tx.inscripcion.findUniqueOrThrow({ where: { id }, select: inscripcionConPagos });
    });
  }

  // ─── Sorteo y fixture ──────────────────────────────────────────────────────

  /** Cierra la inscripción, sortea y genera el fixture según el formato. */
  async sortear(torneoId: number, sesion: Sesion) {
    const torneo = await this.buscar(torneoId);
    this.exigirInscripcionAbierta(torneo.estado);

    const aprobadas = await this.prisma.inscripcion.findMany({
      where: { torneoId, estado: 'APROBADA' },
      select: { id: true, parejaId: true, siembra: true },
      orderBy: { siembra: 'asc' },
    });
    if (aprobadas.length < 2) throw new ConflictException('Hacen falta al menos 2 parejas aprobadas para sortear.');
    if (torneo.formato === 'ELIMINACION_DIRECTA' && aprobadas.length > MAXIMO_EN_LLAVE) {
      throw new ConflictException(`Una llave admite hasta ${MAXIMO_EN_LLAVE} parejas.`);
    }

    // Primero las cabezas de serie en su orden; el resto, al azar.
    const sembradas = [
      ...aprobadas.filter((i) => i.siembra !== null),
      ...mezclar(aprobadas.filter((i) => i.siembra === null)),
    ];

    await this.prisma.$transaction(async (tx) => {
      if (torneo.formato === 'ELIMINACION_DIRECTA') {
        await this.crearLlave(tx, torneoId, sembradas.map((i) => i.parejaId), 1);
      } else {
        const zonas = torneo.formato === 'ROUND_ROBIN' ? [sembradas] : repartirEnZonas(sembradas);
        await this.crearZonas(tx, torneoId, zonas, torneo.formato === 'ROUND_ROBIN');
      }
      await tx.torneo.update({ where: { id: torneoId }, data: { estado: 'EN_CURSO' } });
      await this.auditoria.registrar(tx, sesion.usuarioId, 'SORTEAR', 'torneo', torneoId, { parejas: aprobadas.length });
    });
    return this.detalle(torneoId, sesion);
  }

  /** Zonas terminadas: los dos primeros de cada una pasan a la llave final. */
  async generarLlaves(torneoId: number, sesion: Sesion) {
    const torneo = await this.buscar(torneoId);
    if (torneo.formato !== 'ZONAS_Y_LLAVES' || torneo.estado !== 'EN_CURSO') {
      throw new ConflictException('Las llaves se generan en torneos de zonas que están en curso.');
    }
    const [zonas, partidos] = await Promise.all([
      this.prisma.zona.findMany({
        where: { torneoId },
        orderBy: { nombre: 'asc' },
        select: { id: true, inscripciones: { where: { estado: 'APROBADA' }, select: { parejaId: true } } },
      }),
      this.prisma.partido.findMany({ where: { torneoId }, include: { sets: true } }),
    ]);
    if (partidos.some((p) => p.instancia !== 'ZONA')) throw new ConflictException('Las llaves de este torneo ya están generadas.');
    if (partidos.some((p) => p.ganadorId === null)) {
      throw new ConflictException('Todavía quedan partidos de zona sin resultado.');
    }

    const primeros: (Posicion & { zonaId: number })[] = [];
    const segundos: (Posicion & { zonaId: number })[] = [];
    for (const zona of zonas) {
      const tabla = calcularPosiciones(
        zona.inscripciones.map((i) => i.parejaId),
        partidos.filter((p) => p.zonaId === zona.id),
      );
      if (tabla[0]) primeros.push({ ...tabla[0], zonaId: zona.id });
      if (tabla[1]) segundos.push({ ...tabla[1], zonaId: zona.id });
    }
    primeros.sort(compararPosiciones);
    segundos.sort(compararPosiciones);
    const clasificadas = sembrarClasificadas(primeros, segundos);

    await this.prisma.$transaction(async (tx) => {
      const ultimo = Math.max(...partidos.map((p) => p.numero));
      await this.crearLlave(tx, torneoId, clasificadas, ultimo + 1);
      await this.auditoria.registrar(tx, sesion.usuarioId, 'GENERAR_LLAVES', 'torneo', torneoId, { clasificadas: clasificadas.length });
    });
    return this.detalle(torneoId, sesion);
  }

  private async crearZonas(tx: Tx, torneoId: number, zonas: { id: number; parejaId: number }[][], unica: boolean) {
    const fechasPorZona: { zonaId: number; fechas: [number, number][][] }[] = [];
    for (const [indice, integrantes] of zonas.entries()) {
      const zona = await tx.zona.create({ data: { torneoId, nombre: unica ? 'Única' : nombreDeZona(indice) } });
      await tx.inscripcion.updateMany({
        where: { id: { in: integrantes.map((i) => i.id) } },
        data: { zonaId: zona.id },
      });
      fechasPorZona.push({ zonaId: zona.id, fechas: fechasTodosContraTodos(integrantes.map((i) => i.parejaId)) });
    }

    // Se numera por fecha y no por zona: así el orden de juego alterna las zonas.
    const partidos: Prisma.PartidoCreateManyInput[] = [];
    const totalFechas = Math.max(...fechasPorZona.map((z) => z.fechas.length));
    for (let fecha = 0; fecha < totalFechas; fecha++) {
      for (const { zonaId, fechas } of fechasPorZona) {
        for (const [pareja1Id, pareja2Id] of fechas[fecha] ?? []) {
          partidos.push({ torneoId, numero: partidos.length + 1, instancia: 'ZONA', zonaId, pareja1Id, pareja2Id });
        }
      }
    }
    await tx.partido.createMany({ data: partidos });
  }

  private async crearLlave(tx: Tx, torneoId: number, sembradas: number[], primerNumero: number) {
    const plan = planearLlave(sembradas);
    const numeros = new Map(plan.map((p, i) => [`${p.ronda}-${p.indice}`, primerNumero + i]));
    const ids = new Map<string, number>();
    // De la final hacia atrás: cada partido necesita el id del siguiente.
    for (const partido of [...plan].reverse()) {
      const clave = `${partido.ronda}-${partido.indice}`;
      const creado = await tx.partido.create({
        data: {
          torneoId,
          numero: numeros.get(clave)!,
          instancia: partido.instancia,
          pareja1Id: partido.pareja1Id,
          pareja2Id: partido.pareja2Id,
          siguientePartidoId: partido.siguiente ? ids.get(`${partido.siguiente.ronda}-${partido.siguiente.indice}`)! : null,
          siguienteSlot: partido.siguiente?.slot ?? null,
        },
        select: { id: true },
      });
      ids.set(clave, creado.id);
    }
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  /** Aprueba si hay lugar; si el cupo está completo, la pareja queda en lista de espera. */
  private async resolver(tx: Tx, inscripcionId: number, cupoMaximo: number, sesion: Sesion) {
    const actual = await tx.inscripcion.findUniqueOrThrow({ where: { id: inscripcionId }, select: { torneoId: true } });
    // Mismo bloqueo que toma el trigger: el conteo y la aprobación quedan en serie por torneo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inscripciones'), ${actual.torneoId}::int)`;
    const aprobadas = await tx.inscripcion.count({ where: { torneoId: actual.torneoId, estado: 'APROBADA' } });
    const estado: EstadoInscripcion = aprobadas < cupoMaximo ? 'APROBADA' : 'EN_ESPERA';
    const inscripcion = await tx.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado, resueltaPorId: sesion.usuarioId, resueltaEn: new Date() },
      select: inscripcionDetalle,
    });
    await this.auditoria.registrar(tx, sesion.usuarioId, estado === 'APROBADA' ? 'APROBAR' : 'LISTA_DE_ESPERA', 'inscripcion', inscripcionId);
    return inscripcion;
  }

  private async promoverEnEspera(tx: Tx, torneoId: number, sesion: Sesion) {
    const siguiente = await tx.inscripcion.findFirst({
      where: { torneoId, estado: 'EN_ESPERA' },
      orderBy: { creadaEn: 'asc' },
      select: { id: true },
    });
    if (!siguiente) return;
    await tx.inscripcion.update({ where: { id: siguiente.id }, data: { estado: 'APROBADA' } });
    await this.auditoria.registrar(tx, sesion.usuarioId, 'PROMOVER_DE_ESPERA', 'inscripcion', siguiente.id);
  }

  private async buscar(id: number) {
    const torneo = await this.prisma.torneo.findUnique({ where: { id } });
    if (!torneo) throw new NotFoundException('No encontramos ese torneo.');
    return torneo;
  }

  private async buscarInscripcion(id: number) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: {
        torneo: { select: { estado: true, cupoMaximo: true } },
        pareja: { select: { jugador1Id: true, jugador2Id: true } },
      },
    });
    if (!inscripcion) throw new NotFoundException('No encontramos esa inscripción.');
    return inscripcion;
  }

  private exigirInscripcionAbierta(estado: EstadoTorneo) {
    if (estado !== 'INSCRIPCION_ABIERTA') {
      throw new ConflictException('Esto solo se puede hacer mientras la inscripción del torneo está abierta.');
    }
  }

  private datos(dto: TorneoDto) {
    if (dto.formato === 'ELIMINACION_DIRECTA' && dto.cupoMaximo > MAXIMO_EN_LLAVE) {
      throw new BadRequestException(`En eliminación directa el cupo máximo es de ${MAXIMO_EN_LLAVE} parejas.`);
    }
    return {
      nombre: dto.nombre,
      sedeId: dto.sedeId,
      categoriaId: dto.categoriaId,
      rama: dto.rama,
      formato: dto.formato,
      cupoMaximo: dto.cupoMaximo,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: new Date(dto.fechaFin),
      fechaLimiteInscripcion: new Date(dto.fechaLimiteInscripcion),
      reglamento: dto.reglamento?.trim() || null,
    };
  }
}
