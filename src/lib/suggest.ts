import type { Person, RecordItem } from "@/lib/types";

export interface HelperSuggestion {
  person: Person;
  pairCount: number; // veces que ya han trabajado juntos
  load: number; // total de asignaciones de esa persona (para equilibrar)
}

// Cuántas veces ha trabajado `personId` con cada otra persona (como asignado o ayudante).
export function pairCountsFor(personId: string, records: RecordItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of records) {
    let partnerId: string | null = null;
    if (r.asignadoId === personId) partnerId = r.ayudanteId;
    else if (r.ayudanteId === personId) partnerId = r.asignadoId;
    if (!partnerId) continue;
    counts.set(partnerId, (counts.get(partnerId) ?? 0) + 1);
  }
  return counts;
}

// Carga total (nº de registros) en que aparece cada persona.
function loadMap(records: RecordItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    m.set(r.asignadoId, (m.get(r.asignadoId) ?? 0) + 1);
    if (r.ayudanteId) m.set(r.ayudanteId, (m.get(r.ayudanteId) ?? 0) + 1);
  }
  return m;
}

/**
 * Sugiere ayudantes para un asignado: personas ACTIVAS con quienes nunca (o casi
 * nunca) ha trabajado, priorizando además a las de menor carga (equilibrar parejas).
 */
export function suggestHelpers(
  asignadoId: string,
  persons: Person[],
  records: RecordItem[],
  max = 3,
): HelperSuggestion[] {
  if (!asignadoId) return [];
  const pairs = pairCountsFor(asignadoId, records);
  const load = loadMap(records);

  return persons
    .filter((p) => p.id !== asignadoId && p.active)
    .map((person) => ({
      person,
      pairCount: pairs.get(person.id) ?? 0,
      load: load.get(person.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.pairCount - b.pairCount || // primero los que nunca han trabajado juntos
        a.load - b.load || // luego los de menor carga
        a.person.nombre.localeCompare(b.person.nombre),
    )
    .slice(0, max);
}
