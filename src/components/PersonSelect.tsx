"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";

interface Props {
  persons: Person[];
  value: string; // id seleccionado ("" = ninguno)
  onChange: (id: string) => void;
  excludeId?: string; // no mostrar esta persona (la del campo opuesto)
  placeholder?: string;
  allowClear?: boolean;
}

export function PersonSelect({
  persons,
  value,
  onChange,
  excludeId,
  placeholder = "Seleccionar…",
  allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = persons.find((p) => p.id === value);
  const label = selected ? `${selected.nombre} ${selected.apellido}` : "";

  const options = useMemo(() => {
    const q = query.toLowerCase().trim();
    return persons
      .filter((p) => p.id !== excludeId)
      .filter((p) => !q || `${p.nombre} ${p.apellido}`.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [persons, excludeId, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    setTimeout(() => searchRef.current?.focus(), 40);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="sel-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`sel-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`sel-trigger-text${label ? "" : " ph"}`}>{label || placeholder}</span>
        <svg
          className="sel-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="13"
          height="13"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="sel-dropdown">
          <div className="sel-search-wrap">
            <input
              ref={searchRef}
              className="sel-search"
              type="text"
              placeholder="Buscar persona…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="sel-options">
            {allowClear && value && (
              <div className="sel-opt clear-opt" onClick={() => pick("")}>
                ✕ Quitar selección
              </div>
            )}
            {options.length === 0 ? (
              <div className="sel-opt empty-opt">Sin personas</div>
            ) : (
              options.map((p) => (
                <div
                  key={p.id}
                  className={`sel-opt${value === p.id ? " selected" : ""}`}
                  onClick={() => pick(p.id)}
                >
                  {p.nombre} {p.apellido}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
