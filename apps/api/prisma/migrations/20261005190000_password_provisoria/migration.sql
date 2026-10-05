-- Contraseña provisoria: el administrador general la blanquea desde el sistema de
-- licencias y la app le hace elegir la suya a la persona antes de seguir.

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false;
