import { prisma } from "@/lib/prisma";
import { meetingBulkInput } from "@/lib/validation";
import { serializeMeeting } from "@/lib/serialize";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// GET /api/meetings — lista de reuniones (fecha ascendente).
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  const meetings = await prisma.meeting.findMany({ orderBy: { fecha: "asc" } });
  return ok(meetings.map(serializeMeeting));
}

// POST /api/meetings — crea una o varias fechas (no duplica).
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = meetingBulkInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { fechas, nota } = parsed.data;
  await prisma.meeting.createMany({
    data: [...new Set(fechas)].map((f) => ({ fecha: new Date(f), nota: nota ?? null })),
    skipDuplicates: true,
  });
  const meetings = await prisma.meeting.findMany({ orderBy: { fecha: "asc" } });
  return ok(meetings.map(serializeMeeting), { status: 201 });
}
