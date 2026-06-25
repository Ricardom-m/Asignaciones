import { prisma } from "@/lib/prisma";
import { ok, requireSession } from "@/lib/server";
import { todayYMD } from "@/lib/date";
import { serializeRole } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

const toYMD = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

// GET /api/roster?fecha=&role=&genero=
// Devuelve las personas ordenadas por "a quién le toca": más atrasadas primero
// (nunca → más tiempo sin participar), con la carga del mes como desempate, y
// marcando a quien ya está asignado en la fecha objetivo (para evitar conflictos).
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const target = sp.get("fecha") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("fecha")!) ? sp.get("fecha")! : todayYMD();
  const role = sp.get("role");
  const genero = sp.get("genero");
  const section = sp.get("section"); // recencia por sección (opcional)

  const where: Prisma.PersonWhereInput = {
    active: true,
    ...(role ? { roles: { some: { id: role } } } : {}),
    ...(genero === "H" || genero === "M" ? { genero } : {}),
  };
  const persons = await prisma.person.findMany({ where, include: { roles: true } });
  const recs = await prisma.record.findMany({
    select: { fecha: true, asignadoId: true, ayudanteId: true, sectionId: true },
  });

  const targetT = new Date(target + "T00:00:00Z").getTime();
  const recentFrom = targetT - 60 * DAY;
  const targetMonth = target.slice(0, 7);

  type Agg = { last: string | null; month: number; recent: number; onTarget: boolean; lastSec: string | null; countSec: number };
  const agg = new Map<string, Agg>();
  for (const p of persons) agg.set(p.id, { last: null, month: 0, recent: 0, onTarget: false, lastSec: null, countSec: 0 });

  for (const r of recs) {
    const f = toYMD(r.fecha);
    const ft = new Date(f + "T00:00:00Z").getTime();
    const inSection = !!section && r.sectionId === section;
    for (const pid of [r.asignadoId, r.ayudanteId]) {
      if (!pid) continue;
      const a = agg.get(pid);
      if (!a) continue;
      if (f === target) a.onTarget = true;
      if (ft < targetT) {
        if (!a.last || f > a.last) a.last = f;
        if (ft >= recentFrom) a.recent++;
        if (inSection && (!a.lastSec || f > a.lastSec)) a.lastSec = f;
      }
      if (f.slice(0, 7) === targetMonth) a.month++;
      if (inSection) a.countSec++;
    }
  }

  const list = persons.map((p) => {
    const a = agg.get(p.id)!;
    const daysSince = a.last ? Math.round((targetT - new Date(a.last + "T00:00:00Z").getTime()) / DAY) : null;
    return {
      id: p.id,
      nombre: `${p.nombre} ${p.apellido}`,
      genero: p.genero,
      roles: p.roles.map(serializeRole),
      lastFecha: a.last,
      daysSince,
      countMonth: a.month,
      countRecent: a.recent,
      assignedOnTarget: a.onTarget,
      ...(section
        ? { daysSinceSection: a.lastSec ? Math.round((targetT - new Date(a.lastSec + "T00:00:00Z").getTime()) / DAY) : null, countSection: a.countSec }
        : {}),
    };
  });

  list.sort((x, y) => {
    if (x.assignedOnTarget !== y.assignedOnTarget) return x.assignedOnTarget ? 1 : -1; // ya asignados, al final
    const xn = x.daysSince === null, yn = y.daysSince === null;
    if (xn !== yn) return xn ? -1 : 1; // nunca participó → arriba
    if (xn && yn) return x.countMonth - y.countMonth || x.nombre.localeCompare(y.nombre);
    if (y.daysSince! !== x.daysSince!) return y.daysSince! - x.daysSince!; // más tiempo sin participar arriba
    return x.countRecent - y.countRecent || x.nombre.localeCompare(y.nombre);
  });

  return ok(list);
}
