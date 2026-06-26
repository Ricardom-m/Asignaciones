import type { Person, RecordItem } from "@/lib/types";

export type Level = "alto" | "medio" | "bajo";

export interface ScoredCandidate {
  person: Person;
  pairCount: number; // veces que ya trabajaron juntos
  lastFecha: string | null; // última asignación de la persona
  weeksFree: number | null; // semanas desde su última asignación (null = nunca)
  load: number; // total de asignaciones de la persona
  distinctPartners: number; // con cuántas personas distintas ha trabajado
  weekConflict: boolean; // ya tiene asignación en la misma semana que la fecha
  score: number; // 0–100
  level: Level;
}

// ── utilidades de fecha ───────────────────────────────────
function addDaysYMD(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(ymd: string): string {
  const day = new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 dom … 6 sáb
  return addDaysYMD(ymd, -((day + 6) % 7));
}
function weeksSince(ymd: string): number {
  const then = new Date(ymd + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((Date.now() - then) / (7 * 24 * 3600 * 1000)));
}

// ── conteos ───────────────────────────────────────────────
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
function loadMap(records: RecordItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    if (r.asignadoId) m.set(r.asignadoId, (m.get(r.asignadoId) ?? 0) + 1);
    if (r.ayudanteId) m.set(r.ayudanteId, (m.get(r.ayudanteId) ?? 0) + 1);
  }
  return m;
}
function distinctPartnersMap(records: RecordItem[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a?: string | null, b?: string | null) => {
    if (!a || !b) return;
    if (!m.has(a)) m.set(a, new Set());
    m.get(a)!.add(b);
  };
  for (const r of records) {
    add(r.asignadoId, r.ayudanteId);
    add(r.ayudanteId, r.asignadoId);
  }
  return m;
}
function peopleOnDate(records: RecordItem[], fecha: string): Set<string> {
  const s = new Set<string>();
  for (const r of records) {
    if (r.fecha !== fecha) continue;
    if (r.asignadoId) s.add(r.asignadoId);
    if (r.ayudanteId) s.add(r.ayudanteId);
  }
  return s;
}
function peopleInWeek(records: RecordItem[], fecha: string): Set<string> {
  const wk = mondayOf(fecha);
  const s = new Set<string>();
  for (const r of records) {
    if (!r.fecha || mondayOf(r.fecha) !== wk) continue;
    if (r.asignadoId) s.add(r.asignadoId);
    if (r.ayudanteId) s.add(r.ayudanteId);
  }
  return s;
}

const isNombrado = (p: Person) => p.roles.some((r) => r.nombre === "Nombrados");

/**
 * Rankea TODOS los ayudantes compatibles con el asignado (mismo género, salvo
 * Nombrados), excluyendo a quien ya tiene asignación ese mismo día. Calcula para
 * cada uno un puntaje 0–100 que combina: novedad de pareja, equidad por recencia,
 * balance de carga y cobertura (variedad), con penalización por choque de semana.
 */
export function rankHelpers(opts: {
  asignadoId: string;
  persons: Person[];
  records: RecordItem[];
  fecha?: string;
}): ScoredCandidate[] {
  const { asignadoId, persons, records, fecha } = opts;
  if (!asignadoId) return [];

  const asignado = persons.find((p) => p.id === asignadoId);
  const asignadoGenero = asignado?.genero ?? null;
  const asignadoIsNombrado = asignado ? isNombrado(asignado) : false;

  const pairs = pairCountsFor(asignadoId, records);
  const last = lastFechaMap(records);
  const load = loadMap(records);
  const distinct = distinctPartnersMap(records);
  const busyDate = fecha ? peopleOnDate(records, fecha) : new Set<string>();
  const busyWeek = fecha ? peopleInWeek(records, fecha) : new Set<string>();

  // Pool: activos, no el asignado, no ocupados ese día, compatibles por género.
  let pool = persons.filter((p) => p.id !== asignadoId && p.active && !busyDate.has(p.id));
  const compatible = pool.filter(
    (p) =>
      asignadoIsNombrado || isNombrado(p) || !asignadoGenero || !p.genero || p.genero === asignadoGenero,
  );
  if (compatible.length > 0) pool = compatible;

  const base = pool.map((person) => {
    const lf = last.get(person.id) ?? null;
    return {
      person,
      pairCount: pairs.get(person.id) ?? 0,
      lastFecha: lf,
      weeksFree: lf ? weeksSince(lf) : null,
      load: load.get(person.id) ?? 0,
      distinctPartners: distinct.get(person.id)?.size ?? 0,
      weekConflict: busyWeek.has(person.id),
    };
  });

  const maxLoad = Math.max(0, ...base.map((b) => b.load));
  const maxDistinct = Math.max(0, ...base.map((b) => b.distinctPartners));

  const scored: ScoredCandidate[] = base.map((b) => {
    const novelty = b.pairCount === 0 ? 40 : 40 / (1 + b.pairCount); // 0–40
    const fairness = b.weeksFree === null ? 30 : 30 * (Math.min(b.weeksFree, 12) / 12); // 0–30
    const loadScore = maxLoad > 0 ? 20 * (1 - b.load / maxLoad) : 20; // 0–20
    const coverage = maxDistinct > 0 ? 10 * (1 - b.distinctPartners / maxDistinct) : 10; // 0–10
    let score = novelty + fairness + loadScore + coverage;
    if (b.weekConflict) score -= 25;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const level: Level = score >= 66 ? "alto" : score >= 40 ? "medio" : "bajo";
    return { ...b, score, level };
  });

  return scored.sort(
    (a, b) => b.score - a.score || a.person.nombre.localeCompare(b.person.nombre),
  );
}
