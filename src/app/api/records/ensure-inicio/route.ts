import { prisma } from "@/lib/prisma";
import { ok, fail, requireSession } from "@/lib/server";
import { SECCION_INICIO, PARTE_CANCION, PARTE_PALABRAS, PALABRAS_MIN, norm } from "@/lib/sections";
import type { Prisma } from "@prisma/client";

// POST /api/records/ensure-inicio { fecha } — crea (idempotente) la sección
// "Inicio" y sus 2 partes fijas sin persona (Canción + Palabras de instrucción)
// para esa fecha. Lo llama el planificador al abrir una reunión.
export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const body = await req.json().catch(() => null);
  const fecha = body?.fecha;
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("Fecha inválida", 422);

  // La sección Inicio es la única marcada sinPersona; se crea/adopta si falta.
  let sec = await prisma.section.findFirst({ where: { sinPersona: true } });
  let sectionCreated = false;
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

  const existing = await prisma.record.findMany({
    where: { fecha: new Date(fecha), sectionId: sec.id },
    select: { asignacion: true },
  });
  const have = new Set(existing.map((r) => norm(r.asignacion)));

  const toCreate: Prisma.RecordCreateManyInput[] = [];
  if (!have.has(norm(PARTE_CANCION)))
    toCreate.push({ fecha: new Date(fecha), sectionId: sec.id, asignacion: PARTE_CANCION, orden: 0, minutos: null });
  if (!have.has(norm(PARTE_PALABRAS)))
    toCreate.push({ fecha: new Date(fecha), sectionId: sec.id, asignacion: PARTE_PALABRAS, orden: 1, minutos: PALABRAS_MIN });

  let created = 0;
  if (toCreate.length) {
    const res = await prisma.record.createMany({ data: toCreate });
    created = res.count;
  }
  return ok({ created, sectionCreated });
}
