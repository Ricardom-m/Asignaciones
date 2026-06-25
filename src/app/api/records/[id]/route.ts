import { prisma } from "@/lib/prisma";
import { recordInput } from "@/lib/validation";
import { serializeRecord, recordInclude } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/records/[id] — edita un registro.
export async function PATCH(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = recordInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { asignadoId, ayudanteId, fecha, sala, asignacion, tipo, sectionId, minutos } = parsed.data;
  if (ayudanteId && ayudanteId === asignadoId)
    return fail("El ayudante no puede ser la misma persona que el asignado", 422);

  const exists = await prisma.record.findUnique({ where: { id } });
  if (!exists) return fail("Registro no encontrado", 404);

  const ids = [asignadoId, ...(ayudanteId ? [ayudanteId] : [])];
  const count = await prisma.person.count({ where: { id: { in: ids } } });
  if (count !== ids.length) return fail("Persona referida inexistente", 422);

  if (sectionId && !(await prisma.section.findUnique({ where: { id: sectionId } })))
    return fail("Sección inexistente", 422);

  const record = await prisma.record.update({
    where: { id },
    data: {
      asignadoId,
      ayudanteId: ayudanteId ?? null,
      fecha: new Date(fecha),
      sala: sala ?? null,
      asignacion,
      ...(tipo ? { tipo } : {}),
      sectionId: sectionId ?? null,
      minutos: minutos ?? null,
    },
    include: recordInclude,
  });
  return ok(serializeRecord(record));
}

// DELETE /api/records/[id]
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  await prisma.record.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
