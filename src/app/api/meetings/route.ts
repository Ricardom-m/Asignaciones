import { prisma } from "@/lib/prisma";
import { meetingBulkInput } from "@/lib/validation";
import { serializeMeeting } from "@/lib/serialize";
import { ok, fail, requireSession, requireAdmin, rateLimit, clientKey } from "@/lib/server";
import { todayYMD } from "@/lib/date";

// GET /api/meetings?scope=upcoming|past|all&take= — lista de reuniones.
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;
  const sp = new URL(req.url).searchParams;
  const scope = sp.get("scope") ?? "all";
  const take = Math.min(Math.max(Number(sp.get("take")) || 60, 1), 200);
  const today = new Date(todayYMD());

  if (scope === "upcoming") {
    const meetings = await prisma.meeting.findMany({ where: { fecha: { gte: today } }, orderBy: { fecha: "asc" } });
    return ok(meetings.map(serializeMeeting));
  }
  if (scope === "past") {
    const meetings = await prisma.meeting.findMany({ where: { fecha: { lt: today } }, orderBy: { fecha: "desc" }, take });
    return ok(meetings.map(serializeMeeting));
  }
  const meetings = await prisma.meeting.findMany({ orderBy: { fecha: "asc" } });
  return ok(meetings.map(serializeMeeting));
}

// POST /api/meetings — crea una o varias fechas (no duplica). Solo admin.
export async function POST(req: Request) {
  const { session, response } = await requireAdmin();
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
