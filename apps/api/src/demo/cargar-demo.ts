import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomInt } from 'node:crypto';
import { generarToken, hashearPassword } from '../comun/password.ts';
import type { Sesion } from '../comun/sesion.ts';
import type { FormatoTorneo, Genero, Rama } from '../generated/prisma/enums.ts';
import { VERSION_CONSENTIMIENTO } from '../jugadores/jugadores.service.ts';
import type { SetDto } from '../partidos/partido.dto.ts';
import { PartidosService } from '../partidos/partidos.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { TorneosService } from '../torneos/torneos.service.ts';

// Carga datos de ejemplo para recorrer la app: jugadores, parejas en todos los
// estados y torneos finalizado, en curso, con inscripción abierta y en borrador.
// Usa los mismos servicios que la API, así los datos cumplen todas las reglas.
//
//   npm run db:demo                 (base vacía)
//   npm run db:demo -- --reiniciar  (BORRA TODO y vuelve a cargar)

export const PASSWORD_DEMO = 'jugador1234';
const EMAIL_JUGADOR_DEMO = 'jugador@emparejados.test';

const reiniciar = process.argv.includes('--reiniciar');
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--forzar')) {
  throw new Error('La carga de ejemplo no corre en producción (agregá --forzar si realmente la querés).');
}

type Persona = [nombre: string, apellido: string];

const QUINTA: Persona[] = [
  ['Facundo', 'Ríos'], ['Ignacio', 'Paz'], ['Lautaro', 'Benítez'], ['Nicolás', 'Herrera'],
  ['Santiago', 'Molina'], ['Julián', 'Castro'], ['Ramiro', 'Vega'], ['Emiliano', 'Sosa'],
];
const SEXTA: Persona[] = [
  ['Bruno', 'Acosta'], ['Matías', 'Giménez'], ['Tomás', 'Ferreyra'], ['Agustín', 'Luna'],
  ['Franco', 'Medina'], ['Gonzalo', 'Ibáñez'], ['Lucas', 'Cabrera'], ['Joaquín', 'Rojas'],
  ['Federico', 'Suárez'], ['Pablo', 'Navarro'], ['Diego', 'Ortiz'], ['Maximiliano', 'Peralta'],
  ['Sebastián', 'Godoy'], ['Leandro', 'Vera'], ['Cristian', 'Bustos'], ['Hernán', 'Quiroga'],
];
const SEPTIMA_VARONES: Persona[] = [
  ['Marcos', 'Villalba'], ['Ezequiel', 'Ponce'], ['Damián', 'Correa'], ['Rodrigo', 'Maidana'],
  ['Iván', 'Carrizo'], ['Gastón', 'Figueroa'], ['Esteban', 'Roldán'], ['Mariano', 'Aguirre'],
];
const SEPTIMA_MUJERES: Persona[] = [
  ['Camila', 'Domínguez'], ['Florencia', 'Ramos'], ['Valentina', 'Arias'], ['Lucía', 'Moyano'],
  ['Micaela', 'Farías'], ['Rocío', 'Leiva'], ['Julieta', 'Barrios'], ['Antonella', 'Cáceres'],
];

const sinAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Fecha y hora de Argentina (UTC-3, sin horario de verano) a `dias` de hoy. */
function fechaHora(dias: number, hora: number, minutos = 0): Date {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const base = new Date(`${hoy}T${String(hora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00-03:00`);
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
}
const soloFecha = (dias: number) => fechaHora(dias, 12).toISOString().slice(0, 10);

function resultadoAlAzar(): SetDto[] {
  const set = (ganaP1: boolean): SetDto => {
    const [ganador, perdedor] = [[6, randomInt(0, 5)], [7, 5], [7, 6]][randomInt(0, 10) < 7 ? 0 : randomInt(1, 3)];
    return ganaP1 ? { gamesP1: ganador, gamesP2: perdedor } : { gamesP1: perdedor, gamesP2: ganador };
  };
  const ganaP1 = randomInt(0, 2) === 0;
  if (randomInt(0, 3) > 0) return [set(ganaP1), set(ganaP1)];
  const superTiebreak: SetDto = ganaP1
    ? { gamesP1: 10, gamesP2: randomInt(4, 9), superTiebreak: true }
    : { gamesP1: randomInt(4, 9), gamesP2: 10, superTiebreak: true };
  return [set(ganaP1), set(!ganaP1), superTiebreak];
}

