"use client";

import { useMemo, useState } from "react";
import { fmtDate, fmtShort, relativeLabel, todayYMD, addDaysYMD } from "@/lib/client";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import type { Person, RecordItem } from "@/lib/types";

interface Props {
  personId: string;
  persons: Person[];
  records: RecordItem[];
  onPerson?: (id: string) => void;
}

type Period = "all" | "year" | "3m";

export function Spotlight({ personId, persons, records, onPerson }: Props) {
  const [period, setPeriod] = useState<Period>("all");
  const [roleFilter, setRoleFilter] = useState("");

  const person = persons.find((p) => p.id === personId);
  const partnerOf = (r: RecordItem): Person | null => {
    const pid = r.asignadoId === personId ? r.ayudanteId : r.asignadoId;
    return pid ? persons.find((p) => p.id === pid) ?? null : null;
  };

  const data = useMemo(() => {
    if (!person) return null;
    const myRecords = records.filter((r) => r.asignadoId === personId || r.ayudanteId === personId);

    // Filtro por periodo
    const from =
      period === "year" ? new Date().getFullYear() + "-01-01" : period === "3m" ? addDaysYMD(todayYMD(), -90) : "";
    const inPeriod = from ? myRecords.filter((r) => (r.fecha || "") >= from) : myRecords;

    // Filtro por rol de la pareja (para parejas + timeline)
    const matchesRole = (r: RecordItem) => {
      if (!roleFilter) return true;
      const pt = partnerOf(r);
      return !!pt && pt.roles.some((rr) => rr.id === roleFilter);
    };
    const filtered = inPeriod.filter(matchesRole);

    // Resumen (sobre el periodo)
    const ym = new Date().toISOString().slice(0, 7);
    const esteMes = myRecords.filter((r) => (r.fecha || "").startsWith(ym)).length;
    const lastRec = [...myRecords].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];

    // Parejas (sobre periodo + rol)
    const pairData: Record<string, { count: number; lastFecha: string }> = {};
    for (const r of filtered) {
      const pt = partnerOf(r);
      if (!pt) continue;
      const pd = (pairData[pt.id] ??= { count: 0, lastFecha: "" });
      pd.count++;
      if ((r.fecha || "") > pd.lastFecha) pd.lastFecha = r.fecha;
    }
    const partners = Object.entries(pairData)
      .map(([id, v]) => ({ person: persons.find((p) => p.id === id)!, ...v }))
      .filter((x) => x.person)
      .sort((a, b) => b.count - a.count || (b.lastFecha || "").localeCompare(a.lastFecha || ""));
    const maxCount = Math.max(1, ...partners.map((p) => p.count));

    // Roles presentes entre las parejas del periodo (para los chips de filtro)
    const partnerRoleIds = new Set<string>();
    for (const r of inPeriod) partnerOf(r)?.roles.forEach((rr) => partnerRoleIds.add(rr.id));

    const timeline = [...filtered].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

    // Nunca emparejado (todo el historial; activos y compatibles por género).
    const allPartnerIds = new Set(myRecords.map((r) => partnerOf(r)?.id).filter(Boolean));
    const neverPaired = persons
      .filter(
        (p) =>
          p.id !== personId &&
          p.active &&
          !allPartnerIds.has(p.id) &&
          (!person.genero || !p.genero || p.genero === person.genero),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      total: inPeriod.length,
      esteMes,
      lastRec,
      partners,
      maxCount,
      distinct: new Set(inPeriod.map((r) => partnerOf(r)?.id).filter(Boolean)).size,
      top: partners[0],
      timeline,
      partnerRoleIds,
      neverPaired,
    };
  }, [person, personId, persons, records, period, roleFilter]);

  if (!person || !data) return null;
  const { total, esteMes, lastRec, partners, maxCount, distinct, top, timeline, partnerRoleIds, neverPaired } = data;
  const fullName = `${person.nombre} ${person.apellido}`;
  const initials = (person.nombre[0] + (person.apellido[0] || "")).toUpperCase();
  const filterRoles = persons
    .flatMap((p) => p.roles)
    .filter((r, i, arr) => partnerRoleIds.has(r.id) && arr.findIndex((x) => x.id === r.id) === i);

  const NameLink = ({ p }: { p: Person }) =>
    onPerson ? (
      <button className="person-link" onClick={() => onPerson(p.id)}>{p.nombre} {p.apellido}</button>
    ) : (
      <span>{p.nombre} {p.apellido}</span>
    );

  const exportCsv = () => {
    const rows: string[][] = [["Fecha", "Asignacion", "Con", "Sala", "Tipo"]];
    for (const r of timeline) {
      const pt = partnerOf(r);
      rows.push([r.fecha, r.asignacion, pt ? `${pt.nombre} ${pt.apellido}` : "", r.sala ?? "", r.tipo]);
    }
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial_${fullName.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="spotlight-card">
      <div className="spotlight-head">
        <div className="spotlight-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
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
        <button className="btn btn-ghost btn-sm" onClick={exportCsv} title="Exportar historial (CSV)">
          ⤓ CSV
        </button>
      </div>

      {/* Resumen */}
      <div className="spotlight-stats-row">
        <div className="spotlight-stat">
          <div className="spotlight-stat-val">{total}</div>
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
          <div className="spotlight-stat-val" style={{ fontSize: ".82rem" }}>{lastRec ? relativeLabel(lastRec.fecha) : "—"}</div>
          <div className="spotlight-stat-lbl">Última</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="spotlight-section" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div className="hp-filters" style={{ marginBottom: filterRoles.length ? 8 : 0 }}>
          {([
            { k: "all", label: "Todo" },
            { k: "year", label: "Este año" },
            { k: "3m", label: "3 meses" },
          ] as const).map((o) => (
            <button
              key={o.k}
              className="role-chip"
              onClick={() => setPeriod(o.k)}
              style={period === o.k ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
        {filterRoles.length > 0 && (
          <div className="hp-filters">
            <button
              className="role-chip"
              onClick={() => setRoleFilter("")}
              style={!roleFilter ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
            >
              Toda pareja
            </button>
            {filterRoles.map((r) => (
              <button
                key={r.id}
                className="role-chip"
                onClick={() => setRoleFilter(roleFilter === r.id ? "" : r.id)}
                style={roleFilter === r.id ? { color: r.color, borderColor: r.color, background: r.color + "22" } : undefined}
              >
                {r.nombre}
              </button>
            ))}
          </div>
        )}
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
        {timeline.length === 0 ? (
          <div className="spotlight-empty">Sin asignaciones en este filtro.</div>
        ) : (
          <div className="tl">
            {timeline.map((r) => {
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
