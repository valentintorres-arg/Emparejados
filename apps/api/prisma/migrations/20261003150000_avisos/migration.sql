-- Avisos: notificaciones push y actualización en vivo de las pantallas.

-- CreateTable
CREATE TABLE "suscripciones_push" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "endpoint" VARCHAR(1000) NOT NULL,
    "p256dh" VARCHAR(200) NOT NULL,
    "auth" VARCHAR(100) NOT NULL,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_push_endpoint_key" ON "suscripciones_push"("endpoint");

-- CreateIndex
CREATE INDEX "suscripciones_push_usuario_id_idx" ON "suscripciones_push"("usuario_id");

-- AddForeignKey
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Escrito a mano ──────────────────────────────────────────────────────────

-- Los servicios de avisos de los navegadores solo atienden por HTTPS, y las
-- claves vienen en base64url (sin relleno).
ALTER TABLE "suscripciones_push"
  ADD CONSTRAINT "suscripciones_push_endpoint_https" CHECK ("endpoint" LIKE 'https://%'),
  ADD CONSTRAINT "suscripciones_push_claves_base64url" CHECK ("p256dh" ~ '^[A-Za-z0-9_-]+$' AND "auth" ~ '^[A-Za-z0-9_-]+$');

-- Cada registro de auditoría avisa a la API, por el canal "auditoria", cuando
-- se confirma la transacción que lo creó (pg_notify espera al COMMIT; si la
-- transacción se deshace, no hay aviso). Toda acción de la app deja un
-- registro de auditoría, así que de acá salen la actualización en vivo de las
-- pantallas y las notificaciones push. Viaja solo el id: el contenido se lee de
-- la tabla, y así nunca se pasa el límite de 8000 bytes del aviso.
CREATE FUNCTION auditoria_avisar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('auditoria', NEW.id::text);
  RETURN NULL;
END;
$$;

CREATE TRIGGER auditoria_avisar
AFTER INSERT ON "auditoria"
FOR EACH ROW EXECUTE FUNCTION auditoria_avisar();
