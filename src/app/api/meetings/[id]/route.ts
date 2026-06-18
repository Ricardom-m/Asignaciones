import { prisma } from "@/lib/prisma";
import { meetingInput } from "@/lib/validation";
import { serializeMeeting } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/meetings/[id] — edita la fecha o la nota.
export async function PATCH(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = meetingInput.partial().safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const exists = await prisma.meeting.findUnique({ where: { id } });
  if (!exists) return fail("Reunión no encontrada", 404);

  // Si cambia la fecha, evitar choque con otra reunión existente.
  if (parsed.data.fecha) {
    const clash = await prisma.meeting.findUnique({ where: { fecha: new Date(parsed.data.fecha) } });
    if (clash && clash.id !== id) return fail("Ya existe una reunión en esa fecha", 409);
  }

  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      ...(parsed.data.fecha ? { fecha: new Date(parsed.data.fecha) } : {}),
      ...(parsed.data.nota !== undefined ? { nota: parsed.data.nota ?? null } : {}),
    },
  });
  return ok(serializeMeeting(meeting));
}

// DELETE /api/meetings/[id]
export async function DELETE(req: Request, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const { id } = await params;
  await prisma.meeting.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
