import { prisma } from "@/lib/prisma";
import { todayYMD } from "@/lib/date";

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

  const today = todayYMD();
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

/**
 * Versión "cada N días": solo hace el trabajo si pasaron al menos `days` días
 * desde la última vez. Se llama al abrir la app, así se mantiene al día sin
 * agentes externos ni correr en cada navegación.
 */
export async function ensureMeetingWindowThrottled(days = 3): Promise<number> {
  const cfg = await prisma.meetingConfig.findUnique({ where: { id: "default" } });
  if (cfg?.lastEnsured && Date.now() - cfg.lastEnsured.getTime() < days * 86_400_000) return 0;
  const created = await ensureMeetingWindow();
  await prisma.meetingConfig.upsert({
    where: { id: "default" },
    create: { id: "default", lastEnsured: new Date() },
    update: { lastEnsured: new Date() },
  });
  return created;
}
