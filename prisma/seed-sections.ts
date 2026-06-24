// Carga inicial de las secciones de la reunión.
// Idempotente: si la sección (por nombre) ya existe, no la duplica.
// Ejecutar:  node --env-file=.env --import tsx prisma/seed-sections.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SECTIONS = ["Tesoros de la Biblia", "Seamos mejores maestros", "Nuestra vida cristiana"];

async function main() {
  for (let i = 0; i < SECTIONS.length; i++) {
    const nombre = SECTIONS[i];
    await prisma.section.upsert({
      where: { nombre },
      update: { orden: i },
      create: { nombre, orden: i },
    });
    console.log("✓", nombre);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
