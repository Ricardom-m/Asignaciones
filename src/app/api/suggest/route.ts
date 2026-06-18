import { prisma } from "@/lib/prisma";
import { serializePerson, serializeRecord, recordInclude } from "@/lib/serialize";
import { rankHelpers } from "@/lib/suggest";
import { ok, requireSession } from "@/lib/server";

// GET /api/suggest?asignadoId=&fecha= — ranking de ayudantes calculado EN EL SERVIDOR.
// Reutiliza la lógica pura `rankHelpers`; el cómputo pesado no viaja al navegador,
// solo la lista corta de candidatos compatibles.
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const sp = new URL(req.url).searchParams;
  const asignadoId = sp.get("asignadoId");
  const fecha = sp.get("fecha") ?? undefined;
  if (!asignadoId) return ok([]);

  const [persons, records] = await Promise.all([
    prisma.person.findMany({ include: { roles: true } }),
    prisma.record.findMany({ include: recordInclude }),
  ]);

  const candidates = rankHelpers({
    asignadoId,
    persons: persons.map(serializePerson),
    records: records.map(serializeRecord),
    fecha,
  });
  return ok(candidates);
}
