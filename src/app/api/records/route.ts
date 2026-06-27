import { prisma } from "@/lib/prisma";
import { recordInput } from "@/lib/validation";
import { serializeRecord, recordInclude } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey, isAdmin } from "@/lib/server";
import { todayYMD } from "@/lib/date";
import { SECCION_TESOROS, TESOROS_MAX, PARTE_CANCION, PARTE_PALABRAS, esLecturaNombre, esParteInicio, esParteSinPersona, esRolNombrado, norm } from "@/lib/sections";
import type { Prisma } from "@prisma/client";

const insensitive = (q: string): Prisma.StringFilter => ({ contains: q, mode: "insensitive" });

// GET /api/records — paginado y filtrado en el servidor (consultas indexadas).
// Params: scope=prox|pas|todas, sala, q, personId, sort=fecha|createdAt, take, cursor, all=1
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope");
  const fecha = sp.get("fecha"); // fecha exacta (YYYY-MM-DD) — para el planificador
  const sala = sp.get("sala");
  const q = sp.get("q")?.trim();
  const personId = sp.get("personId");
  const tipo = sp.get("tipo");
  const sort = sp.get("sort") === "createdAt" ? "createdAt" : "fecha";
  const all = sp.get("all") === "1";
  const take = Math.min(Math.max(Number(sp.get("take")) || 25, 1), 100);
  const cursor = sp.get("cursor");

  const today = new Date(todayYMD()); // hoy (zona MX) a medianoche UTC
  const and: Prisma.RecordWhereInput[] = [];
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) and.push({ fecha: new Date(fecha) });
  else if (scope === "prox") and.push({ fecha: { gte: today } });
  else if (scope === "pas") and.push({ fecha: { lt: today } });
  if (sala) and.push({ sala });
  if (tipo === "ASIGNACION" || tipo === "NOMBRADO") and.push({ tipo });
  if (personId) and.push({ OR: [{ asignadoId: personId }, { ayudanteId: personId }] });
  // Las partes "de programa" (sección Inicio + canciones/palabras sin persona) solo
  // viven en el planificador; se ocultan de las listas/dashboard.
  if (!fecha) {
    and.push({ OR: [{ sectionId: null }, { section: { is: { sinPersona: false } } }] });
    and.push({ NOT: { asignacion: { in: [PARTE_CANCION, PARTE_PALABRAS] } } });
  }
  if (q)
    and.push({
      OR: [
        { asignacion: insensitive(q) },
        { sala: insensitive(q) },
        { asignado: { OR: [{ nombre: insensitive(q) }, { apellido: insensitive(q) }] } },
        { ayudante: { OR: [{ nombre: insensitive(q) }, { apellido: insensitive(q) }] } },
      ],
    });
  const where: Prisma.RecordWhereInput = and.length ? { AND: and } : {};

  const dir: Prisma.SortOrder = scope === "prox" ? "asc" : "desc";
  const orderBy: Prisma.RecordOrderByWithRelationInput[] =
    sort === "createdAt" ? [{ createdAt: dir }, { id: dir }] : [{ fecha: dir }, { id: dir }];

  if (all) {
    const items = await prisma.record.findMany({ where, include: recordInclude, orderBy });
    return ok({ items: items.map(serializeRecord), nextCursor: null });
  }

  const rows = await prisma.record.findMany({
    where,
    include: recordInclude,
    orderBy,
    take: take + 1, // uno extra para saber si hay más
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return ok({
    items: page.map(serializeRecord),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

// POST /api/records — crea un registro validando las personas referidas.
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = recordInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { asignadoId, ayudanteId, fecha, sala, asignacion, tipo, sectionId, minutos, cantico } = parsed.data;
  if (ayudanteId && ayudanteId === asignadoId)
    return fail("El ayudante no puede ser la misma persona que el asignado", 422);

  // "Lectura de la Biblia": como mucho una por sala ese día (regla por nombre).
  if (esLecturaNombre(asignacion)) {
    const dupLect = await prisma.record.findFirst({
      where: { fecha: new Date(fecha), sala: sala ?? null, asignacion: { equals: asignacion.trim(), mode: "insensitive" } },
    });
    if (dupLect) return fail(`Ya hay una Lectura de la Biblia en ${sala ?? "esa sala"} ese día`, 409);
  }

  // Partes fijas (Canción/Palabras sin persona, o roles Presidente/Consejero/
  // Oración) tienen persona OPCIONAL, aunque su sección no sea "sinPersona".
  let sectionSoloAdmin = false;
  let personaOpcional = esParteSinPersona(asignacion) || esRolNombrado(asignacion);
  if (sectionId) {
    const sec = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!sec) return fail("Sección inexistente", 422);
    sectionSoloAdmin = sec.soloAdmin;
    personaOpcional = personaOpcional || sec.sinPersona;
    if (sec.soloAdmin && !isAdmin(session))
      return fail(`Solo el administrador puede agregar en "${sec.nombre}"`, 403);
    if (sec.unaPorSala) {
      const dup = await prisma.record.findFirst({ where: { fecha: new Date(fecha), sectionId, sala: sala ?? null } });
      if (dup) return fail(`En "${sec.nombre}" ya hay alguien asignado en ${sala ?? "esa sala"} ese día`, 409);
    }
    // Tesoros de la Biblia: máximo TESOROS_MAX asignaciones (nombres distintos).
    if (norm(sec.nombre) === norm(SECCION_TESOROS)) {
      const rows = await prisma.record.findMany({ where: { fecha: new Date(fecha), sectionId }, select: { asignacion: true } });
      const names = new Set(rows.map((r) => norm(r.asignacion)));
      if (!names.has(norm(asignacion)) && names.size >= TESOROS_MAX)
        return fail(`Máximo ${TESOROS_MAX} asignaciones en ${sec.nombre}`, 409);
    }
  }

  // Validación de personas según el tipo de sección.
  const finalAsignado = asignadoId ?? null;
  if (!personaOpcional && !finalAsignado) return fail("Selecciona el asignado", 422);
  const ids = [...(finalAsignado ? [finalAsignado] : []), ...(ayudanteId ? [ayudanteId] : [])];
  if (ids.length) {
    const count = await prisma.person.count({ where: { id: { in: ids } } });
    if (count !== ids.length) return fail("Persona referida inexistente", 422);
  }

  // Inicio: solo sus 5 partes válidas, sin duplicar la parte (la misma persona
  // sí puede ocupar varios roles).
  if (personaOpcional && sectionId) {
    if (!esParteInicio(asignacion)) return fail("Parte no válida para la sección Inicio", 422);
    const dupPart = await prisma.record.findFirst({
      where: { fecha: new Date(fecha), sectionId, asignacion: { equals: asignacion.trim(), mode: "insensitive" } },
    });
    if (dupPart) return fail("Esa parte de Inicio ya existe ese día", 409);
  }

  // El nuevo registro va al final de su grupo (fecha + sección + sala).
  const last = await prisma.record.findFirst({
    where: { fecha: new Date(fecha), sectionId: sectionId ?? null, sala: sala ?? null },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  const orden = (last?.orden ?? -1) + 1;

  const record = await prisma.record.create({
    data: {
      asignadoId: finalAsignado,
      ayudanteId: personaOpcional ? null : ayudanteId ?? null,
      fecha: new Date(fecha),
      sala: sala ?? null,
      asignacion,
      tipo: tipo ?? "ASIGNACION",
      sectionId: sectionId ?? null,
      minutos: minutos ?? null,
      cantico: cantico ?? null,
      orden,
      soloAdmin: sectionSoloAdmin,
    },
    include: recordInclude,
  });
  return ok(serializeRecord(record), { status: 201 });
}
