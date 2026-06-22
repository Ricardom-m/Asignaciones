"use client";

import { useMemo } from "react";
import { fmtDate, fmtShort, relativeLabel } from "@/lib/client";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  personId: string;
  persons: Person[];
  records: RecordItem[];
  onPerson?: (id: string) => void; // abrir el detalle de otra persona
}

interface PartnerInfo {
  person: Person;
  count: number;
  lastFecha: string;
}

export function Spotlight({ personId, persons, records, onPerson }: Props) {
  const data = useMemo(() => {
    const person = persons.find((p) => p.id === personId);
    if (!person) return null;

    const myRecords = records.filter((r) => r.asignadoId === personId || r.ayudanteId === personId);
    const sortedDesc = [...myRecords].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const ym = new Date().toISOString().slice(0, 7);
    const esteMes = myRecords.filter((r) => (r.fecha || "").startsWith(ym)).length;

    const pairData: Record<string, { count: number; lastFecha: string }> = {};
    for (const r of myRecords) {
      const partnerId = r.asignadoId === personId ? r.ayudanteId : r.asignadoId;
      if (!partnerId) continue;
      const pd = (pairData[partnerId] ??= { count: 0, lastFecha: "" });
      pd.count++;
      if ((r.fecha || "") > pd.lastFecha) pd.lastFecha = r.fecha;
    }
    const partners: PartnerInfo[] = Object.entries(pairData)
      .map(([id, v]) => ({ person: persons.find((p) => p.id === id)!, ...v }))
      .filter((x) => x.person)
      .sort((a, b) => b.count - a.count || (b.lastFecha || "").localeCompare(a.lastFecha || ""));
    const maxCount = Math.max(1, ...partners.map((p) => p.count));

    // Nunca emparejado (activos, mismo género o sin género definido).
    const neverPaired = persons
      .filter(
        (p) =>
          p.id !== personId &&
          p.active &&
          !pairData[p.id] &&
          (!person.genero || !p.genero || p.genero === person.genero),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      person,
      fullName: `${person.nombre} ${person.apellido}`,
      initials: (person.nombre[0] + (person.apellido[0] || "")).toUpperCase(),
      myRecords,
      sortedDesc,
      esteMes,
      lastRec: sortedDesc[0],
      partners,
      maxCount,
      distinct: partners.length,
      top: partners[0],
      neverPaired,
    };
  }, [personId, persons, records]);

  if (!data) return null;
  const { person, fullName, initials, myRecords, sortedDesc, esteMes, lastRec, partners, maxCount, distinct, top, neverPaired } = data;

  const partnerOf = (r: RecordItem): Person | null => {
    const pid = r.asignadoId === personId ? r.ayudanteId : r.asignadoId;
    return pid ? persons.find((p) => p.id === pid) ?? null : null;
  };

  const NameLink = ({ p }: { p: Person }) =>
    onPerson ? (
      <button className="person-link" onClick={() => onPerson(p.id)}>
        {p.nombre} {p.apellido}
      </button>
    ) : (
      <span>{p.nombre} {p.apellido}</span>
    );

  return (
    <div className="spotlight-card">
      <div className="spotlight-head">
        <div className="spotlight-avatar">{initials}</div>
        <div>
          <div className="spotlight-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {fullName}
            <GenderIcon genero={person.genero} />
          </div>
          <div className="spotlight-meta">
            {person.roles.map((r) => (
              <RoleBadge key={r.id} role={r} />
            ))}
          </div>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="spotlight-stats-row">
        <div className="spotlight-stat">
          <div className="spotlight-stat-val">{myRecords.length}</div>
          <div className="spotlight-stat-lbl">Total</div>
        </div>
        <div className="spotlight-stat">
          <div className="spotlight-stat-val">{esteMes}</div>
          <div className="spotlight-stat-lbl">Este mes</div>
        </div>
        <div className="spotlight-stat">
          <div className="spotlight-stat-val">{distinct}</div>
          <div className="spotlight-stat-lbl">Parejas</div>
        </div>
        <div className="spotlight-stat">
          <div className="spotlight-stat-val" style={{ fontSize: ".82rem" }}>
            {lastRec ? relativeLabel(lastRec.fecha) : "—"}
          </div>
          <div className="spotlight-stat-lbl">Última</div>
        </div>
      </div>

      {top && (
        <div className="spotlight-section" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <span className="suggest-tip">⭐ Más frecuente con </span>
          <NameLink p={top.person} /> <span style={{ color: "var(--text3)", fontSize: ".7rem" }}>· {top.count}×</span>
        </div>
      )}

      {/* Gráfica de parejas */}
      {partners.length > 0 && (
        <div className="spotlight-section">
          <div className="spotlight-section-title">Con quién ha trabajado</div>
          <div className="bar-list">
            {partners.map((pt) => (
              <div className="bar-row" key={pt.person.id}>
                <div className="bar-row-head">
                  <span className="bar-row-label">
                    <NameLink p={pt.person} />
                  </span>
                  <span className="bar-row-value">{pt.count}× · {fmtDate(pt.lastFecha)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(pt.count / maxCount) * 100}%`, background: pt.person.roles[0]?.color ?? "var(--accent)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Línea de tiempo */}
      <div className="spotlight-section">
        <div className="spotlight-section-title">Línea de tiempo</div>
        {sortedDesc.length === 0 ? (
          <div className="spotlight-empty">Sin asignaciones aún.</div>
        ) : (
          <div className="tl">
            {sortedDesc.map((r) => {
              const pt = partnerOf(r);
              return (
                <div className="tl-row" key={r.id}>
                  <span className="tl-date">{fmtShort(r.fecha)}</span>
                  <div className="tl-main">
                    <div className="tl-asig">
                      {r.asignacion}
                      {r.tipo === "NOMBRADO" && <span className="tl-tag">nombrado</span>}
                    </div>
                    <div className="tl-with">
                      {pt ? <>con <NameLink p={pt} /></> : r.tipo === "NOMBRADO" ? "—" : "(sin pareja)"}
                      {r.sala ? ` · ${r.sala}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nunca asignado con */}
      <div className="spotlight-section">
        <div className="spotlight-section-title">⚠️ Nunca asignado con</div>
        {neverPaired.length === 0 ? (
          <div className="spotlight-empty">Ha trabajado con todas las personas compatibles.</div>
        ) : (
          neverPaired.map((p) => (
            <div className="spotlight-missing-row" key={p.id}>
              <div className="spotlight-missing-dot" />
              <div className="spotlight-missing-name">
                <NameLink p={p} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
