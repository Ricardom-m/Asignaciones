import { prisma } from "@/lib/prisma";
import { roleInput } from "@/lib/validation";
import { serializeRole } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/roles/[id] — edita nombre, color o estado activo.
export async function PATCH(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = roleInput.partial().safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const exists = await prisma.role.findUnique({ where: { id } });
  if (!exists) return fail("Rol no encontrado", 404);

  const role = await prisma.role.update({ where: { id }, data: parsed.data });
  return ok(serializeRole(role));
}

// DELETE /api/roles/[id] — borra un rol.
// Seguro: la relación muchos-a-muchos limpia los vínculos automáticamente;
// las personas y sus registros quedan intactos.
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  await prisma.role.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
