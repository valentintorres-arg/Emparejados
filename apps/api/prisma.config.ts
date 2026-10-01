import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // "prisma generate" corre al instalar dependencias y al armar la imagen de
    // Docker, cuando todavía no hay base: por eso no se exige la variable acá.
    // Las migraciones sí la necesitan y fallan con un error claro si falta.
    url: process.env.DATABASE_URL ?? '',
  },
});
