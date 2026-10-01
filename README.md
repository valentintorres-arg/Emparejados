# Emparejados Pádel

Sistema para organizar competencias de pádel: jugadores, parejas armadas por QR, torneos, fixture y resultados. Es una aplicación web instalable (PWA) en Android y en escritorio.

Nada queda activo sin la organización: las parejas las arman los jugadores escaneando un QR, pero un administrador las aprueba, igual que las inscripciones a los torneos.

## Qué hay en el repositorio

| Carpeta | Qué es |
|---|---|
| `apps/api` | API en NestJS 12 con Prisma 7 sobre PostgreSQL |
| `apps/web` | Frontend en Next.js 16 (App Router), Tailwind 4, PWA |
| `docker-compose.yml` | Contenedor de PostgreSQL 17 |
| `emparejados paddle seccion carga de.txt` | Especificación original |

El navegador nunca habla con la API directamente: Next la publica bajo `/api` en el mismo dominio (ver `apps/web/next.config.ts`). Por eso la sesión viaja en cookies `httpOnly` de primera parte y no hace falta CORS.

## Puesta en marcha

Requisitos: Node.js 22 o superior y Docker (o un PostgreSQL 15+ propio).

```bash
# 1. Base de datos
cp .env.example .env            # cambiar la clave
docker compose up -d db

# 2. API
cd apps/api
cp .env.example .env            # completar DATABASE_URL, JWT_SECRET y el admin inicial
npm install
npm run db:deploy               # crea tablas, restricciones y triggers
npm run db:seed                 # categorías 1ª a 8ª y el primer administrador
npm run dev                     # http://localhost:4000

# 3. Web (en otra terminal)
cd apps/web
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

### Datos de ejemplo

```bash
cd apps/api
npm run db:demo                 # con la base sin jugadores
npm run db:demo -- --reiniciar  # BORRA TODO y vuelve a cargar
```

Carga 40 jugadores, 20 parejas en distintos estados y 4 torneos: uno finalizado (eliminación directa), uno en curso (zonas y llaves), uno con inscripción abierta (todos contra todos) y un borrador. Usa los mismos servicios que la API, así que los datos cumplen todas las reglas.

Con `NEXT_PUBLIC_DEMO=1` en `apps/web/.env.local`, la pantalla de ingreso muestra dos accesos de un toque:

| Rol | Email | Contraseña |
|---|---|---|
| Organización | el `ADMIN_EMAIL` de `apps/api/.env` | el `ADMIN_PASSWORD` de `apps/api/.env` |
| Jugador | `jugador@emparejados.test` | `jugador1234` |

Los accesos de un toque asumen `admin@emparejados.test` / `admin1234` para la organización. Son solo para desarrollo: en producción hay que dejar `NEXT_PUBLIC_DEMO` vacío y usar otra clave de administrador.

## Cómo funciona

- **Jugadores.** Se registran solos o los da de alta la organización. El consentimiento de la Ley 25.326 es obligatorio. Cada uno tiene un QR hecho con un token aleatorio y revocable; nunca lleva el DNI.
- **Parejas.** Un jugador escanea el QR del otro, el otro confirma desde su cuenta y la organización aprueba. Estados: pendiente, confirmada, activa, rechazada, disuelta.
- **Torneos.** Eliminación directa, zonas y llaves, o todos contra todos. Inscripción con cupo y lista de espera, cabezas de serie, sorteo y fixture automático.
- **Partidos.** Agenda manual o automática sin choques de cancha ni de jugadores. Resultado por sets con validación; el ganador pasa solo a la ronda siguiente.
- **Auditoría.** Cada cambio queda registrado con quién y cuándo, y no se puede editar ni borrar.

## Base de datos

El esquema está en `apps/api/prisma/schema.prisma`. Lo que Prisma no puede expresar (CHECK, exclusión de horarios superpuestos, triggers) está en la migración `reglas_de_integridad`. Cada restricción tiene nombre propio y la API lo traduce a un mensaje para la persona (`apps/api/src/comun/filtro-errores.ts`).

Al cambiar el esquema, verificar que no quede diferencia entre la base y `schema.prisma`:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Los predicados de los índices parciales tienen que escribirse como los guarda PostgreSQL (`estado = ANY (ARRAY[...])`, no `IN (...)`); si no, Prisma detecta una diferencia falsa en cada migración.

## App instalable

- Manifest: `apps/web/src/app/manifest.ts`. Service worker: `apps/web/public/sw.js`.
- El service worker solo se registra en producción (`npm run build && npm run start`).
- Para instalarla hace falta HTTPS (o `localhost`). La cámara del escáner de QR también lo exige.
- Íconos: `node scripts/generar-iconos.mjs` dentro de `apps/web`.

## Pendiente

- Despliegue en el servidor (Dockerfiles de API y web, y la entrada en el túnel para `emparejados.onlineturnos.ar`).
- Subida de fotos de jugadores (hoy se muestran las iniciales).
- Check-in de partidos por QR (opcional en la especificación).
