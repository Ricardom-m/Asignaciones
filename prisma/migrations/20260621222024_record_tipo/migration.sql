-- CreateEnum
CREATE TYPE "RecordTipo" AS ENUM ('ASIGNACION', 'NOMBRADO');

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "tipo" "RecordTipo" NOT NULL DEFAULT 'ASIGNACION';

-- CreateIndex
CREATE INDEX "Record_tipo_fecha_idx" ON "Record"("tipo", "fecha");
