-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_fecha_key" ON "Meeting"("fecha");

-- CreateIndex
CREATE INDEX "Meeting_fecha_idx" ON "Meeting"("fecha");
