"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { fmtShort, todayYMD } from "@/lib/client";

// Cabecera de días (semana inicia en lunes, como la regla).
const WD_HEAD = ["L", "M", "M", "J", "V", "S", "D"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const colOf = (weekday: number) => (weekday + 6) % 7; // lunes = 0 … domingo = 6
const wdOf = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();

/**
 * Selector de fecha con calendario propio: marca los días de reunión
 * (según los weekdays de la regla) y permite navegar a meses pasados
 * para consultar asignaciones anteriores.
 */
export function MeetingDatePicker({
  value,
  onChange,
  meetingWeekdays,
}: {
  value: string;
  onChange: (ymd: string) => void;
  meetingWeekdays: number[];
}) {
  const [open, setOpen] = useState(false);
  const base = value || todayYMD();
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const ref = useRef<HTMLDivElement>(null);
  const today = todayYMD();
  const mset = useMemo(() => new Set(meetingWeekdays), [meetingWeekdays]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPop = () => {
    const b = value || todayYMD();
    setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 });
    setOpen(true);
  };

  const cells = useMemo(() => {
    const { y, m } = view;
    const lead = colOf(new Date(Date.UTC(y, m, 1)).getUTCDay());
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(ymdOf(y, m, d));
    while (arr.length < 42) arr.push(null); // 6 filas → altura estable
    return arr;
  }, [view]);

  const monthLabel = useMemo(() => {
    const s = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [view]);

  const shift = (delta: number) =>
    setView((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { y, m };
    });

  const pick = (ymd: string) => {
    onChange(ymd);
    setOpen(false);
  };

  return (
    <div className="mdp" ref={ref}>
      <button type="button" className="mdp-trigger" onClick={() => (open ? setOpen(false) : openPop())} aria-expanded={open}>
        <CalendarBlank size={16} weight="bold" />
        <span>{value ? fmtShort(value) : "Elegir fecha"}</span>
      </button>

      {open && (
        <div className="mdp-pop fade-up">
          <div className="mdp-head">
            <button type="button" className="mdp-nav" onClick={() => shift(-1)} aria-label="Mes anterior">
              <CaretLeft size={15} weight="bold" />
            </button>
            <span className="mdp-month">{monthLabel}</span>
            <button type="button" className="mdp-nav" onClick={() => shift(1)} aria-label="Mes siguiente">
              <CaretRight size={15} weight="bold" />
            </button>
          </div>

          <div className="mdp-grid mdp-wdrow">
            {WD_HEAD.map((w, i) => (
              <span key={i} className="mdp-wd">{w}</span>
            ))}
          </div>

          <div className="mdp-grid">
            {cells.map((ymd, i) => {
              if (ymd === null) return <span key={i} className="mdp-day empty" />;
              const cls = ["mdp-day"];
              if (mset.has(wdOf(ymd))) cls.push("meeting");
              if (ymd === today) cls.push("today");
              if (ymd === value) cls.push("selected");
              return (
                <button key={i} type="button" className={cls.join(" ")} onClick={() => pick(ymd)}>
                  {Number(ymd.slice(8, 10))}
                </button>
              );
            })}
          </div>

          <div className="mdp-foot">
            <span className="mdp-legend"><span className="mdp-legend-dot" /> Día de reunión</span>
            <button type="button" className="mdp-hoy" onClick={() => pick(today)}>Hoy</button>
          </div>
        </div>
      )}
    </div>
  );
}
