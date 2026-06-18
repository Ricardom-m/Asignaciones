"use client";

import { useMemo, useState } from "react";
import { RoleBadge } from "@/components/RoleBadge";
import type { ScoredCandidate } from "@/lib/suggest";
import type { Role } from "@/lib/types";

interface Props {
  candidates: ScoredCandidate[];
  roles: Role[];
  value: string;
  onChange: (id: string) => void;
}

type SortKey = "score" | "load" | "novelty" | "free" | "az";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Recomendado" },
  { key: "novelty", label: "Nunca juntos" },
  { key: "free", label: "Más libre" },
  { key: "load", label: "Menos cargado" },
  { key: "az", label: "A–Z" },
];

const TOP = 4;

// Ícono de usuario (hombre): cabeza + hombros.
function IconMan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}
// Ícono de usuaria (mujer): cabeza + vestido en A.
function IconWoman() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="6.5" r="3.5" />
      <path d="M12 10 7.5 20h9L12 10z" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}

function reasonOf(c: ScoredCandidate): string {
  const pair = c.pairCount === 0 ? "Nunca juntos" : `Juntos ×${c.pairCount}`;
  const free =
    c.weeksFree === null
      ? "sin asignaciones"
      : c.weeksFree <= 0
        ? "asignado esta semana"
        : `libre ${c.weeksFree} sem`;
  return `${pair} · ${free} · ${c.load} asig`;
}

export function HelperPicker({ candidates, roles, value, onChange }: Props) {
  const [filterRole, setFilterRole] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Roles presentes entre los candidatos (para no mostrar filtros vacíos).
  const presentRoles = useMemo(() => {
    const ids = new Set<string>();
    candidates.forEach((c) => c.person.roles.forEach((r) => ids.add(r.id)));
    return roles.filter((r) => ids.has(r.id));
  }, [candidates, roles]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = candidates.filter((c) => {
      if (filterRole && !c.person.roles.some((r) => r.id === filterRole)) return false;
      if (q && !`${c.person.nombre} ${c.person.apellido}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    switch (sortKey) {
      case "load":
        sorted.sort((a, b) => a.load - b.load || b.score - a.score);
        break;
      case "novelty":
        sorted.sort((a, b) => a.pairCount - b.pairCount || b.score - a.score);
        break;
      case "free":
        sorted.sort((a, b) => (b.weeksFree ?? 9999) - (a.weeksFree ?? 9999) || b.score - a.score);
        break;
      case "az":
        sorted.sort((a, b) => a.person.nombre.localeCompare(b.person.nombre));
        break;
      default:
        sorted.sort((a, b) => b.score - a.score);
    }
    return sorted;
  }, [candidates, filterRole, query, sortKey]);

  const visible = expanded ? filtered : filtered.slice(0, TOP);

  if (candidates.length === 0) return null;

  return (
    <div className="hp">
      <div className="hp-head">
        <span className="suggest-tip">💡 Sugerencias de ayudante</span>
        <span className="hp-count">{filtered.length}</span>
      </div>

      {/* Filtros por rol */}
      {presentRoles.length > 1 && (
        <div className="hp-filters">
          <button
            type="button"
            className="role-chip"
            onClick={() => setFilterRole("")}
            style={!filterRole ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
          >
            Todos
          </button>
          {presentRoles.map((r) => (
            <button
              key={r.id}
              type="button"
              className="role-chip"
              onClick={() => setFilterRole(filterRole === r.id ? "" : r.id)}
              style={filterRole === r.id ? { color: r.color, borderColor: r.color, background: r.color + "22" } : undefined}
            >
              {r.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Orden + búsqueda */}
      <div className="hp-toolbar">
        <select className="hp-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>Ordenar: {s.label}</option>
          ))}
        </select>
        <input
          className="hp-search"
          type="text"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div className={`hp-list${expanded ? " expanded" : ""}`}>
        {visible.map((c) => {
          const on = value === c.person.id;
          const initials = (c.person.nombre[0] + (c.person.apellido[0] || "")).toUpperCase();
          return (
            <button
              key={c.person.id}
              type="button"
              className={`hp-card${on ? " on" : ""}`}
              onClick={() => onChange(c.person.id)}
            >
              <span className="hp-avatar">{initials}</span>
              <div className="hp-main">
                <div className="hp-name">
                  {c.person.nombre} {c.person.apellido}
                  {c.person.genero && (
                    <span
                      className={`hp-gender ${c.person.genero === "H" ? "h" : "m"}`}
                      title={c.person.genero === "H" ? "Hombre" : "Mujer"}
                    >
                      {c.person.genero === "H" ? <IconMan /> : <IconWoman />}
                    </span>
                  )}
                  {c.person.roles[0] && <RoleBadge role={c.person.roles[0]} />}
                </div>
                <div className="hp-sub">
                  {reasonOf(c)}
                  {c.weekConflict && <span className="hp-warn"> · ⚠️ ya esta semana</span>}
                </div>
              </div>
              <span className={`hp-score ${c.level}`} title="Puntaje de recomendación">
                {c.score}
              </span>
              {on && <span className="hp-check">✓</span>}
            </button>
          );
        })}
      </div>

      {filtered.length > TOP && (
        <button type="button" className="hp-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Ver menos ↑" : `Ver todos (${filtered.length}) ↓`}
        </button>
      )}
    </div>
  );
}
