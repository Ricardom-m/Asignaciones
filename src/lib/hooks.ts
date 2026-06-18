"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client";
import type { Person, RecordItem, Role, Meeting } from "@/lib/types";

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

export function useRecords(sort = "createdAt", dir: "asc" | "desc" = "desc") {
  const key = `/api/records?sort=${sort}&dir=${dir}`;
  const { data, error, isLoading, mutate } = useSWR<RecordItem[]>(key, fetcher);
  return { records: data ?? [], error, isLoading, mutate };
}
