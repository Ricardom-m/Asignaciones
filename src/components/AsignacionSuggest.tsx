"use client";

import { useAsignaciones } from "@/lib/hooks";

interface Props {
  sectionId?: string;
  value?: string; // texto actual (para no sugerir lo ya escrito)
  onPick: (value: string, minutos: number | null) => void;
}

// Chips con las asignaciones más frecuentes (de los datos). Al elegir una
// rellena el texto y su duración típica.
export function AsignacionSuggest({ sectionId, value, onPick }: Props) {
  const { asignaciones } = useAsignaciones(sectionId || undefined);
  const sugs = asignaciones.filter((a) => a.value && a.value !== value?.trim()).slice(0, 8);
  if (sugs.length === 0) return null;

  return (
    <div className="sug-row">
      <span className="sug-tip">Frecuentes:</span>
      {sugs.map((a) => (
        <button key={a.value} type="button" className="sug-chip" onClick={() => onPick(a.value, a.minutos)} title={`${a.count} ${a.count === 1 ? "vez" : "veces"}`}>
          {a.value}
          {a.minutos != null && <span className="sug-ago">{a.minutos} min</span>}
        </button>
      ))}
    </div>
  );
}
