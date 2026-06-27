import { prisma } from "@/lib/prisma";
import { meetingDetailInput } from "@/lib/validation";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// GET /api/meetings/detail?fecha=YYYY-MM-DD — relato/lectura de esa reunión.
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;
  const fecha = new URL(req.url).searchParams.get("fecha");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("Fecha inválida", 422);
  const m = await prisma.meeting.findUnique({ where: { fecha: new Date(fecha) }, select: { relato: true } });
  return ok({ relato: m?.relato ?? null });
}

// PUT /api/meetings/detail { fecha, relato } — guarda el relato (crea la reunión si falta).
export async function PUT(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = meetingDetailInput.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { fecha, relato } = parsed.data;
  const value = relato?.trim() || null;
  const m = await prisma.meeting.upsert({
    where: { fecha: new Date(fecha) },
    create: { fecha: new Date(fecha), relato: value },
    update: { relato: value },
    select: { relato: true },
  });
  return ok({ relato: m.relato });
}
