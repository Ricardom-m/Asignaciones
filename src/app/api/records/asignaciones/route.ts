import { prisma } from "@/lib/prisma";
import { ok, requireSession } from "@/lib/server";

// GET /api/records/asignaciones?section=<id>
// Devuelve los textos de asignación más usados (para sugerirlos al escribir),
// junto con su duración más frecuente (en minutos), opcionalmente por sección.
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const section = new URL(req.url).searchParams.get("section");
  const rows = await prisma.record.groupBy({
    by: ["asignacion", "minutos"],
    where: section ? { sectionId: section } : {},
    _count: { _all: true },
  });

  // Agrupa por texto: total de usos + minutos por mayoría (moda).
  const map = new Map<string, { count: number; votes: Map<number, number> }>();
  for (const r of rows) {
    const m = map.get(r.asignacion) ?? { count: 0, votes: new Map<number, number>() };
    m.count += r._count._all;
    if (r.minutos != null) m.votes.set(r.minutos, (m.votes.get(r.minutos) ?? 0) + r._count._all);
    map.set(r.asignacion, m);
  }

  const out = [...map]
    .map(([value, m]) => {
      let minutos: number | null = null;
      let best = 0;
      for (const [min, v] of m.votes) if (v > best) { best = v; minutos = min; }
      return { value, count: m.count, minutos };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  return ok(out);
}
