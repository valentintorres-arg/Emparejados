-- Pagos de inscripción: la organización anota, jugador por jugador, quién pagó.
-- Que exista la fila significa que esa persona pagó; no hay fila, no pagó.
-- CreateTable
CREATE TABLE "pagos_inscripcion" (
    "inscripcion_id" INTEGER NOT NULL,
    "jugador_id" INTEGER NOT NULL,
    "registrado_por_id" INTEGER NOT NULL,
    "registrado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_inscripcion_pkey" PRIMARY KEY ("inscripcion_id","jugador_id")
);

-- CreateIndex
CREATE INDEX "pagos_inscripcion_jugador_id_idx" ON "pagos_inscripcion"("jugador_id");

-- AddForeignKey
ALTER TABLE "pagos_inscripcion" ADD CONSTRAINT "pagos_inscripcion_inscripcion_id_fkey" FOREIGN KEY ("inscripcion_id") REFERENCES "inscripciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_inscripcion" ADD CONSTRAINT "pagos_inscripcion_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "jugadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_inscripcion" ADD CONSTRAINT "pagos_inscripcion_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Solo se le anota el pago a un integrante de la pareja inscripta.
CREATE FUNCTION pagos_inscripcion_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM inscripciones i
    JOIN parejas p ON p.id = i.pareja_id
    WHERE i.id = NEW.inscripcion_id
      AND NEW.jugador_id IN (p.jugador1_id, p.jugador2_id)
  ) THEN
    RAISE EXCEPTION 'El jugador % no es parte de la pareja de la inscripción %', NEW.jugador_id, NEW.inscripcion_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'pagos_inscripcion_jugador_de_la_pareja';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pagos_inscripcion_reglas
  BEFORE INSERT OR UPDATE OF inscripcion_id, jugador_id ON "pagos_inscripcion"
  FOR EACH ROW EXECUTE FUNCTION pagos_inscripcion_validar();
