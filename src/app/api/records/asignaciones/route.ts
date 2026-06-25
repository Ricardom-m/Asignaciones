import { prisma } from "@/lib/prisma";
import { ok, requireSession } from "@/lib/server";

// GET /api/records/asignaciones?section=<id>
// Devuelve los textos de asignación más usados (para sugerirlos al escribir),
// opcionalmente acotados a una sección.
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const section = new URL(req.url).searchParams.get("section");
  const rows = await prisma.record.groupBy({
    by: ["asignacion"],
    where: section ? { sectionId: section } : {},
    _count: { asignacion: true },
    orderBy: { _count: { asignacion: "desc" } },
    take: 24,
  });
  return ok(rows.map((r) => ({ value: r.asignacion, count: r._count.asignacion })));
}
