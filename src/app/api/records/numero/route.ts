import { prisma } from "@/lib/prisma";
import { numeroInput } from "@/lib/validation";
import { ok, fail, requireSession, rateLimit, clientKey, isAdmin } from "@/lib/server";
import { serializeRecord, recordInclude } from "@/lib/serialize";
import { numerar } from "@/lib/numeracion";

// POST /api/records/numero — fija a mano el número de una parte, o lo suelta
// (numero: null) para que vuelva a derivarse.
//
// Se aplica a la PARTE entera, no a un registro suelto: Sala A y Sala B de una
// misma parte comparten número y cambiarlo en una sola las separaría. El grupo se
// resuelve con el mismo lib/numeracion.ts que pinta los números, así que no puede
// discrepar. No sirve agrupar por `orden`: es la posición dentro de
// fecha+sección+SALA, y cada sala lleva su propia secuencia.
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

  const delDia = await prisma.record.findMany({ where: { fecha: rec.fecha }, include: recordInclude });
  const { slotPorId } = numerar(delDia.map(serializeRecord));
  const slot = slotPorId.get(id);
  const ids = slot ? delDia.filter((x) => slotPorId.get(x.id) === slot).map((x) => x.id) : [id];

  const res = await prisma.record.updateMany({ where: { id: { in: ids } }, data: { numero } });
  return ok({ updated: res.count });
}
