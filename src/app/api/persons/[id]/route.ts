import { prisma } from "@/lib/prisma";
import { personInput } from "@/lib/validation";
import { serializePerson } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/persons/[id] — edita una persona.
export async function PATCH(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = personInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const exists = await prisma.person.findUnique({ where: { id } });
  if (!exists) return fail("Persona no encontrada", 404);

  const person = await prisma.person.update({ where: { id }, data: parsed.data });
  return ok(serializePerson(person));
}

// DELETE /api/persons/[id] — borra una persona.
// Se bloquea si es asignado principal de algún registro (dejaría huérfanos).
// Como ayudante el borrado es seguro (la relación queda en null por SetNull).
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;

  const asAsignado = await prisma.record.count({ where: { asignadoId: id } });
  if (asAsignado > 0)
    return fail(
      `No se puede borrar: es asignado en ${asAsignado} registro(s). Reasigna o elimina esos registros primero.`,
      409,
    );

  await prisma.person.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
