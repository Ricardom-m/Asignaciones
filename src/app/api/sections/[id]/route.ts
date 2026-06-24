import { prisma } from "@/lib/prisma";
import { sectionInput } from "@/lib/validation";
import { serializeSection } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/sections/[id] — edita nombre, orden o estado activo.
export async function PATCH(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sectionInput.partial().safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const exists = await prisma.section.findUnique({ where: { id } });
  if (!exists) return fail("Sección no encontrada", 404);

  // Si cambia el nombre, evita choque con otra sección.
  if (parsed.data.nombre && parsed.data.nombre !== exists.nombre) {
    const dup = await prisma.section.findUnique({ where: { nombre: parsed.data.nombre } });
    if (dup) return fail("Ya existe una sección con ese nombre", 409);
  }

  const section = await prisma.section.update({ where: { id }, data: parsed.data });
  return ok(serializeSection(section));
}

// DELETE /api/sections/[id] — borra una sección.
// Seguro: los registros que la usaban quedan con sectionId en null (onDelete: SetNull).
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  await prisma.section.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
