import { prisma } from "@/lib/prisma";
import { ok, requireSession } from "@/lib/server";
import { todayYMD } from "@/lib/date";
import { PARTE_CANCION, PARTE_PALABRAS } from "@/lib/sections";
import type { Prisma } from "@prisma/client";

// Las partes "de programa" (sección Inicio + canciones/palabras sin persona) no
// cuentan como asignaciones.
const notInicio: Prisma.RecordWhereInput = {
  AND: [
    { OR: [{ sectionId: null }, { section: { is: { sinPersona: false } } }] },
    { NOT: { asignacion: { in: [PARTE_CANCION, PARTE_PALABRAS] } } },
  ],
};

function ymdToDate(ymd: string) {
  return new Date(ymd + "T00:00:00.000Z");
}
function addDays(ymd: string, n: number) {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// GET /api/records/stats — conteos con count() (indexado en fecha), sin traer filas.
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const today = todayYMD();
  const dow = ymdToDate(today).getUTCDay(); // 0 dom … 6 sáb
  const monday = addDays(today, -((dow + 6) % 7));
  const sunday = addDays(monday, 6);
  const monthStart = today.slice(0, 7) + "-01";
  const nextMonthStart = addDays(monthStart, 31).slice(0, 7) + "-01";

  const [total, proximas, estaSemana, esteMes] = await Promise.all([
    prisma.record.count({ where: notInicio }),
    prisma.record.count({ where: { AND: [notInicio, { fecha: { gte: ymdToDate(today) } }] } }),
    prisma.record.count({ where: { AND: [notInicio, { fecha: { gte: ymdToDate(monday), lte: ymdToDate(sunday) } }] } }),
    prisma.record.count({
      where: { AND: [notInicio, { fecha: { gte: ymdToDate(monthStart), lt: ymdToDate(nextMonthStart) } }] },
    }),
  ]);

  return ok({ total, proximas, estaSemana, esteMes });
}
