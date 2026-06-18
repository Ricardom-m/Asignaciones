"use client";

import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/client";
import type { Person, RecordItem, Role, Meeting } from "@/lib/types";
import type { ScoredCandidate } from "@/lib/suggest";

export function usePersons() {
  const { data, error, isLoading, mutate } = useSWR<Person[]>("/api/persons", fetcher);
  return { persons: data ?? [], error, isLoading, mutate };
}

export function useRoles() {
  const { data, error, isLoading, mutate } = useSWR<Role[]>("/api/roles", fetcher);
  return { roles: data ?? [], error, isLoading, mutate };
}

export function useMeetings() {
  const { data, error, isLoading, mutate } = useSWR<Meeting[]>("/api/meetings", fetcher);
  return { meetings: data ?? [], error, isLoading, mutate };
}

// ── Records ───────────────────────────────────────────────
interface RecordsPage {
  items: RecordItem[];
  nextCursor: string | null;
}

// Lista paginada por cursor (Registros). Filtros (scope/sala/q) se aplican en el servidor.
export function useRecordsList(params: { scope?: string; sala?: string; q?: string }) {
  const base = new URLSearchParams();
  if (params.scope) base.set("scope", params.scope);
  if (params.sala) base.set("sala", params.sala);
  if (params.q) base.set("q", params.q);

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
    { revalidateFirstPage: false },
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

// Registros de UNA persona (para "Por persona"); consulta indacada por asignadoId/ayudanteId.
export function usePersonRecords(personId: string | null) {
  const { data } = useSWR<RecordsPage>(personId ? `/api/records?personId=${personId}&all=1` : null, fetcher);
  return { items: data?.items ?? [] };
}

// Sugerencias de ayudante calculadas en el servidor.
export function useSuggest(asignadoId: string, fecha: string) {
  const key = asignadoId ? `/api/suggest?asignadoId=${asignadoId}&fecha=${fecha || ""}` : null;
  const { data, isLoading } = useSWR<ScoredCandidate[]>(key, fetcher);
  return { candidates: data ?? [], isLoading };
}
