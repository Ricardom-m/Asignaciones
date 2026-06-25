import { prisma } from "@/lib/prisma";
import { purgeInput } from "@/lib/validation";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";
import { todayYMD } from "@/lib/date";

// POST /api/meetings/purge — borra reuniones en bloque:
//  { past: true } → todas las pasadas (fecha < hoy)
//  { ids: [...] } → por id (p. ej. futuras de un día que se quitó)
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = purgeInput.safeParse(body);
  if (!parsed.success)
    return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  let count = 0;
  if (parsed.data.past) {
    const today = new Date(todayYMD());
    const res = await prisma.meeting.deleteMany({ where: { fecha: { lt: today } } });
    count += res.count;
  }
  if (parsed.data.ids?.length) {
    const res = await prisma.meeting.deleteMany({ where: { id: { in: parsed.data.ids } } });
    count += res.count;
  }
  return ok({ deleted: count });
}
