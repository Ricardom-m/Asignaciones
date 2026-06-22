"use client";

import { useEffect, useRef, useState } from "react";

// Cuenta de 0 → target con requestAnimationFrame (easeOutCubic). Sin dependencias.
// Respeta prefers-reduced-motion: si el usuario lo pide, muestra el valor directo.
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    if (typeof target !== "number" || !Number.isFinite(target)) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      prev.current = target;
      return;
    }
    const from = prev.current === target ? 0 : prev.current;
    prev.current = target;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

function AnimatedNumber({ value }: { value: number }) {
  const v = useCountUp(value);
  return <>{v.toLocaleString("es-MX")}</>;
}

// Tarjeta de estadística para el dashboard.
export function StatCard({
  value,
  label,
  hint,
  accent,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="stat-card anim-zoom">
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

// Barra horizontal (conteo relativo) para "personas por rol".
export function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-row-head">
        <span className="bar-row-label">{label}</span>
        <span className="bar-row-value">{value}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
