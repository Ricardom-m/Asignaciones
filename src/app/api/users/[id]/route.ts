import { prisma } from "@/lib/prisma";
import { ok, fail, requireAdmin, rateLimit, clientKey } from "@/lib/server";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/users/[id] — revoca el acceso de un correo (de la DB).
// Los del respaldo por env (bootstrap) no se pueden borrar desde aquí.
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  await prisma.allowedUser.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
