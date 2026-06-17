import { prisma } from "@/lib/prisma";
import { recordInput } from "@/lib/validation";
import { serializeRecord, recordInclude } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";
import type { Prisma } from "@prisma/client";

// GET /api/records?sort=createdAt|updatedAt|fecha&dir=asc|desc
// Devuelve todos los registros con las personas relacionadas resueltas.
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  const sortField = ["createdAt", "updatedAt", "fecha"].includes(sort)
    ? sort
    : "createdAt";

  const records = await prisma.record.findMany({
    include: recordInclude,
    orderBy: { [sortField]: dir } as Prisma.RecordOrderByWithRelationInput,
  });
  return ok(records.map(serializeRecord));
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

  const { asignadoId, ayudanteId, fecha, sala, asignacion } = parsed.data;
  if (ayudanteId && ayudanteId === asignadoId)
    return fail("El ayudante no puede ser la misma persona que el asignado", 422);

  // Verificar que las personas existan (evita FK rota).
  const ids = [asignadoId, ...(ayudanteId ? [ayudanteId] : [])];
  const count = await prisma.person.count({ where: { id: { in: ids } } });
  if (count !== ids.length) return fail("Persona referida inexistente", 422);

  const record = await prisma.record.create({
    data: {
      asignadoId,
      ayudanteId: ayudanteId ?? null,
      fecha: new Date(fecha),
      sala: sala ?? null,
      asignacion,
    },
    include: recordInclude,
  });
  return ok(serializeRecord(record), { status: 201 });
}
