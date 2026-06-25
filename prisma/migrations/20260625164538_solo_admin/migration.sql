-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "soloAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "soloAdmin" BOOLEAN NOT NULL DEFAULT false;
