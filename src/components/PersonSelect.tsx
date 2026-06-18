"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Person } from "@/lib/types";

interface Props {
  persons: Person[];
  value: string; // id seleccionado ("" = ninguno)
  onChange: (id: string) => void;
  excludeId?: string; // no mostrar esta persona (la del campo opuesto)
  placeholder?: string;
  allowClear?: boolean;
}

interface Pos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
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
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
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

  // Posiciona el desplegable (fixed) respecto al trigger.
  const computePos = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 240 && r.top > spaceBelow;
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

  const dropdown =
    open && pos
      ? createPortal(
          <div
            ref={dropRef}
            className="sel-dropdown"
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
            }}
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
