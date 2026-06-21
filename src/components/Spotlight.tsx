"use client";

import { useMemo } from "react";
import { fmtDate } from "@/lib/client";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  personId: string;
  persons: Person[];
  records: RecordItem[];
}

interface PairInfo {
  person: Person;
  count: number;
  lastFecha: string;
  nextFecha: string;
}

export function Spotlight({ personId, persons, records }: Props) {
  const data = useMemo(() => {
    const person = persons.find((p) => p.id === personId);
    if (!person) return null;

    const myRecords = records.filter(
      (r) => r.asignadoId === personId || r.ayudanteId === personId,
    );

    const today = new Date().toISOString().slice(0, 10);
    const pairData: Record<string, { count: number; lastFecha: string; nextFecha: string }> = {};
    for (const r of myRecords) {
      const partnerId = r.asignadoId === personId ? r.ayudanteId : r.asignadoId;
      if (!partnerId) continue;
      const pd = (pairData[partnerId] ??= { count: 0, lastFecha: "", nextFecha: "" });
      pd.count++;
      if ((r.fecha || "") > pd.lastFecha) pd.lastFecha = r.fecha;
      if ((r.fecha || "") >= today && (!pd.nextFecha || r.fecha < pd.nextFecha))
        pd.nextFecha = r.fecha;
    }

    const neverPaired = persons.filter((p) => p.id !== personId && !pairData[p.id]);

    const sorted = myRecords
      .slice()
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

    const pairedList: PairInfo[] = Object.entries(pairData)
      .map(([id, v]) => ({ person: persons.find((p) => p.id === id)!, ...v }))
      .filter((x) => x.person)
      .sort((a, b) => {
        if (a.nextFecha && b.nextFecha) return a.nextFecha.localeCompare(b.nextFecha);
        if (a.nextFecha) return -1;
        if (b.nextFecha) return 1;
        return (b.lastFecha || "").localeCompare(a.lastFecha || "");
      });

    return {
      person,
      fullName: `${person.nombre} ${person.apellido}`,
      initials: (person.nombre[0] + (person.apellido[0] || "")).toUpperCase(),
      myRecords,
      lastDate: sorted[0] ? fmtDate(sorted[0].fecha) : "—",
      recentRecs: sorted.slice(0, 3),
      pairedList,
      neverPaired: neverPaired.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }, [personId, persons, records]);

  if (!data) return null;
  const { fullName, initials, myRecords, lastDate, recentRecs, pairedList, neverPaired } = data;

  return (
    <div className="spotlight-card">
      <div className="spotlight-head">
        <div className="spotlight-avatar">{initials}</div>
        <div>
          <div className="spotlight-name">{fullName}</div>
          <div className="spotlight-meta">
            {myRecords.length} asignación{myRecords.length !== 1 ? "es" : ""} · última: {lastDate}
          </div>
        </div>
      </div>

      <div className="spotlight-stats-row">
        <div className="spotlight-stat">
          <div className="spotlight-stat-val">{myRecords.length}</div>
          <div className="spotlight-stat-lbl">Total</div>
        </div>
        <div className="spotlight-stat">
          <div className="spotlight-stat-val">{pairedList.length}</div>
          <div className="spotlight-stat-lbl">Con parejas</div>
        </div>
        <div className="spotlight-stat">
          <div className="spotlight-stat-val" style={{ color: "var(--amber)" }}>
            {neverPaired.length}
          </div>
          <div className="spotlight-stat-lbl">Sin pareja</div>
        </div>
      </div>

      {recentRecs.length > 0 && (
        <div className="spotlight-section">
          <div className="spotlight-section-title">Asignaciones recientes</div>
          {recentRecs.map((r) => (
            <div className="spotlight-recent-row" key={r.id}>
              <div className="spotlight-recent-info">
                <div className="spotlight-recent-asig">📌 {r.asignacion}</div>
                <div className="spotlight-recent-meta">
                  {r.sala ? `🏛️ ${r.sala}` : ""}
                  {r.sala && r.tipo === "NOMBRADO" ? " · " : ""}
                  {r.tipo === "NOMBRADO" ? "Nombrado" : ""}
                </div>
              </div>
              <div className="spotlight-recent-date">{fmtDate(r.fecha)}</div>
            </div>
          ))}
        </div>
      )}

      {pairedList.length > 0 && (
        <div className="spotlight-section">
          <div className="spotlight-section-title">✅ Ha sido asignado con</div>
          {pairedList.map(({ person: p, count, lastFecha, nextFecha }) => (
            <div className="spotlight-pair-row" key={p.id}>
              <div>
                <div className="spotlight-pair-name">
                  {p.nombre} {p.apellido}
                </div>
                <div className="spotlight-pair-sub">
                  {nextFecha ? `📅 Próxima: ${fmtDate(nextFecha)}` : `última: ${fmtDate(lastFecha)}`} ·{" "}
                  {count} {count !== 1 ? "veces" : "vez"}
                </div>
              </div>
              <span className="spotlight-pair-count">×{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="spotlight-section">
        <div className="spotlight-section-title">⚠️ Nunca asignado con</div>
        {neverPaired.length === 0 ? (
          <div className="spotlight-empty">Ha sido asignado con todas las personas registradas.</div>
        ) : (
          neverPaired.map((p) => (
            <div className="spotlight-missing-row" key={p.id}>
              <div className="spotlight-missing-dot" />
              <div className="spotlight-missing-name">
                {p.nombre} {p.apellido}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
