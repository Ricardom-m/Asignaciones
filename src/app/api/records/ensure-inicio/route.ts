import { prisma } from "@/lib/prisma";
import { ok, fail, requireSession } from "@/lib/server";
import { SECCION_INICIO, PARTES_FIJAS, norm, type ParteFija } from "@/lib/sections";
import type { Prisma } from "@prisma/client";

// POST /api/records/ensure-inicio { fecha } — crea (idempotente) las partes fijas
// de las secciones que las tienen (Inicio y Nuestra vida cristiana) para esa
// fecha. Lo llama el planificador al abrir una reunión.
export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const body = await req.json().catch(() => null);
  const fecha = body?.fecha;
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("Fecha inválida", 422);

  let created = 0;
  let sectionCreated = false;

  for (const [nombre, fijas] of Object.entries(PARTES_FIJAS)) {
    // Resolver la sección. "Inicio" se crea/adopta (marcada sinPersona); las
    // demás (Nuestra vida) deben existir, no las creamos.
    let sec;
    if (nombre === SECCION_INICIO) {
      sec = await prisma.section.findFirst({ where: { sinPersona: true } });
      if (!sec) {
        const min = await prisma.section.aggregate({ _min: { orden: true } });
        const orden = (min._min.orden ?? 0) - 1; // va primero en el panorama
        sec = await prisma.section.upsert({
          where: { nombre: SECCION_INICIO },
          update: { sinPersona: true, sinAyudante: true, active: true },
          create: { nombre: SECCION_INICIO, sinPersona: true, sinAyudante: true, orden },
        });
        sectionCreated = true;
      }
    } else {
      sec = await prisma.section.findFirst({ where: { nombre } });
    }
    if (!sec) continue;

    const existing = await prisma.record.findMany({
      where: { fecha: new Date(fecha), sectionId: sec.id },
      select: { asignacion: true },
    });
    // Conteo por nombre (permite varias partes con el mismo nombre, p. ej. 2 Canción).
    const counts = new Map<string, number>();
    for (const e of existing) counts.set(norm(e.asignacion), (counts.get(norm(e.asignacion)) ?? 0) + 1);
    const byName = new Map<string, ParteFija[]>();
    for (const p of fijas) {
      const arr = byName.get(norm(p.value));
      if (arr) arr.push(p);
      else byName.set(norm(p.value), [p]);
    }

    const toCreate: Prisma.RecordCreateManyInput[] = [];
    for (const [n, parts] of byName) {
      const have = counts.get(n) ?? 0;
      for (let k = have; k < parts.length; k++) {
        const p = parts[k];
        toCreate.push({
          fecha: new Date(fecha),
          sectionId: sec.id,
          asignacion: p.value,
          orden: p.orden,
          minutos: p.minutos,
          tipo: p.nombrado ? "NOMBRADO" : "ASIGNACION",
        });
      }
    }
    if (toCreate.length) {
      const res = await prisma.record.createMany({ data: toCreate });
      created += res.count;
    }
  }

  return ok({ created, sectionCreated });
}
