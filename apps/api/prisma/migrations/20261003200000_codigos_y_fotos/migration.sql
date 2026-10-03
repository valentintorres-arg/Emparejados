-- Códigos de un solo uso para cambiar la contraseña, y fotos de perfil.

-- CreateTable
CREATE TABLE "codigos_password" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "codigo_hash" CHAR(64) NOT NULL,
    "generado_por_id" INTEGER,
    "generado_por_externo" VARCHAR(200),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence_en" TIMESTAMPTZ(3) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "codigos_password_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_jugadores" (
    "jugador_id" INTEGER NOT NULL,
    "contenido" BYTEA NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_jugadores_pkey" PRIMARY KEY ("jugador_id")
);

-- CreateIndex
CREATE INDEX "codigos_password_usuario_id_idx" ON "codigos_password"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_password_usuario_id_key" ON "codigos_password"("usuario_id") WHERE (usado_en IS NULL);

-- AddForeignKey
ALTER TABLE "codigos_password" ADD CONSTRAINT "codigos_password_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_password" ADD CONSTRAINT "codigos_password_generado_por_id_fkey" FOREIGN KEY ("generado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_jugadores" ADD CONSTRAINT "fotos_jugadores_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "jugadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Escrito a mano ──────────────────────────────────────────────────────────

ALTER TABLE "codigos_password"
  -- Lo generó un usuario de la app o el administrador general, nunca los dos ni ninguno.
  ADD CONSTRAINT "codigos_password_un_autor" CHECK (("generado_por_id" IS NULL) <> ("generado_por_externo" IS NULL)),
  ADD CONSTRAINT "codigos_password_hash_formato" CHECK ("codigo_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "codigos_password_vence_despues" CHECK ("vence_en" > "creado_en"),
  ADD CONSTRAINT "codigos_password_intentos" CHECK ("intentos_fallidos" BETWEEN 0 AND 5),
  -- Se usa antes de vencer y antes de agotar los intentos.
  ADD CONSTRAINT "codigos_password_uso_valido" CHECK ("usado_en" IS NULL OR ("usado_en" <= "vence_en" AND "intentos_fallidos" < 5));

ALTER TABLE "fotos_jugadores"
  ADD CONSTRAINT "fotos_jugadores_tipo" CHECK ("tipo" IN ('image/webp', 'image/jpeg')),
  -- 200 KB como techo: una foto de perfil achicada pesa unos 20 KB.
  ADD CONSTRAINT "fotos_jugadores_tamano" CHECK (octet_length("contenido") BETWEEN 100 AND 204800);

-- foto_url ya no es un enlace libre: la arma la API y apunta a la foto guardada.
ALTER TABLE "jugadores"
  ADD CONSTRAINT "jugadores_foto_url_propia" CHECK ("foto_url" IS NULL OR "foto_url" ~ '^/api/jugadores/[0-9]+/foto\?v=[0-9]+$');
