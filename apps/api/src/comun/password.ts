import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt de Node: sin dependencias nativas que compilar en el servidor.
const LOG_N = 15;
const R = 8;
const P = 1;
const LARGO = 32;
const MEMORIA_MAXIMA = 128 * 1024 * 1024;

function derivar(password: string, salt: Buffer, opciones: ScryptOptions, largo: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, largo, opciones, (error, clave) => (error ? reject(error) : resolve(clave)));
  });
}

export async function hashearPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const clave = await derivar(password, salt, { N: 2 ** LOG_N, r: R, p: P, maxmem: MEMORIA_MAXIMA }, LARGO);
  return ['scrypt', LOG_N, R, P, salt.toString('base64'), clave.toString('base64')].join('$');
}

export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  const [esquema, logN, r, p, salt, clave] = hash.split('$');
  if (esquema !== 'scrypt' || !salt || !clave) return false;
  const esperada = Buffer.from(clave, 'base64');
  const obtenida = await derivar(
    password,
    Buffer.from(salt, 'base64'),
    { N: 2 ** Number(logN), r: Number(r), p: Number(p), maxmem: MEMORIA_MAXIMA },
    esperada.length,
  );
  return timingSafeEqual(esperada, obtenida);
}

/** Contraseña temporal legible, para que el admin se la pase al jugador. */
export function generarPasswordTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(randomBytes(10), (b) => letras[b % letras.length]).join('');
}

export function generarToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
