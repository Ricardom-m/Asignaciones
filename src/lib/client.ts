import type { Person, RecordItem, Role, Section, Meeting, Genero, AllowedUser, RecordTipo, MeetingConfig } from "@/lib/types";
import { todayYMD } from "@/lib/date";

// Wrapper de fetch que lanza con el mensaje de error de la API.
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

export const fetcher = <T>(url: string) => apiFetch<T>(url);

// ── Personas ──────────────────────────────────────────────
export interface PersonPayload {
  nombre: string;
  apellido: string;
  genero?: Genero | null;
  roleIds?: string[];
  active?: boolean;
}
export const createPerson = (data: PersonPayload) =>
  apiFetch<Person>("/api/persons", { method: "POST", body: JSON.stringify(data) });

export const updatePerson = (id: string, data: Partial<PersonPayload>) =>
  apiFetch<Person>(`/api/persons/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deletePerson = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/persons/${id}`, { method: "DELETE" });

// ── Roles ─────────────────────────────────────────────────
export const createRole = (data: { nombre: string; color?: string }) =>
  apiFetch<Role>("/api/roles", { method: "POST", body: JSON.stringify(data) });

export const updateRole = (id: string, data: { nombre?: string; color?: string; active?: boolean }) =>
  apiFetch<Role>(`/api/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteRole = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/roles/${id}`, { method: "DELETE" });

// ── Secciones ─────────────────────────────────────────────
export const createSection = (data: { nombre: string }) =>
  apiFetch<Section>("/api/sections", { method: "POST", body: JSON.stringify(data) });

export const updateSection = (
  id: string,
  data: { nombre?: string; orden?: number; active?: boolean; sinAyudante?: boolean; unaPorSala?: boolean; soloAdmin?: boolean },
) => apiFetch<Section>(`/api/sections/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteSection = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/sections/${id}`, { method: "DELETE" });

// ── Reuniones ─────────────────────────────────────────────
export const createMeetings = (fechas: string[], nota?: string) =>
  apiFetch<Meeting[]>("/api/meetings", { method: "POST", body: JSON.stringify({ fechas, nota }) });

export const updateMeeting = (id: string, data: { fecha?: string; nota?: string | null }) =>
  apiFetch<Meeting>(`/api/meetings/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteMeeting = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/meetings/${id}`, { method: "DELETE" });

export const updateMeetingConfig = (data: MeetingConfig) =>
  apiFetch<MeetingConfig>("/api/meetings/config", { method: "PUT", body: JSON.stringify(data) });

export const purgeMeetings = (body: { past?: boolean; ids?: string[] }) =>
  apiFetch<{ deleted: number }>("/api/meetings/purge", { method: "POST", body: JSON.stringify(body) });

// Genera (sin duplicar) las reuniones que falten en la ventana de la regla.
export const ensureMeetings = () =>
  apiFetch<{ created: number }>("/api/meetings/ensure", { method: "POST" });

// ── Usuarios autorizados ──────────────────────────────────
export const createUser = (data: { email: string; nombre?: string }) =>
  apiFetch<AllowedUser>("/api/users", { method: "POST", body: JSON.stringify(data) });

export const deleteUser = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/users/${id}`, { method: "DELETE" });

// ── Registros ─────────────────────────────────────────────
export interface RecordPayload {
  asignadoId: string | null;
  ayudanteId: string | null;
  fecha: string;
  sala: string | null;
  asignacion: string;
  tipo?: RecordTipo;
  sectionId?: string | null;
  minutos?: number | null;
  cantico?: number | null;
}
export const createRecord = (data: RecordPayload) =>
  apiFetch<RecordItem>("/api/records", { method: "POST", body: JSON.stringify(data) });

export const updateRecord = (id: string, data: RecordPayload) =>
  apiFetch<RecordItem>(`/api/records/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteRecord = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/records/${id}`, { method: "DELETE" });

// Crea (idempotente) la sección "Inicio" y sus 2 partes fijas (Canción +
// Palabras de instrucción) para una fecha. Se llama al abrir el planificador.
export const ensureInicio = (fecha: string) =>
  apiFetch<{ created: number; sectionCreated: boolean }>("/api/records/ensure-inicio", {
    method: "POST",
    body: JSON.stringify({ fecha }),
  });

// Reordenar / cambiar de sala en lote (planificador).
export const arrangeRecords = (updates: { id: string; orden: number; sala?: string | null }[]) =>
  apiFetch<{ updated: number }>("/api/records/arrange", { method: "POST", body: JSON.stringify({ updates }) });

// ── Lectura de la Biblia ──────────────────────────────────
// La lectura la hace un varón: Nombrados, Asignados o Precursores (hombre).
const LECTURA_ROLES = new Set(["Nombrados", "Asignados", "Precursores"]);
export const esLectura = (asignacion: string) => asignacion.trim().toLowerCase() === "lectura de la biblia";
export const eligibleLectura = (persons: Person[]) =>
  persons.filter((p) => p.genero === "H" && p.roles.some((r) => LECTURA_ROLES.has(r.nombre)));

// ── Fechas ────────────────────────────────────────────────
export function fmtDate(ymd?: string | null): string {
  if (!ymd) return "—";
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDT(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  );
}
export { todayYMD };

// Suma días a una fecha YYYY-MM-DD (en UTC, consistente con todayYMD()).
export function addDaysYMD(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const weekdayOf = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();
export const weekdayLabel = (n: number) => DIAS[n] ?? "";

// "Jue 19 jun" — etiqueta corta con día de la semana.
export function fmtShort(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  const mes = d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }).replace(".", "");
  return `${weekdayLabel(d.getUTCDay())} ${d.getUTCDate()} ${mes}`;
}

// Genera las fechas (YMD) de los días de la semana indicados en las próximas N semanas.
export function nextWeekdayDates(weekdays: number[], weeks: number, from = todayYMD()): string[] {
  const set = new Set(weekdays);
  const out: string[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const ymd = addDaysYMD(from, i);
    if (set.has(weekdayOf(ymd))) out.push(ymd);
  }
  return out;
}

export type DateLevel = "hoy" | "manana" | "pasado" | "endias" | "prox" | "pasada";
// Estado de una fecha respecto a hoy. Cada nivel tiene su propio color para
// distinguir de un vistazo qué tan cerca está la asignación.
export function dateStatus(ymd: string): { label: string; level: DateLevel } {
  const today = todayYMD();
  if (ymd === today) return { label: "Hoy", level: "hoy" };
  if (ymd < today) return { label: "Pasada", level: "pasada" };
  const diff = Math.round(
    (new Date(ymd + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86_400_000,
  );
  if (diff === 1) return { label: "Mañana", level: "manana" };
  if (diff === 2) return { label: "Pasado mañana", level: "pasado" };
  if (diff <= 6) return { label: `En ${diff} días`, level: "endias" };
  return { label: "Próxima", level: "prox" };
}

// Diferencia en días vs hoy, en texto ("en 3 días", "hace 2 días", "hoy"…).
export function relativeLabel(ymd: string): string {
  const day = 24 * 3600 * 1000;
  const diff = Math.round(
    (new Date(ymd + "T00:00:00Z").getTime() - new Date(todayYMD() + "T00:00:00Z").getTime()) / day,
  );
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  return diff > 0 ? `en ${diff} días` : `hace ${Math.abs(diff)} días`;
}
