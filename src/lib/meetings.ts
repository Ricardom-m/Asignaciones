import { prisma } from "@/lib/prisma";

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(ymd: string) {
  return new Date(ymd + "T00:00:00Z").getUTCDay();
}

/**
 * Crea (sin duplicar) las reuniones que falten en la ventana definida por la regla
 * guardada (días + semanas). Idempotente. Devuelve cuántas se crearon.
 * Usado por el endpoint con sesión y por el cron protegido por secreto.
 */
export async function ensureMeetingWindow(): Promise<number> {
  const cfg = await prisma.meetingConfig.findUnique({ where: { id: "default" } });
  const weekdays = new Set(cfg?.weekdays ?? [4, 6]);
  const weeks = cfg?.weeks ?? 4;
  if (weekdays.size === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const fechas: string[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const ymd = addDays(today, i);
    if (weekdays.has(weekdayOf(ymd))) fechas.push(ymd);
  }
  if (fechas.length === 0) return 0;

  const res = await prisma.meeting.createMany({
    data: fechas.map((f) => ({ fecha: new Date(f) })),
    skipDuplicates: true,
  });
  return res.count;
}
