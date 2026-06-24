"use client";

import { useMemo, useState } from "react";
import type { UserOptions } from "jspdf-autotable";
import { fmtDate, fmtShort, relativeLabel, todayYMD, addDaysYMD } from "@/lib/client";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import type { Person, RecordItem, Section } from "@/lib/types";

interface Props {
  personId: string;
  persons: Person[];
  records: RecordItem[];
  sections?: Section[];
  onPerson?: (id: string) => void;
}

type Period = "all" | "year" | "3m";
type TipoFilter = "all" | "nombrado" | "normal";

const TL_PAGE = 60; // tope inicial de filas en la línea de tiempo

const MONTH_LETTERS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// "hace N días / meses / años" en grano grueso (para recencia por sección).
function agoLabel(ymd: string): string {
  const day = 864e5;
  const diff = Math.round((Date.now() - new Date(ymd + "T00:00:00Z").getTime()) / day);
  if (diff <= 0) return "hoy";
  if (diff < 45) return `hace ${diff} día${diff !== 1 ? "s" : ""}`;
  const months = Math.round(diff / 30);
  if (months < 12) return `hace ${months} mes${months !== 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years !== 1 ? "s" : ""}`;
}
function daysSince(ymd: string): number {
  return Math.round((Date.now() - new Date(ymd + "T00:00:00Z").getTime()) / 864e5);
}
// Color de la celda del heatmap según intensidad.
function heatColor(count: number, max: number): string {
  if (count === 0) return "var(--surface2)";
  const pct = Math.round(30 + (count / max) * 60); // 30%–90%
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
}

