import type {
  EstadoInscripcion,
  EstadoPareja,
  EstadoPartido,
  EstadoTorneo,
  EstadoUsuario,
  Formato,
  Instancia,
  JugadorBasico,
  ParejaBasica,
  Rama,
} from "./tipos";

// Todo se muestra en hora de Argentina, sin importar dónde esté el dispositivo.
const ZONA = "America/Argentina/Buenos_Aires";

const fechaCorta = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const fechaLarga = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const diaYHora = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });
const soloHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });
const soloDia = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
const momento = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });

/** Fechas sin hora (inicio de torneo, nacimiento): vienen como medianoche UTC. */
export const fecha = (iso: string) => fechaLarga.format(new Date(iso));

export function rangoDeFechas(inicio: string, fin: string) {
  const a = new Date(inicio);
  const b = new Date(fin);
  if (inicio.slice(0, 10) === fin.slice(0, 10)) return fechaLarga.format(a);
  return `${fechaCorta.format(a)} al ${fechaLarga.format(b)}`;
}

export const horario = (iso: string) => diaYHora.format(new Date(iso));
export const hora = (iso: string) => soloHora.format(new Date(iso));
export const dia = (iso: string) => soloDia.format(new Date(iso));
export const fechaYHora = (iso: string) => momento.format(new Date(iso));

/** Valor para <input type="datetime-local"> en hora de Argentina. */
export function paraInputLocal(iso: string) {
  const partes = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: ZONA }).format(new Date(iso));
  return partes.replace(" ", "T");
}

/** De <input type="datetime-local"> (hora de Argentina, UTC-3 fijo) a ISO. */
export const deInputLocal = (valor: string) => new Date(`${valor}:00-03:00`).toISOString();

export const nombreCompleto = (j: { nombre: string; apellido: string }) => `${j.nombre} ${j.apellido}`;
export const iniciales = (j: { nombre: string; apellido: string }) => `${j.nombre[0] ?? ""}${j.apellido[0] ?? ""}`.toUpperCase();

/** "Ríos / Paz": así se nombra una pareja en un fixture. */
export const nombreDePareja = (p: ParejaBasica) => `${p.jugador1.apellido} / ${p.jugador2.apellido}`;

export const companero = (p: ParejaBasica, miJugadorId: number): JugadorBasico =>
  p.jugador1.id === miJugadorId ? p.jugador2 : p.jugador1;

export const RAMAS: Record<Rama, string> = { MASCULINO: "Caballeros", FEMENINO: "Damas", MIXTO: "Mixto" };

export const FORMATOS: Record<Formato, string> = {
  ELIMINACION_DIRECTA: "Eliminación directa",
  ZONAS_Y_LLAVES: "Zonas y llaves",
  ROUND_ROBIN: "Todos contra todos",
};

export const INSTANCIAS: Record<Instancia, string> = {
  ZONA: "Zona",
  DIECISEISAVOS: "16avos",
  OCTAVOS: "Octavos",
  CUARTOS: "Cuartos",
  SEMIFINAL: "Semifinal",
  FINAL: "Final",
};

export type Tono = "neutro" | "pista" | "ok" | "mal" | "aviso" | "vivo";

export const ESTADOS_TORNEO: Record<EstadoTorneo, [string, Tono]> = {
  BORRADOR: ["Borrador", "neutro"],
  INSCRIPCION_ABIERTA: ["Inscripción abierta", "ok"],
  EN_CURSO: ["En curso", "vivo"],
  FINALIZADO: ["Finalizado", "neutro"],
  CANCELADO: ["Cancelado", "mal"],
};

export const ESTADOS_PAREJA: Record<EstadoPareja, [string, Tono]> = {
  PENDIENTE: ["Falta confirmar", "aviso"],
  CONFIRMADA: ["Espera aprobación", "pista"],
  ACTIVA: ["Activa", "ok"],
  RECHAZADA: ["Rechazada", "mal"],
  DISUELTA: ["Disuelta", "neutro"],
};

export const ESTADOS_INSCRIPCION: Record<EstadoInscripcion, [string, Tono]> = {
  PENDIENTE: ["Espera aprobación", "pista"],
  APROBADA: ["Inscripta", "ok"],
  EN_ESPERA: ["Lista de espera", "aviso"],
  RECHAZADA: ["Rechazada", "mal"],
  BAJA: ["Dada de baja", "neutro"],
};

/** Cómo viene el pago de una pareja inscripta, para la organización. */
export function resumenDePago(inscripcion: { pagos?: unknown[] }) {
  const pagaron = inscripcion.pagos?.length ?? 0;
  return pagaron >= 2 ? "Pareja paga" : pagaron === 1 ? "Pagó 1 de 2" : "Sin pagar";
}

export const ESTADOS_PARTIDO: Record<EstadoPartido, [string, Tono]> = {
  PROGRAMADO: ["Por jugar", "neutro"],
  EN_JUEGO: ["En juego", "vivo"],
  FINALIZADO: ["Finalizado", "neutro"],
  SUSPENDIDO: ["Suspendido", "aviso"],
  WO: ["W.O.", "mal"],
};

export const ESTADOS_USUARIO: Record<EstadoUsuario, [string, Tono]> = {
  ACTIVO: ["Activo", "ok"],
  INACTIVO: ["Inactivo", "neutro"],
  BLOQUEADO: ["Bloqueado", "mal"],
};

const ACCIONES: Record<string, string> = {
  PASSWORD_BLANQUEADA: "El administrador general le blanqueó la contraseña",
  ALTA: "Dio de alta",
  BAJA: "Dio de baja",
  EDICION: "Editó",
  EDITAR: "Editó",
  CREAR: "Creó",
  BORRAR: "Borró",
  CONFIRMAR: "Confirmó",
  DECLINAR: "No aceptó",
  APROBAR: "Aprobó",
  RECHAZAR: "Rechazó",
  DISOLVER: "Disolvió",
  INSCRIBIR: "Inscribió",
  LISTA_DE_ESPERA: "Pasó a lista de espera",
  PROMOVER_DE_ESPERA: "Subió de la lista de espera",
  SEMBRAR: "Sembró",
  REGISTRAR_PAGO: "Anotó el pago",
  QUITAR_PAGO: "Quitó el pago",
  SORTEAR: "Sorteó el fixture",
  GENERAR_LLAVES: "Generó las llaves",
  CAMBIAR_ESTADO: "Cambió el estado",
  PROGRAMAR: "Programó",
  PROGRAMAR_AUTOMATICO: "Programó automáticamente",
  CARGAR_RESULTADO: "Cargó el resultado",
  CORREGIR_RESULTADO: "Corrigió el resultado",
  RESET_PASSWORD: "Reinició la contraseña",
};

export const accionLegible = (accion: string) => ACCIONES[accion] ?? accion;
