import { prisma } from "@/lib/prisma";
import { arrangeInput } from "@/lib/validation";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// POST /api/records/arrange — actualiza orden y/o sala de varios registros
// (drag-and-drop del planificador). Aplica todo en una transacción.
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = arrangeInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  await prisma.$transaction(
    parsed.data.updates.map((u) =>
      prisma.record.update({
        where: { id: u.id },
        data: { orden: u.orden, ...(u.sala !== undefined ? { sala: u.sala ?? null } : {}) },
      }),
    ),
  );
  return ok({ updated: parsed.data.updates.length });
}
