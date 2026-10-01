import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashearPassword } from '../src/comun/password.ts';
import { PrismaClient } from '../src/generated/prisma/client.ts';

// Datos mínimos para que el sistema arranque: categorías y el primer administrador.
// Es idempotente: se puede correr en cada despliegue.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Categorías de pádel: 1ª (la más alta) a 8ª.
  for (let orden = 1; orden <= 8; orden++) {
    await prisma.categoria.upsert({
      where: { orden },
      update: {},
      create: { nombre: `${orden}ª`, orden },
    });
  }
  console.log(`Categorías: ${await prisma.categoria.count()}`);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('Sin ADMIN_EMAIL y ADMIN_PASSWORD: no se crea el administrador inicial.');
    return;
  }
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`El administrador ${email} ya existe: no se toca su contraseña.`);
    return;
  }
  await prisma.usuario.create({ data: { email, passwordHash: await hashearPassword(password), rol: 'ADMIN' } });
  console.log(`Administrador creado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
