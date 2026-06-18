"use client";

import { useMemo } from "react";
import { todayYMD, addDaysYMD, fmtShort, fmtDate } from "@/lib/client";
import type { Meeting } from "@/lib/types";

interface Props {
  value: string;
  onChange: (ymd: string) => void;
  meetings: Meeting[];
}

// Chips rápidos de fecha: Hoy, Mañana y las próximas reuniones + selector manual.
export function DateChips({ value, onChange, meetings }: Props) {
  const today = todayYMD();
  const manana = addDaysYMD(today, 1);

  const chips = useMemo(() => {
    const base = [
      { label: "Hoy", ymd: today },
      { label: "Mañana", ymd: manana },
    ];
    const reuniones = meetings
      .filter((m) => m.fecha >= today && m.fecha !== today && m.fecha !== manana)
      .slice(0, 4)
      .map((m) => ({ label: fmtShort(m.fecha), ymd: m.fecha }));
    return [...base, ...reuniones];
  }, [meetings, today, manana]);

  return (
    <>
      <div className="date-chips">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            className={`date-chip${value === c.ymd ? " on" : ""}`}
            onClick={() => onChange(c.ymd)}
          >
            {c.label}
          </button>
        ))}
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
      </div>
      {value && <div className="field-hint">📅 {fmtDate(value)}</div>}
    </>
  );
}
