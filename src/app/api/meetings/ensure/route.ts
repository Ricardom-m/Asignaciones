import { prisma } from "@/lib/prisma";
import { ok, requireSession } from "@/lib/server";

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(ymd: string) {
  return new Date(ymd + "T00:00:00Z").getUTCDay();
}

// POST /api/meetings/ensure — crea (sin duplicar) las reuniones que falten en las
// próximas N semanas según la regla guardada. Idempotente.
export async function POST() {
  const { response } = await requireSession();
  if (response) return response;

  const cfg = await prisma.meetingConfig.findUnique({ where: { id: "default" } });
  const weekdays = new Set(cfg?.weekdays ?? [4, 6]);
  const weeks = cfg?.weeks ?? 4;
  if (weekdays.size === 0) return ok({ created: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const fechas: string[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const ymd = addDays(today, i);
    if (weekdays.has(weekdayOf(ymd))) fechas.push(ymd);
  }
  if (fechas.length === 0) return ok({ created: 0 });

  const res = await prisma.meeting.createMany({
    data: fechas.map((f) => ({ fecha: new Date(f) })),
    skipDuplicates: true,
  });
  return ok({ created: res.count });
}
