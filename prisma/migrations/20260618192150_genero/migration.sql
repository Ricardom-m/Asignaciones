-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('H', 'M');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "genero" "Genero";
