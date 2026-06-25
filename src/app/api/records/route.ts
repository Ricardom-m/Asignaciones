import { prisma } from "@/lib/prisma";
import { recordInput } from "@/lib/validation";
import { serializeRecord, recordInclude } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";
import { todayYMD } from "@/lib/date";
import type { Prisma } from "@prisma/client";

const insensitive = (q: string): Prisma.StringFilter => ({ contains: q, mode: "insensitive" });

// GET /api/records — paginado y filtrado en el servidor (consultas indexadas).
// Params: scope=prox|pas|todas, sala, q, personId, sort=fecha|createdAt, take, cursor, all=1
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope");
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
  if (scope === "prox") and.push({ fecha: { gte: today } });
  else if (scope === "pas") and.push({ fecha: { lt: today } });
  if (sala) and.push({ sala });
  if (tipo === "ASIGNACION" || tipo === "NOMBRADO") and.push({ tipo });
  if (personId) and.push({ OR: [{ asignadoId: personId }, { ayudanteId: personId }] });
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

  const { asignadoId, ayudanteId, fecha, sala, asignacion, tipo, sectionId } = parsed.data;
  if (ayudanteId && ayudanteId === asignadoId)
    return fail("El ayudante no puede ser la misma persona que el asignado", 422);

  const ids = [asignadoId, ...(ayudanteId ? [ayudanteId] : [])];
  const count = await prisma.person.count({ where: { id: { in: ids } } });
  if (count !== ids.length) return fail("Persona referida inexistente", 422);

  if (sectionId && !(await prisma.section.findUnique({ where: { id: sectionId } })))
    return fail("Sección inexistente", 422);

  const record = await prisma.record.create({
    data: {
      asignadoId,
      ayudanteId: ayudanteId ?? null,
      fecha: new Date(fecha),
      sala: sala ?? null,
      asignacion,
      tipo: tipo ?? "ASIGNACION",
      sectionId: sectionId ?? null,
    },
    include: recordInclude,
  });
  return ok(serializeRecord(record), { status: 201 });
}
