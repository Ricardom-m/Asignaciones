"use client";

import type { Section } from "@/lib/types";

interface Props {
  sections: Section[];
  value: string; // sectionId o ""
  onChange: (id: string) => void;
  allowEmpty?: boolean;
}

// Select nativo de sección. Muestra solo las activas, conservando la ya
// seleccionada aunque esté inactiva.
export function SectionSelect({ sections, value, onChange, allowEmpty = true }: Props) {
  const opts = sections.filter((s) => s.active || s.id === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">— Sin sección —</option>}
      {opts.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nombre}
        </option>
      ))}
    </select>
  );
}
