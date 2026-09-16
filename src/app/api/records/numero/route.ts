import { prisma } from "@/lib/prisma";
import { numeroInput } from "@/lib/validation";
import { ok, fail, requireSession, rateLimit, clientKey, isAdmin } from "@/lib/server";

// POST /api/records/numero — fija a mano el número de una parte, o lo suelta
// (numero: null) para que vuelva a derivarse.
//
// Se aplica al GRUPO fecha+sección+orden, no a un registro suelto: Sala A y Sala B
// de una misma parte comparten número, así que cambiarlo en una sola las separaría.
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email)))
    return fail("Demasiadas solicitudes, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = numeroInput.safeParse(body);
  if (!parsed.success) return fail("Datos inválidos", 422, parsed.error.flatten().fieldErrors);

  const { id, numero } = parsed.data;
  const rec = await prisma.record.findUnique({ where: { id }, include: { section: true } });
  if (!rec) return fail("Registro no encontrado", 404);
  if ((rec.soloAdmin || rec.section?.soloAdmin) && !isAdmin(session))
    return fail("Solo el administrador puede numerar esta asignación", 403);

  const res = await prisma.record.updateMany({
    where: { fecha: rec.fecha, sectionId: rec.sectionId, orden: rec.orden },
    data: { numero },
  });
  return ok({ updated: res.count });
}
