"use client";

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/client";
import type { Person, RecordItem, Role, Section, Meeting, AllowedUser, MeetingConfig, RosterPerson } from "@/lib/types";
import type { ScoredCandidate } from "@/lib/suggest";

export function usePersons() {
  const { data, error, isLoading, mutate } = useSWR<Person[]>("/api/persons", fetcher);
  return { persons: data ?? [], error, isLoading, mutate };
}

export function useRoles() {
  const { data, error, isLoading, mutate } = useSWR<Role[]>("/api/roles", fetcher);
  return { roles: data ?? [], error, isLoading, mutate };
}

export function useSections() {
  const { data, error, isLoading, mutate } = useSWR<Section[]>("/api/sections", fetcher);
  return { sections: data ?? [], error, isLoading, mutate };
}

// Solo reuniones próximas (la lista que crece sin límite son las pasadas).
export function useMeetings() {
  const { data, error, isLoading, mutate } = useSWR<Meeting[]>("/api/meetings?scope=upcoming", fetcher);
  return { meetings: data ?? [], error, isLoading, mutate };
}

export function usePastMeetings(enabled: boolean, take = 30) {
  const { data, mutate } = useSWR<Meeting[]>(enabled ? `/api/meetings?scope=past&take=${take}` : null, fetcher);
  return { past: data ?? [], mutate };
}

export function useMeetingConfig() {
  const { data, mutate } = useSWR<MeetingConfig>("/api/meetings/config", fetcher);
  return { config: data ?? { weekdays: [4, 6], weeks: 4 }, mutate };
}

export function useUsers() {
  const { data, mutate } = useSWR<{ users: AllowedUser[]; bootstrap: string[] }>("/api/users", fetcher);
  return { users: data?.users ?? [], bootstrap: data?.bootstrap ?? [], mutate };
}

// ── Records ───────────────────────────────────────────────
interface RecordsPage {
  items: RecordItem[];
  nextCursor: string | null;
}

// Lista paginada por cursor (Registros). Filtros (scope/sala/q/tipo) en el servidor.
export function useRecordsList(params: { scope?: string; sala?: string; q?: string; tipo?: string }) {
  const base = new URLSearchParams();
  if (params.scope) base.set("scope", params.scope);
  if (params.sala) base.set("sala", params.sala);
  if (params.q) base.set("q", params.q);
  if (params.tipo) base.set("tipo", params.tipo);

  const getKey = (index: number, prev: RecordsPage | null) => {
    if (prev && !prev.nextCursor) return null;
    const sp = new URLSearchParams(base);
    sp.set("take", "25");
    if (index > 0 && prev?.nextCursor) sp.set("cursor", prev.nextCursor);
    return `/api/records?${sp.toString()}`;
  };

  const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<RecordsPage>(
    getKey,
    fetcher,
    { revalidateFirstPage: true, revalidateOnMount: true },
  );

  const items = data ? data.flatMap((d) => d.items) : [];
  const hasMore = data ? Boolean(data[data.length - 1]?.nextCursor) : true;
  return {
    items,
    hasMore,
    loadMore: () => setSize(size + 1),
    isLoading: isLoading || (isValidating && !data),
    mutate,
  };
}

// Conteos del dashboard/resumen (servidor, con count()).
export function useRecordsStats() {
  const { data, mutate } = useSWR<{ total: number; proximas: number; estaSemana: number; esteMes: number }>(
    "/api/records/stats",
    fetcher,
  );
  return { stats: data ?? { total: 0, proximas: 0, estaSemana: 0, esteMes: 0 }, mutate };
}

// Una página chica de registros (dashboard: próximas / recientes).
export function useRecordsPage(query: string) {
  const { data, mutate } = useSWR<RecordsPage>(`/api/records?${query}`, fetcher);
  return { items: data?.items ?? [], mutate };
}

// Registros de UNA fecha exacta (planificador).
export function useDateRecords(fecha: string | null) {
  const { data, mutate } = useSWR<RecordsPage>(fecha ? `/api/records?fecha=${fecha}&all=1` : null, fetcher);
  return { items: data?.items ?? [], mutate };
}

// Roster ordenado por "a quién le toca" para una fecha (equidad / sugerencia).
export function useRoster(fecha: string | null, role?: string, genero?: string) {
  const sp = new URLSearchParams();
  if (fecha) sp.set("fecha", fecha);
  if (role) sp.set("role", role);
  if (genero) sp.set("genero", genero);
  const { data, mutate, isLoading } = useSWR<RosterPerson[]>(fecha ? `/api/roster?${sp.toString()}` : null, fetcher);
  return { roster: data ?? [], mutate, isLoading };
}

// Registros de UNA persona (para "Por persona"); consulta indacada por asignadoId/ayudanteId.
export function usePersonRecords(personId: string | null) {
  const { data, mutate } = useSWR<RecordsPage>(personId ? `/api/records?personId=${personId}&all=1` : null, fetcher);
  return { items: data?.items ?? [], mutate };
}

// Sugerencias de ayudante calculadas en el servidor.
export function useSuggest(asignadoId: string, fecha: string) {
  const key = asignadoId ? `/api/suggest?asignadoId=${asignadoId}&fecha=${fecha || ""}` : null;
  const { data, isLoading } = useSWR<ScoredCandidate[]>(key, fetcher);
  return { candidates: data ?? [], isLoading };
}
