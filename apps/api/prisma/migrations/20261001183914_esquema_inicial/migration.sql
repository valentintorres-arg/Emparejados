-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'JUGADOR');

-- CreateEnum
CREATE TYPE "estado_usuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "genero" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO');

-- CreateEnum
CREATE TYPE "mano_habil" AS ENUM ('DERECHA', 'IZQUIERDA');

-- CreateEnum
CREATE TYPE "posicion_juego" AS ENUM ('DRIVE', 'REVES');

-- CreateEnum
CREATE TYPE "estado_pareja" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'ACTIVA', 'RECHAZADA', 'DISUELTA');

-- CreateEnum
CREATE TYPE "rama" AS ENUM ('MASCULINO', 'FEMENINO', 'MIXTO');

-- CreateEnum
CREATE TYPE "formato_torneo" AS ENUM ('ELIMINACION_DIRECTA', 'ZONAS_Y_LLAVES', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "estado_torneo" AS ENUM ('BORRADOR', 'INSCRIPCION_ABIERTA', 'EN_CURSO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "estado_inscripcion" AS ENUM ('PENDIENTE', 'APROBADA', 'EN_ESPERA', 'RECHAZADA', 'BAJA');

-- CreateEnum
CREATE TYPE "instancia" AS ENUM ('ZONA', 'DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIFINAL', 'FINAL');

-- CreateEnum
CREATE TYPE "estado_partido" AS ENUM ('PROGRAMADO', 'EN_JUEGO', 'FINALIZADO', 'SUSPENDIDO', 'WO');

-- CreateTable
CREATE TABLE "localidades" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "provincia" VARCHAR(60) NOT NULL,

    CONSTRAINT "localidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubes" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(160),
    "localidad_id" INTEGER NOT NULL,

    CONSTRAINT "clubes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canchas" (
    "id" SERIAL NOT NULL,
    "club_id" INTEGER NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "orden" SMALLINT NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'JUGADOR',
    "estado" "estado_usuario" NOT NULL DEFAULT 'ACTIVO',
    "ultimo_login_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_agent" VARCHAR(255),
    "ip" INET,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocada_en" TIMESTAMPTZ(3),

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jugadores" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "apellido" VARCHAR(60) NOT NULL,
    "dni" VARCHAR(8) NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "genero" "genero" NOT NULL,
    "telefono" VARCHAR(16) NOT NULL,
    "localidad_id" INTEGER,
    "club_id" INTEGER,
    "categoria_id" INTEGER NOT NULL,
    "mano_habil" "mano_habil" NOT NULL,
    "posicion" "posicion_juego" NOT NULL,
    "foto_url" VARCHAR(500),
    "busqueda" VARCHAR(140) NOT NULL DEFAULT '',
    "consentimiento_version" VARCHAR(20) NOT NULL,
    "consentimiento_aceptado_en" TIMESTAMPTZ(3) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "eliminado_en" TIMESTAMPTZ(3),

    CONSTRAINT "jugadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_tokens" (
    "id" SERIAL NOT NULL,
    "jugador_id" INTEGER NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMPTZ(3),

    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parejas" (
    "id" SERIAL NOT NULL,
    "jugador1_id" INTEGER NOT NULL,
    "jugador2_id" INTEGER NOT NULL,
    "estado" "estado_pareja" NOT NULL DEFAULT 'PENDIENTE',
    "creada_por_id" INTEGER NOT NULL,
    "confirmada_en" TIMESTAMPTZ(3),
    "resuelta_por_id" INTEGER,
    "resuelta_en" TIMESTAMPTZ(3),
    "motivo_rechazo" VARCHAR(300),
    "disuelta_en" TIMESTAMPTZ(3),
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parejas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "rama" "rama" NOT NULL,
    "formato" "formato_torneo" NOT NULL,
    "cupo_maximo" SMALLINT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "fecha_limite_inscripcion" TIMESTAMPTZ(3) NOT NULL,
    "estado" "estado_torneo" NOT NULL DEFAULT 'BORRADOR',
    "reglamento" TEXT,
    "creado_por_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "torneos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas" (
    "id" SERIAL NOT NULL,
    "torneo_id" INTEGER NOT NULL,
    "nombre" VARCHAR(10) NOT NULL,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" SERIAL NOT NULL,
    "torneo_id" INTEGER NOT NULL,
    "pareja_id" INTEGER NOT NULL,
    "estado" "estado_inscripcion" NOT NULL DEFAULT 'PENDIENTE',
    "zona_id" INTEGER,
    "siembra" SMALLINT,
    "solicitada_por_id" INTEGER NOT NULL,
    "resuelta_por_id" INTEGER,
    "resuelta_en" TIMESTAMPTZ(3),
    "motivo_rechazo" VARCHAR(300),
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidos" (
    "id" SERIAL NOT NULL,
    "torneo_id" INTEGER NOT NULL,
    "numero" SMALLINT NOT NULL,
    "instancia" "instancia" NOT NULL,
    "zona_id" INTEGER,
    "pareja1_id" INTEGER,
    "pareja2_id" INTEGER,
    "cancha_id" INTEGER,
    "inicio" TIMESTAMPTZ(3),
    "fin" TIMESTAMPTZ(3),
    "estado" "estado_partido" NOT NULL DEFAULT 'PROGRAMADO',
    "ganador_id" INTEGER,
    "siguiente_partido_id" INTEGER,
    "siguiente_slot" SMALLINT,
    "cargado_por_id" INTEGER,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sets" (
    "partido_id" INTEGER NOT NULL,
    "nro_set" SMALLINT NOT NULL,
    "games_p1" SMALLINT NOT NULL,
    "games_p2" SMALLINT NOT NULL,
    "super_tiebreak" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sets_pkey" PRIMARY KEY ("partido_id","nro_set")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "entidad_id" INTEGER,
    "detalle" JSONB,
    "ip" INET,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "localidades_provincia_nombre_key" ON "localidades"("provincia", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "clubes_localidad_id_nombre_key" ON "clubes"("localidad_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "canchas_club_id_nombre_key" ON "canchas"("club_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_orden_key" ON "categorias"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_estado_idx" ON "usuarios"("rol", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_hash_key" ON "sesiones"("token_hash");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_idx" ON "sesiones"("usuario_id");

-- CreateIndex
CREATE INDEX "sesiones_expira_en_idx" ON "sesiones"("expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "jugadores_usuario_id_key" ON "jugadores"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "jugadores_dni_key" ON "jugadores"("dni");

-- CreateIndex
CREATE INDEX "jugadores_busqueda_idx" ON "jugadores" USING GIN ("busqueda" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "jugadores_apellido_nombre_idx" ON "jugadores"("apellido", "nombre") WHERE (eliminado_en IS NULL);

-- CreateIndex
CREATE INDEX "jugadores_categoria_id_apellido_nombre_idx" ON "jugadores"("categoria_id", "apellido", "nombre") WHERE (eliminado_en IS NULL);

-- CreateIndex
CREATE INDEX "jugadores_club_id_apellido_nombre_idx" ON "jugadores"("club_id", "apellido", "nombre") WHERE (eliminado_en IS NULL);

-- CreateIndex
CREATE INDEX "jugadores_localidad_id_idx" ON "jugadores"("localidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_tokens_token_key" ON "qr_tokens"("token");

-- CreateIndex
CREATE INDEX "qr_tokens_jugador_id_idx" ON "qr_tokens"("jugador_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_tokens_jugador_id_key" ON "qr_tokens"("jugador_id") WHERE (revocado_en IS NULL);

-- CreateIndex
CREATE INDEX "parejas_jugador1_id_idx" ON "parejas"("jugador1_id");

-- CreateIndex
CREATE INDEX "parejas_jugador2_id_idx" ON "parejas"("jugador2_id");

-- CreateIndex
CREATE INDEX "parejas_estado_creada_en_idx" ON "parejas"("estado", "creada_en");

-- CreateIndex
CREATE UNIQUE INDEX "parejas_jugador1_id_jugador2_id_key" ON "parejas"("jugador1_id", "jugador2_id") WHERE (estado = ANY (ARRAY['PENDIENTE'::estado_pareja, 'CONFIRMADA'::estado_pareja, 'ACTIVA'::estado_pareja]));

-- CreateIndex
CREATE INDEX "torneos_estado_fecha_inicio_idx" ON "torneos"("estado", "fecha_inicio");

-- CreateIndex
CREATE INDEX "torneos_categoria_id_fecha_inicio_idx" ON "torneos"("categoria_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "torneos_sede_id_fecha_inicio_idx" ON "torneos"("sede_id", "fecha_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_torneo_id_nombre_key" ON "zonas"("torneo_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_torneo_id_id_key" ON "zonas"("torneo_id", "id");

-- CreateIndex
CREATE INDEX "inscripciones_torneo_id_estado_creada_en_idx" ON "inscripciones"("torneo_id", "estado", "creada_en");

-- CreateIndex
CREATE INDEX "inscripciones_pareja_id_idx" ON "inscripciones"("pareja_id");

-- CreateIndex
CREATE INDEX "inscripciones_zona_id_idx" ON "inscripciones"("zona_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_torneo_id_pareja_id_key" ON "inscripciones"("torneo_id", "pareja_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_torneo_id_siembra_key" ON "inscripciones"("torneo_id", "siembra");

-- CreateIndex
CREATE INDEX "partidos_torneo_id_instancia_numero_idx" ON "partidos"("torneo_id", "instancia", "numero");

-- CreateIndex
CREATE INDEX "partidos_pareja1_id_torneo_id_idx" ON "partidos"("pareja1_id", "torneo_id");

-- CreateIndex
CREATE INDEX "partidos_pareja2_id_torneo_id_idx" ON "partidos"("pareja2_id", "torneo_id");

-- CreateIndex
CREATE INDEX "partidos_zona_id_idx" ON "partidos"("zona_id");

-- CreateIndex
CREATE INDEX "partidos_cancha_id_inicio_idx" ON "partidos"("cancha_id", "inicio");

-- CreateIndex
CREATE INDEX "partidos_estado_inicio_idx" ON "partidos"("estado", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "partidos_torneo_id_numero_key" ON "partidos"("torneo_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "partidos_torneo_id_id_key" ON "partidos"("torneo_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "partidos_siguiente_partido_id_siguiente_slot_key" ON "partidos"("siguiente_partido_id", "siguiente_slot");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_fecha_idx" ON "auditoria"("entidad", "entidad_id", "fecha" DESC);

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_fecha_idx" ON "auditoria"("usuario_id", "fecha" DESC);

-- CreateIndex
CREATE INDEX "auditoria_fecha_idx" ON "auditoria" USING BRIN ("fecha");

-- AddForeignKey
ALTER TABLE "clubes" ADD CONSTRAINT "clubes_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jugadores" ADD CONSTRAINT "jugadores_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parejas" ADD CONSTRAINT "parejas_jugador1_id_fkey" FOREIGN KEY ("jugador1_id") REFERENCES "jugadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parejas" ADD CONSTRAINT "parejas_jugador2_id_fkey" FOREIGN KEY ("jugador2_id") REFERENCES "jugadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parejas" ADD CONSTRAINT "parejas_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "jugadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parejas" ADD CONSTRAINT "parejas_resuelta_por_id_fkey" FOREIGN KEY ("resuelta_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "clubes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_pareja_id_fkey" FOREIGN KEY ("pareja_id") REFERENCES "parejas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_torneo_id_zona_id_fkey" FOREIGN KEY ("torneo_id", "zona_id") REFERENCES "zonas"("torneo_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_solicitada_por_id_fkey" FOREIGN KEY ("solicitada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_resuelta_por_id_fkey" FOREIGN KEY ("resuelta_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneo_id_zona_id_fkey" FOREIGN KEY ("torneo_id", "zona_id") REFERENCES "zonas"("torneo_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneo_id_pareja1_id_fkey" FOREIGN KEY ("torneo_id", "pareja1_id") REFERENCES "inscripciones"("torneo_id", "pareja_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneo_id_pareja2_id_fkey" FOREIGN KEY ("torneo_id", "pareja2_id") REFERENCES "inscripciones"("torneo_id", "pareja_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneo_id_ganador_id_fkey" FOREIGN KEY ("torneo_id", "ganador_id") REFERENCES "inscripciones"("torneo_id", "pareja_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "canchas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_torneo_id_siguiente_partido_id_fkey" FOREIGN KEY ("torneo_id", "siguiente_partido_id") REFERENCES "partidos"("torneo_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_cargado_por_id_fkey" FOREIGN KEY ("cargado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sets" ADD CONSTRAINT "sets_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "partidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
