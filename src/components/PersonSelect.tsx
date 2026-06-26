"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GenderIcon } from "@/components/GenderIcon";
import { RoleBadge } from "@/components/RoleBadge";
import { agoShort } from "@/components/RosterPanel";
import type { Person } from "@/lib/types";

// Datos de decisión por persona (vienen del roster). Activan el modo enriquecido.
export interface PersonMeta {
  daysSince: number | null;
  countMonth: number;
  assignedOnTarget: boolean;
  daysSinceSection?: number | null; // si hay sección seleccionada
}

type SortMode = "toca" | "az" | "carga";

interface Props {
  persons: Person[];
  value: string; // id seleccionado ("" = ninguno)
  onChange: (id: string) => void;
  excludeId?: string; // no mostrar esta persona (la del campo opuesto)
  excludeIds?: string[]; // no mostrar estas personas (p. ej. ya usadas en otras partes)
  placeholder?: string;
  allowClear?: boolean;
  meta?: Map<string, PersonMeta>; // si se pasa, cada opción muestra rol/recencia/carga/conflicto
  sectionLabel?: string; // etiqueta corta de la sección (para la recencia por sección)
}

interface Pos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const fullName = (p: Person) => `${p.nombre} ${p.apellido}`;
const cmpAz = (a: Person, b: Person) => fullName(a).localeCompare(fullName(b));

// Etiqueta de recencia/carga a la derecha de cada opción.
function MetaTags({ m, sectionLabel }: { m: PersonMeta; sectionLabel?: string }) {
  if (m.assignedOnTarget) return <span className="po-tag taken">⚠ ya ese día</span>;
  const hasSec = sectionLabel != null && m.daysSinceSection !== undefined;
  const days = hasSec ? m.daysSinceSection ?? null : m.daysSince;
  const over = days === null || days > 60;
  return (
    <>
      <span className={`po-ago${over ? " over" : ""}${hasSec ? " sec" : ""}`} title={hasSec ? `Última vez en ${sectionLabel}` : "Última asignación"}>
        {agoShort(days)}
      </span>
      <span className="po-load">{m.countMonth}/mes</span>
    </>
  );
}

export function PersonSelect({
  persons,
  value,
  onChange,
  excludeId,
  excludeIds,
  placeholder = "Seleccionar…",
  allowClear = true,
  meta,
  sectionLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("toca");
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const enriched = !!meta;
  const selected = persons.find((p) => p.id === value);
  const label = selected ? fullName(selected) : "";

  // Comparador "le toca": atrasados/nunca arriba; ya asignados ese día, al fondo.
  const cmpToca = useMemo(() => {
    const useSec = sectionLabel != null;
    return (a: Person, b: Person) => {
      const ma = meta?.get(a.id);
      const mb = meta?.get(b.id);
      if (!ma || !mb) return (ma ? 0 : 1) - (mb ? 0 : 1) || cmpAz(a, b);
      if (ma.assignedOnTarget !== mb.assignedOnTarget) return ma.assignedOnTarget ? 1 : -1;
      if (useSec) {
        const da = ma.daysSinceSection ?? null;
        const db = mb.daysSinceSection ?? null;
        const na = da === null, nb = db === null;
        if (na !== nb) return na ? -1 : 1; // nunca en la sección → arriba
        if (!na && !nb && da !== db) return db! - da!;
      }
      const na = ma.daysSince === null, nb = mb.daysSince === null;
      if (na !== nb) return na ? -1 : 1;
      if (!na && !nb && ma.daysSince !== mb.daysSince) return mb.daysSince! - ma.daysSince!;
      return ma.countMonth - mb.countMonth || cmpAz(a, b);
    };
  }, [meta, sectionLabel]);

  const options = useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = persons
      .filter((p) => p.id !== excludeId && !excludeIds?.includes(p.id))
      .filter((p) => !q || fullName(p).toLowerCase().includes(q));
    if (!enriched || sort === "az") return base.sort(cmpAz);
    if (sort === "carga") return base.sort((a, b) => (meta!.get(a.id)?.countMonth ?? 0) - (meta!.get(b.id)?.countMonth ?? 0) || cmpAz(a, b));
    return base.sort(cmpToca);
  }, [persons, excludeId, excludeIds, query, enriched, sort, cmpToca, meta]);

  // Agrupar en "Sugeridos / Todos" solo en el orden por defecto y sin búsqueda.
  const grouped = enriched && sort === "toca" && !query.trim();
  const sugeridos = useMemo(
    () => (grouped ? options.filter((p) => !meta!.get(p.id)?.assignedOnTarget).slice(0, 5) : []),
    [grouped, options, meta],
  );
  const sugSet = useMemo(() => new Set(sugeridos.map((p) => p.id)), [sugeridos]);
  const resto = useMemo(() => (grouped ? options.filter((p) => !sugSet.has(p.id)) : options), [grouped, options, sugSet]);

  const computePos = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 260 && r.top > spaceBelow;
    setPos(
      openUp
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxHeight: r.top - 14 }
        : { left: r.left, width: r.width, top: r.bottom + 4, maxHeight: spaceBelow - 14 },
    );
  };

  useEffect(() => {
    if (!open) return;
    computePos();
    const onDoc = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (!triggerRef.current?.contains(tgt) && !dropRef.current?.contains(tgt)) setOpen(false);
    };
    const onMove = () => computePos();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const renderRow = (p: Person) => {
    const m = meta?.get(p.id);
    return (
      <div key={p.id} className={`sel-opt${enriched ? " rich" : ""}${value === p.id ? " selected" : ""}`} onClick={() => pick(p.id)}>
        {enriched ? (
          <>
            <span className="po-id">
              <GenderIcon genero={p.genero} />
              <span className="po-name">{fullName(p)}</span>
              {p.roles[0] && <RoleBadge role={p.roles[0]} />}
            </span>
            <span className="po-meta">{m && <MetaTags m={m} sectionLabel={sectionLabel} />}</span>
          </>
        ) : (
          <>{fullName(p)}</>
        )}
      </div>
    );
  };

  const dropdown =
    open && pos
      ? createPortal(
          <div
            ref={dropRef}
            className="sel-dropdown"
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          >
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

            {enriched && (
              <div className="sel-sort">
                {([
                  ["toca", "Le toca"],
                  ["az", "A–Z"],
                  ["carga", "Menos carga"],
                ] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    className={`sel-sort-btn${sort === k ? " active" : ""}`}
                    onClick={() => setSort(k)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            <div className="sel-options">
              {allowClear && value && (
                <div className="sel-opt clear-opt" onClick={() => pick("")}>
                  ✕ Quitar selección
                </div>
              )}
              {options.length === 0 ? (
                <div className="sel-opt empty-opt">Sin personas</div>
              ) : grouped ? (
                <>
                  <div className="sel-group">Sugeridos para esta parte</div>
                  {sugeridos.map(renderRow)}
                  {resto.length > 0 && <div className="sel-group">Todos</div>}
                  {resto.map(renderRow)}
                </>
              ) : (
                options.map(renderRow)
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="sel-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`sel-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`sel-trigger-text${label ? "" : " ph"}`}>{label || placeholder}</span>
        <svg className="sel-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
