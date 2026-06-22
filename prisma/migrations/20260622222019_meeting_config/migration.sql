-- CreateTable
CREATE TABLE "MeetingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "weekdays" INTEGER[] DEFAULT ARRAY[4, 6]::INTEGER[],
    "weeks" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingConfig_pkey" PRIMARY KEY ("id")
);
