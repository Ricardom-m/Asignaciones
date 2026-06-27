"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMeetingConfig, useMeetingDetail } from "@/lib/hooks";
import { useIsAdmin } from "@/components/UserContext";
import { useToast } from "@/components/Toast";
import { semanaRango, updateMeetingConfig, setMeetingRelato } from "@/lib/client";

// Título del programa: fijo (siempre el mismo).
const TITULO_PROGRAMA = "Programa para la reunión de entre semana";

// Encabezado de la reunión: congregación (editable por admin), título fijo,
// semana auto-calculada y relato a leer (editable). El `children` (selector de
// fecha) va en la misma tarjeta para que quede compacto.
export function ReunionHeader({ fecha, children }: { fecha: string; children?: ReactNode }) {
  const isAdmin = useIsAdmin();
  const { config, mutate: mutateConfig } = useMeetingConfig();
  const { relato, mutate: mutateRelato } = useMeetingDetail(fecha || null);
  const toast = useToast();

  const [cong, setCong] = useState(config.congregacion ?? "");
  useEffect(() => setCong(config.congregacion ?? ""), [config.congregacion]);
  const [rel, setRel] = useState(relato ?? "");
  useEffect(() => setRel(relato ?? ""), [relato]);

  const saveCong = async () => {
    const v = cong.trim();
    if (v === (config.congregacion ?? "")) return;
    try {
      await mutateConfig(updateMeetingConfig({ weekdays: config.weekdays, weeks: config.weeks, congregacion: v || null }), {
        optimisticData: { ...config, congregacion: v || null },
        revalidate: false,
      });
      toast("💾 Congregación guardada", "success");
    } catch (e) {
      setCong(config.congregacion ?? "");
      toast("❌ " + (e as Error).message, "error");
    }
  };

  const saveRel = async () => {
    if (!fecha) return;
    const v = rel.trim();
    if (v === (relato ?? "")) return;
    try {
      await mutateRelato(setMeetingRelato(fecha, v || null), { optimisticData: { relato: v || null }, revalidate: false });
      toast("💾 Relato guardado", "success");
    } catch (e) {
      setRel(relato ?? "");
      toast("❌ " + (e as Error).message, "error");
    }
  };

  return (
    <div className="content-card reunion-header">
      <div className="rh-detalles">
        {isAdmin ? (
          <input
            className="rh-cong rh-cong-input"
            value={cong}
            onChange={(e) => setCong(e.target.value)}
            onBlur={saveCong}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Nombre de la congregación"
            aria-label="Nombre de la congregación"
          />
        ) : (
          <div className="rh-cong">{config.congregacion || "Congregación"}</div>
        )}
        <div className="rh-titulo">{TITULO_PROGRAMA}</div>
        <div className="rh-semana-row">
          <span className="rh-semana">{fecha ? semanaRango(fecha) : ""}</span>
          <span className="rh-sep" aria-hidden>|</span>
          <input
            className="rh-relato-input"
            value={rel}
            onChange={(e) => setRel(e.target.value)}
            onBlur={saveRel}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Relato a leer (ej. Jeremías 9, 10)"
            aria-label="Relato a leer"
          />
        </div>
      </div>
      {children && <div className="rh-fecha">{children}</div>}
    </div>
  );
}
