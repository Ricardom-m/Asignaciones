import { PrismaClient } from "@prisma/client";

// Reusar la misma instancia en desarrollo para no agotar conexiones con el
// hot-reload de Next.js. En producción se crea una sola.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
