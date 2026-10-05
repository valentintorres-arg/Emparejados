-- Logs: fallos del teléfono que de otro modo no se ven (activar las notificaciones).

-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "origen" VARCHAR(40) NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "detalle" VARCHAR(300) NOT NULL,
    "navegador" VARCHAR(300),
    "usuario_id" INTEGER,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_fecha_idx" ON "logs"("fecha" DESC);

-- CreateIndex
CREATE INDEX "logs_usuario_id_fecha_idx" ON "logs"("usuario_id", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Escrito a mano ──────────────────────────────────────────────────────────

ALTER TABLE "logs"
  -- Identificadores cortos que pone la API, no texto libre: se filtra por ellos.
  ADD CONSTRAINT "logs_origen_formato" CHECK ("origen" ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT "logs_codigo_formato" CHECK ("codigo" ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT "logs_detalle_no_vacio" CHECK (btrim("detalle") <> ''),
  ADD CONSTRAINT "logs_navegador_no_vacio" CHECK ("navegador" IS NULL OR btrim("navegador") <> '');
