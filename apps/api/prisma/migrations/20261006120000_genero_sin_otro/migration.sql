-- Género: solo masculino o femenino. Se saca OTRO del enum; si quedara algún
-- jugador cargado así, la migración corta para que se corrija a mano primero.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "jugadores" WHERE "genero" = 'OTRO') THEN
    RAISE EXCEPTION 'Hay jugadores con género OTRO: corregilos antes de aplicar esta migración.';
  END IF;
END $$;

-- AlterEnum
BEGIN;
CREATE TYPE "genero_new" AS ENUM ('MASCULINO', 'FEMENINO');
ALTER TABLE "jugadores" ALTER COLUMN "genero" TYPE "genero_new" USING ("genero"::text::"genero_new");
ALTER TYPE "genero" RENAME TO "genero_old";
ALTER TYPE "genero_new" RENAME TO "genero";
DROP TYPE "public"."genero_old";
COMMIT;
