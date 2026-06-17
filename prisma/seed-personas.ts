// Carga inicial de personas y roles extraídos de las listas escritas a mano.
// Idempotente: si una persona (nombre+apellido) ya existe, solo le conecta el rol.
// Ejecutar:  node --env-file=.env --import tsx prisma/seed-personas.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES: Record<string, string> = {
  Nombrados: "#4f8ef7",
  Asignados: "#3ecf8e",
  Asignadas: "#b06cf6",
  Precursores: "#f5a623",
};

// [nombre, apellido]
const DATA: Record<string, [string, string][]> = {
  Nombrados: [
    ["Javier", "Espinoza"],
    ["Ismael", "Acoltzi"],
    ["Uriel", "Morales"],
    ["Alfredo", "Hernández"],
    ["Juan", "Hernández"],
    ["Edmundo", "Torres"],
    ["Delfino", "Lombreras"],
    ["Luis", "Sánchez"],
    ["Efraín", "Acoltzi"],
    ["Ricardo", "Muñoz"],
    ["Pablo Antonio", "León"],
    ["Demetrio", "Águila"],
    ["Pablo", "León Flores"],
  ],
  Asignados: [
    ["Juan Carlos", "Lima"],
    ["Antonio", "León"],
    ["Randulfo", "Peralta"],
    ["Pither", "Tetlalmatzi"],
    ["Fernando", "Santiago"],
    ["Demetrio", "Muñoz"],
    ["Josué", "Muñoz"],
    ["Moisés", "Grande"],
    ["Isaías", "Acoltzi"],
    ["Carlos", "Acoltzi"],
    ["Rogelio", "Grande"],
    ["Vicente", "Flores"],
    ["Lubin", "Sánchez"],
    ["Eladio", "Temoltzi"],
  ],
  Asignadas: [
    ["Fidelia", "Hernández"],
    ["Argelia", "Malváez"],
    ["Silvia", "Santiago"],
    ["Catalina", "Serrano"],
    ["Hilaria", "Serrano"],
    ["Mariana", "Acoltzi"],
    ["María Isabel", "Cuamatzi"],
    ["Hanna", "Cuamatzi"],
    ["Sara", "Espinoza"],
    ["Zury", "Águila"],
    ["Laura", "Rojas"],
    ["Elli Libni", "Lima"],
    ["Francisca", "Flores"],
    ["Erica", "Sánchez"],
    ["Fernanda", "Espinoza"],
    ["Edith", "Hernández"],
    ["Rocío", "León"],
    ["Marisa", "Morales"],
    ["Joselin", "Morales"],
    ["Elia", "Molina"],
    ["Lina", "Peralta"],
    ["Sofía", "Pérez"],
    ["Juana", "Mazatzi"],
    ["Leticia", "Luna"],
    ["Clementina", "León"],
    ["Aylin", "León"],
    ["Francisca", "Torres"],
    ["Rosa", "González"],
    ["Emma", "Torres"],
    ["Rosalva", "Muñoz"],
    ["Esperanza", "Saldaña"],
  ],
  Precursores: [
    ["Madai", "Lima"],
    ["Alejandra", "Hernández"],
    ["Catalina", "Hernández"],
    ["Alicia", "Sánchez"],
    ["Celene", "Casillas"],
    ["Laura", "Acoltzi"],
    ["Sandra", "Espinoza"],
    ["Lilia", "Pérez"],
    ["Isabel", "Morales"],
    ["Evelyn", "León"],
    ["Arisbeth", "Cuamatzi"],
  ],
};

async function main() {
  // 1) Roles
  const roleIds: Record<string, string> = {};
  for (const [nombre, color] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { nombre },
      create: { nombre, color },
      update: { color },
    });
    roleIds[nombre] = role.id;
  }
  console.log("Roles listos:", Object.keys(roleIds).join(", "));

  // 2) Personas (con su rol)
  let creadas = 0;
  let vinculadas = 0;
  for (const [roleName, people] of Object.entries(DATA)) {
    const roleId = roleIds[roleName];
    for (const [nombre, apellido] of people) {
      const existing = await prisma.person.findFirst({ where: { nombre, apellido } });
      if (existing) {
        await prisma.person.update({
          where: { id: existing.id },
          data: { roles: { connect: { id: roleId } } },
        });
        vinculadas++;
      } else {
        await prisma.person.create({
          data: { nombre, apellido, roles: { connect: { id: roleId } } },
        });
        creadas++;
      }
    }
  }

  const total = await prisma.person.count();
  console.log(`✔ Personas creadas: ${creadas}, vínculos extra: ${vinculadas}, total en BD: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