const { AppModule } = await import('../app.module.ts');
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const prisma = app.get(PrismaService);
const torneos = app.get(TorneosService);
const partidos = app.get(PartidosService);

try {
  if (reiniciar) {
    await prisma.$executeRaw`
      TRUNCATE auditoria, sets, partidos, inscripciones, zonas, torneos, parejas, qr_tokens,
               jugadores, sesiones, canchas, clubes, localidades
      RESTART IDENTITY CASCADE`;
    await prisma.usuario.deleteMany({ where: { rol: 'JUGADOR' } });
  } else if ((await prisma.jugador.count()) > 0) {
    throw new Error('La base ya tiene jugadores. Usá --reiniciar para borrar todo y cargar los datos de ejemplo.');
  }

  const adminUsuario = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' }, orderBy: { id: 'asc' } });
  if (!adminUsuario) throw new Error('No hay ningún administrador. Corré primero "npm run db:seed".');
  const admin: Sesion = { usuarioId: adminUsuario.id, rol: 'ADMIN', jugadorId: null };

  // ─── Sedes ─────────────────────────────────────────────────────────────────
  const rosario = await prisma.localidad.create({ data: { nombre: 'Rosario', provincia: 'Santa Fe' } });
  const funes = await prisma.localidad.create({ data: { nombre: 'Funes', provincia: 'Santa Fe' } });
  const crearClub = (nombre: string, direccion: string, localidadId: number, canchas: number) =>
    prisma.club.create({
      data: {
        nombre,
        direccion,
        localidadId,
        canchas: { create: Array.from({ length: canchas }, (_, i) => ({ nombre: `Cancha ${i + 1}` })) },
      },
      include: { canchas: { orderBy: { nombre: 'asc' } } },
    });
  const norte = await crearClub('Pádel Norte', 'Av. Alberdi 1250', rosario.id, 4);
  const redonda = await crearClub('La Redonda Pádel', 'Bv. Oroño 3480', rosario.id, 3);
  const clubFunes = await crearClub('Funes Pádel Club', 'Ruta 9 km 318', funes.id, 2);
  const clubes = [norte, redonda, clubFunes];

  // ─── Jugadores ─────────────────────────────────────────────────────────────
  const categorias = new Map((await prisma.categoria.findMany()).map((c) => [c.orden, c.id]));
  const passwordHash = await hashearPassword(PASSWORD_DEMO);
  let correlativo = 0;
  const crearJugadores = async (personas: Persona[], orden: number, genero: Genero) => {
    const creados: { id: number; usuarioId: number }[] = [];
    for (const [nombre, apellido] of personas) {
      correlativo++;
      const esDemo = nombre === 'Bruno' && apellido === 'Acosta';
      const email = esDemo ? EMAIL_JUGADOR_DEMO : `${sinAcentos(nombre)}.${sinAcentos(apellido)}@emparejados.test`;
      const club = clubes[correlativo % clubes.length];
      const usuario = await prisma.usuario.create({
        data: {
          email,
          passwordHash,
          jugador: {
            create: {
              nombre,
              apellido,
              dni: String(28_000_000 + correlativo * 137_911).slice(0, 8),
              fechaNacimiento: new Date(Date.UTC(1980 + (correlativo * 7) % 24, correlativo % 12, 1 + (correlativo * 5) % 27)),
              genero,
              telefono: `+549341${String(5_000_000 + correlativo * 7919).slice(0, 7)}`,
              localidadId: club.localidadId,
              clubId: club.id,
              categoriaId: categorias.get(orden)!,
              manoHabil: correlativo % 6 === 0 ? 'IZQUIERDA' : 'DERECHA',
              posicion: correlativo % 2 === 0 ? 'DRIVE' : 'REVES',
              consentimientoVersion: VERSION_CONSENTIMIENTO,
              consentimientoAceptadoEn: fechaHora(-60 + correlativo, 20),
              qrTokens: { create: { token: generarToken() } },
            },
          },
        },
        select: { id: true, jugador: { select: { id: true } } },
      });
      creados.push({ id: usuario.jugador!.id, usuarioId: usuario.id });
    }
    return creados;
  };
  const quinta = await crearJugadores(QUINTA, 5, 'MASCULINO');
  const sexta = await crearJugadores(SEXTA, 6, 'MASCULINO');
  const septimaVarones = await crearJugadores(SEPTIMA_VARONES, 7, 'MASCULINO');
  const septimaMujeres = await crearJugadores(SEPTIMA_MUJERES, 7, 'FEMENINO');
  const sesionDe = (j: { id: number; usuarioId: number }): Sesion => ({ usuarioId: j.usuarioId, rol: 'JUGADOR', jugadorId: j.id });

  // ─── Parejas ───────────────────────────────────────────────────────────────
  type Jugador = (typeof quinta)[number];
  const crearPareja = async (a: Jugador, b: Jugador, estado: 'ACTIVA' | 'CONFIRMADA' | 'PENDIENTE', dias: number) => {
    const [j1, j2] = a.id < b.id ? [a, b] : [b, a];
    const pareja = await prisma.pareja.create({
      data: {
        jugador1Id: j1.id,
        jugador2Id: j2.id,
        creadaPorId: a.id,
        estado,
        creadaEn: fechaHora(dias, 19),
        confirmadaEn: estado === 'PENDIENTE' ? null : fechaHora(dias, 21),
        resueltaPorId: estado === 'ACTIVA' ? admin.usuarioId : null,
        resueltaEn: estado === 'ACTIVA' ? fechaHora(dias + 1, 10) : null,
      },
    });
    return { id: pareja.id, integrante: a };
  };
  const enPares = <T>(lista: T[]) => Array.from({ length: lista.length / 2 }, (_, i) => [lista[i * 2], lista[i * 2 + 1]] as const);

  const parejasQuinta = [];
  for (const [a, b] of enPares(quinta)) parejasQuinta.push(await crearPareja(a, b, 'ACTIVA', -40));
  const parejasSexta = [];
  for (const [a, b] of enPares(sexta)) parejasSexta.push(await crearPareja(a, b, 'ACTIVA', -35));
  const parejasMixtas = [];
  for (let i = 0; i < 5; i++) parejasMixtas.push(await crearPareja(septimaVarones[i], septimaMujeres[i], 'ACTIVA', -12));
  // Para la bandeja del admin: una confirmada que espera aprobación.
  await crearPareja(septimaVarones[5], septimaMujeres[5], 'CONFIRMADA', -1);
  // Una que todavía espera la confirmación de la compañera.
  await crearPareja(septimaVarones[6], septimaMujeres[6], 'PENDIENTE', 0);
  // Y una invitación que el jugador de ejemplo (Bruno Acosta) tiene que confirmar.
  await crearPareja(septimaVarones[7], sexta[0], 'PENDIENTE', 0);

  // ─── Torneos ───────────────────────────────────────────────────────────────
  const crearTorneo = async (
    nombre: string, sedeId: number, orden: number, rama: Rama, formato: FormatoTorneo, cupoMaximo: number,
    inicio: number, fin: number, reglamento: string,
  ) => {
    const torneo = await torneos.crear(
      {
        nombre, sedeId, categoriaId: categorias.get(orden)!, rama, formato, cupoMaximo,
        fechaInicio: soloFecha(inicio), fechaFin: soloFecha(fin),
        fechaLimiteInscripcion: fechaHora(inicio - 2, 23).toISOString(),
        reglamento,
      },
      admin,
    );
    return torneo.id;
  };
  const reglamento =
    'Partidos al mejor de 3 sets con punto de oro. El tercer set se define por super tie-break a 10.\n' +
    'Tolerancia de 15 minutos; pasado ese tiempo se pierde por W.O.\n' +
    'Pelotas provistas por la organización.';

  const jugarPendientes = async (torneoId: number, hasta?: Date) => {
    // Vuelve a consultar en cada vuelta: al cargar un resultado se completan las llaves siguientes.
    for (;;) {
      const siguiente = await prisma.partido.findFirst({
        where: {
          torneoId, ganadorId: null, pareja1Id: { not: null }, pareja2Id: { not: null },
          ...(hasta ? { inicio: { lt: hasta } } : {}),
        },
        orderBy: { numero: 'asc' },
      });
      if (!siguiente) return;
      await partidos.cargarResultado(siguiente.id, { sets: resultadoAlAzar() }, admin);
    }
  };

  // 1. Finalizado: eliminación directa con 8 parejas de 6ª.
  const copa = await crearTorneo('Copa Primavera', redonda.id, 6, 'MASCULINO', 'ELIMINACION_DIRECTA', 8, -15, -14, reglamento);
  await torneos.cambiarEstado(copa, 'INSCRIPCION_ABIERTA', admin);
  for (const pareja of parejasSexta) await torneos.inscribir(copa, pareja.id, admin);
  await torneos.sortear(copa, admin);
  await partidos.programarAutomaticamente(
    copa,
    { desde: fechaHora(-15, 17).toISOString(), duracionMin: 90, turnosPorDia: 4, canchaIds: redonda.canchas.slice(0, 2).map((c) => c.id) },
    admin,
  );
  await jugarPendientes(copa);

  // 2. En curso: zonas y llaves con 8 parejas (5ª y 6ª). Ayer se jugó; hoy sigue.
  const aniversario = await crearTorneo('Torneo Aniversario', norte.id, 5, 'MASCULINO', 'ZONAS_Y_LLAVES', 8, -1, 2, reglamento);
  await torneos.cambiarEstado(aniversario, 'INSCRIPCION_ABIERTA', admin);
  const enAniversario = [...parejasQuinta, ...parejasSexta.slice(0, 4)];
  for (const [i, pareja] of enAniversario.entries()) {
    const inscripcion = await torneos.inscribir(aniversario, pareja.id, admin);
    if (i < 2) await torneos.sembrar(inscripcion.id, i + 1, admin);
  }
  await torneos.sortear(aniversario, admin);
  await partidos.programarAutomaticamente(
    aniversario,
    { desde: fechaHora(-1, 18).toISOString(), duracionMin: 90, turnosPorDia: 3, canchaIds: norte.canchas.slice(0, 2).map((c) => c.id) },
    admin,
  );
  await jugarPendientes(aniversario, fechaHora(0, 0));

  // 3. Inscripción abierta: mixto todos contra todos, con solicitudes por aprobar.
  const mixto = await crearTorneo('Mixto de Verano', clubFunes.id, 7, 'MIXTO', 'ROUND_ROBIN', 6, 14, 15, reglamento);
  await torneos.cambiarEstado(mixto, 'INSCRIPCION_ABIERTA', admin);
  for (const pareja of parejasMixtas.slice(0, 3)) await torneos.inscribir(mixto, pareja.id, admin);
  for (const pareja of parejasMixtas.slice(3)) await torneos.inscribir(mixto, pareja.id, sesionDe(pareja.integrante));

  // 4. Borrador: todavía no es público.
  await crearTorneo('Clausura 4ª', norte.id, 4, 'MASCULINO', 'ZONAS_Y_LLAVES', 16, 45, 48, reglamento);

  const [nJugadores, nParejas, nTorneos, nPartidos] = await Promise.all([
    prisma.jugador.count(), prisma.pareja.count(), prisma.torneo.count(), prisma.partido.count(),
  ]);
  console.log(`Datos de ejemplo cargados: ${nJugadores} jugadores, ${nParejas} parejas, ${nTorneos} torneos, ${nPartidos} partidos.`);
  console.log(`Administrador: ${adminUsuario.email}`);
  console.log(`Jugador de ejemplo: ${EMAIL_JUGADOR_DEMO} / ${PASSWORD_DEMO} (todos los jugadores usan esa contraseña)`);
} finally {
  await app.close();
}
