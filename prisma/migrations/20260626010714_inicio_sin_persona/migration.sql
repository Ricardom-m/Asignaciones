-- DropForeignKey
ALTER TABLE "Record" DROP CONSTRAINT "Record_asignadoId_fkey";

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "cantico" INTEGER,
ALTER COLUMN "asignadoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "sinPersona" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_asignadoId_fkey" FOREIGN KEY ("asignadoId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
