"use client";

import { useMemo, useRef, useState } from "react";
import { todayYMD, addDaysYMD } from "@/lib/client";
import { usePersistedState } from "@/lib/usePersistedState";
import type { RecordItem } from "@/lib/types";

type Gran = "day" | "month" | "year";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

// Path suavizado (curvas de Bézier con puntos de control en los puntos medios).
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

interface Bucket {
  key: string;
  label: string;
  count: number;
}

// Gráfica de actividad (asignaciones en el tiempo). SVG nativo, sin dependencias.
export function TimeChart({ records }: { records: RecordItem[] }) {
  const dates = useMemo(() => records.map((r) => r.fecha).filter(Boolean).sort(), [records]);
  const minF = dates[0];
  const maxF = dates[dates.length - 1];

  const defaultRange = (g: Gran): [string, string] => {
    const today = todayYMD();
    if (!minF) return [today, today];
    const hi = maxF && maxF > today ? maxF : today;
    const hiY = Number(hi.slice(0, 4));
    const hiM = Number(hi.slice(5, 7)) - 1;
    if (g === "year") return [`${minF.slice(0, 4)}-01-01`, `${hi.slice(0, 4)}-12-31`];
    if (g === "month") {
      const from = new Date(Date.UTC(hiY, hiM - 11, 1)).toISOString().slice(0, 10);
      const to = new Date(Date.UTC(hiY, hiM + 1, 0)).toISOString().slice(0, 10);
      return [from, to];
    }
    return [addDaysYMD(hi, -29), hi]; // día: últimos 30
  };

  const [gran, setGran] = usePersistedState<Gran>("asgn_tc_gran", "month");
  const [range, setRange] = usePersistedState<[string, string]>("asgn_tc_range", defaultRange("month"));
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const changeGran = (g: Gran) => {
    setGran(g);
    setRange(defaultRange(g));
    setHover(null);
  };

  const buckets = useMemo<Bucket[]>(() => {
    const [from, to] = range;
    if (!from || !to || from > to) return [];
    const counts: Record<string, number> = {};
    for (const r of records) {
      const f = r.fecha;
      if (!f || f < from || f > to) continue;
      const key = gran === "day" ? f : gran === "month" ? f.slice(0, 7) : f.slice(0, 4);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const out: Bucket[] = [];
    if (gran === "year") {
      for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++)
        out.push({ key: String(y), label: String(y), count: counts[String(y)] ?? 0 });
    } else if (gran === "month") {
      let y = Number(from.slice(0, 4));
      let m = Number(from.slice(5, 7)) - 1;
      const ey = Number(to.slice(0, 4));
      const em = Number(to.slice(5, 7)) - 1;
      let guard = 0;
      while ((y < ey || (y === ey && m <= em)) && guard < 600) {
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        out.push({ key, label: `${MES[m]} ${y}`, count: counts[key] ?? 0 });
        m++;
        if (m > 11) { m = 0; y++; }
        guard++;
      }
    } else {
      let cur = from;
      let guard = 0;
      while (cur <= to && guard < 1000) {
        const d = new Date(cur + "T00:00:00Z");
        out.push({ key: cur, label: `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`, count: counts[cur] ?? 0 });
        cur = addDaysYMD(cur, 1);
        guard++;
      }
    }
    return out;
  }, [records, range, gran]);

  const total = buckets.reduce((s, b) => s + b.count, 0);

  // Geometría
  const W = 720, H = 240, PL = 30, PR = 10, PT = 14, PB = 26;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const baseY = PT + plotH;
  const n = buckets.length;
  const niceMax = niceCeil(Math.max(1, ...buckets.map((b) => b.count)));
  const step = plotW / Math.max(1, n);
  const barW = Math.max(1.5, Math.min(step * 0.6, 28));
  const cx = (i: number) => PL + (i + 0.5) * step;
  const yFor = (c: number) => PT + plotH - (c / niceMax) * plotH;
  const pts = buckets.map((b, i) => [cx(i), yFor(b.count)] as [number, number]);
  const linePath = smoothPath(pts);
  const areaPath = n > 0 ? `${linePath} L ${cx(n - 1)},${baseY} L ${cx(0)},${baseY} Z` : "";
  const gridVals = [0, niceMax / 2, niceMax];
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  // Interacción: cubo bajo el cursor + posición del tooltip.
  const onMove = (clientX: number) => {
    const el = svgRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const xVB = ((clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round((xVB - PL) / step - 0.5)));
    setHover(i);
  };
  const hb = hover != null && hover < n ? buckets[hover] : null;
  const hx = hb ? cx(hover!) : 0;
  const hy = hb ? yFor(hb.count) : 0;
  const tipLeft = Math.max(13, Math.min(87, (hx / W) * 100));
  const tipTopPct = (hy / H) * 100;
  const tipBelow = tipTopPct < 28;

  return (
    <div>
      {/* Controles */}
      <div className="hp-filters" style={{ marginBottom: 8 }}>
        {([
          { k: "day", label: "Día" },
          { k: "month", label: "Mes" },
          { k: "year", label: "Año" },
        ] as const).map((o) => (
          <button
            key={o.k}
            className="role-chip"
            onClick={() => changeGran(o.k)}
            style={gran === o.k ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="tc-range">
        <input type="date" value={range[0]} max={range[1]} onChange={(e) => setRange([e.target.value, range[1]])} />
        <span className="tc-range-sep">→</span>
        <input type="date" value={range[1]} min={range[0]} onChange={(e) => setRange([range[0], e.target.value])} />
      </div>

      {n === 0 || total === 0 ? (
        <div className="spotlight-empty" style={{ padding: 24 }}>
          {n === 0 ? "Rango de fechas inválido." : "Sin asignaciones en este rango."}
        </div>
      ) : (
        <div className="tc-wrap">
          <svg
            ref={svgRef}
            className="tc-svg"
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label="Actividad en el tiempo"
            onMouseMove={(e) => onMove(e.clientX)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={(e) => onMove(e.touches[0].clientX)}
            onTouchMove={(e) => onMove(e.touches[0].clientX)}
            onTouchEnd={() => setHover(null)}
          >
            <defs>
              <linearGradient id="tcBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--accent)" }} />
                <stop offset="100%" style={{ stopColor: "var(--accent2)" }} />
              </linearGradient>
            </defs>

            {/* Rejilla + etiquetas Y */}
            {gridVals.map((v, i) => {
              const y = yFor(v);
              return (
                <g key={i}>
                  <line x1={PL} y1={y} x2={W - PR} y2={y} style={{ stroke: "var(--border)" }} strokeWidth={1} strokeDasharray={i === 0 ? "0" : "3 3"} />
                  <text x={PL - 6} y={y + 3} textAnchor="end" style={{ fill: "var(--text3)", fontSize: "12px" }}>
                    {Math.round(v)}
                  </text>
                </g>
              );
            })}

            {/* Banda + guía vertical del cubo bajo el cursor */}
            {hb && (
              <>
                <rect x={hx - step / 2} y={PT} width={step} height={plotH} style={{ fill: "var(--accent)", opacity: 0.07 }} />
                <line x1={hx} y1={PT} x2={hx} y2={baseY} style={{ stroke: "var(--accent2)", opacity: 0.5 }} strokeWidth={1} strokeDasharray="3 3" />
              </>
            )}

            {/* Barras */}
            {buckets.map((b, i) => {
              const y = yFor(b.count);
              return (
                <rect
                  key={b.key}
                  x={cx(i) - barW / 2}
                  y={y}
                  width={barW}
                  height={Math.max(0, baseY - y)}
                  rx={2}
                  style={{ fill: "url(#tcBar)", opacity: hover == null || hover === i ? 1 : 0.5 }}
                />
              );
            })}

            {/* Área + línea de tendencia */}
            <path d={areaPath} style={{ fill: "var(--accent)", opacity: 0.1 }} />
            <path d={linePath} style={{ fill: "none", stroke: "var(--accent2)" }} strokeWidth={2} />

            {/* Punto resaltado */}
            {hb && (
              <circle cx={hx} cy={hy} r={4} style={{ fill: "var(--accent2)", stroke: "var(--surface)" }} strokeWidth={2} />
            )}

            {/* Etiquetas X */}
            {buckets.map((b, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text key={b.key} x={cx(i)} y={H - 8} textAnchor="middle" style={{ fill: "var(--text3)", fontSize: "11px" }}>
                  {b.label}
                </text>
              ) : null,
            )}
          </svg>

          {/* Tooltip flotante */}
          {hb && (
            <div
              className="tc-tip"
              style={{
                left: `${tipLeft}%`,
                top: `${tipTopPct}%`,
                transform: tipBelow ? "translate(-50%, 16px)" : "translate(-50%, calc(-100% - 14px))",
              }}
            >
              <div className="tc-tip-title">{hb.label}</div>
              <div className="tc-tip-row">
                <span className="tc-tip-dot" />
                <span className="tc-tip-val">{hb.count}</span> asignaci{hb.count === 1 ? "ón" : "ones"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
