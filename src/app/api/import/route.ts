import { prisma } from "@/lib/prisma";
import { importInput } from "@/lib/validation";
import { ok, fail, requireSession, rateLimit, clientKey } from "@/lib/server";

// POST /api/import — carga el JSON exportado por la app v1 ({ persons, records }).
// Conserva los IDs originales (son strings únicos) para preservar las relaciones
// asignado/ayudante. Idempotente: usa upsert, se puede reintentar sin duplicar.
export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) return response;
  if (!rateLimit(clientKey(req, session.user?.email), 5, 60_000))
    return fail("Demasiadas importaciones seguidas, espera un momento", 429);

  const body = await req.json().catch(() => null);
  const parsed = importInput.safeParse(body);
  if (!parsed.success)
    return fail("JSON inválido", 422, parsed.error.flatten().fieldErrors);

  const { persons, records } = parsed.data;

  // ── Personas ──
  let personsCreated = 0;
  for (const p of persons) {
    const data = { nombre: p.nombre.trim(), apellido: (p.apellido ?? "").trim() };
    await prisma.person.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        ...data,
        ...(p.createdAt ? { createdAt: new Date(p.createdAt) } : {}),
      },
      update: data,
    });
    personsCreated++;
  }

  // Mapa nombre-completo → id para resolver registros sin asignadoId.
  const allPersons = await prisma.person.findMany();
  const byName = new Map(
    allPersons.map((p) => [`${p.nombre} ${p.apellido}`.trim().toLowerCase(), p.id]),
  );
  const validIds = new Set(allPersons.map((p) => p.id));

  const resolveId = (id?: string | null, name?: string | null): string | null => {
    if (id && validIds.has(id)) return id;
    if (name) return byName.get(name.trim().toLowerCase()) ?? null;
    return null;
  };

  // ── Registros ──
  let recordsImported = 0;
  const skipped: string[] = [];
  for (const r of records) {
    const asignadoId = resolveId(r.asignadoId, r.asignado);
    if (!asignadoId) {
      skipped.push(r.asignacion || r.id || "(sin asignación)");
      continue;
    }
    let ayudanteId = resolveId(r.ayudanteId, r.ayudante);
    if (ayudanteId === asignadoId) ayudanteId = null;

    const fecha = r.fecha && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha)
      ? new Date(r.fecha)
      : new Date();

    const data = {
      asignadoId,
      ayudanteId,
      fecha,
      sala: r.sala ?? null,
      asignacion: (r.asignacion ?? "").trim() || "(sin descripción)",
      ...(r.createdAt ? { createdAt: new Date(r.createdAt) } : {}),
      ...(r.updatedAt ? { updatedAt: new Date(r.updatedAt) } : {}),
    };

    if (r.id) {
      await prisma.record.upsert({
        where: { id: r.id },
        create: { id: r.id, ...data },
        update: data,
      });
    } else {
      await prisma.record.create({ data });
    }
    recordsImported++;
  }

  return ok({
    personsCreated,
    recordsImported,
    skipped: skipped.length,
    skippedDetail: skipped.slice(0, 20),
  });
}
