-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "asignadoId" TEXT NOT NULL,
    "ayudanteId" TEXT,
    "fecha" DATE NOT NULL,
    "sala" TEXT,
    "asignacion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_nombre_apellido_idx" ON "Person"("nombre", "apellido");

-- CreateIndex
CREATE INDEX "Record_fecha_idx" ON "Record"("fecha");

-- CreateIndex
CREATE INDEX "Record_asignadoId_idx" ON "Record"("asignadoId");

-- CreateIndex
CREATE INDEX "Record_ayudanteId_idx" ON "Record"("ayudanteId");

-- CreateIndex
CREATE INDEX "Record_createdAt_idx" ON "Record"("createdAt");

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_asignadoId_fkey" FOREIGN KEY ("asignadoId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_ayudanteId_fkey" FOREIGN KEY ("ayudanteId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
