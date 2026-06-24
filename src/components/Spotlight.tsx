"use client";

import { useMemo, useState } from "react";
import type { UserOptions } from "jspdf-autotable";
import { fmtDate, fmtShort, relativeLabel, todayYMD, addDaysYMD } from "@/lib/client";
import { RoleBadge } from "@/components/RoleBadge";
import { GenderIcon } from "@/components/GenderIcon";
import { TimeChart } from "@/components/TimeChart";
import type { Person, RecordItem, Section } from "@/lib/types";

interface Props {
  personId: string;
  persons: Person[];
  records: RecordItem[];
  sections?: Section[];
  onPerson?: (id: string) => void;
}

type Period = "all" | "year" | "3m";

const TL_PAGE = 60; // tope inicial de filas por lista de la línea de tiempo

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

export function Spotlight({ personId, persons, records, sections, onPerson }: Props) {
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
    const isNombrado = person.roles.some((r) => r.nombre === "Nombrados");

    // Filtro por periodo
    const from =
      period === "year" ? new Date().getFullYear() + "-01-01" : period === "3m" ? addDaysYMD(todayYMD(), -90) : "";
    const inPeriod = from ? myRecords.filter((r) => (r.fecha || "") >= from) : myRecords;

    const matchesRole = (r: RecordItem) => {
      if (!roleFilter) return true;
      const pt = partnerOf(r);
      return !!pt && pt.roles.some((rr) => rr.id === roleFilter);
    };

    const byDateDesc = (a: RecordItem, b: RecordItem) => (b.fecha || "").localeCompare(a.fecha || "");
    const filtered = inPeriod.filter(matchesRole);

    // Resumen
    const ym = new Date().toISOString().slice(0, 7);
    const esteMes = myRecords.filter((r) => (r.fecha || "").startsWith(ym)).length;
    const lastRec = [...myRecords].sort(byDateDesc)[0];

    // Parejas
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

    // Líneas de tiempo
    const timelineAll = [...filtered].sort(byDateDesc);
    const timelineNombrado = [...inPeriod.filter((r) => r.tipo === "NOMBRADO")].sort(byDateDesc);
    const timelineNormal = [...inPeriod.filter((r) => r.tipo === "ASIGNACION").filter(matchesRole)].sort(byDateDesc);
    const pdfRows = [...inPeriod].sort(byDateDesc);

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

    // Recencia por sección (nombrados): última vez pasada o próxima programada.
    const today = todayYMD();
    const sectionRecency = (sections ?? [])
      .filter((s) => s.active)
      .map((s) => {
        let lastPast = "";
        let nextFuture = "";
        for (const r of myRecords) {
          if (r.sectionId !== s.id) continue;
          const f = r.fecha || "";
          if (!f) continue;
          if (f <= today) {
            if (f > lastPast) lastPast = f;
          } else if (!nextFuture || f < nextFuture) {
            nextFuture = f;
          }
        }
        return { section: s, lastPast, nextFuture };
      })
      .sort((a, b) => {
        // nunca arriba, luego más atrasadas, y al final las que solo tienen próxima.
        const rk = (x: { lastPast: string; nextFuture: string }) =>
          !x.lastPast && !x.nextFuture ? -1e9 : x.lastPast ? -daysSince(x.lastPast) : 1e9;
        return rk(a) - rk(b);
      });

    return {
      myRecords,
      isNombrado,
      total: inPeriod.length,
      esteMes,
      lastRec,
      partners,
      maxCount,
      distinct: new Set(filtered.map((r) => partnerOf(r)?.id).filter(Boolean)).size,
      top: partners[0],
      timelineAll,
      timelineNombrado,
      timelineNormal,
      pdfRows,
      partnerRoleIds,
      neverPaired,
      sectionRecency,
    };
  }, [person, personId, persons, records, sections, period, roleFilter]);

  if (!person || !data) return null;
  const {
    myRecords, isNombrado, total, esteMes, lastRec, partners, maxCount, distinct, top,
    timelineAll, timelineNombrado, timelineNormal, pdfRows, partnerRoleIds, neverPaired, sectionRecency,
  } = data;
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
      body: pdfRows.map((r) => {
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

      {/* Actividad en el tiempo */}
      {myRecords.length > 0 && (
        <div className="spotlight-section">
          <div className="spotlight-section-title">Actividad · asignaciones en el tiempo</div>
          <TimeChart records={myRecords} />
        </div>
      )}

      {/* Línea(s) de tiempo */}
      {isNombrado ? (
        <>
          <TimelineList title="Asignaciones de nombrado" records={timelineNombrado} partnerOf={partnerOf} onPerson={onPerson} />
          <TimelineList title="Asignaciones normales (con otras personas)" records={timelineNormal} partnerOf={partnerOf} onPerson={onPerson} />
        </>
      ) : (
        <TimelineList title="Línea de tiempo" records={timelineAll} partnerOf={partnerOf} onPerson={onPerson} />
      )}

      {/* Nombrados: recencia por sección · resto: nunca asignado con */}
      {isNombrado ? (
        sectionRecency.length > 0 && (
          <div className="spotlight-section">
            <div className="spotlight-section-title">Por sección · última vez / próxima</div>
            {sectionRecency.map(({ section, lastPast, nextFuture }) => {
              const overdue = (!lastPast && !nextFuture) || (!!lastPast && !nextFuture && daysSince(lastPast) > 90);
              const upcoming = !lastPast && !!nextFuture;
              return (
                <div className="sec-rec-row" key={section.id}>
                  <span className="sec-rec-name">{section.nombre}</span>
                  <span className={`sec-rec-when${overdue ? " over" : upcoming ? " up" : ""}`}>
                    {overdue && <span className="sec-rec-dot" />}
                    {lastPast
                      ? `${fmtShort(lastPast)} · ${agoLabel(lastPast)}`
                      : nextFuture
                        ? `próxima · ${fmtShort(nextFuture)}`
                        : "nunca"}
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

// Lista de tiempo con su propio "ver más" (tope independiente por sección).
function TimelineList({
  title,
  records,
  partnerOf,
  onPerson,
}: {
  title: string;
  records: RecordItem[];
  partnerOf: (r: RecordItem) => Person | null;
  onPerson?: (id: string) => void;
}) {
  const [limit, setLimit] = useState(TL_PAGE);
  const shown = records.slice(0, limit);

  return (
    <div className="spotlight-section">
      <div className="spotlight-section-title">{title}</div>
      {records.length === 0 ? (
        <div className="spotlight-empty">Sin asignaciones en este filtro.</div>
      ) : (
        <>
          <div className="tl">
            {shown.map((r) => {
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
                      {pt ? (
                        <>
                          con{" "}
                          {onPerson ? (
                            <button className="person-link" onClick={() => onPerson(pt.id)}>{pt.nombre} {pt.apellido}</button>
                          ) : (
                            <span>{pt.nombre} {pt.apellido}</span>
                          )}
                        </>
                      ) : r.tipo === "NOMBRADO" ? (
                        "—"
                      ) : (
                        "(sin pareja)"
                      )}
                      {r.sala ? ` · ${r.sala}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {records.length > limit && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLimit((l) => l + TL_PAGE)}>
                Ver más ({records.length - limit}) ↓
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
