"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileArrowDown, FilePdf } from "@phosphor-icons/react";
import { PageHeader } from "@/components/PageHeader";
import { useMeetings, usePastMeetings, useExportProgram } from "@/lib/hooks";
import { ProgramSheet } from "@/components/ProgramSheet";
import { fmtShort } from "@/lib/client";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
};

export default function ExportarPage() {
  const { meetings } = useMeetings();
  const { past } = usePastMeetings(true, 60);

  // Todas las fechas de reunión (pasadas + próximas), únicas y ordenadas.
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of past) set.add(m.fecha);
    for (const m of meetings) set.add(m.fecha);
    return [...set].sort();
  }, [past, meetings]);

  // Agrupadas por mes (YYYY-MM).
  const months = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of allDates) {
      const ym = d.slice(0, 7);
      const arr = map.get(ym);
      if (arr) arr.push(d);
      else map.set(ym, [d]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allDates]);

  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Por defecto: el mes más reciente con reuniones, todas seleccionadas.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !months.length) return;
    initRef.current = true;
    const [ym, dates] = months[months.length - 1];
    setMonth(ym);
    setSelected(new Set(dates));
  }, [months]);

  const monthDates = months.find(([ym]) => ym === month)?.[1] ?? [];
  const selectedList = useMemo(() => monthDates.filter((d) => selected.has(d)), [monthDates, selected]);

  const pickMonth = (ym: string, dates: string[]) => {
    setMonth(ym);
    setSelected(new Set(dates));
  };
  const toggle = (d: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  const { weeks, isLoading } = useExportProgram(selectedList);
  const wordHref = `/api/export?fechas=${selectedList.join(",")}&format=docx`;

  return (
    <div className="page-inner fade-up">
      <PageHeader title="Exportar" subtitle="Programa de la reunión (formato oficial) a Word o PDF" />

      <div className="content-card exp-controls">
        <div>
          <div className="section-label">Mes</div>
          <div className="exp-months">
            {months.length === 0 && <span className="plan-hint">No hay reuniones registradas todavía.</span>}
            {months.map(([ym, dates]) => (
              <button key={ym} className={`reg-pill${month === ym ? " active" : ""}`} onClick={() => pickMonth(ym, dates)}>
                {monthLabel(ym)}
              </button>
            ))}
          </div>
        </div>

        {monthDates.length > 0 && (
          <div>
            <div className="section-label">Reuniones a incluir ({selectedList.length})</div>
            <div className="exp-dates">
              {monthDates.map((d) => (
                <label key={d} className="exp-date-chip">
                  <input type="checkbox" checked={selected.has(d)} onChange={() => toggle(d)} />
                  {fmtShort(d)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="exp-actions">
          {selectedList.length ? (
            <a className="btn btn-primary" href={wordHref}>
              <FileArrowDown size={16} weight="bold" /> Descargar Word
            </a>
          ) : (
            <button className="btn btn-primary" disabled>
              <FileArrowDown size={16} weight="bold" /> Descargar Word
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => window.print()} disabled={!weeks.length}>
            <FilePdf size={16} weight="bold" /> Guardar como PDF
          </button>
        </div>
        <p className="plan-hint">
          Revisa la vista previa. Para el PDF: <b>Guardar como PDF</b> abre la impresión del navegador
          (activa “Gráficos de fondo” para que salgan los colores).
        </p>
      </div>

      {selectedList.length > 0 && (
        <div className="exp-preview-wrap">
          {isLoading ? (
            <p className="plan-hint">Cargando vista previa…</p>
          ) : weeks.length ? (
            <ProgramSheet weeks={weeks} />
          ) : (
            <p className="plan-hint">Las reuniones seleccionadas no tienen asignaciones cargadas.</p>
          )}
        </div>
      )}
    </div>
  );
}
