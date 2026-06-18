import type { Person, RecordItem } from "@/lib/types";

export interface HelperSuggestion {
  person: Person;
  pairCount: number;
  lastFecha: string | null;
  reason: string; // motivo corto para mostrar en la UI
}

// Veces que ha trabajado `personId` con cada otra persona (asignado o ayudante).
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

// Última fecha de asignación (YYYY-MM-DD) por persona.
function lastFechaMap(records: RecordItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of records) {
    const f = r.fecha || "";
    for (const id of [r.asignadoId, r.ayudanteId]) {
      if (!id) continue;
      if (!m.has(id) || f > (m.get(id) as string)) m.set(id, f);
    }
  }
  return m;
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

// Personas que ya tienen una asignación en esa fecha (para evitar choques).
function peopleOnDate(records: RecordItem[], fecha: string): Set<string> {
  const s = new Set<string>();
  for (const r of records) {
    if (r.fecha !== fecha) continue;
    s.add(r.asignadoId);
    if (r.ayudanteId) s.add(r.ayudanteId);
  }
  return s;
}

function weeksSince(ymd: string): number {
  const then = new Date(ymd + "T00:00:00Z").getTime();
  return Math.floor((Date.now() - then) / (7 * 24 * 3600 * 1000));
}

// null (nunca asignado) primero; luego la fecha más antigua primero.
function cmpRecency(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b);
}

function buildReason(pairCount: number, lastFecha: string | null): string {
  const novelty = pairCount === 0 ? "Nunca han trabajado juntos" : `Juntos ${pairCount}×`;
  let rec: string;
  if (lastFecha === null) rec = "sin asignaciones aún";
  else {
    const w = weeksSince(lastFecha);
    rec = w <= 0 ? "asignación reciente" : w === 1 ? "1 semana libre" : `${w} semanas libre`;
  }
  return `${novelty} · ${rec}`;
}

/**
 * Sugiere ayudantes para un asignado, considerando:
 *  - compatibilidad por rol (mismo rol; si nadie coincide, no filtra),
 *  - sin choque de fecha (excluye a quien ya tiene asignación ese día),
 *  - equidad por recencia (prioriza a quien lleva más tiempo sin asignación),
 *  - novedad de pareja (prioriza a quien nunca ha trabajado con el asignado).
 */
export function suggestHelpers(opts: {
  asignadoId: string;
  persons: Person[];
  records: RecordItem[];
  fecha?: string;
  max?: number;
}): HelperSuggestion[] {
  const { asignadoId, persons, records, fecha, max = 3 } = opts;
  if (!asignadoId) return [];

  const asignado = persons.find((p) => p.id === asignadoId);
  const asignadoRoleIds = new Set((asignado?.roles ?? []).map((r) => r.id));

  const pairs = pairCountsFor(asignadoId, records);
  const last = lastFechaMap(records);
  const load = loadMap(records);
  const busyOnDate = fecha ? peopleOnDate(records, fecha) : new Set<string>();

  let pool = persons.filter((p) => p.id !== asignadoId && p.active && !busyOnDate.has(p.id));

  // Compatibilidad por rol (con fallback si nadie coincide).
  if (asignadoRoleIds.size > 0) {
    const sameRole = pool.filter((p) => p.roles.some((r) => asignadoRoleIds.has(r.id)));
    if (sameRole.length > 0) pool = sameRole;
  }

  return pool
    .map((person) => ({
      person,
      pairCount: pairs.get(person.id) ?? 0,
      lastFecha: last.get(person.id) ?? null,
      load: load.get(person.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.pairCount - b.pairCount || // novedad de pareja
        cmpRecency(a.lastFecha, b.lastFecha) || // equidad por recencia
        a.load - b.load || // menor carga
        a.person.nombre.localeCompare(b.person.nombre),
    )
    .slice(0, max)
    .map(({ person, pairCount, lastFecha }) => ({
      person,
      pairCount,
      lastFecha,
      reason: buildReason(pairCount, lastFecha),
    }));
}
