import type { Person, RecordItem } from "@/lib/types";

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
export const createPerson = (data: { nombre: string; apellido: string }) =>
  apiFetch<Person>("/api/persons", { method: "POST", body: JSON.stringify(data) });

export const updatePerson = (id: string, data: { nombre: string; apellido: string }) =>
  apiFetch<Person>(`/api/persons/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deletePerson = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/persons/${id}`, { method: "DELETE" });

// ── Registros ─────────────────────────────────────────────
export interface RecordPayload {
  asignadoId: string;
  ayudanteId: string | null;
  fecha: string;
  sala: string | null;
  asignacion: string;
}
export const createRecord = (data: RecordPayload) =>
  apiFetch<RecordItem>("/api/records", { method: "POST", body: JSON.stringify(data) });

export const updateRecord = (id: string, data: RecordPayload) =>
  apiFetch<RecordItem>(`/api/records/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteRecord = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/records/${id}`, { method: "DELETE" });

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
export const todayYMD = () => new Date().toISOString().slice(0, 10);
