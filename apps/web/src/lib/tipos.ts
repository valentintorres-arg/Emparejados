// Formas de los datos que devuelve la API (apps/api).

export type Rol = "ADMIN" | "JUGADOR";
export type EstadoUsuario = "ACTIVO" | "INACTIVO" | "BLOQUEADO";
export type Genero = "MASCULINO" | "FEMENINO";
export type ManoHabil = "DERECHA" | "IZQUIERDA";
export type Posicion = "DRIVE" | "REVES";
export type EstadoPareja = "PENDIENTE" | "CONFIRMADA" | "ACTIVA" | "RECHAZADA" | "DISUELTA";
export type Rama = "MASCULINO" | "FEMENINO" | "MIXTO";
export type Formato = "ELIMINACION_DIRECTA" | "ZONAS_Y_LLAVES" | "ROUND_ROBIN";
export type EstadoTorneo = "BORRADOR" | "INSCRIPCION_ABIERTA" | "EN_CURSO" | "FINALIZADO" | "CANCELADO";
export type EstadoInscripcion = "PENDIENTE" | "APROBADA" | "EN_ESPERA" | "RECHAZADA" | "BAJA";
export type Instancia = "ZONA" | "DIECISEISAVOS" | "OCTAVOS" | "CUARTOS" | "SEMIFINAL" | "FINAL";
export type EstadoPartido = "PROGRAMADO" | "EN_JUEGO" | "FINALIZADO" | "SUSPENDIDO" | "WO";

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
}

export interface Localidad {
  id: number;
  nombre: string;
  provincia: string;
}

export interface Cancha {
  id: number;
  nombre: string;
  activa?: boolean;
}

export interface Club {
  id: number;
  nombre: string;
  direccion: string | null;
  localidad: Localidad;
  canchas: Cancha[];
}

export interface Catalogos {
  categorias: Categoria[];
  localidades: Localidad[];
  clubes: Club[];
}

export interface JugadorBasico {
  id: number;
  nombre: string;
  apellido: string;
  fotoUrl: string | null;
  genero: Genero;
  categoria: Categoria;
  club?: { nombre: string } | null;
}

export interface Yo {
  id: number;
  email: string;
  rol: Rol;
  /** Entró con una contraseña provisoria: tiene que elegir la suya antes de seguir. */
  debeCambiarPassword: boolean;
  jugador: {
    id: number;
    nombre: string;
    apellido: string;
    fotoUrl: string | null;
    categoria: Categoria;
    club: { id: number; nombre: string } | null;
  } | null;
}

export interface Jugador {
  id: number;
  usuarioId: number;
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  genero: Genero;
  telefono: string;
  manoHabil: ManoHabil;
  posicion: Posicion;
  fotoUrl: string | null;
  creadoEn: string;
  eliminadoEn: string | null;
  consentimientoAceptadoEn: string;
  categoria: Categoria;
  club: { id: number; nombre: string } | null;
  localidad: Localidad | null;
  usuario: { email: string; estado: EstadoUsuario; rol: Rol };
}

export interface ParejaBasica {
  id: number;
  estado: EstadoPareja;
  jugador1: JugadorBasico;
  jugador2: JugadorBasico;
}

export interface Pareja extends ParejaBasica {
  creadaPorId: number;
  creadaEn: string;
  confirmadaEn: string | null;
  resueltaEn: string | null;
  motivoRechazo: string | null;
}

export interface TorneoResumen {
  id: number;
  nombre: string;
  rama: Rama;
  formato: Formato;
  estado: EstadoTorneo;
  cupoMaximo: number;
  fechaInicio: string;
  fechaFin: string;
  fechaLimiteInscripcion: string;
  sede: { id: number; nombre: string; localidad: { nombre: string } };
  categoria: Categoria;
  inscriptas?: number;
}

export interface Inscripcion {
  id: number;
  estado: EstadoInscripcion;
  siembra: number | null;
  zonaId: number | null;
  torneoId: number;
  creadaEn: string;
  motivoRechazo: string | null;
  pareja: ParejaBasica;
}

export interface SetJugado {
  numero: number;
  gamesP1: number;
  gamesP2: number;
  superTiebreak: boolean;
}

export interface Partido {
  id: number;
  torneoId: number;
  numero: number;
  instancia: Instancia;
  zonaId: number | null;
  pareja1Id: number | null;
  pareja2Id: number | null;
  ganadorId: number | null;
  estado: EstadoPartido;
  inicio: string | null;
  fin: string | null;
  canchaId: number | null;
  siguientePartidoId: number | null;
  siguienteSlot: 1 | 2 | null;
  sets: SetJugado[];
  cancha: Cancha | null;
  zona: { id: number; nombre: string } | null;
  pareja1: ParejaBasica | null;
  pareja2: ParejaBasica | null;
  torneo?: { id: number; nombre: string; sede?: { nombre: string } };
}

export interface FilaPosicion {
  parejaId: number;
  jugados: number;
  ganados: number;
  perdidos: number;
  setsFavor: number;
  setsContra: number;
  gamesFavor: number;
  gamesContra: number;
  puntos: number;
  pareja: ParejaBasica;
}

export interface TorneoDetalle extends TorneoResumen {
  reglamento: string | null;
  sede: TorneoResumen["sede"] & { direccion: string | null; canchas: Cancha[] };
  zonas: { id: number; nombre: string; posiciones: FilaPosicion[] }[];
  inscripciones: Inscripcion[];
  partidos: Partido[];
}

export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  paginas: number;
}

export interface FichaJugador extends Jugador {
  parejas: (ParejaBasica & { creadaEn: string; motivoRechazo: string | null })[];
  inscripciones: { id: number; estado: EstadoInscripcion; pareja: ParejaBasica; torneo: Pick<TorneoResumen, "id" | "nombre" | "estado" | "fechaInicio" | "fechaFin"> }[];
  partidos: Partido[];
}

export interface UsuarioAdmin {
  id: number;
  email: string;
  rol: Rol;
  estado: EstadoUsuario;
  ultimoLoginEn: string | null;
  creadoEn: string;
  jugador: { id: number; nombre: string; apellido: string } | null;
}

export interface RegistroAuditoria {
  id: number;
  accion: string;
  entidad: string;
  entidadId: number | null;
  detalle: Record<string, unknown> | null;
  fecha: string;
  usuario: { email: string };
}

/** Un fallo ocurrido en el teléfono de alguien (tabla logs). */
export interface RegistroDeLog {
  id: number;
  origen: string;
  codigo: string;
  detalle: string;
  navegador: string | null;
  fecha: string;
  usuario: { email: string } | null;
}

export interface ResumenAdmin {
  parejasPorAprobar: number;
  inscripcionesPorAprobar: number;
  torneosEnCurso: number;
  torneosAbiertos: number;
  jugadores: number;
}