export function Spotlight({ personId, persons, records, sections, onPerson }: Props) {
  const [period, setPeriod] = useState<Period>("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("all");
  const [tlLimit, setTlLimit] = useState(TL_PAGE);

  const person = persons.find((p) => p.id === personId);
  const partnerOf = (r: RecordItem): Person | null => {
    const pid = r.asignadoId === personId ? r.ayudanteId : r.asignadoId;
    return pid ? persons.find((p) => p.id === pid) ?? null : null;
  };

  const data = useMemo(() => {
    if (!person) return null;
    const myRecords = records.filter((r) => r.asignadoId === personId || r.ayudanteId === personId);

    const isNombrado = person.roles.some((r) => r.nombre === "Nombrados");
    const hasNombradoRecs = myRecords.some((r) => r.tipo === "NOMBRADO");
    const hasNormalRecs = myRecords.some((r) => r.tipo === "ASIGNACION");
    const showTipoChips = hasNombradoRecs && hasNormalRecs;
    const effTipo: TipoFilter = showTipoChips ? tipoFilter : "all";

    // Filtro por periodo
    const from =
      period === "year" ? new Date().getFullYear() + "-01-01" : period === "3m" ? addDaysYMD(todayYMD(), -90) : "";
    const inPeriod = from ? myRecords.filter((r) => (r.fecha || "") >= from) : myRecords;

    const matchesRole = (r: RecordItem) => {
      if (!roleFilter) return true;
      const pt = partnerOf(r);
      return !!pt && pt.roles.some((rr) => rr.id === roleFilter);
    };
    const matchesTipo = (r: RecordItem) =>
      effTipo === "all" ? true : effTipo === "nombrado" ? r.tipo === "NOMBRADO" : r.tipo === "ASIGNACION";
    const filtered = inPeriod.filter(matchesRole).filter(matchesTipo);

    // Resumen
    const ym = new Date().toISOString().slice(0, 7);
    const esteMes = myRecords.filter((r) => (r.fecha || "").startsWith(ym)).length;
    const lastRec = [...myRecords].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];

    // Parejas (sobre filtered)
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

    const partnerRoleIds = new Set<string>();
    for (const r of inPeriod) partnerOf(r)?.roles.forEach((rr) => partnerRoleIds.add(rr.id));

    const timeline = [...filtered].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

    // Actividad por mes (barras recientes + heatmap)
    const byMonth: Record<string, number> = {};
    for (const r of filtered) {
      const k = (r.fecha || "").slice(0, 7);
      if (k) byMonth[k] = (byMonth[k] ?? 0) + 1;
    }
    const now = new Date();
    const months6: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      months6.push({
        key,
        label: d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }).replace(".", ""),
        count: byMonth[key] ?? 0,
      });
    }
    const months6Max = Math.max(1, ...months6.map((m) => m.count));
    const heatYears = [...new Set(Object.keys(byMonth).map((k) => Number(k.slice(0, 4))))].sort();
    const heatMax = Math.max(1, ...Object.values(byMonth));

    // Nunca emparejado (no-nombrados)
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

    // Recencia por sección (nombrados): última vez pasada por cada sección.
    const today = todayYMD();
    const sectionRecency = (sections ?? [])
      .filter((s) => s.active)
      .map((s) => {
        let last = "";
        for (const r of myRecords)
          if (r.sectionId === s.id && (r.fecha || "") <= today && (r.fecha || "") > last) last = r.fecha;
        return { section: s, last };
      })
      .sort((a, b) => {
        if (!a.last && !b.last) return a.section.orden - b.section.orden;
        if (!a.last) return -1;
        if (!b.last) return 1;
        return a.last.localeCompare(b.last); // más atrasado arriba
      });

    return {
      total: filtered.length,
      esteMes,
      lastRec,
      partners,
      maxCount,
      distinct: new Set(filtered.map((r) => partnerOf(r)?.id).filter(Boolean)).size,
      top: partners[0],
      timeline,
      partnerRoleIds,
      neverPaired,
      months6,
      months6Max,
      byMonth,
      heatYears,
      heatMax,
      sectionRecency,
      isNombrado,
      showTipoChips,
      effTipo,
    };
  }, [person, personId, persons, records, sections, period, roleFilter, tipoFilter]);

  if (!person || !data) return null;
  const {
    total, esteMes, lastRec, partners, maxCount, distinct, top, timeline, partnerRoleIds, neverPaired,
    months6, months6Max, byMonth, heatYears, heatMax, sectionRecency, isNombrado, showTipoChips, effTipo,
  } = data;
  const fullName = `${person.nombre} ${person.apellido}`;
  const initials = (person.nombre[0] + (person.apellido[0] || "")).toUpperCase();
  const filterRoles = persons
    .flatMap((p) => p.roles)
    .filter((r, i, arr) => partnerRoleIds.has(r.id) && arr.findIndex((x) => x.id === r.id) === i);
  const tlShown = timeline.slice(0, tlLimit);

  const NameLink = ({ p }: { p: Person }) =>
    onPerson ? (
      <button className="person-link" onClick={() => onPerson(p.id)}>{p.nombre} {p.apellido}</button>
    ) : (
      <span>{p.nombre} {p.apellido}</span>
    );

  // PDF minimalista (jsPDF cargado solo al exportar).
  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 40;
    let y = M;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(25);
    doc.text("Historial de asignaciones", M, y);
    y += 22;
    doc.setFontSize(13);
    doc.text(fullName, M, y);
    y += 15;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    const generoTxt = person.genero === "H" ? "Hombre" : person.genero === "M" ? "Mujer" : "—";
    const rolesTxt = person.roles.map((r) => r.nombre).join(", ") || "—";
    doc.text(`${generoTxt}  ·  ${rolesTxt}`, M, y);
    y += 12;
    const periodTxt = period === "all" ? "Todo" : period === "year" ? "Este año" : "Últimos 3 meses";
    const roleTxt = roleFilter ? filterRoles.find((r) => r.id === roleFilter)?.nombre ?? "—" : "Toda pareja";
    doc.text(`Generado: ${new Date().toLocaleDateString("es-MX")}   ·   Periodo: ${periodTxt}   ·   Pareja: ${roleTxt}`, M, y);
    y += 18;

    doc.setTextColor(25);
    doc.setFontSize(10);
    doc.text(
      `Total: ${total}      Este mes: ${esteMes}      Parejas distintas: ${distinct}      Última: ${lastRec ? fmtDate(lastRec.fecha) : "—"}`,
      M,
      y,
    );
    y += 16;

    const style = {
      theme: "grid" as const,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: 45, lineColor: 225, lineWidth: 0.5 },
      headStyles: { fillColor: [245, 246, 248], textColor: 90, fontStyle: "bold" as const, lineColor: 225, lineWidth: 0.5 },
      margin: { left: M, right: M },
    };

    if (partners.length) {
      autoTable(doc, {
        startY: y,
        head: [["Con quién ha trabajado", "Veces", "Última"]],
        body: partners.map((p) => [`${p.person.nombre} ${p.person.apellido}`, String(p.count), fmtDate(p.lastFecha)]),
        columnStyles: { 1: { halign: "center", cellWidth: 50 }, 2: { cellWidth: 90 } },
        ...style,
      } as unknown as UserOptions);
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    }

    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Asignación", "Con", "Sala", "Tipo"]],
      body: timeline.map((r) => {
        const pt = partnerOf(r);
        return [fmtDate(r.fecha), r.asignacion, pt ? `${pt.nombre} ${pt.apellido}` : "—", r.sala ?? "", r.tipo === "NOMBRADO" ? "Nombrado" : "Asignación"];
      }),
      columnStyles: { 0: { cellWidth: 72 }, 3: { cellWidth: 55 }, 4: { cellWidth: 74 } },
      ...style,
    } as unknown as UserOptions);

    doc.save(`historial_${fullName.replace(/\s+/g, "_")}.pdf`);
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
        <button className="btn btn-ghost btn-sm" onClick={exportPdf} title="Exportar historial (PDF)">
          ⤓ PDF
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
        <div className="hp-filters" style={{ marginBottom: showTipoChips || filterRoles.length ? 8 : 0 }}>
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

        {/* Tipo (solo si tiene de nombrado y normales) */}
        {showTipoChips && (
          <div className="hp-filters" style={{ marginBottom: filterRoles.length ? 8 : 0 }}>
            {([
              { k: "all", label: "Todas" },
              { k: "nombrado", label: "De nombrado" },
              { k: "normal", label: "Con otras personas" },
            ] as const).map((o) => (
              <button
                key={o.k}
                className="role-chip"
                onClick={() => setTipoFilter(o.k)}
                style={effTipo === o.k ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {/* Rol de la pareja (no aplica cuando se ven solo las de nombrado) */}
        {filterRoles.length > 0 && effTipo !== "nombrado" && (
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

      {top && effTipo !== "nombrado" && (
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

      {/* Actividad: barras (últimos 6 meses) + heatmap */}
      {total > 0 && (
        <div className="spotlight-section">
          <div className="spotlight-section-title">Actividad</div>
          <div className="bar-list" style={{ marginBottom: heatYears.length ? 16 : 0 }}>
            {months6.map((m) => (
              <div className="bar-row" key={m.key}>
                <div className="bar-row-head">
                  <span className="bar-row-label" style={{ textTransform: "capitalize" }}>{m.label}</span>
                  <span className="bar-row-value">{m.count}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(m.count / months6Max) * 100}%`, background: "var(--grad)" }} />
                </div>
              </div>
            ))}
          </div>

          {heatYears.length > 0 && (
            <div className="heatmap">
              <div className="hm-head">
                <span />
                {MONTH_LETTERS.map((l, i) => (
                  <span key={i}>{l}</span>
                ))}
              </div>
              {heatYears.map((year) => (
                <div className="hm-row" key={year}>
                  <span className="hm-year">{String(year).slice(2)}</span>
                  {Array.from({ length: 12 }, (_, m) => {
                    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
                    const count = byMonth[key] ?? 0;
                    return (
                      <span
                        key={m}
                        className="hm-cell"
                        title={`${MONTH_LETTERS[m]} ${year}: ${count}`}
                        style={{ background: heatColor(count, heatMax) }}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="hm-legend">
                menos
                <i style={{ background: "var(--surface2)" }} />
                <i style={{ background: heatColor(1, 4) }} />
                <i style={{ background: heatColor(2, 4) }} />
                <i style={{ background: heatColor(4, 4) }} />
                más
              </div>
            </div>
          )}
        </div>
      )}

      {/* Línea de tiempo */}
      <div className="spotlight-section">
        <div className="spotlight-section-title">Línea de tiempo</div>
        {timeline.length === 0 ? (
          <div className="spotlight-empty">Sin asignaciones en este filtro.</div>
        ) : (
          <>
            <div className="tl">
              {tlShown.map((r) => {
                const pt = partnerOf(r);
                return (
                  <div className="tl-row" key={r.id}>
                    <span className="tl-date">{fmtShort(r.fecha)}</span>
                    <div className="tl-main">
                      <div className="tl-asig">
                        {r.asignacion}
                        {r.tipo === "NOMBRADO" && <span className="tl-tag">nombrado</span>}
                        {r.section && <span className="tl-sec">{r.section}</span>}
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
            {timeline.length > tlLimit && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setTlLimit((l) => l + TL_PAGE)}>
                  Ver más ({timeline.length - tlLimit}) ↓
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Nombrados: recencia por sección · resto: nunca asignado con */}
      {isNombrado ? (
        sectionRecency.length > 0 && (
          <div className="spotlight-section">
            <div className="spotlight-section-title">Por sección · cuándo pasó por última vez</div>
            {sectionRecency.map(({ section, last }) => {
              const overdue = !last || daysSince(last) > 90;
              return (
                <div className="sec-rec-row" key={section.id}>
                  <span className="sec-rec-name">{section.nombre}</span>
                  <span className={`sec-rec-when${overdue ? " over" : ""}`}>
                    {overdue && <span className="sec-rec-dot" />}
                    {last ? `${fmtShort(last)} · ${agoLabel(last)}` : "nunca"}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : (
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
      )}
    </div>
  );
}
